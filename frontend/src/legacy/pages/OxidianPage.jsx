import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { SUPER_ADMIN_BRAND } from '../lib/adminBranding'
import { loadStoreCatalog } from '../lib/storeManagement'
import AdminRolesTab from './AdminRolesTab'
import OxidianSuperAdminTab from './OxidianSuperAdminTab'
import { requestAppLogin } from '../lib/appAuthApi'
import { STORAGE_KEYS, clearStoredSession, loadStoredSession, persistStoredSession } from '../lib/appSession'

const SESSION_KEY = 'oxidian_admin'
const TEMPLATE_STORE_ID = import.meta.env.VITE_OXIDIAN_TEMPLATE_STORE_ID || 'default'

const TAB_OPTIONS = [
  { id: 'overview', label: 'Vision global' },
  { id: 'stores',   label: 'Tiendas' },
  { id: 'roles',    label: 'Admins de tienda' },
  { id: 'links',    label: 'Links de acceso' },
]

const shellStyles = {
  page: {
    minHeight: '100dvh',
    background: 'radial-gradient(circle at top, #172554 0%, #0F172A 45%, #020617 100%)',
    color: 'white',
    fontFamily: "'Nunito', system-ui, sans-serif",
  },
  loginWrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(15,23,42,.8)',
    border: '1px solid rgba(129,140,248,.26)',
    borderRadius: 24,
    padding: 30,
    boxShadow: '0 24px 80px rgba(2,6,23,.45)',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    border: '1.5px solid rgba(129,140,248,.28)',
    background: 'rgba(255,255,255,.05)',
    color: 'white',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontWeight: 800,
    outline: 'none',
  },
  button: {
    width: '100%',
    marginTop: 12,
    padding: '13px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#4F46E5,#818CF8)',
    color: 'white',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
}

async function sha256(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function loadOxidianPasswordHash() {
  // La contraseña maestra de OXIDIAN es global: vive en la tabla `settings`
  // con clave `oxidian_admin_password_hash` (preferida) o `admin_password_hash` (legado).
  // NUNCA buscar por store_id porque OXIDIAN es el super-admin del SaaS completo.
  const { data, error } = await supabase
    .from('settings')
    .select('key,value')
    .in('key', ['oxidian_admin_password_hash', 'admin_password_hash'])

  if (error) {
    // Si la tabla settings no existe aún, no bloquear el acceso
    if (/does not exist|schema cache|relation/i.test(String(error.message || ''))) return ''
    throw error
  }

  const settingsMap = Object.fromEntries((data || []).map(row => [row.key, row.value]))
  return settingsMap.oxidian_admin_password_hash || settingsMap.admin_password_hash || ''
}

function buildCleanLinks(store) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const isDefault = !store.code || store.code === 'default'
  const prefix = isDefault ? '' : `/s/${store.code}`
  return [
    { label: 'Menú público',            icon: '🛒', url: `${base}${prefix}/menu`,       desc: 'Clientes' },
    { label: 'Panel admin',             icon: '⚙️', url: `${base}${prefix}/admin`,      desc: 'Operador' },
    { label: 'Portal afiliados',        icon: '🤝', url: `${base}${prefix}/afiliado`,   desc: 'Repartidores' },
    { label: 'PWA Cocina',              icon: '👨‍🍳', url: `${base}${prefix}/pedidos`,   desc: 'Tablet cocina' },
    { label: 'PWA Repartidor',          icon: '🛵', url: `${base}${prefix}/repartidor`, desc: 'Móvil repartidor' },
  ]
}

function LinkCopyRow({ item }) {
  const [copied, setCopied] = React.useState(false)
  function copy() {
    navigator.clipboard.writeText(item.url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', marginBottom:6 }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:'.82rem' }}>{item.label}</div>
        <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.url}</div>
        <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.38)', marginTop:2 }}>{item.desc}</div>
      </div>
      <button onClick={copy} style={{ flexShrink:0, padding:'5px 10px', borderRadius:7, border:'none', background:copied?'rgba(34,197,94,.28)':'rgba(255,255,255,.1)', color:copied?'#86EFAC':'rgba(255,255,255,.8)', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .2s' }}>
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function LinksTabContent({ entries }) {
  if (!entries.length) return (
    <div style={{ color:'rgba(255,255,255,.5)', fontWeight:700 }}>No hay tiendas todavía.</div>
  )
  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,.22),rgba(15,23,42,.9))', border:'1px solid rgba(129,140,248,.22)', borderRadius:18, padding:'16px 18px' }}>
        <div style={{ fontSize:'.72rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(199,210,254,.72)' }}>Links de acceso</div>
        <div style={{ fontWeight:900, marginTop:4 }}>Copia y comparte los links de cada tenant</div>
        <div style={{ fontSize:'.82rem', color:'rgba(226,232,240,.72)', marginTop:6 }}>Cada tenant mantiene URLs aisladas para storefront, admin, cocina, reparto y afiliados dentro de la misma instancia SaaS.</div>
      </div>
      {entries.map(entry => (
        <div key={entry.store.id} style={{ background:'rgba(15,23,42,.55)', border:'1px solid rgba(255,255,255,.08)', borderRadius:18, padding:'16px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontWeight:900 }}>{entry.store.name}</div>
              <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.48)', marginTop:2 }}>{entry.store.code} · {entry.store.status}</div>
            </div>
            <span style={{ fontSize:'.66rem', fontWeight:900, textTransform:'uppercase', padding:'4px 8px', borderRadius:999, background:'rgba(99,102,241,.16)', color:'#C7D2FE' }}>
              {entry.plan?.name || 'Sin plan'}
            </span>
          </div>
          {buildCleanLinks(entry.store).map(item => <LinkCopyRow key={item.label} item={item} />)}
        </div>
      ))}
    </div>
  )
}

function StoreOverview({ entries, selectedStoreId, onSelectStore }) {
  const total = entries.length
  const active = entries.filter(entry => entry.store.status === 'active').length
  const draft = entries.filter(entry => entry.store.status === 'draft').length
  const paused = entries.filter(entry => entry.store.status === 'paused').length

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,.28), rgba(15,23,42,.9))', border: '1px solid rgba(129,140,248,.22)', borderRadius: 22, padding: '22px 24px' }}>
        <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 900, color: 'rgba(199,210,254,.72)' }}>
          {SUPER_ADMIN_BRAND.name}
        </div>
        <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: 8 }}>
          Centro maestro para gobernar una arquitectura multi-tenant sin mezclar identidades
        </div>
        <div style={{ marginTop: 10, lineHeight: 1.7, color: 'rgba(226,232,240,.82)', fontSize: '.86rem' }}>
          Cada tenant conserva su storefront, pedidos, admins, WhatsApp, branding y configuracion de IA. Desde aqui se crea, supervisa y escala la operacion SaaS completa.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        {[
          { label: 'Tiendas', value: total, tone: '#C7D2FE', bg: 'rgba(99,102,241,.14)', border: 'rgba(99,102,241,.26)' },
          { label: 'Activas', value: active, tone: '#86EFAC', bg: 'rgba(34,197,94,.12)', border: 'rgba(34,197,94,.25)' },
          { label: 'Borrador', value: draft, tone: '#FDE68A', bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.25)' },
          { label: 'Pausadas', value: paused, tone: '#FCA5A5', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.25)' },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 18, padding: '16px 18px' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: card.tone, opacity: .8 }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 900, color: card.tone, marginTop: 6 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(15,23,42,.55)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)' }}>
              Acceso rapido
            </div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>Tenants listos para operar</div>
          </div>
          {entries.length > 0 && (
            <select
              data-testid="oxidian-overview-store-select"
              value={selectedStoreId}
              onChange={event => onSelectStore(event.target.value)}
              style={{ minWidth: 230, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(129,140,248,.26)', background: 'rgba(255,255,255,.05)', color: 'white', fontFamily: 'inherit', fontWeight: 800 }}
            >
              {entries.map(entry => (
                <option key={entry.store.id} value={entry.store.id} style={{ color: '#0F172A' }}>
                  {entry.store.name} · {entry.store.code}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {entries.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,.45)', fontWeight: 700 }}>No hay tiendas registradas todavia.</div>
          )}
          {entries.slice(0, 8).map(entry => (
            <div key={entry.store.id} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900 }}>{entry.store.name}</div>
                <div style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
                  {entry.store.code} · {entry.store.city || 'Sin ciudad'} · {entry.store.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={entry.store.code && entry.store.code !== 'default' ? `/s/${entry.store.code}/admin` : '/admin'} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'rgba(34,197,94,.16)', border: '1px solid rgba(34,197,94,.25)', color: '#BBF7D0', fontWeight: 800, fontSize: '.76rem' }}>
                  Admin
                </a>
                <a href={entry.store.code && entry.store.code !== 'default' ? `/s/${entry.store.code}/menu` : '/menu'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'rgba(99,102,241,.16)', border: '1px solid rgba(99,102,241,.28)', color: '#C7D2FE', fontWeight: 800, fontSize: '.76rem' }}>
                  Menú
                </a>
                <a href={entry.store.code && entry.store.code !== 'default' ? `/s/${entry.store.code}/pedidos` : '/pedidos'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)', color: '#FDE68A', fontWeight: 800, fontSize: '.76rem' }}>
                  Cocina
                </a>
                <a href={entry.store.code && entry.store.code !== 'default' ? `/s/${entry.store.code}/repartidor` : '/repartidor'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.25)', color: '#FDBA74', fontWeight: 800, fontSize: '.76rem' }}>
                  Repartidor
                </a>
                <a href={entry.store.code && entry.store.code !== 'default' ? `/s/${entry.store.code}/afiliado` : '/afiliado'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.25)', color: '#E9D5FF', fontWeight: 800, fontSize: '.76rem' }}>
                  Afiliados
                </a>
                <button data-testid={`oxidian-manage-store-${entry.store.id}`} onClick={() => onSelectStore(entry.store.id)} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', fontSize: '.76rem' }}>
                  Gestionar admins
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OxidianPage() {
  const [auth, setAuth] = useState(() => Boolean(loadStoredSession(STORAGE_KEYS.oxidian) || sessionStorage.getItem(SESSION_KEY) === '1'))
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState(0)
  const [tab, setTab] = useState('overview')
  const [entries, setEntries] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  useEffect(() => {
    if (!auth) return
    refreshStores()
  }, [auth])

  async function refreshStores() {
    try {
      const result = await loadStoreCatalog()
      const visibleStores = (result.stores || []).filter(entry => entry.store.id !== TEMPLATE_STORE_ID)
      setEntries(visibleStores)
      setSelectedStoreId(current => {
        if (current && visibleStores.some(entry => entry.store.id === current)) return current
        return visibleStores[0]?.store.id || ''
      })
    } catch (error) {
      toast.error(error.message || 'No pude cargar las tiendas')
    }
  }

  async function secureLogin() {
    if (!password.trim()) return
    if (Date.now() < lockUntil) {
      toast.error(`Bloqueado. Espera ${Math.ceil((lockUntil - Date.now()) / 1000)}s`)
      return
    }

    setLoading(true)
    try {
      const session = await requestAppLogin({
        scope: 'oxidian',
        password,
      })
      persistStoredSession(STORAGE_KEYS.oxidian, session)
      setAttempts(0)
      setAuth(true)
    } catch (error) {
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      if (nextAttempts >= 5) {
        setLockUntil(Date.now() + 5 * 60 * 1000)
        toast.error('Bloqueado durante 5 minutos')
      } else {
        toast.error(error.message || `Contrasena incorrecta (${nextAttempts}/5)`)
      }
      setPassword('')
    }
    setLoading(false)
  }

  function secureLogout() {
    clearStoredSession(STORAGE_KEYS.oxidian)
    sessionStorage.removeItem(SESSION_KEY)
    setAuth(false)
    setPassword('')
  }

  async function login() {
    if (!password.trim()) return
    if (Date.now() < lockUntil) {
      toast.error(`Bloqueado. Espera ${Math.ceil((lockUntil - Date.now()) / 1000)}s`)
      return
    }

    setLoading(true)
    try {
      const [hashHex, expectedHash] = await Promise.all([
        sha256(password),
        loadOxidianPasswordHash(),
      ])

      if (expectedHash && expectedHash === hashHex) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setAttempts(0)
        setAuth(true)
      } else {
        const nextAttempts = attempts + 1
        setAttempts(nextAttempts)
        if (nextAttempts >= 5) {
          setLockUntil(Date.now() + 5 * 60 * 1000)
          toast.error('Bloqueado durante 5 minutos')
        } else {
          toast.error(`Contrasena incorrecta (${nextAttempts}/5)`)
        }
        setPassword('')
      }
    } catch (error) {
      toast.error(error.message || 'No pude validar el acceso')
    }
    setLoading(false)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuth(false)
    setPassword('')
  }

  const selectedEntry = useMemo(
    () => entries.find(entry => entry.store.id === selectedStoreId) || null,
    [entries, selectedStoreId],
  )

  if (!auth) {
    return (
      <div style={shellStyles.loginWrap}>
        <div style={shellStyles.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>⬡</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, background: 'linear-gradient(90deg,#A5B4FC,#E0E7FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {SUPER_ADMIN_BRAND.name}
            </div>
            <div style={{ marginTop: 8, color: 'rgba(226,232,240,.62)', fontWeight: 700, fontSize: '.84rem' }}>
              Acceso web al centro maestro del SaaS
            </div>
          </div>

          {Date.now() < lockUntil && (
            <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.28)', borderRadius: 12, padding: '10px 12px', color: '#FCA5A5', marginBottom: 12, fontWeight: 800, fontSize: '.8rem' }}>
              Acceso temporalmente bloqueado por intentos fallidos.
            </div>
          )}

          <input
            data-testid="oxidian-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && !loading && secureLogin()}
            placeholder="Contrasena maestra de OXIDIAN"
            style={shellStyles.input}
            autoFocus
            disabled={loading || Date.now() < lockUntil}
          />
          <button data-testid="oxidian-login-button" onClick={secureLogin} disabled={loading || Date.now() < lockUntil} style={shellStyles.button}>
            {loading ? 'Verificando...' : 'Acceder a OXIDIAN'}
          </button>

          <div style={{ marginTop: 18, fontSize: '.78rem', color: 'rgba(226,232,240,.56)', lineHeight: 1.6 }}>
            Este acceso es solo para crear, supervisar y gobernar tiendas. La operacion diaria de cada marca se hace desde su propio panel en <code>/admin?store=...</code>.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={shellStyles.page}>
      <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ fontSize: '1.3rem' }}>⬡</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem' }}>{SUPER_ADMIN_BRAND.name}</div>
          <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.48)', fontWeight: 700 }}>Centro SaaS multi-tienda</div>
        </div>
        <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.12em', padding: '4px 8px', borderRadius: 999, background: 'rgba(99,102,241,.16)', color: '#C7D2FE', fontWeight: 900 }}>
          Super admin
        </span>
        <div style={{ flex: 1 }} />
        <a href="/admin" style={{ color: 'rgba(255,255,255,.7)', fontWeight: 700, textDecoration: 'none', fontSize: '.8rem' }}>
          Panel de tienda
        </a>
        <button onClick={secureLogout} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: 'rgba(255,255,255,.72)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          Salir
        </button>
      </header>

      <nav style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {TAB_OPTIONS.map(option => (
          <button
            data-testid={`oxidian-tab-${option.id}`}
            key={option.id}
            onClick={() => setTab(option.id)}
            style={{
              padding: '9px 14px',
              borderRadius: 12,
              border: tab === option.id ? '1px solid rgba(129,140,248,.42)' : '1px solid rgba(255,255,255,.08)',
              background: tab === option.id ? 'rgba(99,102,241,.16)' : 'rgba(255,255,255,.03)',
              color: tab === option.id ? '#E0E7FF' : 'rgba(255,255,255,.66)',
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: 20, maxWidth: 1300, margin: '0 auto' }}>
        {tab === 'overview' && (
          <StoreOverview
            entries={entries}
            selectedStoreId={selectedStoreId}
            onSelectStore={value => {
              setSelectedStoreId(value)
              setTab('roles')
            }}
          />
        )}
        {tab === 'stores' && <OxidianSuperAdminTab />}
        {tab === 'roles' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: 'rgba(15,23,42,.55)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 900, color: 'rgba(255,255,255,.48)' }}>
                  Gobierno de accesos
                </div>
                <div style={{ fontWeight: 900, marginTop: 4 }}>
                  {selectedEntry ? `Admins de ${selectedEntry.store.name}` : 'Selecciona una tienda'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  data-testid="oxidian-role-store-select"
                  value={selectedStoreId}
                  onChange={event => setSelectedStoreId(event.target.value)}
                  style={{ minWidth: 260, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(129,140,248,.26)', background: 'rgba(255,255,255,.05)', color: 'white', fontFamily: 'inherit', fontWeight: 800 }}
                >
                  {entries.map(entry => (
                    <option key={entry.store.id} value={entry.store.id} style={{ color: '#0F172A' }}>
                      {entry.store.name} · {entry.store.code}
                    </option>
                  ))}
                </select>
                {selectedStoreId && (
                  <>
                    <a href={selectedEntry?.store?.code && selectedEntry.store.code !== 'default' ? `/s/${selectedEntry.store.code}/admin` : '/admin'} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,.16)', border: '1px solid rgba(34,197,94,.25)', color: '#BBF7D0', fontWeight: 800, fontSize: '.78rem' }}>
                      Admin
                    </a>
                    <a href={selectedEntry?.store?.code && selectedEntry.store.code !== 'default' ? `/s/${selectedEntry.store.code}/menu` : '/menu'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: 'rgba(99,102,241,.16)', border: '1px solid rgba(99,102,241,.28)', color: '#C7D2FE', fontWeight: 800, fontSize: '.78rem' }}>
                      Menú
                    </a>
                    <a href={selectedEntry?.store?.code && selectedEntry.store.code !== 'default' ? `/s/${selectedEntry.store.code}/pedidos` : '/pedidos'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)', color: '#FDE68A', fontWeight: 800, fontSize: '.78rem' }}>
                      Cocina
                    </a>
                    <a href={selectedEntry?.store?.code && selectedEntry.store.code !== 'default' ? `/s/${selectedEntry.store.code}/repartidor` : '/repartidor'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.25)', color: '#FDBA74', fontWeight: 800, fontSize: '.78rem' }}>
                      Repartidor
                    </a>
                    <a href={selectedEntry?.store?.code && selectedEntry.store.code !== 'default' ? `/s/${selectedEntry.store.code}/afiliado` : '/afiliado'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.25)', color: '#E9D5FF', fontWeight: 800, fontSize: '.78rem' }}>
                      Afiliados
                    </a>
                  </>
                )}
              </div>
            </div>

            {selectedStoreId ? (
              <AdminRolesTab
                storeId={selectedStoreId}
                title={`Administradores de ${selectedEntry?.store?.name || 'la tienda'}`}
                description="Define los accesos del equipo de gestion de la tienda seleccionada sin entrar al panel operativo."
                infoMessage="Desde OXIDIAN puedes crear o bloquear admins de cada tienda. La operacion diaria y la configuracion comercial siguen dentro del panel propio de cada marca."
              />
            ) : (
              <div style={{ color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>No hay tiendas disponibles todavia.</div>
            )}
          </div>
        )}
        {tab === 'links' && (
          <LinksTabContent entries={entries} />
        )}
      </main>
    </div>
  )
}
