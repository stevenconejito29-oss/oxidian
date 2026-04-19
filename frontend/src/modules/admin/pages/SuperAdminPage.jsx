import React from 'react'
import DashboardLayout from '../../../core/app/DashboardLayout'
import {
  listTenants, createOwnerAccount, updateOwnerAccount, listOwnerAccounts,
  listStores, createStore, getSuperAdminStats, inviteLandingRequest,
} from '../../../shared/lib/supabaseApi'
import { supabaseAuth } from '../../../shared/supabase/client'
import ChatbotAuthManager from '../components/ChatbotAuthManager'

// ─── Componentes UI base ──────────────────────────────────────────
function StatCard({ label, value, hint, color = '#6366f1', icon }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 14, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: 'var(--color-text-primary)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{hint}</div>}
    </div>
  )
}

function Badge({ children, color = '#64748b' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: `${color}20`, color,
    }}>{children}</span>
  )
}

function Card({ children, title, action, style = {} }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 14, overflow: 'hidden', ...style,
    }}>
      {title && (
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border-tertiary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md' }) {
  const pad  = size === 'sm' ? '6px 14px' : '9px 18px'
  const fs   = size === 'sm' ? 12 : 13
  const bg   = variant === 'primary'  ? 'var(--color-text-primary)' :
               variant === 'danger'   ? '#dc2626' :
               variant === 'success'  ? '#16a34a' : 'transparent'
  const clr  = variant === 'ghost' ? 'var(--color-text-secondary)' : '#fff'
  const border = variant === 'ghost' ? '1px solid var(--color-border-secondary)' : 'none'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: pad, borderRadius: 8, border, background: disabled ? '#ddd' : bg,
      color: disabled ? '#999' : clr, fontSize: fs, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      transition: '.15s', whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
        border: '1px solid var(--color-border-secondary)',
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)', fontFamily: 'inherit',
        boxSizing: 'border-box', outline: 'none',
        ...(props.style || {}),
      }} />
    </div>
  )
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>{label}</label>}
      <select {...props} style={{
        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
        border: '1px solid var(--color-border-secondary)',
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)', fontFamily: 'inherit',
        boxSizing: 'border-box', outline: 'none',
        ...(props.style || {}),
      }}>{children}</select>
    </div>
  )
}

function Alert({ children, type = 'error' }) {
  const colors = { error: '#dc2626', success: '#16a34a', info: '#2563eb' }
  const bgs    = { error: '#fef2f2', success: '#f0fdf4', info: '#eff6ff' }
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 12,
      background: bgs[type], color: colors[type], fontSize: 13,
      border: `1px solid ${colors[type]}30`,
    }}>{children}</div>
  )
}

function Empty({ icon = '📭', text }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

// ─── Constantes ───────────────────────────────────────────────────
const PLANS = ['trial','starter','growth','pro','enterprise']
const NICHES = [
  { id:'restaurant', label:'Restaurante', icon:'🍕', template:'delivery' },
  { id:'supermarket', label:'Supermercado', icon:'🛒', template:'vitrina' },
  { id:'boutique_fashion', label:'Moda', icon:'👗', template:'portfolio' },
  { id:'pharmacy', label:'Farmacia', icon:'💊', template:'minimal' },
  { id:'neighborhood_store', label:'Tienda Barrio', icon:'🏪', template:'minimal' },
  { id:'barbershop', label:'Barbería', icon:'✂️', template:'booking' },
  { id:'beauty_salon', label:'Salón', icon:'💅', template:'booking' },
  { id:'services', label:'Servicios', icon:'🛠️', template:'booking' },
  { id:'universal', label:'Otro', icon:'⭐', template:'delivery' },
]

const STATUS_BADGE = {
  active:   { label:'Activo',    color:'#16a34a' },
  suspended:{ label:'Suspendido',color:'#dc2626' },
  archived: { label:'Archivado', color:'#64748b' },
  pending:  { label:'Pendiente', color:'#ca8a04' },
  contacted:{ label:'Contactado',color:'#2563eb' },
  onboarding:{ label:'Onboarding',color:'#7c3aed' },
  converted:{ label:'Convertido',color:'#16a34a' },
  rejected: { label:'Rechazado', color:'#dc2626' },
  demo_scheduled: { label:'Demo',color:'#0891b2' },
  ghosted:  { label:'Ghosted',   color:'#9ca3af' },
  draft:    { label:'Borrador',  color:'#64748b' },
  paused:   { label:'Pausado',   color:'#f59e0b' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { label: status, color: '#64748b' }
  return <Badge color={s.color}>{s.label}</Badge>
}

// ─── TABS ─────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',  label:'Visión Global',  icon:'📊' },
  { id:'tenants',   label:'Tenants',        icon:'🏢' },
  { id:'owners',    label:'Dueños',         icon:'👤' },
  { id:'pipeline',  label:'Solicitudes',    icon:'📋' },
  { id:'stores',    label:'Tiendas',        icon:'🏪' },
  { id:'chatbot',   label:'Chatbot',        icon:'🤖' },
]

function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function SuperAdminPage() {
  const [tab, setTab] = React.useState('overview')

  return (
    <DashboardLayout
      activeTab={tab}
      onTabChange={setTab}
      title="Super Admin"
      subtitle="Oxidian Platform"
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap',
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400, fontFamily: 'inherit',
            background: tab === t.id ? 'var(--color-text-primary)' : 'transparent',
            color: tab === t.id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', gap: 6, transition: '.15s',
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab />}
      {tab === 'tenants'   && <TenantsTab />}
      {tab === 'owners'    && <OwnersTab />}
      {tab === 'pipeline'  && <PipelineTab />}
      {tab === 'stores'    && <StoresTab />}
      {tab === 'chatbot'   && <ChatbotAuthManager />}
    </DashboardLayout>
  )
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = React.useState(null)

  React.useEffect(() => {
    Promise.all([
      supabaseAuth.from('tenants').select('id', { count:'exact', head:true }),
      supabaseAuth.from('stores').select('id', { count:'exact', head:true }),
      supabaseAuth.from('branches').select('id', { count:'exact', head:true }),
      supabaseAuth.from('user_memberships').select('id', { count:'exact', head:true }),
      supabaseAuth.from('landing_requests').select('id', { count:'exact', head:true }).eq('status','pending'),
      supabaseAuth.from('orders').select('id,total', { count:'exact' })
        .gte('created_at', new Date(Date.now()-86400000).toISOString()),
    ]).then(([t, s, b, m, l, o]) => {
      const revenue = (o.data || []).reduce((sum, x) => sum + Number(x.total || 0), 0)
      setStats({ tenants:t.count||0, stores:s.count||0, branches:b.count||0,
        members:m.count||0, leads:l.count||0, orders:o.count||0,
        revenue: revenue.toFixed(2) })
    })
  }, [])

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="Tenants"          value={stats?.tenants   ?? '…'} icon="🏢" hint="Negocios en la plataforma" />
        <StatCard label="Tiendas"          value={stats?.stores    ?? '…'} icon="🏪" hint="Marcas activas" />
        <StatCard label="Sedes"            value={stats?.branches  ?? '…'} icon="📍" hint="Puntos de operación" />
        <StatCard label="Usuarios"         value={stats?.members   ?? '…'} icon="👥" hint="Staff y dueños" />
        <StatCard label="Leads pendientes" value={stats?.leads     ?? '…'} icon="📋" hint="Sin contactar" color="#f59e0b" />
        <StatCard label="Pedidos (24h)"    value={stats?.orders    ?? '…'} icon="📦" hint={`${stats?.revenue ?? '0.00'} EUR`} color="#10b981" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:16 }}>
        <Card title="Acciones rápidas">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'➕ Crear tenant nuevo', desc:'Añade un nuevo cliente a la plataforma' },
              { label:'👤 Crear cuenta de dueño', desc:'Asigna acceso a un negocio existente' },
              { label:'🤖 Gestionar chatbots', desc:'Autoriza el chatbot portable por sede' },
              { label:'📋 Ver solicitudes', desc:'Revisa los leads del landing page' },
            ].map(a => (
              <div key={a.label} style={{
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                cursor: 'default',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Sistema">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'Base de datos', status:'Supabase', ok:true },
              { label:'Auth',          status:'Activa',   ok:true },
              { label:'RLS',           status:'Habilitado',ok:true },
              { label:'Vercel',        status:'Desplegado',ok:true },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize: 13 }}>{s.label}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: s.ok ? '#f0fdf4' : '#fef2f2',
                  color: s.ok ? '#16a34a' : '#dc2626',
                }}>● {s.status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TENANTS
// ══════════════════════════════════════════════════════════════════
function TenantsTab() {
  const [tenants, setTenants] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState('')
  const [saving, setSaving]   = React.useState(false)
  const [form, setForm]       = React.useState({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'', plan:'growth' })
  const [showForm, setShowForm] = React.useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabaseAuth.from('tenants')
        .select('*, tenant_subscriptions(plan_id, status), stores(count)')
        .order('created_at', { ascending:false })
      setTenants(data || [])
    } catch(e) { setError(e.message) }
    setLoading(false)
  }
  React.useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { data: t, error: te } = await supabaseAuth.from('tenants').insert({
        name: form.name, slug: form.slug, owner_name: form.owner_name,
        owner_email: form.owner_email, owner_phone: form.owner_phone,
        notes: form.notes, status:'active', monthly_fee:0,
      }).select().single()
      if (te) throw te
      if (form.plan) {
        await supabaseAuth.from('tenant_subscriptions').insert({
          tenant_id:t.id, plan_id:form.plan, status:'active',
          current_period_end: new Date(Date.now()+30*86400000).toISOString(),
        })
      }
      setForm({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'', plan:'growth' })
      setShowForm(false)
      load()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'suspended' : 'active'
    await supabaseAuth.from('tenants').update({ status:next }).eq('id', t.id)
    setTenants(prev => prev.map(x => x.id===t.id ? {...x, status:next} : x))
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Tenants ({tenants.length})</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--color-text-secondary)' }}>
            Negocios clientes de la plataforma
          </p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancelar' : '+ Nuevo tenant'}</Btn>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card title="Nuevo tenant">
          {error && <Alert>{error}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12, marginBottom:12 }}>
              <Input label="Nombre del negocio *" required value={form.name}
                onChange={e => { const n=e.target.value; setForm(f=>({...f,name:n,slug:f.slug||slugify(n)})) }}
                placeholder="Panadería Demo" />
              <Input label="Slug *" required value={form.slug}
                onChange={e => setForm(f=>({...f,slug:slugify(e.target.value)}))}
                placeholder="panaderia-demo" />
              <Input label="Nombre del dueño" value={form.owner_name}
                onChange={e => setForm(f=>({...f,owner_name:e.target.value}))} placeholder="Laura Morales" />
              <Input label="Email del dueño" type="email" value={form.owner_email}
                onChange={e => setForm(f=>({...f,owner_email:e.target.value}))} placeholder="laura@negocio.com" />
              <Input label="Teléfono" value={form.owner_phone}
                onChange={e => setForm(f=>({...f,owner_phone:e.target.value}))} placeholder="+34 600 000 000" />
              <Select label="Plan" value={form.plan} onChange={e => setForm(f=>({...f,plan:e.target.value}))}>
                {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </Select>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear tenant'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Lista */}
      {loading ? <div style={{textAlign:'center',padding:'2rem',color:'var(--color-text-secondary)'}}>Cargando…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {!tenants.length && <Empty icon="🏢" text="No hay tenants todavía. Crea el primero." />}
          {tenants.map(t => {
            const sub     = t.tenant_subscriptions?.[0]
            const nStores = t.stores?.[0]?.count ?? 0
            return (
              <div key={t.id} style={{
                background:'var(--color-background-primary)',
                border:'1px solid var(--color-border-tertiary)',
                borderRadius:12, padding:'14px 18px',
                display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
              }}>
                <div style={{
                  width:42, height:42, borderRadius:10, background:'#6366f120',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:18, flexShrink:0,
                }}>🏢</div>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:3 }}>
                    {t.owner_email || 'Sin email'} · {nStores} tienda{nStores!==1?'s':''}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <Badge color="#6366f1">{sub?.plan_id || 'sin plan'}</Badge>
                  <StatusBadge status={t.status} />
                  <Btn size="sm" variant="ghost" onClick={() => toggleStatus(t)}>
                    {t.status==='active' ? 'Suspender' : 'Activar'}
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// DUEÑOS
// ══════════════════════════════════════════════════════════════════
function OwnersTab() {
  const [tenants,  setTenants]  = React.useState([])
  const [accounts, setAccounts] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [error,    setError]    = React.useState('')
  const [success,  setSuccess]  = React.useState('')
  const [saving,   setSaving]   = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [form, setForm] = React.useState({ tenant_id:'', role:'tenant_owner', full_name:'', email:'', password:'' })

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [ts, os] = await Promise.all([listTenants(), listOwnerAccounts()])
      setTenants(Array.isArray(ts) ? ts : [])
      setAccounts(Array.isArray(os) ? os : [])
      setForm(f => ({ ...f, tenant_id: f.tenant_id || ts?.[0]?.id || '' }))
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [])
  React.useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const result = await createOwnerAccount(form)
      setSuccess(`Cuenta creada para ${form.email}`)
      setForm(f => ({ ...f, full_name:'', email:'', password:'' }))
      setShowForm(false)
      load()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function handleStatus(a, isActive) {
    try { await updateOwnerAccount(a.membership_id, { is_active: isActive }); load() }
    catch(e) { setError(e.message) }
  }

  async function handleReset(a) {
    const pw = window.prompt(`Nueva password para ${a.email || a.user_id}`, '')
    if (!pw) return
    try { await updateOwnerAccount(a.membership_id, { password: pw }); load() }
    catch(e) { setError(e.message) }
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Cuentas de dueños ({accounts.length})</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--color-text-secondary)' }}>
            tenant_owner y tenant_admin con acceso al panel del negocio
          </p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancelar' : '+ Nueva cuenta'}</Btn>
      </div>

      {showForm && (
        <Card title="Crear cuenta de dueño">
          {error   && <Alert>{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12, marginBottom:12 }}>
              <Select label="Tenant *" required value={form.tenant_id}
                onChange={e => setForm(f=>({...f,tenant_id:e.target.value}))}>
                <option value="">Selecciona un tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select label="Rol" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                <option value="tenant_owner">tenant_owner</option>
                <option value="tenant_admin">tenant_admin</option>
              </Select>
              <Input label="Nombre completo" value={form.full_name}
                onChange={e => setForm(f=>({...f,full_name:e.target.value}))} placeholder="María García" />
              <Input label="Email *" type="email" required value={form.email}
                onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="dueno@marca.com" />
              <Input label="Password *" required value={form.password}
                onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      {loading ? <div style={{textAlign:'center',padding:'2rem',color:'var(--color-text-secondary)'}}>Cargando…</div> : (
        <Card title="Cuentas activas">
          {!accounts.length && <Empty icon="👤" text="No hay cuentas de dueños todavía." />}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {accounts.map(a => (
              <div key={a.membership_id||a.id} style={{
                display:'flex', alignItems:'center', gap:14, padding:'12px 0',
                borderBottom:'1px solid var(--color-border-tertiary)', flexWrap:'wrap',
              }}>
                <div style={{
                  width:36, height:36, borderRadius:9, background:'#f59e0b20',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, flexShrink:0, fontWeight:700, color:'#f59e0b',
                }}>{(a.full_name||a.email||'?').slice(0,2).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:150 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{a.full_name || a.user_id}</div>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>
                    {a.tenant_name} · {a.role}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  <StatusBadge status={a.is_active ? 'active' : 'suspended'} />
                  <Btn size="sm" variant="ghost" onClick={() => handleStatus(a, !a.is_active)}>
                    {a.is_active ? 'Pausar' : 'Activar'}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => handleReset(a)}>Reset PW</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PIPELINE
// ══════════════════════════════════════════════════════════════════
const PIPELINE_STAGES = ['pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted']

function PipelineTab() {
  const [requests, setRequests] = React.useState([])
  const [loading, setLoading]   = React.useState(true)
  const [filter, setFilter]     = React.useState('pending')
  const [busy, setBusy]         = React.useState(null)

  React.useEffect(() => {
    supabaseAuth.from('landing_requests').select('*').order('created_at',{ascending:false})
      .then(({ data }) => { setRequests(data||[]); setLoading(false) })
  }, [])

  async function advance(id, status) {
    setBusy(id)
    const patch = { status, updated_at: new Date().toISOString() }
    if (status==='contacted') patch.contacted_at = new Date().toISOString()
    if (status==='converted') patch.converted_at = new Date().toISOString()
    await supabaseAuth.from('landing_requests').update(patch).eq('id', id)
    setRequests(rs => rs.map(r => r.id===id ? {...r,...patch} : r))
    setBusy(null)
  }

  async function sendInvite(r) {
    if (!window.confirm(`¿Enviar invitación a ${r.email}?`)) return
    setBusy(r.id)
    try {
      await inviteLandingRequest(r.id, `${window.location.origin}/onboarding`)
      setRequests(rs => rs.map(x => x.id===r.id ? {...x, status:'onboarding'} : x))
    } catch(e) { window.alert('Error: '+e.message) }
    setBusy(null)
  }

  const byStatus = requests.reduce((a,r) => { a[r.status]=(a[r.status]||0)+1; return a }, {})
  const filtered = filter==='all' ? requests : requests.filter(r => r.status===filter)

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div>
        <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:700 }}>Pipeline de solicitudes</h2>
        <p style={{ margin:0, fontSize:13, color:'var(--color-text-secondary)' }}>
          Leads del landing page y su estado de conversión
        </p>
      </div>

      {/* Kanban filters */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {['all',...PIPELINE_STAGES].map(s => {
          const st = STATUS_BADGE[s] || { label:'Todos', color:'#64748b' }
          const count = s==='all' ? requests.length : (byStatus[s]||0)
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit',
              border:`1px solid ${filter===s ? st.color : 'var(--color-border-secondary)'}`,
              background: filter===s ? `${st.color}18` : 'transparent',
              color: filter===s ? st.color : 'var(--color-text-secondary)',
              fontWeight: filter===s ? 600 : 400,
            }}>
              {s==='all' ? 'Todos' : st.label} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      {loading && <Empty icon="⏳" text="Cargando solicitudes…" />}
      {!loading && !filtered.length && <Empty icon="📭" text="Sin solicitudes en este estado." />}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(r => (
          <div key={r.id} style={{
            background:'var(--color-background-primary)',
            border:'1px solid var(--color-border-tertiary)',
            borderRadius:12, padding:'16px 18px',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{r.full_name}</div>
                <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:4 }}>
                  {r.email} {r.phone && `· ${r.phone}`} {r.business_name && `· ${r.business_name}`} {r.city && `· ${r.city}`}
                </div>
                {r.message && (
                  <div style={{
                    fontSize:12, marginTop:8, padding:'8px 12px',
                    background:'var(--color-background-secondary)', borderRadius:8,
                    color:'var(--color-text-secondary)', fontStyle:'italic',
                  }}>"{r.message}"</div>
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
              {r.status==='pending' && (
                <Btn size="sm" onClick={() => advance(r.id,'contacted')} disabled={busy===r.id}>
                  Contactar
                </Btn>
              )}
              {['contacted','demo_scheduled'].includes(r.status) && (
                <Btn size="sm" variant="success" onClick={() => sendInvite(r)} disabled={busy===r.id}>
                  ✉️ Enviar invitación
                </Btn>
              )}
              {!['converted','rejected'].includes(r.status) && (
                <Btn size="sm" variant="danger" onClick={() => advance(r.id,'rejected')} disabled={busy===r.id}>
                  Rechazar
                </Btn>
              )}
              <span style={{ fontSize:11, color:'var(--color-text-secondary)', alignSelf:'center', marginLeft:'auto' }}>
                {new Date(r.created_at).toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TIENDAS
// ══════════════════════════════════════════════════════════════════
function StoresTab() {
  const [tenants,  setTenants]  = React.useState([])
  const [stores,   setStores]   = React.useState([])
  const [loading,  setLoading]  = React.useState(false)
  const [error,    setError]    = React.useState('')
  const [saving,   setSaving]   = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [form, setForm] = React.useState({ name:'', slug:'', niche:'restaurant', tenant_id:'', city:'' })

  const load = async () => {
    setLoading(true)
    const [ts, ss] = await Promise.all([listTenants(), listStores()])
    setTenants(Array.isArray(ts)?ts:[])
    setStores(Array.isArray(ss)?ss:[])
    setForm(f => ({ ...f, tenant_id: f.tenant_id || ts?.[0]?.id || '' }))
    setLoading(false)
  }
  React.useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const niche = NICHES.find(n => n.id===form.niche) || NICHES[0]
      await createStore({
        id: form.slug, slug: form.slug, name: form.name,
        tenant_id: form.tenant_id, niche: form.niche,
        business_type: niche.template, template_id: niche.template,
        city: form.city, status:'active', public_visible:true, theme_tokens:{},
      })
      setForm(f => ({ ...f, name:'', slug:'' }))
      setShowForm(false)
      load()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Tiendas ({stores.length})</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--color-text-secondary)' }}>Todas las marcas en la plataforma</p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancelar' : '+ Nueva tienda'}</Btn>
      </div>

      {showForm && (
        <Card title="Crear tienda">
          {error && <Alert>{error}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12, marginBottom:12 }}>
              <Select label="Tenant *" required value={form.tenant_id}
                onChange={e => setForm(f=>({...f,tenant_id:e.target.value}))}>
                <option value="">Selecciona tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Input label="Nombre *" required value={form.name}
                onChange={e => setForm(f=>({...f,name:e.target.value,slug:f.slug||slugify(e.target.value)}))}
                placeholder="Pizza Roma" />
              <Input label="Slug *" required value={form.slug}
                onChange={e => setForm(f=>({...f,slug:slugify(e.target.value)}))}
                placeholder="pizza-roma" />
              <Select label="Nicho" value={form.niche} onChange={e => setForm(f=>({...f,niche:e.target.value}))}>
                {NICHES.map(n => <option key={n.id} value={n.id}>{n.icon} {n.label}</option>)}
              </Select>
              <Input label="Ciudad" value={form.city}
                onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder="Madrid" />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn type="submit" disabled={saving}>{saving?'Creando…':'Crear tienda'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      {loading ? <div style={{textAlign:'center',padding:'2rem',color:'var(--color-text-secondary)'}}>Cargando…</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
          {!stores.length && <Empty icon="🏪" text="No hay tiendas todavía." />}
          {stores.map(s => {
            const niche = NICHES.find(n => n.id===s.niche || n.id===s.business_type) || NICHES[NICHES.length-1]
            return (
              <div key={s.id} style={{
                background:'var(--color-background-primary)',
                border:'1px solid var(--color-border-tertiary)',
                borderRadius:12, padding:'16px',
              }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                  <div style={{
                    width:44, height:44, borderRadius:10, background:'#6366f115',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0,
                  }}>{niche.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{s.name}</div>
                    <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                      /{s.slug} · {s.city||'Sin ciudad'}
                    </div>
                  </div>
                  <StatusBadge status={s.status||'draft'} />
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn size="sm" variant="ghost"
                    onClick={() => window.open(`/s/${s.slug}/menu`,'_blank')}>
                    Ver menú ↗
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
