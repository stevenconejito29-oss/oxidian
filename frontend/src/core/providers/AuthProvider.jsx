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

// Jerarquía de roles: índice 0 = mayor privilegio
const ROLE_PRIORITY = [
  'super_admin',
  'tenant_owner',
  'tenant_admin',
  'store_admin',
  'store_operator',
  'branch_manager',
  'cashier',
  'kitchen',
  'rider',
]

// Reintentos cuando la membresía falla (ej: RLS tardía en propagarse)
const MAX_MEMBERSHIP_RETRIES = 3
const MEMBERSHIP_RETRY_DELAY_MS = 800

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function AuthProvider({ children }) {
  const [session,         setSession]         = React.useState(null)
  const [membership,      setMembership]      = React.useState(null)
  const [loading,         setLoading]         = React.useState(true)
  // null = sin error, 'membership_not_found' = autenticado pero sin membresía
  const [authError,       setAuthError]       = React.useState(null)

  // ── Carga membresías con reintentos para tolerar latencia RLS ────
  async function loadMembership(userId, retryCount = 0) {
    if (!userId) {
      setMembership(null)
      setAuthError(null)
      return
    }
    try {
      const { data, error } = await supabaseAuth
        .from('user_memberships')
        .select('role, tenant_id, store_id, branch_id, is_active, metadata')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        const errMsg = `[${error.code}] ${error.message} | hint: ${error.hint || '-'} | details: ${error.details || '-'}`
        console.error('[AuthProvider] loadMembership error:', errMsg)
        if (retryCount < MAX_MEMBERSHIP_RETRIES) {
          await sleep(MEMBERSHIP_RETRY_DELAY_MS)
          return loadMembership(userId, retryCount + 1)
        }
        setMembership(null)
        setAuthError('membership_load_failed:' + errMsg)
        return
      }

      if (!data || data.length === 0) {
        if (retryCount < MAX_MEMBERSHIP_RETRIES) {
          // Puede que RLS tarde un momento en propagarse tras el login
          await sleep(MEMBERSHIP_RETRY_DELAY_MS)
          return loadMembership(userId, retryCount + 1)
        }
        setMembership(null)
        setAuthError('membership_not_found')
        return
      }

      // Ordenar por jerarquía y quedarse con la de mayor rango
      const sorted = [...data].sort((a, b) => {
        const ai = ROLE_PRIORITY.indexOf(a.role)
        const bi = ROLE_PRIORITY.indexOf(b.role)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })

      console.log('[AuthProvider] rol resuelto:', sorted[0].role)
      setMembership(sorted[0])
      setAuthError(null)
    } catch (e) {
      console.warn('[AuthProvider] loadMembership exception:', e)
      if (retryCount < MAX_MEMBERSHIP_RETRIES) {
        await sleep(MEMBERSHIP_RETRY_DELAY_MS)
        return loadMembership(userId, retryCount + 1)
      }
      setMembership(null)
      setAuthError('membership_exception')
    }
  }

  React.useEffect(() => {
    let mounted = true

    // ── Aplica una sesión de Supabase Auth ────────────────────────
    async function applyNativeSession(s) {
      if (!s?.user?.id) {
        if (mounted) { setSession(null); setMembership(null); setLoading(false); setAuthError(null) }
        return
      }
      persistStoredSession(STORAGE_KEYS.admin, {
        user: s.user,
        supabase_access_token: s.access_token,
        auth_expires_at: s.expires_at
          ? new Date(s.expires_at * 1000).toISOString()
          : null,
        _source: 'supabaseAuth',
      })
      // Cargar membership ANTES de setLoading(false) para tener el role listo
      await loadMembership(s.user.id)
      if (mounted) { setSession(s); setLoading(false) }
    }

    // ── Aplica una sesión legacy de staff (PIN login) ─────────────
    function applyLegacySession() {
      const active = readActiveStoredSession()
      const s = active ? buildSessionFromStored(active.stored) : null
      if (mounted) { setSession(s); setLoading(false) }
    }

    async function init() {
      const { data: { session: s } } = await supabaseAuth.auth.getSession()
      if (!mounted) return
      if (s?.user?.id) {
        await applyNativeSession(s)
        return
      }
      applyLegacySession()
    }

    init()

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      if (!s) {
        const current = loadStoredSession(STORAGE_KEYS.admin)
        if (current?._source === 'supabaseAuth') clearStoredSession(STORAGE_KEYS.admin)
        if (mounted) { setSession(null); setMembership(null); setAuthError(null) }
        return
      }
      // Usamos setTimeout(0) para evitar el warning de React sobre updates durante render
      window.setTimeout(() => {
        if (!mounted) return
        applyNativeSession(s)
      }, 0)
    })

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
    setAuthError(null)
  }

  // Permite forzar una recarga de la membresía desde cualquier componente
  async function retryLoadMembership() {
    const userId = session?.user?.id
    if (!userId) return
    setLoading(true)
    await loadMembership(userId)
    setLoading(false)
  }

  const value = {
    session,
    user:            session?.user || null,
    membership,
    loading,
    authError,
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
    retryLoadMembership,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
