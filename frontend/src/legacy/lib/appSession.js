import { OXIDIAN_ENTRY_PATH } from './oxidianAccess'

const STORAGE_KEYS = {
  oxidian: 'oxidian_admin',
  admin: 'oxidian_admin_panel',
  cocina: 'oxidian_staff_kitchen',
  repartidor: 'oxidian_staff_riders',
}

function safeParse(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  const time = new Date(expiresAt).getTime()
  if (Number.isNaN(time)) return false
  return Date.now() >= time
}

function storageForKey(key) {
  if (typeof window === 'undefined') return null
  if (key === STORAGE_KEYS.cocina || key === STORAGE_KEYS.repartidor) return window.localStorage
  return window.sessionStorage
}

function resolveRouteKey(pathname = '') {
  if (pathname === OXIDIAN_ENTRY_PATH || /^\/oxidian(?:\/|$)/.test(pathname)) return STORAGE_KEYS.oxidian
  if (/\/pedidos(?:\/|$)/.test(pathname) || /\/branch\/kitchen(?:\/|$)/.test(pathname)) return STORAGE_KEYS.cocina
  if (/\/repartidor(?:\/|$)/.test(pathname) || /\/branch\/riders(?:\/|$)/.test(pathname)) return STORAGE_KEYS.repartidor
  if (/\/branch\/admin(?:\/|$)/.test(pathname)) return STORAGE_KEYS.admin
  if (/\/admin(?:\/|$)/.test(pathname)) return STORAGE_KEYS.admin
  return STORAGE_KEYS.admin
}

export function loadStoredSession(key) {
  if (typeof window === 'undefined') return null
  const storage = storageForKey(key)
  if (!storage) return null

  const value = safeParse(storage.getItem(key))
  if (!value) return null
  if (isExpired(value.auth_expires_at)) {
    storage.removeItem(key)
    return null
  }
  return value
}

export function persistStoredSession(key, payload) {
  if (typeof window === 'undefined') return
  const storage = storageForKey(key)
  if (!storage) return
  storage.setItem(key, JSON.stringify(payload))
}

export function clearStoredSession(key) {
  if (typeof window === 'undefined') return
  const storage = storageForKey(key)
  if (!storage) return
  storage.removeItem(key)
}

export function readCurrentSupabaseAccessToken(fallbackToken = '') {
  if (typeof window === 'undefined') return fallbackToken
  const key = resolveRouteKey(window.location.pathname)
  const session = loadStoredSession(key)
  if (session?.supabase_access_token) return session.supabase_access_token

  // Fallback: si el key de ruta no tiene sesión (ej: owner visitando /branch/kitchen),
  // intentar con el key admin antes de devolver el token anónimo
  if (key !== STORAGE_KEYS.admin) {
    const adminSession = loadStoredSession(STORAGE_KEYS.admin)
    if (adminSession?.supabase_access_token) return adminSession.supabase_access_token
  }

  return fallbackToken
}

export function hasCurrentRouteSession() {
  if (typeof window === 'undefined') return false
  const key = resolveRouteKey(window.location.pathname)
  return Boolean(loadStoredSession(key)?.supabase_access_token)
}

export {
  STORAGE_KEYS,
}
