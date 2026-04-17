import { supabase } from './supabase'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const DEFAULT_STORE_ID = 'default'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function normalizeStoreId(value) {
  return String(value || '').trim() || DEFAULT_STORE_ID
}

function buildLocalSession(payload) {
  return {
    id: payload.id || null,
    name: payload.name || '',
    username: payload.username || '',
    role: payload.role,
    store_id: payload.store_id || DEFAULT_STORE_ID,
    avatar: payload.avatar || '',
    avatar_emoji: payload.avatar_emoji || payload.avatar || '',
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    auth_expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    supabase_access_token: '',
  }
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')))
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function passwordMatches(storedHash, plainPassword, hashHex) {
  if (!storedHash || !plainPassword) return false
  if (storedHash.length === 64) return storedHash === hashHex
  return storedHash === plainPassword
}

function canUseLocalFallback() {
  return typeof window !== 'undefined' && LOCAL_HOSTS.has(window.location.hostname)
}

async function requestLocalFallback(payload) {
  const scope = String(payload.scope || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const hashHex = await sha256Hex(password)

  if (scope === 'oxidian') {
    const { data, error } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['oxidian_admin_password_hash', 'admin_password_hash'])

    if (error) throw new Error(error.message || 'No pude validar el acceso')
    const settingsMap = Object.fromEntries((data || []).map(row => [row.key, row.value]))
    const storedHash = settingsMap.oxidian_admin_password_hash || settingsMap.admin_password_hash || ''
    if (!passwordMatches(storedHash, password, hashHex)) throw new Error('Credenciales incorrectas')
    return buildLocalSession({
      role: 'super_admin',
      store_id: DEFAULT_STORE_ID,
      name: 'OXIDIAN',
      username: 'oxidian',
    })
  }

  if (scope === 'store-owner') {
    const storeId = normalizeStoreId(payload.storeId)
    const { data: scopedData, error: scopedError } = await supabase
      .from('store_settings')
      .select('value')
      .eq('store_id', storeId)
      .eq('key', 'admin_password_hash')
      .maybeSingle()

    if (scopedError) throw new Error(scopedError.message || 'No pude validar el acceso')
    let storedHash = scopedData?.value || ''

    if (!storedHash) {
      const { data: globalData, error: globalError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin_password_hash')
        .maybeSingle()
      if (globalError) throw new Error(globalError.message || 'No pude validar el acceso')
      storedHash = globalData?.value || ''
    }

    if (!passwordMatches(storedHash, password, hashHex)) throw new Error('Credenciales incorrectas')
    return buildLocalSession({
      role: 'owner',
      store_id: storeId,
      permissions: [],
      name: storeId === DEFAULT_STORE_ID ? 'Store Owner' : `${storeId} owner`,
      username: 'owner',
    })
  }

  if (scope === 'store-admin' || scope === 'staff') {
    const storeId = normalizeStoreId(payload.storeId)
    const username = String(payload.username || '').trim().toLowerCase()
    const role = scope === 'store-admin' ? 'admin' : String(payload.role || '').trim().toLowerCase()
    const { data, error } = await supabase
      .from('staff_users')
      .select('id,name,username,role,avatar_emoji,permissions,password_hash,active')
      .eq('store_id', storeId)
      .eq('username', username)
      .eq('role', role)
      .eq('active', true)
      .maybeSingle()

    if (error) throw new Error(error.message || 'No pude validar el acceso')
    if (!data || !passwordMatches(data.password_hash, password, hashHex)) throw new Error('Credenciales incorrectas')

    if (scope === 'staff') {
      await supabase.from('staff_users').update({
        last_login: new Date().toISOString(),
        is_online: false,
      }).eq('id', data.id).eq('store_id', storeId)
    }

    let permissions = []
    if (Array.isArray(data.permissions)) permissions = data.permissions
    else {
      try {
        permissions = JSON.parse(data.permissions || '[]')
      } catch {
        permissions = []
      }
    }

    return buildLocalSession({
      id: data.id,
      name: data.name,
      username: data.username,
      role: data.role,
      store_id: storeId,
      avatar: data.avatar_emoji || '',
      avatar_emoji: data.avatar_emoji || '',
      permissions,
    })
  }

  throw new Error('Scope de login no soportado')
}

export async function requestAppLogin(payload) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    let data = {}
    try {
      data = await response.json()
    } catch {
      data = {}
    }

    if (!response.ok || !data?.session) {
      throw new Error(data?.error || 'No pude validar el acceso')
    }

    return data.session
  } catch (error) {
    if (!canUseLocalFallback()) throw error
    return requestLocalFallback(payload)
  }
}
