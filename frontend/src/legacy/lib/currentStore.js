import { useEffect, useState } from 'react'
import { loadStoreConfig } from './storeConfig'
import { supabase } from './supabase'

export const DEFAULT_STORE_ID = 'default'
export const DEFAULT_NICHE = 'food'
const ACTIVE_ADMIN_STORE_KEY = 'cc_active_store_id'
const DOMAIN_STORE_CONTEXT_KEY = 'cc_domain_store_context'
let domainStoreContextPromise = null

export function normalizeStoreId(value) {
  const normalized = String(value || '').trim()
  return normalized || DEFAULT_STORE_ID
}

function normalizeOptionalText(value) {
  return String(value || '').trim()
}

function isLocalHostname(hostname) {
  const normalized = normalizeOptionalText(hostname).toLowerCase()
  return !normalized || normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]'
}

function canUseStoreQueryOverride() {
  if (typeof window === 'undefined') return false
  return Boolean(import.meta.env.DEV) || isLocalHostname(window.location.hostname)
}

export function isLocalPreviewMode() {
  if (typeof window === 'undefined') return Boolean(import.meta.env.DEV)
  return Boolean(import.meta.env.DEV) || isLocalHostname(window.location.hostname)
}

export function isDefaultStoreId(value) {
  return normalizeStoreId(value) === DEFAULT_STORE_ID
}

export function shouldUseLocalPreviewDefaults(storeId = DEFAULT_STORE_ID) {
  return isLocalPreviewMode() && isDefaultStoreId(storeId)
}

function readCachedDomainStoreContext() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DOMAIN_STORE_CONTEXT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.hostname !== window.location.hostname) return null
    if (!parsed.storeId) return null
    return {
      resolvedByDomain: true,
      storeId: normalizeStoreId(parsed.storeId),
      niche: normalizeOptionalText(parsed.niche || DEFAULT_NICHE) || DEFAULT_NICHE,
    }
  } catch {
    return null
  }
}

function writeCachedDomainStoreContext(context) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DOMAIN_STORE_CONTEXT_KEY, JSON.stringify({
      hostname: window.location.hostname,
      storeId: context?.storeId ? normalizeStoreId(context.storeId) : '',
      niche: normalizeOptionalText(context?.niche || ''),
      emoji: normalizeOptionalText(context?.emoji || ''),
    }))
  } catch {
    // Ignorar storage bloqueado o lleno.
  }
}

export function getDesktopBoundStoreId() {
  if (typeof window === 'undefined') return null
  return normalizeStoreId(window.carmocreamDesktopAdmin?.runtimeConfig?.storeId || '')
}

export function getStoredActiveStoreId() {
  if (typeof window === 'undefined') return DEFAULT_STORE_ID
  const requested = getRequestedStoreId()
  if (requested) return requested
  const desktopBound = getDesktopBoundStoreId()
  if (desktopBound && desktopBound !== DEFAULT_STORE_ID) return desktopBound
  const domainContext = readCachedDomainStoreContext()
  if (domainContext?.resolvedByDomain) return domainContext.storeId
  return normalizeStoreId(window.sessionStorage.getItem(ACTIVE_ADMIN_STORE_KEY))
}

export function setStoredActiveStoreId(storeId) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ACTIVE_ADMIN_STORE_KEY, normalizeStoreId(storeId))
}

export function getRequestedStoreId() {
  if (typeof window === 'undefined') return null
  try {
    // 1. Query param solo en desarrollo/local para QA
    if (canUseStoreQueryOverride()) {
      const params = new URLSearchParams(window.location.search)
      const fromQuery = params.get('store')
      if (fromQuery) return normalizeStoreId(fromQuery)
    }

    // 2. Path-based: /s/<slug>/...  — sin redirect, URL permanente
    const pathMatch = window.location.pathname.match(/^\/s\/([^/]+)/)
    if (pathMatch?.[1]) return normalizeStoreId(pathMatch[1])

    return null
  } catch {
    return null
  }
}

export async function resolveDomainStoreContext() {
  if (typeof window === 'undefined') return { resolvedByDomain: false, storeId: null, niche: DEFAULT_NICHE }
  if (isLocalHostname(window.location.hostname)) return { resolvedByDomain: false, storeId: null, niche: DEFAULT_NICHE }

  const cached = readCachedDomainStoreContext()
  if (cached) return cached
  if (domainStoreContextPromise) return domainStoreContextPromise

  domainStoreContextPromise = fetch('/api/middleware/resolve-store', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  })
    .then(async response => {
      if (!response.ok) {
        return { resolvedByDomain: false, storeId: null, niche: DEFAULT_NICHE }
      }

      const payload = await response.json().catch(() => ({}))
      const resolvedStoreId = normalizeOptionalText(
        response.headers.get('x-store-id') || payload?.storeId,
      )

      if (!resolvedStoreId) {
        writeCachedDomainStoreContext(null)
        return { resolvedByDomain: false, storeId: null, niche: DEFAULT_NICHE }
      }

      const context = {
        resolvedByDomain: true,
        storeId: normalizeStoreId(resolvedStoreId),
        niche: normalizeOptionalText(response.headers.get('x-store-niche') || payload?.niche || DEFAULT_NICHE) || DEFAULT_NICHE,
        emoji: normalizeOptionalText(response.headers.get('x-store-emoji') || payload?.emoji || ''),
      }
      writeCachedDomainStoreContext(context)
      return context
    })
    .catch(() => ({ resolvedByDomain: false, storeId: null, niche: DEFAULT_NICHE }))

  return domainStoreContextPromise
}

export async function resolveConfiguredStoreContext(client = supabase) {
  const domainContext = await resolveDomainStoreContext()
  if (domainContext.resolvedByDomain && domainContext.storeId) {
    setStoredActiveStoreId(domainContext.storeId)
    return domainContext
  }

  const requested = getRequestedStoreId()
  if (requested) {
    return { resolvedByDomain: false, storeId: requested, niche: DEFAULT_NICHE }
  }

  const desktopBound = getDesktopBoundStoreId()
  if (desktopBound && desktopBound !== DEFAULT_STORE_ID) {
    return { resolvedByDomain: false, storeId: desktopBound, niche: DEFAULT_NICHE }
  }

  const config = await loadStoreConfig(DEFAULT_STORE_ID, client, { visibility: 'public' }).catch(() => null)
  return {
    resolvedByDomain: false,
    storeId: normalizeStoreId(config?.store_code || DEFAULT_STORE_ID),
    niche: normalizeOptionalText(config?.business_type || DEFAULT_NICHE) || DEFAULT_NICHE,
  }
}

export async function resolveConfiguredStoreId(client = supabase) {
  const context = await resolveConfiguredStoreContext(client)
  return normalizeStoreId(context?.storeId || DEFAULT_STORE_ID)
}

export function useResolvedStoreId(initialValue = DEFAULT_STORE_ID) {
  const [storeId, setStoreId] = useState(normalizeStoreId(initialValue))

  useEffect(() => {
    let active = true
    resolveConfiguredStoreContext()
      .then(context => {
        if (!active) return
        setStoreId(normalizeStoreId(context?.storeId || DEFAULT_STORE_ID))
      })
      .catch(() => {
        if (active) setStoreId(DEFAULT_STORE_ID)
      })
    return () => { active = false }
  }, [])

  return storeId
}
