/**
 * useCart.js — Oxidian
 * ─────────────────────────────────────────────────────────────
 * Hook que centraliza toda la lógica de estado del carrito.
 * Elimina ~120 líneas de Menu.jsx y hace el carrito testeable.
 *
 * API pública:
 *   cart              — array de items en el carrito
 *   cartCount         — total de unidades
 *   cartTotal         — suma de precios (sin envío)
 *   addToCart(item)   — añade o fusiona item
 *   updateQty(i, n)   — ajusta cantidad (n<=0 elimina)
 *   removeItem(i)     — elimina item por índice
 *   updateItem(i, it) — reemplaza item completo (edición)
 *   clearCart()       — vacía el carrito
 *   comboReachedLimit(combo) — boolean de límite por combo
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useCallback } from 'react'

export function useCart() {
  const [cart, setCart] = useState([])

  function getItemLimit(item) {
    const limit = Number(item?.max_quantity)
    return Number.isFinite(limit) && limit > 0 ? limit : null
  }

  function getReservedQty(cartItems, item, excludeIndex = null) {
    return cartItems.reduce((sum, cartItem, index) => {
      if (excludeIndex != null && index === excludeIndex) return sum

      const sameCombo = item?.isCombo && cartItem?.isCombo && (cartItem.comboId || cartItem.id) === (item.comboId || item.id)
      const sameProduct = !item?.isCombo && !cartItem?.isCombo && cartItem.id === item.id

      if (!sameCombo && !sameProduct) return sum
      return sum + Number(cartItem.qty || 0)
    }, 0)
  }

  function getRemainingQty(cartItems, item, excludeIndex = null) {
    const maxQuantity = getItemLimit(item)
    if (maxQuantity == null) return null
    const soldToday = Number(item?.sold_today || 0)
    const reservedQty = getReservedQty(cartItems, item, excludeIndex)
    return Math.max(0, maxQuantity - soldToday - reservedQty)
  }

  function clampQty(cartItems, item, desiredQty, excludeIndex = null) {
    const remainingQty = getRemainingQty(cartItems, item, excludeIndex)
    if (remainingQty == null) return Math.max(1, desiredQty)
    return Math.max(0, Math.min(desiredQty, remainingQty))
  }

  /* ── Añadir o fusionar item ── */
  const addToCart = useCallback((item) => {
    setCart(prev => {
      // Los combos siempre se añaden como línea nueva (pueden tener selecciones distintas)
      if (item.isCombo) {
        const safeQty = clampQty(prev, item, Number(item.qty || 1))
        if (safeQty <= 0) return prev
        return [...prev, { ...item, qty: safeQty }]
      }

      // Productos simples: fusionar si mismo id + tamaño + toppings
      const idx = prev.findIndex(c =>
        c.id === item.id &&
        c.size === item.size &&
        JSON.stringify(c.toppings) === JSON.stringify(item.toppings)
      )
      if (idx >= 0) {
        const updated = [...prev]
        const nextQty = updated[idx].qty + item.qty
        const safeQty = clampQty(updated, item, nextQty, idx)
        if (safeQty <= 0) return prev
        updated[idx] = { ...updated[idx], qty: safeQty }
        return updated
      }
      const safeQty = clampQty(prev, item, Number(item.qty || 1))
      if (safeQty <= 0) return prev
      return [...prev, { ...item, qty: safeQty }]
    })
  }, [])

  /* ── Actualizar cantidad (elimina si n <= 0) ── */
  const updateQty = useCallback((index, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index))
    } else {
      setCart(prev => {
        const updated = [...prev]
        const safeQty = clampQty(updated, updated[index], newQty, index)
        if (safeQty <= 0) return prev.filter((_, i) => i !== index)
        updated[index] = { ...updated[index], qty: safeQty }
        return updated
      })
    }
  }, [])

  /* ── Eliminar item por índice ── */
  const removeItem = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }, [])

  /* ── Reemplazar item completo (flujo de edición desde carrito) ── */
  const updateItem = useCallback((index, updatedItem) => {
    setCart(prev => {
      const updated = [...prev]
      const safeQty = clampQty(updated, updatedItem, Number(updatedItem.qty || 1), index)
      updated[index] = { ...updatedItem, qty: safeQty > 0 ? safeQty : 1 }
      return updated
    })
  }, [])

  /* ── Vaciar carrito ── */
  const clearCart = useCallback(() => setCart([]), [])

  /* ── Verificar límite de combo ── */
  const comboReachedLimit = useCallback((combo) => {
    const remaining = getRemainingQty(cart, { ...combo, isCombo: true })
    return remaining != null && remaining <= 0
  }, [cart])

  const productReachedLimit = useCallback((product) => {
    const remaining = getRemainingQty(cart, { ...product, isCombo: false })
    return remaining != null && remaining <= 0
  }, [cart])

  /* ── Valores derivados ── */
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  return {
    cart,
    cartCount,
    cartTotal,
    addToCart,
    updateQty,
    removeItem,
    updateItem,
    clearCart,
    comboReachedLimit,
    productReachedLimit,
  }
}
