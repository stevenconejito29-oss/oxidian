import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'

const STORE_LEVEL_ID_SEPARATOR = '__'

export function isMissingStoreScope(error) {
  return /store_id.*does not exist|column .*store_id.* does not exist|schema cache|Could not find the 'store_id' column/i.test(
    String(error?.message || error?.details || '')
  )
}

export function isMissingLoyaltySlug(error) {
  return /column .*slug.* does not exist|schema cache|Could not find the 'slug' column/i.test(
    String(error?.message || error?.details || '')
  )
}

export function extractLevelSlug(levelId) {
  const raw = String(levelId || '').trim()
  if (!raw) return ''
  const separatorIndex = raw.indexOf(STORE_LEVEL_ID_SEPARATOR)
  if (separatorIndex <= 0) return raw
  return raw.slice(separatorIndex + STORE_LEVEL_ID_SEPARATOR.length)
}

export function buildStoreScopedLevelId(storeId, slug) {
  const normalizedStoreId = normalizeStoreId(storeId)
  const normalizedSlug = extractLevelSlug(slug)
  if (!normalizedSlug) return ''
  if (normalizedStoreId === DEFAULT_STORE_ID) return normalizedSlug
  return `${normalizedStoreId}${STORE_LEVEL_ID_SEPARATOR}${normalizedSlug}`
}

export function normalizeLevelRecord(record, storeId = DEFAULT_STORE_ID) {
  if (!record) return null
  const normalizedStoreId = normalizeStoreId(record.store_id || storeId)
  const slug = extractLevelSlug(record.slug || record.id)
  if (!slug) return null

  return {
    ...record,
    store_id: normalizedStoreId,
    db_id: record.id,
    slug,
    id: slug,
  }
}

export function normalizeVisitorLevel(levelValue) {
  return extractLevelSlug(levelValue)
}
