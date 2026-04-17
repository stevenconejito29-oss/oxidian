/**
 * useRealtimeOrders.js — CarmoCream
 * ─────────────────────────────────────────────────────────────
 * Hook de suscripción en tiempo real a la tabla `orders`.
 * Reemplaza el polling manual de 18-25 s con Supabase Realtime.
 * Todas las vistas (Admin, Cocina, Repartidor) lo usan con un
 * filtro de estado distinto → cero latencia entre pilares.
 *
 * CORRECCIÓN: statusFilter se estabiliza con useMemo para evitar
 * re-subscriptions infinitas cuando el padre pasa un array inline.
 * refresh() tiene manejo de errores completo con try/catch/finally.
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import { DEFAULT_STORE_ID, normalizeStoreId, shouldUseLocalPreviewDefaults } from './currentStore'

export function useRealtimeOrders({
  statusFilter = [],
  riderId      = null,
  cookId       = null,
  storeId      = DEFAULT_STORE_ID,
  limit        = 80,
} = {}) {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)
  const activeStoreId = normalizeStoreId(storeId)

  // Estabilizar statusFilter para evitar re-subscriptions cuando el padre pasa un array inline
  const statusKey = statusFilter.join(',')
  const stableStatusFilter = useMemo(() => statusFilter, [statusKey]) // eslint-disable-line

  const buildQuery = useCallback(() => {
    let q = supabase.from('orders').select('*').eq('store_id', activeStoreId).order('created_at', { ascending: false }).limit(limit)
    if (stableStatusFilter.length > 0) q = q.in('status', stableStatusFilter)
    if (riderId) q = q.eq('assigned_rider_id', riderId)
    if (cookId)  q = q.eq('assigned_cook_id',  cookId)
    return q
  }, [stableStatusFilter, riderId, cookId, limit, activeStoreId])

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await buildQuery()
      if (error) {
        console.warn('[useRealtimeOrders] refresh error:', error.message)
        return
      }
      if (data) setOrders(data)
    } catch (err) {
      console.warn('[useRealtimeOrders] refresh exception:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    if (shouldUseLocalPreviewDefaults(activeStoreId)) {
      setOrders([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    refresh()

    const channelName = `orders-rt-${activeStoreId}-${statusKey}-${riderId || 'all'}-${cookId || 'all'}`

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${activeStoreId}` }, () => refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${activeStoreId}` }, () => refresh())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders', filter: `store_id=eq.${activeStoreId}` }, () => refresh())
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [refresh, activeStoreId, statusKey, riderId, cookId]) // eslint-disable-line

  return { orders, loading, refresh }
}
