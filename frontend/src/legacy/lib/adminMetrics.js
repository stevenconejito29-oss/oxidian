import { isGiftOrderItem } from './clubGift'

export const DEFAULT_MERMA = 0.20
export const DEFAULT_MARGIN_MODEL = {
  mermaPercent: 20,
  mediumMultiplier: 1.3,
  largeMultiplier: 1.6,
  toppingBufferPercent: 8,
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeMarginModel(model = {}) {
  const next = {
    mermaPercent: toFiniteNumber(model.mermaPercent, DEFAULT_MARGIN_MODEL.mermaPercent),
    mediumMultiplier: toFiniteNumber(model.mediumMultiplier, DEFAULT_MARGIN_MODEL.mediumMultiplier),
    largeMultiplier: toFiniteNumber(model.largeMultiplier, DEFAULT_MARGIN_MODEL.largeMultiplier),
    toppingBufferPercent: toFiniteNumber(model.toppingBufferPercent, DEFAULT_MARGIN_MODEL.toppingBufferPercent),
  }

  return {
    mermaPercent: clamp(next.mermaPercent, 0, 100),
    mediumMultiplier: clamp(next.mediumMultiplier || 1, 1, 5),
    largeMultiplier: clamp(next.largeMultiplier || 1, 1, 6),
    toppingBufferPercent: clamp(next.toppingBufferPercent, 0, 100),
  }
}

function resolveMarginModel(input) {
  if (typeof input === 'number') {
    return normalizeMarginModel({
      ...DEFAULT_MARGIN_MODEL,
      mermaPercent: input <= 1 ? input * 100 : input,
    })
  }

  return normalizeMarginModel({
    ...DEFAULT_MARGIN_MODEL,
    ...(input || {}),
  })
}

export function getProductSellPrice(product, size = 'small') {
  if (size === 'large' && product?.price_large != null) return Number(product.price_large || 0)
  if (size === 'medium' && product?.price_medium != null) return Number(product.price_medium || 0)
  return Number(product?.price || 0)
}

export function getProductCostMultiplier(size = 'small', model = DEFAULT_MARGIN_MODEL) {
  const normalized = resolveMarginModel(model)
  if (size === 'large') return normalized.largeMultiplier
  if (size === 'medium') return normalized.mediumMultiplier
  return 1
}

export function getEstimatedProductRawCost(product, size = 'small', model = DEFAULT_MARGIN_MODEL) {
  const rawCost = getEffectiveProductCost(product)
  if (rawCost <= 0) return 0
  return rawCost * getProductCostMultiplier(size, model)
}

function getToppingCount(value) {
  if (!value) return 0
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + getToppingCount(item), 0)
  }
  if (typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + getToppingCount(item), 0)
  }
  return 1
}

export function parseOrderItems(order) {
  try {
    return typeof order?.items === 'string' ? JSON.parse(order.items) : (order?.items || [])
  } catch {
    return []
  }
}

export function buildProductSalesMap(orders = [], daysBack = 30) {
  const map = {}
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)

  orders
    .filter(order => order?.status !== 'cancelled' && (!order?.created_at || new Date(order.created_at) >= cutoff))
    .forEach(order => {
      parseOrderItems(order).forEach(item => {
        if (isGiftOrderItem(item)) return
        const qty = Number(item?.qty || item?.quantity || 1) || 1

        if (item?.isCombo || item?.is_combo) {
          ;(item.combo_items || []).forEach(comboItem => {
            const comboProductId = comboItem.productId || comboItem.product_id || comboItem.id
            if (comboProductId) map[comboProductId] = (map[comboProductId] || 0) + qty
          })
          return
        }

        const productId = item?.product_id || item?.id
        if (productId) map[productId] = (map[productId] || 0) + qty
      })
    })

  return map
}

export function getEffectiveProductCost(product) {
  return Number(product?.effective_cost_production || product?.cost_production || 0)
}

export function getProductMarginSnapshot(product, modelInput = DEFAULT_MERMA, options = {}) {
  const model = resolveMarginModel(modelInput)
  const size = options.size || 'small'
  const toppingsCount = Number(options.toppingsCount || 0)
  const sell = getProductSellPrice(product, size)
  const rawCost = getEstimatedProductRawCost(product, size, model)
  const toppingFactor = toppingsCount > 0 ? (1 + model.toppingBufferPercent / 100) : 1
  const costWithWaste = rawCost > 0 ? rawCost * toppingFactor * (1 + model.mermaPercent / 100) : 0
  const margin = sell > 0 && rawCost > 0 ? (sell - costWithWaste) / sell : null
  const unitProfit = sell > 0 && rawCost > 0 ? sell - costWithWaste : null

  return {
    sell,
    rawCost,
    costWithWaste,
    margin,
    unitProfit,
    costSource: product?.cost_source || (rawCost > 0 ? 'manual' : 'none'),
  }
}

export function buildProductPerformanceMap(orders = [], products = [], modelInput = DEFAULT_MARGIN_MODEL) {
  const model = resolveMarginModel(modelInput)
  const productMap = new Map((products || []).map(product => [product.id, product]))
  const totals = {}

  orders
    .filter(order => order?.status !== 'cancelled')
    .forEach(order => {
      parseOrderItems(order).forEach(item => {
        if (isGiftOrderItem(item)) return
        if (item?.isCombo || item?.is_combo) return

        const productId = item?.product_id || item?.id
        const product = productMap.get(productId)
        if (!productId || !product) return

        const qty = Number(item?.qty || item?.quantity || 1) || 1
        const size = item?.size || 'small'
        const toppingsCount = getToppingCount(item?.toppings)
        const sell = Number(item?.price || getProductSellPrice(product, size) || 0)
        const { costWithWaste } = getProductMarginSnapshot(product, model, { size, toppingsCount })

        if (!totals[productId]) {
          totals[productId] = {
            units: 0,
            revenue: 0,
            estimatedCost: 0,
            profit: 0,
            sizeMix: { small: 0, medium: 0, large: 0 },
          }
        }

        totals[productId].units += qty
        totals[productId].revenue += sell * qty
        totals[productId].estimatedCost += costWithWaste * qty
        totals[productId].profit += (sell - costWithWaste) * qty
        totals[productId].sizeMix[size] = (totals[productId].sizeMix[size] || 0) + qty
      })
    })

  return totals
}
