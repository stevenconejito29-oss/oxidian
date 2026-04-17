import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function json(res, status, payload) {
  res.status(status).json(payload)
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks)
  if (!raw.length) return {}
  try { return JSON.parse(raw.toString('utf8')) } catch { return {} }
}

function buildJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig    = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function buildSupabaseToken(role, storeId, jwtSecret) {
  if (!jwtSecret) return ''
  const now = Math.floor(Date.now() / 1000)
  return buildJwt({
    aud: 'authenticated',
    iss: 'oxidian-app',
    iat: now,
    exp: now + 8 * 60 * 60,
    sub: 'oxidian:super-admin',
    role: 'authenticated',
    app_role: role,
    user_role: role,
    store_id: storeId,
    is_super_admin: role === 'super_admin',
  }, jwtSecret)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  try {
    const body     = await readJsonBody(req)
    const scope    = String(body.scope    || '').trim().toLowerCase()
    const password = String(body.password || '').trim()
    const storeId  = String(body.storeId  || 'default').trim() || 'default'
    const username = String(body.username || '').trim().toLowerCase()
    const staffRole = String(body.role   || '').trim().toLowerCase()

    if (!password) return json(res, 400, { error: 'La contrasena es obligatoria' })

    const supabaseUrl  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const jwtSecret    = process.env.SUPABASE_JWT_SECRET || ''

    if (!supabaseUrl || !serviceKey) {
      return json(res, 500, { error: 'Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel' })
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const inputHash = sha256Hex(password)
    const ttl = 8 * 60 * 60 * 1000

    // ── OXIDIAN super admin ──────────────────────────────────────
    if (scope === 'oxidian') {
      const { data, error } = await db
        .from('settings')
        .select('key,value')
        .in('key', ['oxidian_admin_password_hash', 'admin_password_hash'])
      if (error) return json(res, 500, { error: error.message })
      const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
      const stored = map.oxidian_admin_password_hash || map.admin_password_hash || ''
      if (!stored)       return json(res, 401, { error: 'No hay contrasena configurada' })
      if (stored !== inputHash) return json(res, 401, { error: 'Credenciales incorrectas' })
      return json(res, 200, { session: {
        role: 'super_admin', store_id: 'default', name: 'OXIDIAN', username: 'oxidian',
        permissions: [], auth_expires_at: new Date(Date.now() + ttl).toISOString(),
        supabase_access_token: buildSupabaseToken('super_admin', 'default', jwtSecret),
      }})
    }

    // ── Owner de tienda ──────────────────────────────────────────
    if (scope === 'store-owner') {
      const { data: ss } = await db.from('store_settings')
        .select('value').eq('store_id', storeId).eq('key', 'admin_password_hash').maybeSingle()
      let stored = ss?.value || ''
      if (!stored) {
        const { data: gs } = await db.from('settings')
          .select('value').eq('key', 'admin_password_hash').maybeSingle()
        stored = gs?.value || ''
      }
      if (!stored || stored !== inputHash) return json(res, 401, { error: 'Credenciales incorrectas' })
      return json(res, 200, { session: {
        role: 'owner', store_id: storeId, name: storeId, username: 'owner',
        permissions: [], auth_expires_at: new Date(Date.now() + ttl).toISOString(),
        supabase_access_token: buildSupabaseToken('owner', storeId, jwtSecret),
      }})
    }

    // ── Admin de tienda ──────────────────────────────────────────
    if (scope === 'store-admin') {
      if (!username) return json(res, 400, { error: 'El usuario es obligatorio' })
      const { data: staff } = await db.from('staff_users')
        .select('id,name,username,role,avatar_emoji,permissions,password_hash,active')
        .eq('store_id', storeId).eq('username', username).eq('role', 'admin').eq('active', true).maybeSingle()
      if (!staff || staff.password_hash !== inputHash) return json(res, 401, { error: 'Credenciales incorrectas' })
      let perms = []
      try { perms = Array.isArray(staff.permissions) ? staff.permissions : JSON.parse(staff.permissions || '[]') } catch { perms = [] }
      await db.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', staff.id)
      return json(res, 200, { session: {
        id: staff.id, role: 'admin', store_id: storeId, name: staff.name,
        username: staff.username, avatar: staff.avatar_emoji || '', avatar_emoji: staff.avatar_emoji || '',
        permissions: perms, auth_expires_at: new Date(Date.now() + ttl).toISOString(),
        supabase_access_token: buildSupabaseToken('admin', storeId, jwtSecret),
      }})
    }

    // ── Staff (cocina / repartidor) ──────────────────────────────
    if (scope === 'staff') {
      if (!username) return json(res, 400, { error: 'El usuario es obligatorio' })
      if (!['cocina', 'repartidor'].includes(staffRole)) return json(res, 400, { error: 'Rol no valido' })
      const { data: staff } = await db.from('staff_users')
        .select('id,name,username,role,avatar_emoji,permissions,password_hash,active')
        .eq('store_id', storeId).eq('username', username).eq('role', staffRole).eq('active', true).maybeSingle()
      if (!staff || staff.password_hash !== inputHash) return json(res, 401, { error: 'Credenciales incorrectas' })
      let perms = []
      try { perms = Array.isArray(staff.permissions) ? staff.permissions : JSON.parse(staff.permissions || '[]') } catch { perms = [] }
      await db.from('staff_users').update({ last_login: new Date().toISOString(), is_online: false }).eq('id', staff.id)
      return json(res, 200, { session: {
        id: staff.id, role: staffRole, store_id: storeId, name: staff.name,
        username: staff.username, avatar: staff.avatar_emoji || '', avatar_emoji: staff.avatar_emoji || '',
        permissions: perms, auth_expires_at: new Date(Date.now() + ttl).toISOString(),
        supabase_access_token: buildSupabaseToken(staffRole, storeId, jwtSecret),
      }})
    }

    return json(res, 400, { error: 'Scope de login no soportado' })

  } catch (err) {
    return json(res, 500, { error: err.message || 'Error interno del servidor' })
  }
}
