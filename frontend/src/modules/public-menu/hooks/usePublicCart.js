/**
 * usePublicCart — Carrito ligero para el menú público.
 * Sin Redux, sin Context: estado local con persistencia en sessionStorage.
 */
import React from 'react'

const KEY = 'oxidian_public_cart'

function load() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.map(normalizeStoredItem) : []
  } catch {
    return []
  }
}
function save(items) {
  try { sessionStorage.setItem(KEY, JSON.stringify(items)) } catch {}
}

function stableSignature(value) {
  return JSON.stringify(value || null)
}

function resolveVariants(prod) {
  if (Array.isArray(prod?.variants) && prod.variants.length > 0) return prod.variants
  if (prod?.selectedVariant) return [prod.selectedVariant]
  return []
}

function resolveModifiers(prod) {
  return Array.isArray(prod?.modifiers) ? prod.modifiers : []
}

function resolveLineId(prod) {
  const signature = {
    id: prod?.id || null,
    name: prod?.product_name || prod?.name || '',
    variants: resolveVariants(prod).map(v => v?.id || v?.label || v?.name || v),
    modifiers: resolveModifiers(prod).map(m => m?.id || m?.label || m?.name || m),
    notes: prod?.notes || null,
  }
  return prod?.line_id || `line:${stableSignature(signature)}`
}

function computeUnitPrice(prod) {
  const basePrice = Number(prod?.base_price ?? prod?.price ?? 0)
  const variantDelta = resolveVariants(prod).reduce(
    (sum, variant) => sum + Number(variant?.price_modifier ?? variant?.priceModifier ?? 0),
    0,
  )
  const modifiersDelta = resolveModifiers(prod).reduce(
    (sum, modifier) => sum + Number(modifier?.price ?? modifier?.price_modifier ?? modifier?.priceModifier ?? 0),
    0,
  )
  return Number((basePrice + variantDelta + modifiersDelta).toFixed(2))
}

function normalizeStoredItem(item) {
  if (!item || typeof item !== 'object') return item
  const variants = resolveVariants(item)
  const modifiers = resolveModifiers(item)
  const price = item.price != null ? Number(item.price) : computeUnitPrice(item)
  return {
    ...item,
    line_id: resolveLineId(item),
    base_price: Number(item.base_price ?? item.price ?? 0),
    price,
    variants,
    modifiers,
    qty: Math.max(1, Number(item.qty || 1)),
  }
}

function normalizeLineItem(prod) {
  const variants = resolveVariants(prod)
  const modifiers = resolveModifiers(prod)
  const price = computeUnitPrice({ ...prod, variants, modifiers })
  return {
    ...prod,
    line_id: resolveLineId({ ...prod, variants, modifiers }),
    base_price: Number(prod?.base_price ?? prod?.price ?? 0),
    price,
    variants,
    modifiers,
    qty: Math.max(1, Number(prod?.qty || 1)),
  }
}

export function usePublicCart(storeId) {
  const [items, setItems] = React.useState(() => load())

  // Limpiar carrito si cambia la tienda
  React.useEffect(() => { setItems([]); save([]) }, [storeId])

  function addToCart(prod) {
    setItems(prev => {
      const line = normalizeLineItem(prod)
      const idx = prev.findIndex(i => i.line_id === line.line_id)
      const next = idx >= 0
        ? prev.map((i, n) => n === idx ? { ...i, qty: i.qty + line.qty } : i)
        : [...prev, line]
      save(next)
      return next
    })
  }

  function updateQty(lineId, qty) {
    if (qty <= 0) return removeItem(lineId)
    setItems(prev => {
      const next = prev.map(item => item.line_id === lineId ? { ...item, qty } : item)
      save(next)
      return next
    })
  }

  function removeItem(lineId) {
    setItems(prev => {
      const next = prev.filter(item => item.line_id !== lineId)
      save(next)
      return next
    })
  }

  function clearCart() { setItems([]); save([]) }

  const cartCount = items.reduce((s, i) => s + i.qty, 0)
  const cartTotal = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)

  return { items, addToCart, updateQty, removeItem, clearCart, cartCount, cartTotal }
}
