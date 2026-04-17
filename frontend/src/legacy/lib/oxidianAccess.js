const DEFAULT_OXIDIAN_ENTRY_SLUG = 'nexo-control'

function normalizeRouteSlug(value, fallback = DEFAULT_OXIDIAN_ENTRY_SLUG) {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || fallback
}

export const OXIDIAN_ENTRY_SLUG = normalizeRouteSlug(
  import.meta.env.VITE_OXIDIAN_ENTRY_SLUG || import.meta.env.VITE_OXIDIAN_ENTRY_PATH,
)

export const OXIDIAN_ENTRY_PATH = `/${OXIDIAN_ENTRY_SLUG}`

export function isOxidianAccessPath(pathname = '') {
  const normalizedPath = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalizedPath === OXIDIAN_ENTRY_PATH || normalizedPath === '/oxidian'
}
