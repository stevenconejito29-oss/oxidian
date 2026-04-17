import { supabase } from './supabase'
import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'
import {
  isMissingLoyaltySlug,
  isMissingStoreScope,
  normalizeLevelRecord,
} from './loyaltyScope'

const FALLBACK_PRIORITY_LEVEL_IDS = ['oro', 'diamante']
const PRIORITY_CACHE_TTL_MS = 60 * 1000

const priorityCache = new Map()

function getCacheEntry(storeId) {
  const normalizedStoreId = normalizeStoreId(storeId)
  if (!priorityCache.has(normalizedStoreId)) {
    priorityCache.set(normalizedStoreId, {
      ids: [...FALLBACK_PRIORITY_LEVEL_IDS],
      cachedAt: 0,
      inFlightPromise: null,
    })
  }
  return priorityCache.get(normalizedStoreId)
}

export function getFallbackPriorityLevelIds() {
  return [...FALLBACK_PRIORITY_LEVEL_IDS]
}

export async function fetchPriorityLevelIds({ force = false, storeId = DEFAULT_STORE_ID } = {}) {
  const normalizedStoreId = normalizeStoreId(storeId)
  const cacheEntry = getCacheEntry(normalizedStoreId)
  const now = Date.now()

  if (!force && cacheEntry.cachedAt && now - cacheEntry.cachedAt < PRIORITY_CACHE_TTL_MS) {
    return [...cacheEntry.ids]
  }

  if (cacheEntry.inFlightPromise) return cacheEntry.inFlightPromise

  const variants = [
    { columns: 'id,slug,store_id,priority_delivery,active', scoped: true },
    { columns: 'id,store_id,priority_delivery,active', scoped: true },
    { columns: 'id,priority_delivery,active', scoped: false },
  ]

  cacheEntry.inFlightPromise = (async () => {
    for (const variant of variants) {
      let query = supabase
        .from('loyalty_rewards')
        .select(variant.columns)
        .eq('active', true)

      if (variant.scoped) query = query.eq('store_id', normalizedStoreId)

      const { data, error } = await query
      if (error) {
        if (isMissingStoreScope(error) || isMissingLoyaltySlug(error)) continue
        return [...cacheEntry.ids]
      }

      const nextIds = (Array.isArray(data) ? data : [])
        .map(level => normalizeLevelRecord(level, normalizedStoreId))
        .filter(level => level?.priority_delivery === true && level?.id)
        .map(level => level.id)

      cacheEntry.ids = nextIds.length ? nextIds : [...FALLBACK_PRIORITY_LEVEL_IDS]
      cacheEntry.cachedAt = Date.now()
      return [...cacheEntry.ids]
    }

    return [...cacheEntry.ids]
  })()
    .catch(() => [...cacheEntry.ids])
    .finally(() => {
      cacheEntry.inFlightPromise = null
    })

  return cacheEntry.inFlightPromise
}

export function isPriorityClubOrder(order, priorityLevelIds = FALLBACK_PRIORITY_LEVEL_IDS) {
  if (!order?.club_level) return false
  return new Set(priorityLevelIds).has(order.club_level)
}

export function compareOrdersByClubPriority(a, b, priorityLevelIds = FALLBACK_PRIORITY_LEVEL_IDS, timeField = 'created_at') {
  const aPriority = isPriorityClubOrder(a, priorityLevelIds)
  const bPriority = isPriorityClubOrder(b, priorityLevelIds)

  if (aPriority !== bPriority) return aPriority ? -1 : 1

  const aTime = new Date(a?.[timeField] || a?.created_at || 0).getTime()
  const bTime = new Date(b?.[timeField] || b?.created_at || 0).getTime()
  return aTime - bTime
}

export function sortOrdersByClubPriority(orders, priorityLevelIds = FALLBACK_PRIORITY_LEVEL_IDS, timeField = 'created_at') {
  return [...(Array.isArray(orders) ? orders : [])].sort((a, b) =>
    compareOrdersByClubPriority(a, b, priorityLevelIds, timeField)
  )
}
