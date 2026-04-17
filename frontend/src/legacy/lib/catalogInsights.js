import { isGiftOrderItem } from './clubGift'

const MERMA = 0.20

function getLowStockThreshold(unit) {
  const normalized = String(unit || '').toLowerCase()
  if (normalized === 'kg' || normalized === 'l') return 0.5
  if (normalized === 'g' || normalized === 'ml') return 500
  return 2
}

function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildTodaySalesMap(orders = []) {
  const today = new Date().toISOString().slice(0, 10)
  const soldProducts = {}
  const soldCombos = {}

  orders
    .filter(order => order?.status !== 'cancelled' && String(order?.created_at || '').slice(0, 10) === today)
    .forEach(order => {
      let items = []
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
      } catch {
        items = []
      }

      items.forEach(item => {
        if (isGiftOrderItem(item)) return
        const qty = safeNumber(item.qty || item.quantity || 1) || 1
        if (item?.isCombo || item?.is_combo || item?.comboId) {
          const comboId = item.comboId || item.id
          if (comboId) soldCombos[comboId] = (soldCombos[comboId] || 0) + qty
          return
        }

        const productId = item.product_id || item.id
        if (productId) soldProducts[productId] = (soldProducts[productId] || 0) + qty
      })
    })

  return { soldProducts, soldCombos }
}

export function enrichProductsFromStock(products = [], stockItems = [], stockLinks = [], orders = []) {
  const activeStockItems = (stockItems || []).filter(item => !item?.deleted_at)
  const linkMap = new Map()

  activeStockItems.forEach(item => {
    if (!item?.product_id) return
    const current = linkMap.get(item.product_id) || []
    current.push(item)
    linkMap.set(item.product_id, current)
  })

  ;(stockLinks || []).forEach(link => {
    if (!link?.product_id || !link?.stock_item_id) return
    const stockItem = activeStockItems.find(item => item.id === link.stock_item_id)
    if (!stockItem) return
    const current = linkMap.get(link.product_id) || []
    if (!current.some(item => item.id === stockItem.id)) current.push(stockItem)
    linkMap.set(link.product_id, current)
  })

  const { soldProducts } = buildTodaySalesMap(orders)

  return (products || []).map(product => {
    const linkedItems = linkMap.get(product.id) || []
    const unitLimited = safeNumber(product.max_quantity) > 0
    const soldToday = soldProducts[product.id] || 0
    const remainingToday = unitLimited ? Math.max(0, safeNumber(product.max_quantity) - soldToday) : null
    const hasReachedDailyLimit = unitLimited && remainingToday <= 0

    const zeroStock = linkedItems.length > 0 && linkedItems.some(item => safeNumber(item.quantity) <= 0)
    const lowStockFromLinked = linkedItems.some(item => {
      const quantity = safeNumber(item.quantity)
      return quantity > 0 && quantity <= getLowStockThreshold(item.unit)
    })

    const derivableCostItems = linkedItems.filter(item => safeNumber(item.cost_per_unit) > 0)
    const derivedCost = derivableCostItems.length === 1 ? safeNumber(derivableCostItems[0].cost_per_unit) : null
    const manualCost = safeNumber(product.cost_production)
    const resolvedCost = derivedCost || manualCost || 0
    const costSource = derivedCost ? 'stock' : manualCost > 0 ? 'manual' : 'none'
    const costWithWaste = resolvedCost > 0 ? resolvedCost * (1 + MERMA) : 0
    const margin = safeNumber(product.price) > 0 && resolvedCost > 0
      ? (safeNumber(product.price) - costWithWaste) / safeNumber(product.price)
      : null

    return {
      ...product,
      linked_stock_items: linkedItems,
      linked_stock_count: linkedItems.length,
      sold_today: soldToday,
      remaining_today: remainingToday,
      has_daily_limit: unitLimited,
      has_reached_daily_limit: hasReachedDailyLimit,
      low_stock: Boolean(product.low_stock || lowStockFromLinked || (unitLimited && remainingToday !== null && remainingToday > 0 && remainingToday <= 3)),
      out_of_stock: Boolean(product.out_of_stock || zeroStock || hasReachedDailyLimit),
      derived_cost_production: derivedCost,
      effective_cost_production: resolvedCost || null,
      cost_source: costSource,
      derived_margin: margin,
    }
  })
}

export function enrichCombosWithSales(combos = [], orders = []) {
  const { soldCombos } = buildTodaySalesMap(orders)

  return (combos || []).map(combo => {
    const maxQuantity = safeNumber(combo.max_quantity)
    const soldToday = soldCombos[combo.id] || 0
    const remainingToday = maxQuantity > 0 ? Math.max(0, maxQuantity - soldToday) : null
    const hasReachedDailyLimit = maxQuantity > 0 && remainingToday <= 0

    return {
      ...combo,
      sold_today: soldToday,
      remaining_today: remainingToday,
      has_daily_limit: maxQuantity > 0,
      has_reached_daily_limit: hasReachedDailyLimit,
      out_of_stock: Boolean(combo.out_of_stock || hasReachedDailyLimit),
    }
  })
}
