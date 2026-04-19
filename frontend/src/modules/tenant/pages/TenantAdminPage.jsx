import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../core/providers/AuthProvider'
import DashboardLayout from '../../../core/app/DashboardLayout'
import AdminStoreCustomizationPanel from '../../../legacy/pages/AdminStoreCustomizationPanel'
import {
  listStores, createStore, updateStore,
  listBranches, createBranch,
  listMemberships, createStaffAccount, updateStaffAccount,
  getTenantDashboard, getTenantPlan,
} from '../../../shared/lib/supabaseApi'
import { supabaseAuth } from '../../../shared/supabase/client'

// ─── UI base ─────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant='primary', size='md', type='button', style={} }) {
  const pad = size==='sm' ? '6px 14px' : '10px 20px'
  const fs  = size==='sm' ? 12 : 13
  const bg  = variant==='primary' ? 'var(--color-text-primary)' :
              variant==='danger'  ? '#dc2626' : 'transparent'
  const clr = variant==='ghost' ? 'var(--color-text-secondary)' : '#fff'
  const brd = variant==='ghost' ? '1px solid var(--color-border-secondary)' : 'none'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding:pad, borderRadius:8, border:brd, background:disabled?'#ddd':bg,
      color:disabled?'#999':clr, fontSize:fs, fontWeight:500, cursor:disabled?'not-allowed':'pointer',
      fontFamily:'inherit', transition:'.15s', whiteSpace:'nowrap', ...style,
    }}>{children}</button>
  )
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}
const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
  border:'1px solid var(--color-border-secondary)',
  background:'var(--color-background-primary)',
  color:'var(--color-text-primary)', fontFamily:'inherit', boxSizing:'border-box',
}
function Alert({ children, type='error' }) {
  const c = { error:'#dc2626', success:'#16a34a', info:'#2563eb' }
  const b = { error:'#fef2f2', success:'#f0fdf4', info:'#eff6ff' }
  return (
    <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:12,
      background:b[type], color:c[type], fontSize:13, border:`1px solid ${c[type]}30` }}>
      {children}
    </div>
  )
}
function StatCard({ label, value, icon }) {
  return (
    <div style={{
      background:'var(--color-background-primary)',
      border:'1px solid var(--color-border-tertiary)',
      borderRadius:12, padding:'16px 18px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</span>
        <span style={{ fontSize:18 }}>{icon}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:700, marginTop:6 }}>{value}</div>
    </div>
  )
}
function Badge({ children, color='#64748b' }) {
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}20`, color }}>{children}</span>
}

function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}

// ─── Nichos con descripciones de funciones ────────────────────────
const NICHES = [
  {
    id:'restaurant', label:'Restaurante / Delivery', icon:'🍕', color:'#ef4444', templateId:'delivery',
    features:['Pedidos a domicilio','Menú digital con fotos','Gestión de cocina','Repartidores','Combos y promociones'],
  },
  {
    id:'supermarket', label:'Supermercado / Tienda online', icon:'🛒', color:'#22c55e', templateId:'vitrina',
    features:['Catálogo con stock','Control de inventario','Fecha de vencimiento','Delivery propio','Afiliados'],
  },
  {
    id:'boutique_fashion', label:'Boutique / Moda', icon:'👗', color:'#ec4899', templateId:'portfolio',
    features:['Catálogo editorial','Tallas y colores','Lookbook','Gestión de stock','Afiliados de moda'],
  },
  {
    id:'pharmacy', label:'Farmacia / Parafarmacia', icon:'💊', color:'#0ea5e9', templateId:'minimal',
    features:['Control de vencimientos','Categorías por tipo','Delivery urgente','Stock crítico','Facturación'],
  },
  {
    id:'neighborhood_store', label:'Tienda de Barrio / Colmado', icon:'🏪', color:'#f97316', templateId:'minimal',
    features:['Catálogo sencillo','Pedidos por WhatsApp','Delivery local','Fiado y cuentas','Lista de precios'],
  },
  {
    id:'barbershop', label:'Barbería', icon:'✂️', color:'#1e40af', templateId:'booking',
    features:['Reserva de citas','Horarios por barbero','Lista de espera','Historial de clientes','Puntos de fidelidad'],
  },
  {
    id:'beauty_salon', label:'Salón de Belleza', icon:'💅', color:'#a855f7', templateId:'booking',
    features:['Citas online','Servicios por duración','Staff especializado','Galería de trabajos','Recordatorios'],
  },
  {
    id:'nail_salon', label:'Salón de Uñas', icon:'💅', color:'#f43f5e', templateId:'booking',
    features:['Galería de diseños','Citas con servicios','Control de materiales','Puntos de fidelidad','Reseñas'],
  },
  {
    id:'services', label:'Servicios Profesionales', icon:'🛠️', color:'#6366f1', templateId:'booking',
    features:['Agendamiento online','Presupuestos','Por horas o proyecto','Historial de clientes','Facturación'],
  },
  {
    id:'universal', label:'Otro / Universal', icon:'⭐', color:'#64748b', templateId:'delivery',
    features:['Catálogo flexible','Pedidos online','Staff básico','Chatbot WhatsApp','Personalizable'],
  },
]

// ─── 5 Estilos de menú ────────────────────────────────────────────
const MENU_STYLES = [
  {
    id:'delivery', label:'Tarjetas Delivery', icon:'🍔', desc:'Tarjetas con imagen, precio y botón de añadir. Ideal para restaurantes y delivery rápido.',
    preview:'grid', niches:['restaurant','supermarket','universal','neighborhood_store'],
  },
  {
    id:'vitrina', label:'Cuadrícula Market', icon:'🛒', desc:'Grid denso tipo supermercado. Stock visible, búsqueda lateral por categoría.',
    preview:'grid-dense', niches:['supermarket','pharmacy','neighborhood_store'],
  },
  {
    id:'portfolio', label:'Editorial Boutique', icon:'👗', desc:'Layout minimalista tipo revista de moda. Imagen a pantalla completa, lujo visual.',
    preview:'editorial', niches:['boutique_fashion'],
  },
  {
    id:'minimal', label:'Lista Catálogo', icon:'📋', desc:'Lista con precio y descripción. Para farmacias, catálogos técnicos y tiendas de barrio.',
    preview:'list', niches:['pharmacy','neighborhood_store','services'],
  },
  {
    id:'booking', label:'Citas y Reservas', icon:'📅', desc:'Servicios con duración, precio y botón de reserva. Barberías, salones y servicios.',
    preview:'booking', niches:['barbershop','beauty_salon','nail_salon','services'],
  },
]

const STAFF_ROLES = [
  ['tenant_admin','Admin del tenant','tenant'],
  ['store_admin','Admin de tienda','store'],
  ['store_operator','Operador','store'],
  ['branch_manager','Manager de sede','branch'],
  ['cashier','Caja','branch'],
  ['kitchen','Preparación','branch'],
  ['rider','Repartidor','branch'],
]

const TABS = [
  ['overview','Panel',    '📊'],
  ['stores',  'Tiendas',  '🏪'],
  ['branches','Sedes',    '📍'],
  ['staff',   'Staff',    '👥'],
  ['customize','Diseño',  '🎨'],
]

// ══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function TenantAdminPage() {
  const navigate   = useNavigate()
  const { tenantId, role } = useAuth()
  const [tab,             setTab]             = React.useState('overview')
  const [loading,         setLoading]         = React.useState(true)
  const [error,           setError]           = React.useState('')
  const [dashboard,       setDashboard]       = React.useState({})
  const [stores,          setStores]          = React.useState([])
  const [branches,        setBranches]        = React.useState([])
  const [accounts,        setAccounts]        = React.useState([])
  const [planId,          setPlanId]          = React.useState('growth')
  const [selectedStoreId, setSelectedStoreId] = React.useState('')

  const selectedStore  = stores.find(s => s.id===selectedStoreId) || stores[0] || null
  const storeBranches  = branches.filter(b => b.store_id===selectedStore?.id)

  const load = React.useCallback(async () => {
    if (!tenantId) return setLoading(false)
    setLoading(true); setError('')
    try {
      const [d, ss, bs, as, plan] = await Promise.all([
        getTenantDashboard(tenantId),
        listStores(tenantId),
        listBranches(tenantId),
        listMemberships({ tenant_id:tenantId, roles:['tenant_admin','store_admin','store_operator','branch_manager','cashier','kitchen','rider'] }),
        getTenantPlan(tenantId),
      ])
      setDashboard(d && !Array.isArray(d) ? d : {})
      setStores(Array.isArray(ss) ? ss : [])
      setBranches(Array.isArray(bs) ? bs : [])
      setAccounts(Array.isArray(as) ? as : [])
      setPlanId(typeof plan==='string' ? plan : 'growth')
      setSelectedStoreId(c => c && (Array.isArray(ss)?ss:[]).some(s=>s.id===c) ? c : (ss?.[0]?.id||''))
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [tenantId])

  React.useEffect(() => { load() }, [load])

  if (!tenantId) return (
    <div style={{ padding:24 }}>
      <Alert>Esta cuenta no tiene tenant asignado. Contacta al administrador.</Alert>
    </div>
  )

  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} title="Panel del negocio" subtitle={`Plan ${planId}`}>
      {/* Stats rápidos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="Plan"       value={planId}                    icon="💎" />
        <StatCard label="Tiendas"    value={stores.length}             icon="🏪" />
        <StatCard label="Sedes"      value={branches.length}           icon="📍" />
        <StatCard label="Staff"      value={accounts.length}           icon="👥" />
        <StatCard label="Pedidos hoy" value={dashboard.orders_today||0} icon="📦" />
      </div>

      {/* Tab bar */}
      <div style={{
        display:'flex', gap:4, marginBottom:24, flexWrap:'wrap',
        background:'var(--color-background-primary)',
        border:'1px solid var(--color-border-tertiary)',
        borderRadius:12, padding:4,
      }}>
        {TABS.map(([id,label,icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer',
            fontSize:13, fontWeight:tab===id?600:400, fontFamily:'inherit',
            background: tab===id ? 'var(--color-text-primary)' : 'transparent',
            color: tab===id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
            display:'flex', alignItems:'center', gap:6, transition:'.15s',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && <div style={{textAlign:'center',padding:'2rem',color:'var(--color-text-secondary)'}}>Cargando…</div>}

      {!loading && tab==='overview'  && <OverviewTab stores={stores} branches={branches} accounts={accounts} dashboard={dashboard} onTabChange={setTab} setSelectedStoreId={setSelectedStoreId} />}
      {!loading && tab==='stores'    && <StoresTab tenantId={tenantId} stores={stores} onRefresh={load} setSelectedStoreId={setSelectedStoreId} setTab={setTab} />}
      {!loading && tab==='branches'  && <BranchesTab tenantId={tenantId} stores={stores} branches={branches} selectedStore={selectedStore} setSelectedStoreId={setSelectedStoreId} storeBranches={storeBranches} onRefresh={load} navigate={navigate} />}
      {!loading && tab==='staff'     && <StaffTab tenantId={tenantId} stores={stores} branches={branches} accounts={accounts} onRefresh={load} />}
      {!loading && tab==='customize' && <CustomizeTab stores={stores} selectedStore={selectedStore} setSelectedStoreId={setSelectedStoreId} onRefresh={load} />}
    </DashboardLayout>
  )
}

// ── OVERVIEW ───────────────────────────────────────────────────────
function OverviewTab({ stores, branches, accounts, dashboard, onTabChange, setSelectedStoreId }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
      {/* Tiendas activas */}
      <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, fontSize:14 }}>🏪 Mis tiendas</span>
          <Btn size="sm" onClick={() => onTabChange('stores')}>+ Nueva</Btn>
        </div>
        <div style={{ padding:'0 18px' }}>
          {!stores.length && (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--color-text-secondary)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🏪</div>
              <div style={{ fontSize:13 }}>Crea tu primera tienda</div>
              <Btn style={{ marginTop:12 }} size="sm" onClick={() => onTabChange('stores')}>Crear tienda</Btn>
            </div>
          )}
          {stores.map(s => {
            const niche = [{ id:'restaurant',icon:'🍕' },{ id:'supermarket',icon:'🛒' },{ id:'boutique_fashion',icon:'👗' },{ id:'barbershop',icon:'✂️' },{ id:'beauty_salon',icon:'💅' },{ id:'pharmacy',icon:'💊' },{ id:'neighborhood_store',icon:'🏪' },{ id:'services',icon:'🛠️' }].find(n=>n.id===s.niche)
            return (
              <div key={s.id} style={{ padding:'12px 0', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36,height:36,borderRadius:9,background:'#6366f115',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>
                  {niche?.icon||'⭐'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>/{s.slug}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn size="sm" variant="ghost" onClick={() => window.open(`/s/${s.slug}/menu`,'_blank')}>Ver ↗</Btn>
                  <Btn size="sm" onClick={() => { setSelectedStoreId(s.id); onTabChange('customize') }}>Diseñar</Btn>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border-tertiary)' }}>
          <span style={{ fontWeight:600, fontSize:14 }}>⚡ Acciones rápidas</span>
        </div>
        <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { icon:'🏪', label:'Crear nueva tienda', tab:'stores' },
            { icon:'📍', label:'Añadir sede',        tab:'branches' },
            { icon:'👥', label:'Crear staff',        tab:'staff' },
            { icon:'🎨', label:'Personalizar diseño',tab:'customize' },
          ].map(a => (
            <button key={a.tab} onClick={() => onTabChange(a.tab)} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
              borderRadius:10, border:'1px solid var(--color-border-tertiary)',
              background:'var(--color-background-secondary)', cursor:'pointer',
              fontFamily:'inherit', textAlign:'left', transition:'.15s',
            }}>
              <span style={{ fontSize:20 }}>{a.icon}</span>
              <span style={{ fontSize:13, fontWeight:500 }}>{a.label}</span>
              <span style={{ marginLeft:'auto', color:'var(--color-text-secondary)', fontSize:16 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── CREAR TIENDA — Wizard con selector de nicho ────────────────────
function StoresTab({ tenantId, stores, onRefresh, setSelectedStoreId, setTab }) {
  const [step,    setStep]    = React.useState(1) // 1=nicho, 2=estilo, 3=datos
  const [nicho,   setNicho]   = React.useState(null)
  const [estilo,  setEstilo]  = React.useState(null)
  const [form,    setForm]    = React.useState({ name:'', slug:'', city:'', initial_branch_name:'Sede principal', initial_branch_slug:'principal', initial_branch_city:'', initial_branch_address:'' })
  const [saving,  setSaving]  = React.useState(false)
  const [error,   setError]   = React.useState('')
  const [showCreate, setShowCreate] = React.useState(false)

  const RECOMMENDED = estilo ? null : nicho ? MENU_STYLES.find(m => m.niches.includes(nicho.id)) : null

  async function handleCreate(e) {
    e.preventDefault()
    if (!nicho || !estilo || !form.name || !form.slug) {
      setError('Completa todos los campos'); return
    }
    setSaving(true); setError('')
    try {
      const store = await createStore({
        id: form.slug, slug: form.slug, name: form.name,
        tenant_id: tenantId, niche: nicho.id,
        business_type: nicho.templateId, template_id: estilo.id,
        city: form.city, status:'active', public_visible:true, theme_tokens:{},
      })
      if (form.initial_branch_name) {
        await createBranch({
          tenant_id: tenantId, store_id: store.id,
          slug: form.initial_branch_slug||'principal',
          name: form.initial_branch_name,
          address: form.initial_branch_address, city: form.initial_branch_city||form.city,
          status:'active', is_primary:true, public_visible:true,
        })
      }
      await onRefresh()
      setSelectedStoreId(store.id)
      setTab('customize')
      setShowCreate(false)
      setStep(1); setNicho(null); setEstilo(null)
      setForm({ name:'', slug:'', city:'', initial_branch_name:'Sede principal', initial_branch_slug:'principal', initial_branch_city:'', initial_branch_address:'' })
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Tiendas ({stores.length})</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--color-text-secondary)' }}>
            Cada tienda tiene su propio menú, sedes y staff
          </p>
        </div>
        <Btn onClick={() => setShowCreate(s => !s)}>{showCreate ? 'Cancelar' : '+ Crear tienda'}</Btn>
      </div>

      {/* ── WIZARD ──────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, overflow:'hidden' }}>
          {/* Stepper */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', gap:8, alignItems:'center' }}>
            {[['1','Elige nicho'],['2','Elige estilo'],['3','Configura']].map(([n,l]) => (
              <React.Fragment key={n}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{
                    width:26, height:26, borderRadius:13,
                    background: Number(n)<=step ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
                    color: Number(n)<=step ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700, flexShrink:0,
                  }}>{n}</div>
                  <span style={{ fontSize:13, fontWeight:Number(n)===step?600:400, color:Number(n)===step?'var(--color-text-primary)':'var(--color-text-secondary)' }}>{l}</span>
                </div>
                {n!=='3' && <div style={{ flex:1, height:1, background:'var(--color-border-tertiary)', maxWidth:40 }} />}
              </React.Fragment>
            ))}
          </div>

          <div style={{ padding:'20px' }}>
            {error && <Alert>{error}</Alert>}

            {/* PASO 1: Elige nicho */}
            {step===1 && (
              <div>
                <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:16 }}>
                  ¿Qué tipo de negocio es? El nicho determina las funciones disponibles.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10 }}>
                  {NICHES.map(n => (
                    <button key={n.id} type="button" onClick={() => { setNicho(n); setEstilo(MENU_STYLES.find(m=>m.niches.includes(n.id))||MENU_STYLES[0]); setStep(2) }} style={{
                      padding:'14px 12px', borderRadius:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit',
                      border: nicho?.id===n.id ? `2px solid ${n.color}` : '1px solid var(--color-border-secondary)',
                      background: nicho?.id===n.id ? `${n.color}10` : 'var(--color-background-secondary)',
                      transition:'.15s',
                    }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>{n.icon}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:nicho?.id===n.id?n.color:'var(--color-text-primary)', marginBottom:4 }}>{n.label}</div>
                      <div style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.5 }}>
                        {n.features.slice(0,3).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PASO 2: Elige estilo de menú */}
            {step===2 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <button onClick={() => setStep(1)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', fontSize:20 }}>←</button>
                  <div>
                    <p style={{ margin:0, fontSize:13, color:'var(--color-text-secondary)' }}>
                      Elige cómo verán el menú tus clientes. Puedes cambiarlo después.
                    </p>
                    {nicho && (
                      <div style={{ fontSize:12, marginTop:4 }}>
                        Nicho seleccionado: <strong>{nicho.icon} {nicho.label}</strong>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:10 }}>
                  {MENU_STYLES.map(s => {
                    const isRec = nicho && s.niches.includes(nicho.id)
                    const isSel = estilo?.id===s.id
                    return (
                      <button key={s.id} type="button" onClick={() => { setEstilo(s); setStep(3) }} style={{
                        padding:'16px', borderRadius:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit',
                        border: isSel ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                        background: isSel ? 'var(--color-background-secondary)' : 'transparent',
                        position:'relative', transition:'.15s',
                      }}>
                        {isRec && <span style={{ position:'absolute', top:8, right:8, fontSize:9, background:'#22c55e', color:'#fff', borderRadius:4, padding:'2px 6px', fontWeight:700 }}>✓ Ideal</span>}
                        <div style={{ fontSize:32, marginBottom:10 }}>{s.icon}</div>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{s.label}</div>
                        <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5 }}>{s.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* PASO 3: Datos de la tienda */}
            {step===3 && (
              <form onSubmit={handleCreate}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <button type="button" onClick={() => setStep(2)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', fontSize:20 }}>←</button>
                  <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>
                    {nicho && <span>{nicho.icon} {nicho.label}</span>}
                    {estilo && <span> · {estilo.icon} {estilo.label}</span>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12, marginBottom:16 }}>
                  <Field label="Nombre de la tienda *">
                    <input style={inp} required value={form.name}
                      onChange={e => setForm(f=>({...f,name:e.target.value,slug:f.slug||slugify(e.target.value)}))}
                      placeholder="Mi Restaurante" />
                  </Field>
                  <Field label="Slug (URL pública) *">
                    <input style={inp} required value={form.slug}
                      onChange={e => setForm(f=>({...f,slug:slugify(e.target.value)}))}
                      placeholder="mi-restaurante" />
                  </Field>
                  <Field label="Ciudad">
                    <input style={inp} value={form.city}
                      onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder="Madrid" />
                  </Field>
                </div>
                <div style={{ background:'var(--color-background-secondary)', borderRadius:10, padding:'14px', marginBottom:16 }}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>📍 Sede inicial (recomendada)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10 }}>
                    <Field label="Nombre de la sede">
                      <input style={inp} value={form.initial_branch_name}
                        onChange={e => setForm(f=>({...f,initial_branch_name:e.target.value}))} />
                    </Field>
                    <Field label="Ciudad sede">
                      <input style={inp} value={form.initial_branch_city}
                        onChange={e => setForm(f=>({...f,initial_branch_city:e.target.value}))} placeholder={form.city} />
                    </Field>
                    <Field label="Dirección">
                      <input style={inp} value={form.initial_branch_address}
                        onChange={e => setForm(f=>({...f,initial_branch_address:e.target.value}))} placeholder="Calle Ejemplo 123" />
                    </Field>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : '✓ Crear tienda'}</Btn>
                  <Btn variant="ghost" type="button" onClick={() => { setShowCreate(false); setStep(1); setNicho(null); setEstilo(null) }}>Cancelar</Btn>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Lista de tiendas ─────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
        {!stores.length && !showCreate && (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--color-text-secondary)', gridColumn:'1/-1' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏪</div>
            <div style={{ fontSize:14, marginBottom:16 }}>Aún no tienes tiendas. Crea la primera.</div>
            <Btn onClick={() => setShowCreate(true)}>+ Crear primera tienda</Btn>
          </div>
        )}
        {stores.map(s => {
          const niche = NICHES.find(n=>n.id===s.niche) || NICHES[NICHES.length-1]
          const style = MENU_STYLES.find(m=>m.id===s.template_id) || MENU_STYLES[0]
          return (
            <div key={s.id} style={{
              background:'var(--color-background-primary)',
              border:'1px solid var(--color-border-tertiary)',
              borderRadius:14, overflow:'hidden',
            }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ width:40,height:40,borderRadius:10,background:`${niche.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>
                  {niche.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>/{s.slug} · {s.city||'Sin ciudad'}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20,
                  background: s.status==='active'?'#f0fdf4':'#fef2f2',
                  color: s.status==='active'?'#16a34a':'#dc2626' }}>
                  {s.status==='active'?'Activa':'Inactiva'}
                </span>
              </div>
              <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <Badge color={niche.color}>{niche.label}</Badge>
                  <Badge color="#6366f1">{style.icon} {style.label}</Badge>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <Btn size="sm" variant="ghost" onClick={() => window.open(`/s/${s.slug}/menu`,'_blank')}>Ver menú ↗</Btn>
                  <Btn size="sm" onClick={() => { setSelectedStoreId(s.id); setTab('customize') }}>🎨 Diseñar</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => updateStore(s.id, { public_visible:!s.public_visible }).then(onRefresh)}>
                    {s.public_visible?'Ocultar':'Publicar'}
                  </Btn>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SEDES ───────────────────────────────────────────────────────────
function BranchesTab({ tenantId, stores, branches, selectedStore, setSelectedStoreId, storeBranches, onRefresh, navigate }) {
  const [form, setForm]   = React.useState({ name:'Nueva sede', slug:'nueva-sede', city:'', address:'', phone:'' })
  const [busy, setBusy]   = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleCreate(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await createBranch({ tenant_id:tenantId, store_id:selectedStore.id, ...form, status:'active', public_visible:true })
      await onRefresh()
      setForm({ name:'Nueva sede', slug:'nueva-sede', city:'', address:'', phone:'' })
    } catch(e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
      {/* Lista de sedes */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>📍 Sedes ({branches.length})</h2>
          <select style={{ ...inp, width:'auto', fontSize:12 }} value={selectedStore?.id||''}
            onChange={e => setSelectedStoreId(e.target.value)}>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {!storeBranches.length && (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--color-text-secondary)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📍</div>
            <div style={{ fontSize:13 }}>Esta tienda no tiene sedes todavía.</div>
          </div>
        )}
        {storeBranches.map(b => (
          <div key={b.id} style={{
            background:'var(--color-background-primary)',
            border:'1px solid var(--color-border-tertiary)',
            borderRadius:12, padding:'14px 16px', marginBottom:10,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                  {b.city||'Sin ciudad'} · /{b.slug}
                </div>
                {b.address && <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>📍 {b.address}</div>}
                {b.phone   && <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>📞 {b.phone}</div>}
              </div>
              <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20,
                background:b.status==='active'?'#f0fdf4':'#fef2f2',
                color:b.status==='active'?'#16a34a':'#dc2626' }}>
                {b.status==='active'?'Activa':'Inactiva'}
              </span>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={() => window.open(`/s/${selectedStore?.slug}/${b.slug}/login`,'_blank')}>Login staff</Btn>
              <Btn size="sm" variant="ghost" onClick={() => navigate(`/branch/kitchen?store_id=${selectedStore?.id}&branch_id=${b.id}`)}>Cocina</Btn>
              <Btn size="sm" variant="ghost" onClick={() => navigate(`/branch/riders?store_id=${selectedStore?.id}&branch_id=${b.id}`)}>Reparto</Btn>
              <Btn size="sm" onClick={() => navigate(`/branch/admin?store_id=${selectedStore?.id}&branch_id=${b.id}`)}>Panel sede</Btn>
            </div>
          </div>
        ))}
      </div>

      {/* Crear sede */}
      <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, padding:'18px' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>➕ Añadir sede</h3>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[['Nombre *','name','Nueva sede'],['Slug *','slug','nueva-sede'],['Ciudad','city','Madrid'],['Teléfono','phone','+34 600 000 000']].map(([l,k,ph]) => (
            <Field key={k} label={l}>
              <input style={inp} value={form[k]}
                onChange={e => setForm(f=>({...f,[k]:k==='slug'?slugify(e.target.value):e.target.value}))}
                placeholder={ph} required={k==='name'||k==='slug'} />
            </Field>
          ))}
          <Field label="Dirección">
            <input style={inp} value={form.address}
              onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="Calle Ejemplo 123" />
          </Field>
          <Btn type="submit" disabled={!selectedStore||busy}>{busy?'Creando…':'Crear sede'}</Btn>
        </form>
      </div>
    </div>
  )
}

// ── STAFF ────────────────────────────────────────────────────────────
function StaffTab({ tenantId, stores, branches, accounts, onRefresh }) {
  const [form,  setForm]  = React.useState({ full_name:'', email:'', password:'', role:'store_admin', store_id:'', branch_id:'' })
  const [busy,  setBusy]  = React.useState(false)
  const [error, setError] = React.useState('')
  const [success,setSuccess]=React.useState('')

  const selectedRole   = STAFF_ROLES.find(r=>r[0]===form.role)||STAFF_ROLES[0]
  const scopedBranches = branches.filter(b => b.store_id===form.store_id)

  async function handleCreate(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      await createStaffAccount({ ...form, tenant_id:tenantId })
      setSuccess(`Cuenta creada para ${form.email}`)
      setForm(f => ({ ...f, full_name:'', email:'', password:'', branch_id:'' }))
      await onRefresh()
    } catch(e) { setError(e.message) }
    setBusy(false)
  }

  const ROLE_COLORS = { tenant_admin:'#6366f1', store_admin:'#2563eb', store_operator:'#0891b2', branch_manager:'#059669', kitchen:'#d97706', rider:'#7c3aed', cashier:'#dc2626' }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
      {/* Formulario */}
      <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, padding:'18px' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>➕ Crear cuenta de staff</h3>
        {error   && <Alert>{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Field label="Nombre completo *">
            <input style={inp} required value={form.full_name}
              onChange={e => setForm(f=>({...f,full_name:e.target.value}))} placeholder="María García" />
          </Field>
          <Field label="Email *">
            <input style={inp} type="email" required value={form.email}
              onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="maria@tienda.com" />
          </Field>
          <Field label="Password *">
            <input style={inp} required value={form.password}
              onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Mínimo 8 caracteres" />
          </Field>
          <Field label="Rol *">
            <select style={inp} value={form.role}
              onChange={e => setForm(f=>({...f,role:e.target.value,branch_id:''}))}>
              {STAFF_ROLES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          {selectedRole[2]!=='tenant' && (
            <Field label="Tienda">
              <select style={inp} value={form.store_id}
                onChange={e => setForm(f=>({...f,store_id:e.target.value,branch_id:''}))}>
                <option value="">Selecciona tienda</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          {selectedRole[2]==='branch' && (
            <Field label="Sede *">
              <select style={inp} value={form.branch_id}
                onChange={e => setForm(f=>({...f,branch_id:e.target.value}))}>
                <option value="">Selecciona sede</option>
                {scopedBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
          <Btn type="submit" disabled={busy}>{busy?'Creando…':'Crear cuenta'}</Btn>
        </form>
      </div>

      {/* Lista de staff */}
      <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border-tertiary)' }}>
          <span style={{ fontWeight:600, fontSize:14 }}>👥 Staff activo ({accounts.length})</span>
        </div>
        <div style={{ padding:'0 18px' }}>
          {!accounts.length && (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--color-text-secondary)' }}>
              <div style={{ fontSize:36 }}>👥</div>
              <div style={{ fontSize:13, marginTop:8 }}>Sin cuentas de staff todavía.</div>
            </div>
          )}
          {accounts.map(a => (
            <div key={a.id} style={{ padding:'12px 0', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:34, height:34, borderRadius:9, flexShrink:0, fontWeight:700, fontSize:13,
                background: `${ROLE_COLORS[a.role]||'#64748b'}20`,
                color: ROLE_COLORS[a.role]||'#64748b',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{(a.metadata?.full_name||a.role||'?').slice(0,2).toUpperCase()}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{a.metadata?.full_name||a.user_id}</div>
                <div style={{ fontSize:11, color:'var(--color-text-secondary)' }}>{a.role}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <Badge color={a.is_active?'#16a34a':'#dc2626'}>{a.is_active?'Activo':'Pausado'}</Badge>
                <Btn size="sm" variant="ghost"
                  onClick={() => updateStaffAccount(a.id,{is_active:!a.is_active}).then(onRefresh)}>
                  {a.is_active?'Pausar':'Activar'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── PERSONALIZAR ─────────────────────────────────────────────────────
function CustomizeTab({ stores, selectedStore, setSelectedStoreId, onRefresh }) {
  const [activeStyle, setActiveStyle] = React.useState(null)
  const [saving, setSaving] = React.useState(false)

  const currentStyle = MENU_STYLES.find(m => m.id===(selectedStore?.template_id)) || MENU_STYLES[0]

  async function handleStyleChange(styleId) {
    if (!selectedStore) return
    setSaving(true)
    try {
      await updateStore(selectedStore.id, { template_id: styleId })
      await onRefresh()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Selector de tienda */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:13, fontWeight:500 }}>Tienda:</span>
        <select style={{ ...inp, width:'auto', fontSize:13 }} value={selectedStore?.id||''}
          onChange={e => setSelectedStoreId(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {selectedStore && (
          <a href={`/s/${selectedStore.slug}/menu`} target="_blank" rel="noreferrer"
            style={{ fontSize:13, color:'var(--color-text-primary)', textDecoration:'none' }}>
            Ver menú público ↗
          </a>
        )}
      </div>

      {selectedStore ? (
        <>
          {/* Selector de estilo de menú */}
          <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-border-tertiary)', borderRadius:14, padding:'18px' }}>
            <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700 }}>🎨 Estilo del menú público</h3>
            <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--color-text-secondary)' }}>
              Así verán el menú tus clientes. Activo: <strong>{currentStyle.icon} {currentStyle.label}</strong>
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
              {MENU_STYLES.map(s => {
                const isCurrent = s.id===selectedStore.template_id
                const nicho = NICHES.find(n => n.id===selectedStore.niche)
                const isRec = nicho && s.niches.includes(nicho.id)
                return (
                  <button key={s.id} type="button" disabled={saving}
                    onClick={() => handleStyleChange(s.id)} style={{
                      padding:'14px', borderRadius:12, textAlign:'left', cursor:saving?'not-allowed':'pointer',
                      fontFamily:'inherit', position:'relative', transition:'.15s',
                      border: isCurrent ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                      background: isCurrent ? 'var(--color-background-secondary)' : 'transparent',
                    }}>
                    {isCurrent && <span style={{ position:'absolute', top:8, right:8, fontSize:9, background:'var(--color-text-primary)', color:'var(--color-background-primary)', borderRadius:4, padding:'2px 6px', fontWeight:700 }}>ACTIVO</span>}
                    {isRec && !isCurrent && <span style={{ position:'absolute', top:8, right:8, fontSize:9, background:'#22c55e', color:'#fff', borderRadius:4, padding:'2px 6px', fontWeight:700 }}>Ideal</span>}
                    <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
                    <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.4 }}>{s.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel de personalización avanzada */}
          <AdminStoreCustomizationPanel
            key={selectedStore.id}
            storeId={selectedStore.id}
            capabilityScope="oxidian"
            onSaved={onRefresh}
          />
        </>
      ) : (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--color-text-secondary)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🎨</div>
          <div style={{ fontSize:14 }}>Crea una tienda primero para personalizarla.</div>
        </div>
      )}
    </div>
  )
}
