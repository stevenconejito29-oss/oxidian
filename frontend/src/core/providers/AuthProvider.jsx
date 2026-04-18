import React from 'react'
import { supabase, supabaseAuth } from '../../legacy/lib/supabase'
import {
  loadStoredSession,
  clearStoredSession,
  persistStoredSession,
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

function persistNativeSession(session) {
  if (!session?.access_token) return
  const current = loadStoredSession(STORAGE_KEYS.admin) || {}
  persistStoredSession(STORAGE_KEYS.admin, {
    ...current,
    user: session.user || current.user || null,
    auth_expires_at: session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : current.auth_expires_at || null,
    supabase_access_token: session.access_token,
    _source: 'supabaseAuth',
  })
}

function clearNativeSessionMirror() {
  const current = loadStoredSession(STORAGE_KEYS.admin)
  if (current?._source === 'supabaseAuth') clearStoredSession(STORAGE_KEYS.admin)
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
    async function applySession(nextSession) {
      if (nextSession?.user?.id) {
        persistNativeSession(nextSession)
        // CRÍTICO: cargar membership ANTES de exponer la sesión.
        // Si se hace setSession primero, React re-renderiza con
        // isAuthenticated=true pero role='anonymous' → redirect a '/'.
        await loadMembership(nextSession.user.id)
        if (mounted) setSession(nextSession)
        if (mounted) setLoading(false)
        return
      }

      const active = readActiveStoredSession()
      const legacy = active ? buildSessionFromStored(active.stored) : null
      await loadMembership(legacy?.user?.id)
      if (mounted) setSession(legacy)
      if (mounted) setLoading(false)
    }

    async function init() {
      // 1. Supabase native auth (admin / tenant / store roles)
      const { data: { session: s } } = await supabaseAuth.auth.getSession()
      if (!mounted) return
      await applySession(s)
    }
    init()

    // Listen Supabase auth changes (login / logout / token refresh)
    const { data: { subscription: authSub } } = supabaseAuth.auth.onAuthStateChange(
      (_event, s) => {
        if (!mounted) return
        if (!s) clearNativeSessionMirror()
        window.setTimeout(() => {
          if (!mounted) return
          applySession(s)
        }, 0)
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
    try { await supabaseAuth.auth.signOut() } catch {}
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
