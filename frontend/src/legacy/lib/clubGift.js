import { getClubLevelMeta } from './clubAccess'

export function normalizeGiftCadence(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function normalizeSurpriseGiftLevel(level) {
  return {
    ...level,
    surprise_gift: level?.surprise_gift === true,
    surprise_gift_type: level?.surprise_gift_type || '',
    surprise_gift_item_id: level?.surprise_gift_item_id || '',
    surprise_gift_every_orders: normalizeGiftCadence(level?.surprise_gift_every_orders),
    surprise_gift_note: level?.surprise_gift_note || '',
  }
}

export function hasConfiguredSurpriseGift(level) {
  return Boolean(
    level?.surprise_gift === true &&
    level?.surprise_gift_type &&
    level?.surprise_gift_item_id &&
    normalizeGiftCadence(level?.surprise_gift_every_orders) > 0
  )
}

export function hasOperationalSurpriseGift(level) {
  const normalizedLevel = normalizeSurpriseGiftLevel(level)
  return hasConfiguredSurpriseGift(normalizedLevel) && normalizedLevel.surprise_gift_type === 'product'
}

export function isGiftOrderItem(item) {
  return item?.is_gift === true
}

function buildGiftSourceCatalog(products = [], combos = []) {
  return {
    product: Array.isArray(products) ? products : [],
    combo: Array.isArray(combos) ? combos : [],
  }
}

function findGiftSource(level, products = [], combos = []) {
  if (!level?.surprise_gift_type || !level?.surprise_gift_item_id) return null

  const catalog = buildGiftSourceCatalog(products, combos)
  const source = catalog[level.surprise_gift_type]?.find(item => item?.id === level.surprise_gift_item_id)
  if (!source) return null
  if (source.available === false) return null
  if (source.out_of_stock === true) return null
  return source
}

function buildGiftRecord(level, source, nextOrderCount) {
  if (!level || !source) return null

  const levelMeta = getClubLevelMeta(level.id)
  const type = level.surprise_gift_type
  const cadence = normalizeGiftCadence(level.surprise_gift_every_orders)

  return {
    type,
    source_id: source.id,
    level_id: level.id || '',
    level_label: level.label || levelMeta.label,
    level_emoji: level.emoji || levelMeta.emoji,
    cadence,
    order_count_qualified: nextOrderCount,
    note: level.surprise_gift_note || '',
    item: {
      id: source.id,
      name: source.name || source.product_name || 'Regalo sorpresa',
      emoji: source.emoji || (type === 'combo' ? '🎁' : '🍓'),
      image_url: source.image_url || null,
      isCombo: type === 'combo',
    },
  }
}

export function resolveSurpriseGift({
  level,
  orderCount = 0,
  products = [],
  combos = [],
}) {
  const normalizedLevel = normalizeSurpriseGiftLevel(level)
  if (!normalizedLevel?.surprise_gift) {
    return { eligible: false, reason: 'perk_disabled', gift: null }
  }

  if (!hasOperationalSurpriseGift(normalizedLevel)) {
    return { eligible: false, reason: 'missing_config', gift: null }
  }

  const source = findGiftSource(normalizedLevel, products, combos)
  if (!source) {
    return { eligible: false, reason: 'source_unavailable', gift: null }
  }

  const cadence = normalizeGiftCadence(normalizedLevel.surprise_gift_every_orders)
  const nextOrderCount = Number(orderCount || 0) + 1
  const qualifiesNow = cadence > 0 && nextOrderCount % cadence === 0
  const gift = buildGiftRecord(normalizedLevel, source, nextOrderCount)

  return {
    eligible: qualifiesNow,
    reason: qualifiesNow ? 'eligible' : 'cadence_miss',
    gift,
  }
}

export function buildSurpriseGiftOrderItem(gift) {
  if (!gift?.item) return null

  return {
    id: gift.item.id,
    product_name: gift.item.name,
    emoji: gift.item.emoji || (gift.type === 'combo' ? '🎁' : '🍓'),
    image_url: gift.item.image_url || null,
    qty: 1,
    price: 0,
    size: null,
    toppings: {},
    isCombo: gift.type === 'combo',
    comboId: gift.type === 'combo' ? gift.item.id : null,
    combo_items: null,
    is_gift: true,
    gift_source: 'club_surprise',
    gift_level: gift.level_id || null,
    gift_note: gift.note || null,
  }
}
