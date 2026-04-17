import { loadStoreConfig } from '../../../legacy/lib/storeConfig'
import { DEFAULT_STORE_ID } from '../../../legacy/lib/currentStore'
import { OXIDIAN_THEME_CONFIG } from '../../../core/config/brand'

function hasExplicitStoreRoute(pathname = '', search = '') {
  const hasStoreQuery = new URLSearchParams(search).get('store')
  return Boolean(hasStoreQuery) || /^\/s\/[^/]+/.test(pathname)
}

function isPlatformRoute(pathname = '', search = '', storeContext = { resolvedByDomain: false }) {
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/onboarding')) return true
  return pathname === '/' && !hasExplicitStoreRoute(pathname, search) && !storeContext?.resolvedByDomain
}

export async function resolveRouteThemeConfig(
  pathname = window.location.pathname,
  search = window.location.search,
  storeContext = { storeId: DEFAULT_STORE_ID, resolvedByDomain: false },
) {
  if (isPlatformRoute(pathname, search, storeContext)) {
    return OXIDIAN_THEME_CONFIG
  }

  const config = await loadStoreConfig(storeContext?.storeId || DEFAULT_STORE_ID, undefined, {
    visibility: 'public',
  }).catch(() => null)

  return config || OXIDIAN_THEME_CONFIG
}

