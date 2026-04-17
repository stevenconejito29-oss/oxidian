import React from 'react'
import { supabase } from '../../legacy/lib/supabase'

export const AuthContext = React.createContext(null)

export function useAuth() {
  return React.useContext(AuthContext)
}

/**
 * AuthProvider — Gestiona sesión Supabase + membresía del usuario.
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      loadMembership(s?.user?.id).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      loadMembership(s?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
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
