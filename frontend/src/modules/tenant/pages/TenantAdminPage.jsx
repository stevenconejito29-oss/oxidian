import React from 'react'
import { useNavigate } from 'react-router-dom'
import AdminStoreCustomizationPanel from '../../../legacy/pages/AdminStoreCustomizationPanel'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'
import { tenantApi } from '../../../shared/lib/backofficeApi'

// ─── Estilos inline reutilizables ────────────────────────────────
const UI = {
  shell:   { maxWidth: 1120, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' },
  tabs:    { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 24px', paddingBottom: 8, borderBottom: '1px solid var(--color-border-tertiary)' },
  tab:     (active) => ({ padding: '8px 16px', borderRadius: 999, border: active ? 'none' : '1px solid var(--color-border-secondary)', background: active ? 'var(--color-text-primary)' : 'transparent', color: active ? 'var(--color-background-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }),
  card:    { background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 },
  muted:   { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 },
  grid:    { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
  stats:   { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 16 },
  stat:    { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 14 },
  label:   { display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' },
  cols:    { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  primary: { padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' },
  ghost:   { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)', fontFamily: 'inherit', cursor: 'pointer' },
  notice:  (tone) => ({ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: tone === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)', color: tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)', fontSize: 13 }),
}

// ─── Nichos con estilos de menú disponibles ───────────────────────
const NICHES = [
  { id: 'restaurant',         label: 'Restaurante / Delivery',   icon: '🍕', templateId: 'delivery',  color: '#ef4444' },
  { id: 'supermarket',        label: 'Supermercado / Tienda',    icon: '🛒', templateId: 'vitrina',   color: '#22c55e' },
  { id: 'boutique_fashion',   label: 'Boutique / Moda',          icon: '👗', templateId: 'portfolio', color: '#ec4899' },
  { id: 'pharmacy',           label: 'Farmacia / Parafarmacia',  icon: '💊', templateId: 'minimal',   color: '#0ea5e9' },
  { id: 'neighborhood_store', label: 'Tienda de Barrio',         icon: '🏪', templateId: 'minimal',   color: '#f97316' },
  { id: 'barbershop',         label: 'Barbería',                 icon: '✂️', templateId: 'booking',   color: '#1e40af' },
  { id: 'beauty_salon',       label: 'Salón de Belleza',         icon: '💅', templateId: 'booking',   color: '#a855f7' },
  { id: 'nail_salon',         label: 'Salón de Uñas',            icon: '💅', templateId: 'booking',   color: '#f43f5e' },
  { id: 'services',           label: 'Servicios Profesionales',  icon: '🛠️', templateId: 'booking',   color: '#6366f1' },
  { id: 'universal',          label: 'Otro / Universal',         icon: '⭐', templateId: 'delivery',  color: '#64748b' },
]

// 5 estilos de menú que el dueño puede elegir
const MENU_STYLES = [
  { id: 'delivery',  label: 'Tarjetas Delivery',  icon: '🍔', desc: 'Ideal restaurantes y comida rápida. Imagen grande, añadir rápido.',     niches: ['restaurant','supermarket','universal','neighborhood_store'] },
  { id: 'vitrina',   label: 'Cuadrícula Market',  icon: '🛒', desc: 'Dense grid estilo supermercado. Stock visible, búsqueda lateral.',      niches: ['supermarket','pharmacy','neighborhood_store'] },
  { id: 'portfolio', label: 'Editorial Boutique', icon: '👗', desc: 'Minimalista tipo revista de moda. Imagen a pantalla completa.',          niches: ['boutique_fashion'] },
  { id: 'minimal',   label: 'Lista Catálogo',     icon: '📋', desc: 'Lista densa con precio y stock. Farmacias y tiendas de barrio.',         niches: ['pharmacy','neighborhood_store','services'] },
  { id: 'booking',   label: 'Citas y Reservas',   icon: '📅', desc: 'Servicios con duración y precio. Para barberías y salones de belleza.',  niches: ['barbershop','beauty_salon','nail_salon','services'] },
]

const STAFF_ROLES = [
  ['tenant_admin',   'Admin del tenant', 'tenant'],
  ['store_admin',    'Admin de tienda',  'store'],
  ['store_operator', 'Operador',         'store'],
  ['branch_manager', 'Manager de sede',  'branch'],
  ['cashier',        'Caja',             'branch'],
  ['kitchen',        'Preparación',      'branch'],
  ['rider',          'Repartidor',       'branch'],
]

const TABS = [
  ['overview',   'Resumen'],
  ['stores',     'Tiendas'],
  ['branches',   'Sedes'],
  ['staff',      'Staff'],
  ['customize',  'Personalizar'],
]

function slugify(v) {
  return String(v || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

function Badge({ ok, text }) {
  const c = ok ? '#16a34a' : '#9ca3af'
  return <span style={{ fontSize: 11, fontWeight: 600, color: c, background: `${c}20`, padding: '3px 8px', borderRadius: 999 }}>{text}</span>
}

// ─── Selector visual de nicho ─────────────────────────────────────
function NichePicker({ value, onChange }) {
  return (
    <div>
      <label style={UI.label}>Tipo de negocio (nicho) *</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {NICHES.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => onChange(n)}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: value === n.id
                ? `2px solid ${n.color}`
                : '1px solid var(--color-border-secondary)',
              background: value === n.id ? `${n.color}12` : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: '.15s',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{n.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: value === n.id ? n.color : 'var(--color-text-primary)' }}>
              {n.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Selector visual de estilo de menú ───────────────────────────
function MenuStylePicker({ value, onChange, niche }) {
  // Mostrar todos los estilos, resaltar los recomendados para el nicho
  return (
    <div>
      <label style={UI.label}>Estilo del menú público *</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {MENU_STYLES.map(s => {
          const recommended = niche && s.niches.includes(niche)
          const selected    = value === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              style={{
                padding: 12,
                borderRadius: 10,
                border: selected
                  ? '2px solid var(--color-text-primary)'
                  : '1px solid var(--color-border-secondary)',
                background: selected
                  ? 'var(--color-background-secondary)'
                  : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              {recommended && !selected && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  fontSize: 9, background: '#22c55e', color: '#fff',
                  borderRadius: 4, padding: '1px 5px', fontWeight: 700,
                }}>Recomendado</span>
              )}
              <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{s.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TenantAdminPage() {
  const navigate = useNavigate()
  const { tenantId, role } = useAuth()
  const [tab,            setTab]            = React.useState('overview')
  const [loading,        setLoading]        = React.useState(true)
  const [error,          setError]          = React.useState('')
  const [dashboard,      setDashboard]      = React.useState({})
  const [stores,         setStores]         = React.useState([])
  const [branches,       setBranches]       = React.useState([])
  const [accounts,       setAccounts]       = React.useState([])
  const [planId,         setPlanId]         = React.useState('growth')
  const [selectedStoreId,setSelectedStoreId]= React.useState('')
  const [busy,           setBusy]           = React.useState('')

  // ── Formulario de tienda con nicho y estilo de menú ──────────────
  const [storeForm, setStoreForm] = React.useState({
    name: '', slug: '', niche: '', templateId: '', city: '',
    initial_branch_name: 'Sede principal',
    initial_branch_slug: 'principal',
    initial_branch_city: '', initial_branch_address: '',
  })

  const [branchForm, setBranchForm] = React.useState({
    name: 'Nueva sede', slug: 'nueva-sede', city: '', address: '', phone: '',
  })

  const [staffForm, setStaffForm] = React.useState({
    full_name: '', email: '', password: '', role: 'store_admin', store_id: '', branch_id: '',
  })

  const selectedStore   = stores.find(s => s.id === selectedStoreId) || stores[0] || null
  const selectedRole    = STAFF_ROLES.find(r => r[0] === staffForm.role) || STAFF_ROLES[0]
  const storeBranches   = branches.filter(b => b.store_id === selectedStore?.id)
  const scopedBranches  = branches.filter(b => b.store_id === staffForm.store_id)

  const load = React.useCallback(async () => {
    if (!tenantId) return setLoading(false)
    setLoading(true); setError('')
    try {
      const [nextDashboard, nextStores, nextBranches, nextAccounts, nextSub] = await Promise.all([
        tenantApi('GET', '/dashboard'),
        tenantApi('GET', '/stores'),
        tenantApi('GET', '/branches'),
        tenantApi('GET', '/accounts/staff'),
        supabaseAuth.from('tenant_subscriptions').select('plan_id').eq('tenant_id', tenantId).maybeSingle(),
      ])
      setDashboard(nextDashboard || {})
      setStores(nextStores || [])
      setBranches(nextBranches || [])
      setAccounts(nextAccounts || [])
      setPlanId(nextSub?.data?.plan_id || 'growth')
      setSelectedStoreId(c => c && (nextStores || []).some(s => s.id === c) ? c : (nextStores?.[0]?.id || ''))
      setStaffForm(c => ({ ...c, store_id: c.store_id || nextStores?.[0]?.id || '' }))
    } catch (e) {
      setError(e.message || 'No se pudo cargar el panel.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  React.useEffect(() => { load() }, [load])

  async function run(label, action, onDone) {
    setBusy(label); setError('')
    try { await action(); await load(); onDone?.() }
    catch (e) { setError(e.message || 'Operación fallida') }
    finally { setBusy('') }
  }

  // ── Handler: crear tienda con nicho + estilo de menú ──────────────
  async function handleCreateStore() {
    if (!storeForm.name || !storeForm.slug || !storeForm.niche || !storeForm.templateId) {
      setError('Completa nombre, slug, nicho y estilo de menú'); return
    }
    await run('store', () =>
      tenantApi('POST', '/stores', {
        name:                  storeForm.name,
        slug:                  storeForm.slug,
        id:                    storeForm.slug,
        niche:                 storeForm.niche,
        business_type:         NICHES.find(n => n.id === storeForm.niche)?.templateId || 'food',
        template_id:           storeForm.templateId,
        city:                  storeForm.city,
        initial_branch_name:   storeForm.initial_branch_name,
        initial_branch_slug:   storeForm.initial_branch_slug,
        initial_branch_city:   storeForm.initial_branch_city,
        initial_branch_address:storeForm.initial_branch_address,
      }),
    () => {
      setSelectedStoreId(storeForm.slug)
      setTab('customize')
      setStoreForm({ name:'', slug:'', niche:'', templateId:'', city:'', initial_branch_name:'Sede principal', initial_branch_slug:'principal', initial_branch_city:'', initial_branch_address:'' })
    })
  }

  if (!tenantId) return (
    <div style={UI.shell}>
      <div style={UI.notice('error')}>
        Esta cuenta no tiene tenant asignado. Pide al super admin que asigne tu rol.
      </div>
    </div>
  )
  if (loading) return <div style={{ ...UI.shell, color: 'var(--color-text-secondary)' }}>Cargando panel…</div>

  return (
    <div style={UI.shell}>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Panel del dueño · {role}
      </div>
      <h1 style={{ fontSize: 26, margin: '6px 0 8px' }}>Mis tiendas, sedes y staff</h1>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
        Crea tiendas por nicho, personaliza el menú que ve el cliente y gestiona a tu equipo.
      </p>

      {/* Stats */}
      <div style={UI.stats}>
        {[['Plan', planId], ['Tiendas', stores.length], ['Sedes', branches.length], ['Staff', accounts.length], ['Pedidos hoy', dashboard.orders_today || 0]]
          .map(([l, v]) => (
            <div key={l} style={UI.stat}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{v}</div>
            </div>
          ))}
      </div>

      {error && <div style={{ ...UI.notice('error'), marginTop: 12 }}>{error}</div>}

      {/* Tabs */}
      <div style={UI.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" style={UI.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── RESUMEN ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Bienvenido a tu panel</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Crea una tienda eligiendo el nicho de tu negocio. El sistema configurará
              automáticamente las funciones y el estilo del menú que verán tus clientes.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button style={UI.primary} type="button" onClick={() => setTab('stores')}>+ Crear tienda</button>
              <button style={UI.ghost}   type="button" onClick={() => setTab('staff')}>Crear staff</button>
            </div>
          </div>
          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Tiendas activas ({stores.length})</h2>
            {stores.map(s => (
              <div key={s.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {NICHES.find(n => n.id === s.niche)?.icon || '⭐'} {s.niche || s.business_type} · {s.city || 'Sin ciudad'}
                    </div>
                  </div>
                  <Badge ok={s.status === 'active'} text={s.status || 'draft'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button"
                    onClick={() => window.open(`/s/${s.slug || s.id}/menu`, '_blank')}>
                    Ver menú público
                  </button>
                  <button style={UI.primary} type="button"
                    onClick={() => { setSelectedStoreId(s.id); setTab('customize') }}>
                    Personalizar
                  </button>
                </div>
              </div>
            ))}
            {!stores.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Aún no hay tiendas.</div>}
          </div>
        </div>
      )}

      {/* ── CREAR TIENDA ─────────────────────────────────────────── */}
      {tab === 'stores' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Crear nueva tienda</h2>

            {/* Nombre + slug */}
            <div style={{ ...UI.cols, marginBottom: 16 }}>
              <div>
                <label style={UI.label}>Nombre de la tienda *</label>
                <input style={UI.input} value={storeForm.name}
                  onChange={e => setStoreForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                  placeholder="Mi Restaurante" />
              </div>
              <div>
                <label style={UI.label}>Slug (URL pública) *</label>
                <input style={UI.input} value={storeForm.slug}
                  onChange={e => setStoreForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="mi-restaurante" />
              </div>
              <div>
                <label style={UI.label}>Ciudad</label>
                <input style={UI.input} value={storeForm.city}
                  onChange={e => setStoreForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Madrid" />
              </div>
            </div>

            {/* Nicho */}
            <div style={{ marginBottom: 20 }}>
              <NichePicker
                value={storeForm.niche}
                onChange={niche => setStoreForm(f => ({
                  ...f,
                  niche:      niche.id,
                  templateId: niche.templateId,  // pre-selecciona el estilo recomendado
                }))}
              />
            </div>

            {/* Estilo de menú */}
            <div style={{ marginBottom: 20 }}>
              <MenuStylePicker
                value={storeForm.templateId}
                niche={storeForm.niche}
                onChange={tid => setStoreForm(f => ({ ...f, templateId: tid }))}
              />
            </div>

            {/* Sede inicial */}
            <div style={{ ...UI.muted, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Sede inicial (opcional pero recomendada)</div>
              <div style={UI.cols}>
                <div>
                  <label style={UI.label}>Nombre de la sede</label>
                  <input style={UI.input} value={storeForm.initial_branch_name}
                    onChange={e => setStoreForm(f => ({ ...f, initial_branch_name: e.target.value }))} />
                </div>
                <div>
                  <label style={UI.label}>Ciudad</label>
                  <input style={UI.input} value={storeForm.initial_branch_city}
                    onChange={e => setStoreForm(f => ({ ...f, initial_branch_city: e.target.value }))} />
                </div>
                <div>
                  <label style={UI.label}>Dirección</label>
                  <input style={UI.input} value={storeForm.initial_branch_address}
                    onChange={e => setStoreForm(f => ({ ...f, initial_branch_address: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={UI.primary} type="button"
                disabled={busy === 'store'}
                onClick={handleCreateStore}>
                {busy === 'store' ? 'Creando…' : '✓ Crear tienda'}
              </button>
              <button style={UI.ghost} type="button"
                onClick={() => setStoreForm({ name:'', slug:'', niche:'', templateId:'', city:'', initial_branch_name:'Sede principal', initial_branch_slug:'principal', initial_branch_city:'', initial_branch_address:'' })}>
                Limpiar
              </button>
            </div>
          </div>

          {/* Lista de tiendas existentes */}
          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Mis tiendas ({stores.length})</h2>
            {stores.map(s => (
              <div key={s.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {s.niche || s.business_type} · Estilo: {s.template_id || 'delivery'}
                    </div>
                  </div>
                  <Badge ok={s.public_visible} text={s.public_visible ? 'pública' : 'oculta'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button"
                    onClick={() => run('toggle', () => tenantApi('PATCH', `/stores/${s.id}`, { public_visible: !s.public_visible }))}>
                    {s.public_visible ? 'Ocultar' : 'Publicar'}
                  </button>
                  <button style={UI.primary} type="button"
                    onClick={() => { setSelectedStoreId(s.id); setTab('customize') }}>
                    Personalizar
                  </button>
                </div>
              </div>
            ))}
            {!stores.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Crea tu primera tienda →</div>}
          </div>
        </div>
      )}

      {/* ── SEDES ────────────────────────────────────────────────── */}
      {tab === 'branches' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Sedes de la tienda</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={UI.label}>Tienda</label>
              <select style={UI.input} value={selectedStore?.id || ''} onChange={e => setSelectedStoreId(e.target.value)}>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {storeBranches.map(b => (
              <div key={b.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{b.city} · {b.slug}</div>
                  </div>
                  <Badge ok={b.status === 'active'} text={b.status || 'active'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button"
                    onClick={() => window.open(`/s/${selectedStore?.slug}/${b.slug}/login`, '_blank')}>
                    Login staff
                  </button>
                  <button style={UI.primary} type="button"
                    onClick={() => navigate(`/branch/admin?store_id=${selectedStore?.id}&branch_id=${b.id}`)}>
                    Panel sede
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Añadir sede</h2>
            <div style={UI.cols}>
              {[['Nombre *', 'name', 'Nueva sede'], ['Slug *', 'slug', 'nueva-sede'], ['Ciudad', 'city', 'Madrid'], ['Teléfono', 'phone', '+34 600 000 000']].map(([label, key, ph]) => (
                <div key={key}>
                  <label style={UI.label}>{label}</label>
                  <input style={UI.input} value={branchForm[key]}
                    onChange={e => setBranchForm(f => ({ ...f, [key]: key === 'slug' ? slugify(e.target.value) : e.target.value }))}
                    placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={UI.label}>Dirección</label>
              <input style={UI.input} value={branchForm.address}
                onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Calle Ejemplo 123" />
            </div>
            <button style={{ ...UI.primary, marginTop: 12 }} type="button"
              disabled={!selectedStore || busy === 'branch'}
              onClick={() => run('branch', () => tenantApi('POST', '/branches', { store_id: selectedStore.id, ...branchForm }))}>
              {busy === 'branch' ? 'Creando…' : 'Crear sede'}
            </button>
          </div>
        </div>
      )}

      {/* ── STAFF ────────────────────────────────────────────────── */}
      {tab === 'staff' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Crear cuenta de staff</h2>
            <div style={UI.cols}>
              {[['Nombre *', 'full_name', 'text', 'María García'], ['Email *', 'email', 'email', 'maria@tienda.com'], ['Password *', 'password', 'text', 'Min. 8 caracteres']].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={UI.label}>{label}</label>
                  <input style={UI.input} type={type} value={staffForm[key]}
                    onChange={e => setStaffForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={ph} />
                </div>
              ))}
              <div>
                <label style={UI.label}>Rol *</label>
                <select style={UI.input} value={staffForm.role}
                  onChange={e => setStaffForm(f => ({ ...f, role: e.target.value, branch_id: '' }))}>
                  {STAFF_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={UI.label}>Tienda {selectedRole[2] !== 'tenant' ? '*' : ''}</label>
                <select style={UI.input} value={staffForm.store_id}
                  disabled={selectedRole[2] === 'tenant'}
                  onChange={e => setStaffForm(f => ({ ...f, store_id: e.target.value, branch_id: '' }))}>
                  <option value="">Selecciona tienda</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={UI.label}>Sede {selectedRole[2] === 'branch' ? '*' : ''}</label>
                <select style={UI.input} value={staffForm.branch_id}
                  disabled={selectedRole[2] !== 'branch'}
                  onChange={e => setStaffForm(f => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">Selecciona sede</option>
                  {scopedBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <button style={{ ...UI.primary, marginTop: 12 }} type="button"
              disabled={busy === 'staff'}
              onClick={() => run('staff', () => tenantApi('POST', '/accounts/staff', staffForm),
                () => setStaffForm(f => ({ ...f, full_name: '', email: '', password: '', branch_id: '' })))}>
              {busy === 'staff' ? 'Creando…' : 'Crear cuenta'}
            </button>
          </div>

          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Staff activo ({accounts.length})</h2>
            {accounts.map(a => (
              <div key={a.membership_id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.full_name || a.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{a.email} · {a.role}</div>
                  </div>
                  <Badge ok={a.is_active} text={a.is_active ? 'activo' : 'pausado'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button"
                    onClick={() => run('toggle-staff', () => tenantApi('PATCH', `/accounts/staff/${a.membership_id}`, { is_active: !a.is_active }))}>
                    {a.is_active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button style={UI.ghost} type="button"
                    onClick={() => { const p = window.prompt(`Nueva password para ${a.email}`, ''); if (p) run('pw', () => tenantApi('PATCH', `/accounts/staff/${a.membership_id}`, { password: p })) }}>
                    Reset password
                  </button>
                </div>
              </div>
            ))}
            {!accounts.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Sin cuentas de staff todavía.</div>}
          </div>
        </div>
      )}

      {/* ── PERSONALIZAR ─────────────────────────────────────────── */}
      {tab === 'customize' && (
        <>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Personalizar tienda</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={UI.label}>Tienda a personalizar</label>
              <select style={UI.input} value={selectedStore?.id || ''}
                onChange={e => setSelectedStoreId(e.target.value)}>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedStore && (
              <div style={{ marginBottom: 12, padding: '10px 14px',
                background: 'var(--color-background-secondary)', borderRadius: 8, fontSize: 13 }}>
                <strong>Estilo actual:</strong>{' '}
                {MENU_STYLES.find(m => m.id === selectedStore.template_id)?.label || selectedStore.template_id || 'Delivery Cards'}
                {' · '}
                <a href={`/s/${selectedStore.slug}/menu`} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--color-text-primary)' }}>
                  Ver menú público ↗
                </a>
              </div>
            )}
          </div>

          {selectedStore
            ? <AdminStoreCustomizationPanel key={selectedStore.id} storeId={selectedStore.id} capabilityScope="oxidian" onSaved={load} />
            : <div style={{ ...UI.muted, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Primero crea una tienda para personalizarla.
              </div>}
        </>
      )}
    </div>
  )
}
