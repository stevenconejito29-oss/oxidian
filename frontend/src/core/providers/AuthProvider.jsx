import React from 'react'
import { supabase } from '../../legacy/lib/supabase'
import {
  loadStoredSession,
  clearStoredSession,
  STORAGE_KEYS,
} from '../../legacy/lib/appSession'

export const AuthContext = React.createContext(null)

export function useAuth() {
  return React.useContext(AuthContext)
}

/**
 * Construye un objeto session-like a partir del payload almacenado en appSession.
 * Compatible con la forma que usaba supabase.auth.getSession().
 */
function buildSessionFromStored(stored) {
  if (!stored?.supabase_access_token) return null
  return {
    access_token: stored.supabase_access_token,
    user: stored.user || null,
  }
}

/**
 * Lee la sesión activa de cualquiera de los storage keys registrados.
 */
function readActiveStoredSession() {
  for (const key of Object.values(STORAGE_KEYS)) {
    const stored = loadStoredSession(key)
    if (stored?.supabase_access_token) return { stored, key }
  }
  return null
}

/**
 * AuthProvider — Gestiona sesión (modo accessToken externo) + membresía del usuario.
 * Expone: session, user, membership (role, tenant_id, store_id, branch_id), loading, signOut
 */
export function AuthProvider({ children }) {
  const [session, setSession] = React.useState(null)
  const [membership, setMembership] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  async function loadMembership(userId) {
    if (!userId) { setMembership(null); return }
    try {
      const { data } = await supabase
        .from('user_memberships')
        .select('role,tenant_id,store_id,branch_id,is_active,metadata')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setMembership(data || null)
    } catch {
      setMembership(null)
    }
  }

  React.useEffect(() => {
    // En modo accessToken el cliente no gestiona sesión internamente;
    // la leemos desde nuestro propio storage (appSession).
    const active = readActiveStoredSession()
    const s = active ? buildSessionFromStored(active.stored) : null
    setSession(s)
    loadMembership(s?.user?.id).finally(() => setLoading(false))

    // Detectar cambios de storage entre tabs / ventanas
    function onStorage(e) {
      if (!Object.values(STORAGE_KEYS).includes(e.key)) return
      const active2 = readActiveStoredSession()
      const s2 = active2 ? buildSessionFromStored(active2.stored) : null
      setSession(s2)
      loadMembership(s2?.user?.id)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function signOut() {
    // Limpiar todos los storage keys propios
    for (const key of Object.values(STORAGE_KEYS)) {
      clearStoredSession(key)
    }
    setSession(null)
    setMembership(null)
  }

  const value = {
    session,
    user: session?.user || null,
    membership,
    loading,
    isAuthenticated: Boolean(session),
    role: membership?.role || 'anonymous',
    tenantId: membership?.tenant_id || null,
    storeId: membership?.store_id || null,
    branchId: membership?.branch_id || null,
    isSuperAdmin: membership?.role === 'super_admin',
    isTenantOwner: ['tenant_owner', 'tenant_admin'].includes(membership?.role),
    isStoreAdmin: ['store_admin', 'store_operator'].includes(membership?.role),
    isBranchOp: ['branch_manager', 'kitchen', 'rider', 'cashier'].includes(membership?.role),
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
