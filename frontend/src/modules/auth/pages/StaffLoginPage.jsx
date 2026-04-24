import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { buildBackendUrl } from '../../../shared/lib/backendBase'
import { persistStoredSession, STORAGE_KEYS } from '../../../legacy/lib/appSession'

const ROLE_PATHS = {
  kitchen: 'kitchen',
  rider: 'riders',
  cashier: 'admin',
  branch_manager: 'admin',
  store_operator: 'admin',
  store_admin: 'admin',
}

function resolveStorageKey(role) {
  if (role === 'rider') return STORAGE_KEYS.repartidor
  if (role === 'kitchen') return STORAGE_KEYS.cocina
  return STORAGE_KEYS.admin
}

export default function StaffLoginPage() {
  const { storeSlug, branchSlug } = useParams()
  const navigate = useNavigate()
  const [branch, setBranch] = React.useState(null)
  const [store, setStore] = React.useState(null)
  const [username, setUsername] = React.useState('')
  const [pin, setPin] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!storeSlug || !branchSlug) {
        setLoading(false)
        return
      }

      const { data: storeData } = await supabaseAuth
        .from('stores')
        .select('id, name, slug, theme_tokens')
        .eq('slug', storeSlug)
        .maybeSingle()
      const { data: branchData } = await supabaseAuth
        .from('branches')
        .select('id, name, slug, store_id')
        .eq('store_id', storeData?.id)
        .eq('slug', branchSlug)
        .maybeSingle()

      if (cancelled) return
      setStore(storeData || null)
      setBranch(branchData || null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [storeSlug, branchSlug])

  async function handleLogin(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await fetch(buildBackendUrl('/public/staff/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug,
          branchSlug,
          username: username.trim(),
          pin: pin.trim(),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || payload?.message || 'No se pudo iniciar sesiÃ³n.')

      const session = payload?.data?.session || payload?.session
      const membership = session?.session_membership || {}
      const resolvedStore = payload?.data?.store || payload?.store || store
      const resolvedBranch = payload?.data?.branch || payload?.branch || branch
      const resolvedRole = session?.role || membership.role

      if (!session?.supabase_access_token || !resolvedRole) {
        throw new Error('La sesiÃ³n de staff llegÃ³ incompleta.')
      }

      persistStoredSession(resolveStorageKey(resolvedRole), session)
      setStore(resolvedStore || null)
      setBranch(resolvedBranch || null)

      const dest = ROLE_PATHS[resolvedRole] || 'admin'
      const query = new URLSearchParams({
        store_id: session.store_id || membership.store_id || resolvedStore?.id || '',
        branch_id: session.branch_id || membership.branch_id || resolvedBranch?.id || '',
      })
      navigate(`/branch/${dest}?${query.toString()}`, { replace: true })
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:14, color:'var(--color-text-secondary)' }}>Cargando...</div>
  )
  if (!branch || !store) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:12, padding:'2rem' }}>
      <div style={{ fontSize:40 }}>404</div>
      <div style={{ fontSize:14, color:'var(--color-text-secondary)' }}>Sede no encontrada</div>
      <div style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>{storeSlug}/{branchSlug}</div>
    </div>
  )

  const primary = store.theme_tokens?.primary || 'var(--color-text-primary)'

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--color-background-tertiary)', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:360, background:'var(--color-background-primary)',
        borderRadius:16, border:'0.5px solid var(--color-border-tertiary)', padding:'2rem' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:primary, margin:'0 auto 12px',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:500, fontSize:18 }}>
            {store.name[0]}
          </div>
          <div style={{ fontWeight:500, fontSize:16 }}>{store.name}</div>
          <div style={{ fontSize:13, color:'var(--color-text-secondary)', marginTop:3 }}>{branch.name}</div>
          <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:4 }}>
            {storeSlug}/{branchSlug}
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display:'grid', gap:14 }}>
          {error && <div style={{ padding:'8px 12px', background:'var(--color-background-danger)',
            color:'var(--color-text-danger)', borderRadius:8, fontSize:13 }}>{error}</div>}
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
              Nombre / usuario
            </label>
            <input style={{ width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14,
              border:'1px solid var(--color-border-secondary)', background:'var(--color-background-primary)',
              color:'var(--color-text-primary)', fontFamily:'inherit', boxSizing:'border-box', outline:'none' }}
              autoComplete="username" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Camila" required />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
              PIN
            </label>
            <input style={{ width:'100%', padding:'9px 12px', borderRadius:8, fontSize:24,
              border:'1px solid var(--color-border-secondary)', background:'var(--color-background-primary)',
              color:'var(--color-text-primary)', fontFamily:'monospace', boxSizing:'border-box',
              outline:'none', letterSpacing:'0.3em', textAlign:'center' }}
              type="password" inputMode="numeric" maxLength={8} autoComplete="current-password"
              value={pin} onChange={e => setPin(e.target.value)} placeholder="â€¢â€¢â€¢â€¢" required />
          </div>
          <button type="submit" disabled={busy} style={{ padding:'11px', borderRadius:8,
            border:'none', background: primary, color:'#fff',
            fontSize:14, fontWeight:500, cursor:busy ? 'wait' : 'pointer', fontFamily:'inherit', marginTop:4 }}>
            {busy ? 'Entrando...' : 'Entrar a mi estaciÃ³n'}
          </button>
        </form>

        <div style={{ marginTop:16, textAlign:'center', fontSize:11, color:'var(--color-text-tertiary)' }}>
          Acceso exclusivo para staff de esta sede
        </div>
      </div>
    </div>
  )
}
