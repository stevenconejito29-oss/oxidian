import { supabase } from './supabase'
import { DEFAULT_STORE_ID, normalizeStoreId, shouldUseLocalPreviewDefaults } from './currentStore'
import { PUBLIC_STORE_SETTING_KEYS } from './storeConfigVisibility'

function buildSettingsSelect(client, tableName, keys = []) {
  let query = client.from(tableName).select('key, value')
  if (Array.isArray(keys) && keys.length > 0) {
    query = query.in('key', keys)
  }
  return query
}

function isMissingRelation(error) {
  return /does not exist|schema cache|relation/i.test(String(error?.message || ''))
}

function isSoftCompatibilityError(error) {
  const message = String(error?.message || '')
  return (
    isMissingRelation(error)
    || /permission denied/i.test(message)
    || /column .* does not exist/i.test(message)
    || /invalid input syntax for type uuid/i.test(message)
  )
}

function toEntriesMap(rows = []) {
  return Object.fromEntries((rows || []).map(row => [row.key, row.value]))
}

function toOrderedEntries(map = {}) {
  return Object.entries(map)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value }))
}

export async function loadMergedSettingsMap(storeId = DEFAULT_STORE_ID, client = supabase, options = {}) {
  const normalizedStoreId = normalizeStoreId(storeId)
  const visibility = String(options.visibility || 'full').trim().toLowerCase()
  const scopedKeys = visibility === 'public' ? PUBLIC_STORE_SETTING_KEYS : []

  if (shouldUseLocalPreviewDefaults(normalizedStoreId)) {
    return {}
  }

  // Tienda por defecto: solo carga tabla global
  if (normalizedStoreId === DEFAULT_STORE_ID) {
    const globalRes = await buildSettingsSelect(client, 'settings', scopedKeys)
    if (globalRes.error) {
      if (isSoftCompatibilityError(globalRes.error)) return {}
      throw globalRes.error
    }
    return toEntriesMap(globalRes.data)
  }

  // Tienda específica: carga global Y scoped en paralelo
  const [globalRes, scopedRes] = await Promise.all([
    buildSettingsSelect(client, 'settings', scopedKeys),
    buildSettingsSelect(client, 'store_settings', scopedKeys).eq('store_id', normalizedStoreId),
  ])

  if (globalRes.error) {
    if (isSoftCompatibilityError(globalRes.error)) return {}
    throw globalRes.error
  }

  if (scopedRes.error) {
    if (isSoftCompatibilityError(scopedRes.error)) return toEntriesMap(globalRes.data)
    throw scopedRes.error
  }

  // Los settings scoped tienen prioridad sobre los globales
  return {
    ...toEntriesMap(globalRes.data),
    ...toEntriesMap(scopedRes.data),
  }
}

export async function loadPublicMergedSettingsMap(storeId = DEFAULT_STORE_ID, client = supabase) {
  return loadMergedSettingsMap(storeId, client, { visibility: 'public' })
}

export async function loadMergedSettingsEntries(storeId = DEFAULT_STORE_ID, client = supabase, options = {}) {
  const map = await loadMergedSettingsMap(storeId, client, options)
  return toOrderedEntries(map)
}

export async function upsertScopedSetting(key, value, storeId = DEFAULT_STORE_ID, client = supabase) {
  const normalizedStoreId = normalizeStoreId(storeId)

  if (normalizedStoreId === DEFAULT_STORE_ID) {
    const { error } = await client
      .from('settings')
      .upsert({ key, value: String(value ?? '') }, { onConflict: 'key' })
    if (error) throw error
    return
  }

  const { error } = await client
    .from('store_settings')
    .upsert({ store_id: normalizedStoreId, key, value: String(value ?? '') }, { onConflict: 'store_id,key' })

  if (error) {
    if (isMissingRelation(error)) {
      const fallback = await client
        .from('settings')
        .upsert({ key, value: String(value ?? '') }, { onConflict: 'key' })
      if (fallback.error) throw fallback.error
      return
    }
    throw error
  }
}
