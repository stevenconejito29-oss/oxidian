/**
 * useRealtimeProducts.js — Oxidian
 * ─────────────────────────────────────────────────────────────
 * Escucha cambios en `products` y `combos` en tiempo real.
 * Cuando el Admin cambia stock/precio/disponibilidad,
 * el Menú del cliente lo refleja instantáneamente.
 *
 * Retorna el mismo API que useMenuData pero con suscripción live.
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { enrichCombosWithSales, enrichProductsFromStock } from './catalogInsights'
import { DEFAULT_STORE_ID, normalizeStoreId, shouldUseLocalPreviewDefaults } from './currentStore'

export function useRealtimeProducts(storeId = DEFAULT_STORE_ID) {
  const [products,          setProducts]          = useState([])
  const [combos,            setCombos]            = useState([])
  const [toppingCategories, setToppingCategories] = useState([])
  const [loading,           setLoading]           = useState(true)
  const channelRef = useRef(null)
  const activeStoreId = normalizeStoreId(storeId)

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.all([
        supabase.from('products').select('*').eq('store_id', activeStoreId).eq('available', true).order('sort_order'),
        supabase.from('topping_categories').select('*').eq('store_id', activeStoreId).order('sort_order'),
        supabase.from('toppings').select('*').eq('store_id', activeStoreId).order('sort_order'),
        supabase.from('combos').select('*').eq('store_id', activeStoreId).eq('available', true).order('sort_order'),
        supabase.from('stock_items').select('id, product_id, quantity, unit, cost_per_unit, deleted_at').eq('store_id', activeStoreId),
        supabase.from('stock_item_products').select('stock_item_id, product_id').eq('store_id', activeStoreId),
        supabase.from('orders').select('created_at, status, items').eq('store_id', activeStoreId).gte('created_at', new Date().toISOString().slice(0, 10)),
      ])

      const [
        { data: prods,      error: prodsErr },
        { data: cats,       error: catsErr  },
        { data: tops,       error: topsErr  },
        { data: combosData, error: combosErr },
        { data: stockItems, error: stockErr },
        stockLinksRes,
        { data: todayOrders },
      ] = results

      // Loguear errores no-críticos sin romper la UI
      if (prodsErr)  console.warn('[useRealtimeProducts] products:', prodsErr.message)
      if (catsErr)   console.warn('[useRealtimeProducts] topping_categories:', catsErr.message)
      if (topsErr)   console.warn('[useRealtimeProducts] toppings:', topsErr.message)
      if (combosErr) console.warn('[useRealtimeProducts] combos:', combosErr.message)
      if (stockErr)  console.warn('[useRealtimeProducts] stock_items:', stockErr.message)

      const stockLinks = stockLinksRes?.data || []
      const enrichedProducts = enrichProductsFromStock(prods || [], stockItems || [], stockLinks, todayOrders || [])
      const enrichedCombos = enrichCombosWithSales(combosData || [], todayOrders || [])

      if (prods != null) setProducts(enrichedProducts.filter(p => p.available !== false))
      if (combosData != null) setCombos(enrichedCombos.filter(c => c.available !== false))
      if (cats != null && tops != null) {
        setToppingCategories(
          cats.map(cat => ({
            ...cat,
            toppings: tops.filter(t => t.category_id === cat.id),
          }))
        )
      }
    } catch (err) {
      console.error('[useRealtimeProducts] fetchAll falló:', err?.message || err)
    } finally {
      setLoading(false)
    }
  }, [activeStoreId])

  useEffect(() => {
    if (shouldUseLocalPreviewDefaults(activeStoreId)) {
      setProducts([])
      setCombos([])
      setToppingCategories([])
      setLoading(false)
      return undefined
    }

    fetchAll()

    // Escuchar cambios del catálogo completo → actualizar todo
    channelRef.current = supabase
      .channel(`catalog-realtime-${activeStoreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combos', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topping_categories', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'toppings', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_item_products', filter: `store_id=eq.${activeStoreId}` }, fetchAll)
      // NOTA: orders NO está suscrito aquí en tiempo real para evitar saturar canales
      // con múltiples clientes simultáneos. El fetch inicial ya trae las ventas del día.
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [fetchAll, activeStoreId])

  return { products, combos, toppingCategories, loading, refetch: fetchAll }
}
