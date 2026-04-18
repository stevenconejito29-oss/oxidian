import React from 'react'
import { supabase } from '../../legacy/lib/supabase'
import {
  loadStoredSession,
  clearStoredSession,
  STORAGE_KEYS,
} from '../../legacy/lib/appSession'

export const AuthContext = React.createContext(null)
export function useAuth() { return React.useContext(AuthContext) }

// ── Helpers sesión legacy (staff PIN) ────────────────────────────
function buildSessionFromStored(stored) {
  if (!stored?.supabase_access_token) return null
  return { access_token: stored.supabase_access_token, user: stored.user || null, _source: 'appSession' }
}
function readActiveStoredSession() {
  for (const key of Object.values(STORAGE_KEYS)) {
    const stored = loadStoredSession(key)
    if (stored?.supabase_access_token) return { stored, key }
  }
  return null
}

export function AuthProvider({ children }) {
  const [session,    setSession]    = React.useState(null)
  const [membership, setMembership] = React.useState(null)
  const [loading,    setLoading]    = React.useState(true)

  async function loadMembership(userId) {
    if (!userId) { setMembership(null); return }
    try {
      const { data } = await supabase
        .from('user_memberships')
        .select('role, tenant_id, store_id, branch_id, is_active, metadata')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      setMembership(data || null)
    } catch { setMembership(null) }
  }

  React.useEffect(() => {
    let mounted = true
    async function init() {
      // 1. Supabase native auth (admin / tenant / store roles)
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!mounted) return
      if (s?.user?.id) {
        setSession(s)
        await loadMembership(s.user.id)
        setLoading(false)
        return
      }
      // 2. Fallback: legacy appSession (kitchen / rider PIN login)
      const active = readActiveStoredSession()
      const legacy = active ? buildSessionFromStored(active.stored) : null
      setSession(legacy)
      await loadMembership(legacy?.user?.id)
      setLoading(false)
    }
    init()

    // Listen Supabase auth changes (login / logout / token refresh)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return
        setSession(s)
        await loadMembership(s?.user?.id)
        setLoading(false)
      }
    )
    // Listen legacy appSession changes between tabs
    function onStorage(e) {
      if (!Object.values(STORAGE_KEYS).includes(e.key)) return
      const a = readActiveStoredSession()
      const s2 = a ? buildSessionFromStored(a.stored) : null
      setSession(s2)
      loadMembership(s2?.user?.id)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      mounted = false
      authSub.unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  async function signOut() {
    try { await supabase.auth.signOut() } catch {}
    for (const key of Object.values(STORAGE_KEYS)) clearStoredSession(key)
    setSession(null); setMembership(null)
  }

  const value = {
    session, user: session?.user || null, membership, loading,
    isAuthenticated: Boolean(session),
    role:      membership?.role      || 'anonymous',
    tenantId:  membership?.tenant_id  || null,
    storeId:   membership?.store_id   || null,
    branchId:  membership?.branch_id  || null,
    isSuperAdmin:  membership?.role === 'super_admin',
    isTenantOwner: ['tenant_owner','tenant_admin'].includes(membership?.role),
    isStoreAdmin:  ['store_admin','store_operator'].includes(membership?.role),
    isBranchOp:    ['branch_manager','kitchen','rider','cashier'].includes(membership?.role),
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
