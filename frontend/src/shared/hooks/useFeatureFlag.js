/**
 * useFeatureFlag — lee si una feature del PLAN está activa para la tienda.
 * Usa get_store_features() que resuelve: store_override > tenant_override > plan.
 * Uso: const { enabled } = useFeatureFlag('module_affiliates_enabled')
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from '../../core/providers/AuthProvider'

const CACHE = {}; const TTL = 120_000
function valid(id) { const e = CACHE[id]; return e && Date.now() - e.ts < TTL }

export function useFeatureFlag(featureKey) {
  const { storeId } = useAuth()
  const [features, setFeatures] = useState(CACHE[storeId]?.data ?? null)
  const [loading,  setLoading]  = useState(!valid(storeId))
  const ref = useRef(true)

  useEffect(() => {
    ref.current = true
    if (!storeId) { setLoading(false); return }
    if (valid(storeId)) { setFeatures(CACHE[storeId].data); setLoading(false); return }
    setLoading(true)
    supabase.rpc('get_store_features', { p_store_id: storeId }).then(({ data, error }) => {
      if (!ref.current) return
      if (!error && data) { CACHE[storeId] = { data, ts: Date.now() }; setFeatures(data) }
      setLoading(false)
    })
    return () => { ref.current = false }
  }, [storeId])

  return { enabled: features ? Boolean(features[featureKey]) : false, loading, features }
}
