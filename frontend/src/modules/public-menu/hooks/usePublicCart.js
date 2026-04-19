/**
 * usePublicCart — Carrito ligero para el menú público.
 * Sin Redux, sin Context: estado local con persistencia en sessionStorage.
 */
import React from 'react'

const KEY = 'oxidian_public_cart'

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] }
}
function save(items) {
  try { sessionStorage.setItem(KEY, JSON.stringify(items)) } catch {}
}

export function usePublicCart(storeId) {
  const [items, setItems] = React.useState(() => load())

  // Limpiar carrito si cambia la tienda
  React.useEffect(() => { setItems([]); save([]) }, [storeId])

  function addToCart(prod) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === prod.id)
      const next = idx >= 0
        ? prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...prod, qty: 1 }]
      save(next)
      return next
    })
  }

  function updateQty(id, qty) {
    if (qty <= 0) return removeItem(id)
    setItems(prev => { const n = prev.map(i => i.id === id ? { ...i, qty } : i); save(n); return n })
  }

  function removeItem(id) {
    setItems(prev => { const n = prev.filter(i => i.id !== id); save(n); return n })
  }

  function clearCart() { setItems([]); save([]) }

  const cartCount = items.reduce((s, i) => s + i.qty, 0)
  const cartTotal = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)

  return { items, addToCart, updateQty, removeItem, clearCart, cartCount, cartTotal }
}
