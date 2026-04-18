import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../legacy/lib/supabase'
import { persistStoredSession, STORAGE_KEYS } from '../../../legacy/lib/appSession'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

const ROLE_PATHS = { kitchen: 'kitchen', rider: 'riders', cashier: 'admin', branch_manager: 'admin' }

export default function StaffLoginPage() {
  const { storeSlug, branchSlug } = useParams()
  const navigate = useNavigate()
  const [branch, setBranch] = React.useState(null)
  const [store,  setStore]  = React.useState(null)
  const [username, setUsername] = React.useState('')
  const [pin, setPin]           = React.useState('')
  const [loading, setLoading]   = React.useState(true)
  const [busy, setBusy]         = React.useState(false)
  const [error, setError]       = React.useState('')

  React.useEffect(() => {
    async function load() {
      if (!storeSlug || !branchSlug) { setLoading(false); return }
      const { data: s } = await supabase.from('stores')
        .select('id, name, theme_tokens').eq('slug', storeSlug).maybeSingle()
      const { data: b } = await supabase.from('branches')
        .select('id, name, store_id').eq('store_id', s?.id).eq('slug', branchSlug).maybeSingle()
      setStore(s); setBranch(b); setLoading(false)
    }
    load()
  }, [storeSlug, branchSlug])

  async function handleLogin(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (!branch) throw new Error('Sede no encontrada')
      const hashHex = await sha256(pin)
      const { data: staff, error: se } = await supabase
        .from('staff_users')
        .select('*')
        .eq('store_id', branch.store_id)
        .eq('branch_id', branch.id)
        .eq('is_active', true)
        .or(`name.ilike.${username},username.eq.${username}`)
        .maybeSingle()
      if (se || !staff) throw new Error('Usuario no encontrado en esta sede')
      const pinMatch = staff.pin === pin || staff.pin === hashHex
      if (!pinMatch) throw new Error('PIN incorrecto')
      const session = {
        id: staff.id, name: staff.name, role: staff.role,
        store_id: branch.store_id, branch_id: branch.id,
        auth_expires_at: new Date(Date.now() + 8*3600*1000).toISOString(),
        supabase_access_token: '',
        user: { id: staff.user_id || staff.id },
      }
      const storageKey = staff.role === 'rider'
        ? STORAGE_KEYS.repartidor
        : staff.role === 'kitchen' ? STORAGE_KEYS.cocina : STORAGE_KEYS.admin
      persistStoredSession(storageKey, session)
      const dest = ROLE_PATHS[staff.role] || 'admin'
      navigate(`/branch/${dest}`)
    } catch(e) { setError(e.message) }
    setBusy(false)
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
              value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" required />
          </div>
          <button type="submit" disabled={busy} style={{ padding:'11px', borderRadius:8,
            border:'none', background: primary, color:'#fff',
            fontSize:14, fontWeight:500, cursor:busy ? 'wait' : 'pointer', fontFamily:'inherit', marginTop:4 }}>
            {busy ? 'Entrando...' : 'Entrar a mi estación'}
          </button>
        </form>

        <div style={{ marginTop:16, textAlign:'center', fontSize:11, color:'var(--color-text-tertiary)' }}>
          Acceso exclusivo para staff de esta sede
        </div>
      </div>
    </div>
  )
}
