import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || ''
const SESSION_TTL_HOURS = Math.max(1, Number.parseInt(process.env.APP_SESSION_TTL_HOURS || '8', 10) || 8)
const DEFAULT_STORE_ID = 'default'

function requireAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

export function normalizeStoreId(value) {
  return normalizeText(value, DEFAULT_STORE_ID) || DEFAULT_STORE_ID
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function passwordsMatch(storedHash, inputPassword) {
  if (!storedHash || !inputPassword) return false
  if (storedHash.length === 64) return sha256Hex(inputPassword) === storedHash
  return storedHash === inputPassword
}

function buildSupabaseAccessToken(payload) {
  if (!SUPABASE_JWT_SECRET) return ''

  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + (SESSION_TTL_HOURS * 60 * 60)

  return jwt.sign({
    aud: 'authenticated',
    iss: 'oxidian-app',
    iat: issuedAt,
    exp: expiresAt,
    sub: payload.subject,
    role: 'authenticated',
    email: payload.email || `${payload.subject}@oxidian.local`,
    user_role: payload.role,
    app_role: payload.role,
    session_scope: payload.scope,
    store_id: payload.store_id || null,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    actor_id: payload.actor_id || null,
    actor_name: payload.actor_name || '',
    is_super_admin: payload.role === 'super_admin',
  }, SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
  })
}

function buildSessionPayload(payload) {
  return {
    id: payload.id || null,
    name: payload.name || '',
    username: payload.username || '',
    role: payload.role,
    store_id: payload.store_id || DEFAULT_STORE_ID,
    avatar: payload.avatar || '',
    avatar_emoji: payload.avatar_emoji || payload.avatar || '',
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    auth_expires_at: new Date(Date.now() + (SESSION_TTL_HOURS * 60 * 60 * 1000)).toISOString(),
    supabase_access_token: buildSupabaseAccessToken({
      subject: payload.subject,
      role: payload.role,
      scope: payload.scope,
      store_id: payload.store_id,
      permissions: payload.permissions,
      actor_id: payload.id,
      actor_name: payload.name,
      email: payload.email,
    }),
  }
}

async function loadGlobalPasswordHash(client, keys) {
  const { data, error } = await client
    .from('settings')
    .select('key,value')
    .in('key', keys)

  if (error) throw error

  const settingsMap = Object.fromEntries((data || []).map(row => [row.key, row.value]))
  for (const key of keys) {
    if (settingsMap[key]) return settingsMap[key]
  }
  return ''
}

async function authenticateOxidian(client, password) {
  const storedHash = await loadGlobalPasswordHash(client, ['oxidian_admin_password_hash', 'admin_password_hash'])
  if (!passwordsMatch(storedHash, password)) return null

  return buildSessionPayload({
    role: 'super_admin',
    scope: 'oxidian',
    store_id: DEFAULT_STORE_ID,
    name: 'OXIDIAN',
    username: 'oxidian',
    subject: 'oxidian:super-admin',
  })
}

async function authenticateStoreOwner(client, password, storeId) {
  const scopedStoreId = normalizeStoreId(storeId)
  const { data: scopedData, error: scopedError } = await client
    .from('store_settings')
    .select('value')
    .eq('store_id', scopedStoreId)
    .eq('key', 'admin_password_hash')
    .maybeSingle()

  if (scopedError) throw scopedError

  let storedHash = scopedData?.value || ''
  if (!storedHash) {
    storedHash = await loadGlobalPasswordHash(client, ['admin_password_hash'])
  }

  if (!passwordsMatch(storedHash, password)) return null

  return buildSessionPayload({
    role: 'owner',
    scope: 'store-owner',
    store_id: scopedStoreId,
    permissions: [],
    name: scopedStoreId === DEFAULT_STORE_ID ? 'Store Owner' : `${scopedStoreId} owner`,
    username: 'owner',
    subject: `owner:${scopedStoreId}`,
  })
}

async function authenticateStaffRecord(client, { storeId, username, password, role }) {
  const scopedStoreId = normalizeStoreId(storeId)
  const normalizedUsername = normalizeText(username).toLowerCase()
  const normalizedRole = normalizeText(role).toLowerCase()

  if (!normalizedUsername) throw new Error('El usuario es obligatorio')
  if (!normalizedRole) throw new Error('El rol es obligatorio')

  const { data, error } = await client
    .from('staff_users')
    .select('id,name,username,role,avatar_emoji,permissions,password_hash,active')
    .eq('store_id', scopedStoreId)
    .eq('username', normalizedUsername)
    .eq('role', normalizedRole)
    .eq('active', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  if (!passwordsMatch(data.password_hash, password)) return null

  const nextLastLogin = new Date().toISOString()
  const patch = normalizedRole === 'admin'
    ? { last_login: nextLastLogin }
    : { last_login: nextLastLogin, is_online: false }

  const { error: updateError } = await client
    .from('staff_users')
    .update(patch)
    .eq('id', data.id)
    .eq('store_id', scopedStoreId)

  if (updateError) throw updateError

  let permissions = []
  if (Array.isArray(data.permissions)) permissions = data.permissions
  else {
    try {
      permissions = JSON.parse(data.permissions || '[]')
    } catch {
      permissions = []
    }
  }

  return buildSessionPayload({
    id: data.id,
    name: data.name,
    username: data.username,
    role: normalizedRole,
    store_id: scopedStoreId,
    avatar: data.avatar_emoji || '',
    avatar_emoji: data.avatar_emoji || '',
    permissions,
    subject: `${normalizedRole}:${scopedStoreId}:${data.id}`,
  })
}

export async function authenticateAppLogin(payload) {
  const client = requireAdminClient()
  const scope = normalizeText(payload.scope).toLowerCase()
  const password = normalizeText(payload.password)

  if (!password) throw new Error('La contrasena es obligatoria')

  switch (scope) {
    case 'oxidian':
      return authenticateOxidian(client, password)
    case 'store-owner':
      return authenticateStoreOwner(client, password, payload.storeId)
    case 'store-admin':
      return authenticateStaffRecord(client, {
        storeId: payload.storeId,
        username: payload.username,
        password,
        role: 'admin',
      })
    case 'staff': {
      const role = normalizeText(payload.role).toLowerCase()
      if (!['cocina', 'repartidor'].includes(role)) {
        throw new Error('Rol de staff no valido')
      }
      return authenticateStaffRecord(client, {
        storeId: payload.storeId,
        username: payload.username,
        password,
        role,
      })
    }
    default:
      throw new Error('Scope de login no soportado')
  }
}
