const metaEnv = typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {}

export function resolveBackendBase({
  explicitBase = metaEnv.VITE_BACKEND_URL,
  dev = metaEnv.DEV,
} = {}) {
  const cleanBase = String(explicitBase || '').trim().replace(/\/$/, '')
  if (cleanBase) return cleanBase
  return dev ? '' : '/api/backend'
}

export function buildBackendUrl(path, options) {
  const base = resolveBackendBase(options)
  const rawPath = String(path || '')
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return `${base}${normalizedPath}`
}
