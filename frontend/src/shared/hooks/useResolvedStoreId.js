import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../core/providers/AuthProvider'

export function useResolvedStoreId() {
  const { storeId: jwtStoreId } = useAuth()
  const params = useParams()
  return useMemo(() => {
    if (jwtStoreId) return jwtStoreId
    if (params.storeId) return params.storeId
    if (params.storeSlug) return params.storeSlug
    try {
      const legacy = localStorage.getItem('oxidian_active_store_id')
      if (legacy) return legacy
    } catch {}
    return null
  }, [jwtStoreId, params])
}
