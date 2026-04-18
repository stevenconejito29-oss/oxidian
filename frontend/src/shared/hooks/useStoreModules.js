/**
 * useStoreModules — lee módulos activos de la tienda via get_store_modules().
 * Retorna: { modules, isEnabled(id), getConfig(id), loading, error, refresh }
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from '../../core/providers/AuthProvider'

const CACHE = {}
const TTL = 60_000

function valid(id) { const e = CACHE[id]; return e && Date.now() - e.ts < TTL }

export function useStoreModules(overrideStoreId = null) {
  const { storeId: authStoreId, isAuthenticated } = useAuth()
  const storeId = overrideStoreId || authStoreId
  const [modules, setModules] = useState(() => CACHE[storeId]?.data ?? null)
  const [loading, setLoading] = useState(!valid(storeId))
  const [error,   setError]   = useState(null)
  const ref = useRef(true)

  const fetch = useCallback(async (force = false) => {
    if (!storeId) { setLoading(false); return }
    if (!force && valid(storeId)) { setModules(CACHE[storeId].data); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase.rpc('get_store_modules', { p_store_id: storeId })
      if (e) throw e
      const r = data ?? {}
      CACHE[storeId] = { data: r, ts: Date.now() }
      if (ref.current) setModules(r)
    } catch (e) { if (ref.current) setError(e.message) }
    finally     { if (ref.current) setLoading(false) }
  }, [storeId])

  useEffect(() => {
    ref.current = true
    if (isAuthenticated || overrideStoreId) fetch()
    return () => { ref.current = false }
  }, [fetch, isAuthenticated, overrideStoreId])

  const isEnabled = useCallback(id => !!(modules && id && modules[id]?.enabled), [modules])
  const getConfig = useCallback(id => modules?.[id]?.config ?? {}, [modules])

  return { modules, isEnabled, getConfig, loading, error, refresh: () => fetch(true) }
}
