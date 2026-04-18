import React from 'react'
import { supabaseAuth } from '../../legacy/lib/supabase'
import {
  loadStoredSession,
  clearStoredSession,
  persistStoredSession,
  STORAGE_KEYS,
} from '../../legacy/lib/appSession'

export const AuthContext = React.createContext(null)
export function useAuth() { return React.useContext(AuthContext) }

// ─── helpers legacy (staff PIN) ──────────────────────────────────
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

  // ── Carga la membresía usando supabaseAuth (cliente nativo con sesión real)
  async function loadMembership(userId, accessToken) {
    if (!userId) { setMembership(null); return }
    try {
      // Usamos supabaseAuth directamente — tiene el Bearer token en memoria
      // porque es el mismo cliente con el que se hizo signInWithPassword()
      const { data, error } = await supabaseAuth
        .from('user_memberships')
        .select('role, tenant_id, store_id, branch_id, is_active, metadata')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn('[AuthProvider] loadMembership error:', error.message)
        setMembership(null)
        return
      }
      setMembership(data || null)
    } catch (e) {
      console.warn('[AuthProvider] loadMembership exception:', e)
      setMembership(null)
    }
  }

  React.useEffect(() => {
    let mounted = true

    // ── Aplica una sesión de Supabase Auth (login nativo de admin/tenant/store)
    async function applyNativeSession(s) {
      if (!s?.user?.id) {
        if (mounted) { setSession(null); setMembership(null); setLoading(false) }
        return
      }
      // Persistir en appSession para compatibilidad con el cliente legacy
      persistStoredSession(STORAGE_KEYS.admin, {
        user: s.user,
        supabase_access_token: s.access_token,
        auth_expires_at: s.expires_at
          ? new Date(s.expires_at * 1000).toISOString()
          : null,
        _source: 'supabaseAuth',
      })
      // CRÍTICO: cargar membership ANTES de setSession
      // Si setSession va primero, React renderiza isAuthenticated=true con role='anonymous'
      // y el LoginPage redirige a '/' antes de que el role esté listo
      await loadMembership(s.user.id)
      if (mounted) { setSession(s); setLoading(false) }
    }

    // ── Aplica una sesión legacy de staff (PIN login)
    function applyLegacySession() {
      const active = readActiveStoredSession()
      const s = active ? buildSessionFromStored(active.stored) : null
      if (mounted) { setSession(s); setLoading(false) }
    }

    async function init() {
      // 1. ¿Hay sesión nativa de Supabase Auth?
      const { data: { session: s } } = await supabaseAuth.auth.getSession()
      if (!mounted) return
      if (s?.user?.id) {
        await applyNativeSession(s)
        return
      }
      // 2. ¿Hay sesión legacy de staff por PIN?
      applyLegacySession()
    }

    init()

    // Escuchar cambios de sesión nativa (login, logout, refresh de token)
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      if (!s) {
        // Logout: limpiar todo
        const current = loadStoredSession(STORAGE_KEYS.admin)
        if (current?._source === 'supabaseAuth') clearStoredSession(STORAGE_KEYS.admin)
        if (mounted) { setSession(null); setMembership(null) }
        return
      }
      // Nueva sesión — usar setTimeout para no bloquear el event loop de Supabase
      window.setTimeout(() => {
        if (!mounted) return
        applyNativeSession(s)
      }, 0)
    })

    // Escuchar cambios de appSession entre tabs (staff PIN)
    function onStorage(e) {
      if (!Object.values(STORAGE_KEYS).includes(e.key)) return
      applyLegacySession()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      mounted = false
      subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  async function signOut() {
    try { await supabaseAuth.auth.signOut() } catch {}
    for (const key of Object.values(STORAGE_KEYS)) clearStoredSession(key)
    setSession(null)
    setMembership(null)
  }

  const value = {
    session,
    user:            session?.user || null,
    membership,
    loading,
    isAuthenticated: Boolean(session),
    role:            membership?.role      || 'anonymous',
    tenantId:        membership?.tenant_id  || null,
    storeId:         membership?.store_id   || null,
    branchId:        membership?.branch_id  || null,
    isSuperAdmin:    membership?.role === 'super_admin',
    isTenantOwner:   ['tenant_owner', 'tenant_admin'].includes(membership?.role),
    isStoreAdmin:    ['store_admin', 'store_operator'].includes(membership?.role),
    isBranchOp:      ['branch_manager', 'kitchen', 'rider', 'cashier'].includes(membership?.role),
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
