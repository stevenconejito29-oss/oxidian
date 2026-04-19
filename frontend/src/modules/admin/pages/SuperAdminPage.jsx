import React from 'react'
import {
  listTenants,
  createOwnerAccount, updateOwnerAccount, listOwnerAccounts,
  listStores, createStore,
  inviteLandingRequest,
  getSuperAdminStats,
} from '../../../shared/lib/supabaseApi'
import { supabaseAuth } from '../../../shared/supabase/client'
import {
  Actions, BadgeRow, Button, Field, Form, FormGrid,
  GhostButton, Grid, Hero, Notice, Panel, Shell, Stats,
  controlDeckStyles,
} from '../../../shared/ui/ControlDeck'
import ChatbotAuthManager from '../components/ChatbotAuthManager'

// ─── Constantes ───────────────────────────────────────────────────────
const ADMIN_TABS = [
  { id: 'overview', label: 'Visión Global' },
  { id: 'pipeline', label: 'Solicitudes' },
  { id: 'tenants',  label: 'Tenants' },
  { id: 'owners',   label: 'Dueños' },
  { id: 'stores',   label: 'Tiendas' },
  { id: 'chatbot',  label: 'Chatbot' },
]

const PLANS = [
  { id: 'trial',      name: 'Trial' },
  { id: 'starter',    name: 'Starter' },
  { id: 'growth',     name: 'Growth' },
  { id: 'pro',        name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
]

const NICHES = [
  { id: 'restaurant',       label: 'Restaurante',    template: 'delivery'  },
  { id: 'supermarket',      label: 'Supermercado',   template: 'vitrina'   },
  { id: 'boutique_fashion', label: 'Moda / Boutique',template: 'portfolio' },
  { id: 'pharmacy',         label: 'Farmacia',       template: 'minimal'   },
  { id: 'neighborhood_store',label:'Tienda Barrio',  template: 'minimal'   },
  { id: 'barbershop',       label: 'Barbería',       template: 'booking'   },
  { id: 'beauty_salon',     label: 'Salón Belleza',  template: 'booking'   },
  { id: 'services',         label: 'Servicios',      template: 'booking'   },
  { id: 'universal',        label: 'Otro',           template: 'delivery'  },
]

const INITIAL_OWNER_FORM = { tenant_id:'', role:'tenant_owner', full_name:'', email:'', password:'' }
const INITIAL_STORE_FORM  = { name:'', slug:'', niche:'restaurant', template_id:'delivery', city:'', tenant_id:'' }

function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}

function TabBar({ active, onChange }) {
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20, padding:'4px 0', borderBottom:'1px solid var(--color-border-tertiary)' }}>
      {ADMIN_TABS.map(t => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
          padding:'6px 16px', borderRadius:20, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'.15s',
          border: active===t.id ? 'none' : '1px solid var(--color-border-secondary)',
          background: active===t.id ? 'var(--color-text-primary)' : 'transparent',
          color: active===t.id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────
export default function SuperAdminPage() {
  const [activeTab,      setActiveTab]      = React.useState('owners')
  const [tenants,        setTenants]        = React.useState([])
  const [ownerAccounts,  setOwnerAccounts]  = React.useState([])
  const [stores,         setStores]         = React.useState([])
  const [ownersLoading,  setOwnersLoading]  = React.useState(true)
  const [storesLoading,  setStoresLoading]  = React.useState(false)
  const [ownerError,     setOwnerError]     = React.useState('')
  const [storeError,     setStoreError]     = React.useState('')
  const [ownerResult,    setOwnerResult]    = React.useState(null)
  const [storeResult,    setStoreResult]    = React.useState(null)
  const [ownerForm,      setOwnerForm]      = React.useState(INITIAL_OWNER_FORM)
  const [storeForm,      setStoreForm]      = React.useState(INITIAL_STORE_FORM)
  const [ownerSaving,    setOwnerSaving]    = React.useState(false)
  const [storeSaving,    setStoreSaving]    = React.useState(false)

  // ── Cargar tenants y dueños ──────────────────────────────────────
  const refreshOwners = React.useCallback(async () => {
    setOwnersLoading(true); setOwnerError('')
    try {
      const [nextTenants, nextOwners] = await Promise.all([listTenants(), listOwnerAccounts()])
      const ts = Array.isArray(nextTenants) ? nextTenants : []
      const os = Array.isArray(nextOwners)  ? nextOwners  : []
      setTenants(ts)
      setOwnerAccounts(os)
      setOwnerForm(f => ({ ...f, tenant_id: f.tenant_id || ts[0]?.id || '' }))
      setStoreForm(f => ({ ...f, tenant_id: f.tenant_id || ts[0]?.id || '' }))
    } catch (e) { setOwnerError(e.message || 'Error cargando cuentas') }
    finally { setOwnersLoading(false) }
  }, [])

  const refreshStores = React.useCallback(async () => {
    setStoresLoading(true)
    try {
      const data = await listStores()
      setStores(Array.isArray(data) ? data : [])
    } catch (e) { setStoreError(e.message) }
    finally { setStoresLoading(false) }
  }, [])

  React.useEffect(() => { refreshOwners() }, [refreshOwners])
  React.useEffect(() => { if (activeTab === 'stores') refreshStores() }, [activeTab, refreshStores])

  // ── Crear cuenta de dueño ────────────────────────────────────────
  async function handleOwnerSubmit(e) {
    e.preventDefault()
    setOwnerSaving(true); setOwnerError(''); setOwnerResult(null)
    try {
      const result = await createOwnerAccount(ownerForm)
      setOwnerResult(result)
      setOwnerForm(f => ({ ...INITIAL_OWNER_FORM, tenant_id: f.tenant_id }))
      await refreshOwners()
    } catch (e) { setOwnerError(e.message) }
    finally { setOwnerSaving(false) }
  }

  async function handleOwnerStatus(account, isActive) {
    setOwnerError('')
    try { await updateOwnerAccount(account.membership_id, { is_active: isActive }); await refreshOwners() }
    catch (e) { setOwnerError(e.message) }
  }

  async function handleOwnerPasswordReset(account) {
    const pw = window.prompt(`Nueva password para ${account.email}`, '')
    if (!pw) return
    try { await updateOwnerAccount(account.membership_id, { password: pw }); await refreshOwners() }
    catch (e) { setOwnerError(e.message) }
  }

  // ── Crear tienda directa ─────────────────────────────────────────
  async function handleStoreSubmit(e) {
    e.preventDefault()
    if (!storeForm.name || !storeForm.slug || !storeForm.tenant_id) {
      setStoreError('Nombre, slug y tenant son requeridos'); return
    }
    setStoreSaving(true); setStoreError(''); setStoreResult(null)
    try {
      const niche = NICHES.find(n => n.id === storeForm.niche) || NICHES[0]
      const store = await createStore({
        id:           storeForm.slug,
        slug:         storeForm.slug,
        name:         storeForm.name,
        tenant_id:    storeForm.tenant_id,
        niche:        storeForm.niche,
        business_type: niche.template,
        template_id:  storeForm.template_id || niche.template,
        city:         storeForm.city,
        status:       'active',
        public_visible: true,
        theme_tokens: {},
      })
      setStoreResult(store)
      setStoreForm(f => ({ ...INITIAL_STORE_FORM, tenant_id: f.tenant_id }))
      await refreshStores()
    } catch (e) { setStoreError(e.message) }
    finally { setStoreSaving(false) }
  }

  return (
    <Shell>
      <Hero
        eyebrow="Super Admin · Oxidian"
        title="Controla tenants, tiendas, sedes y chatbots."
        description="Gestiona toda la red comercial desde un solo panel. Los tenants se crean aquí, el dueño gestiona su tienda desde su panel."
        signals={[
          { label: 'Tenants', value: String(tenants.length) },
          { label: 'Tiendas', value: String(stores.length) },
        ]}
      />

      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── VISION GLOBAL ───────────────────────────────────────── */}
      {activeTab === 'overview' && <OverviewTab />}

      {/* ── PIPELINE ────────────────────────────────────────────── */}
      {activeTab === 'pipeline' && <PipelineTab />}

      {/* ── TENANTS ─────────────────────────────────────────────── */}
      {activeTab === 'tenants' && <TenantsTab />}

      {/* ── DUEÑOS ──────────────────────────────────────────────── */}
      {activeTab === 'owners' && (
        <Grid>
          <Panel title="Crear cuenta de dueño" text="Crea el acceso para un tenant_owner o tenant_admin.">
            {ownerError  && <Notice tone="error">{ownerError}</Notice>}
            {ownerResult && <Notice tone="success">Cuenta lista para <strong>{ownerResult.email || ownerResult.user_id}</strong>.</Notice>}
            <Form onSubmit={handleOwnerSubmit}>
              <FormGrid>
                <Field label="Tenant *">
                  <select className={controlDeckStyles.select} required
                    value={ownerForm.tenant_id}
                    onChange={e => setOwnerForm(f => ({ ...f, tenant_id: e.target.value }))}>
                    <option value="">Selecciona tenant</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Rol">
                  <select className={controlDeckStyles.select} value={ownerForm.role}
                    onChange={e => setOwnerForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="tenant_owner">tenant_owner</option>
                    <option value="tenant_admin">tenant_admin</option>
                  </select>
                </Field>
                <Field label="Nombre completo">
                  <input className={controlDeckStyles.input} value={ownerForm.full_name}
                    onChange={e => setOwnerForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="María García" />
                </Field>
                <Field label="Email *">
                  <input className={controlDeckStyles.input} type="email" required
                    value={ownerForm.email}
                    onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="dueno@negocio.com" />
                </Field>
                <Field label="Password *">
                  <input className={controlDeckStyles.input} type="text" required
                    value={ownerForm.password}
                    onChange={e => setOwnerForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres" />
                </Field>
              </FormGrid>
              <Actions>
                <Button type="submit" disabled={ownerSaving}>{ownerSaving ? 'Creando…' : 'Crear cuenta'}</Button>
                <GhostButton type="button" onClick={() => setOwnerForm(f => ({ ...INITIAL_OWNER_FORM, tenant_id: f.tenant_id }))}>Limpiar</GhostButton>
              </Actions>
            </Form>
          </Panel>

          <Panel title={`Dueños (${ownerAccounts.length})`} text="Cuentas con acceso a paneles de tenant." dark>
            {ownersLoading && <Notice>Cargando…</Notice>}
            {!ownersLoading && !ownerAccounts.length && <Notice>Sin cuentas creadas todavía.</Notice>}
            {ownerAccounts.map(a => (
              <article className={controlDeckStyles.listCard} key={a.membership_id || a.id}>
                <div className={controlDeckStyles.listTop}>
                  <div>
                    <h3 className={controlDeckStyles.listTitle}>{a.full_name || a.email || a.user_id}</h3>
                    <p className={controlDeckStyles.listMeta}>{a.email} · {a.tenant_name || 'Sin tenant'}</p>
                  </div>
                  <span className={controlDeckStyles.badge}>{a.is_active ? 'activo' : 'pausado'}</span>
                </div>
                <BadgeRow items={[a.role, a.last_sign_in_at ? 'con acceso' : 'sin login']} />
                <Actions>
                  <GhostButton type="button" onClick={() => handleOwnerStatus(a, !a.is_active)}>
                    {a.is_active ? 'Pausar' : 'Reactivar'}
                  </GhostButton>
                  <GhostButton type="button" onClick={() => handleOwnerPasswordReset(a)}>
                    Reset password
                  </GhostButton>
                </Actions>
              </article>
            ))}
          </Panel>
        </Grid>
      )}

      {/* ── TIENDAS ──────────────────────────────────────────────── */}
      {activeTab === 'stores' && (
        <Grid>
          <Panel title="Crear tienda" text="Crea una tienda y asígnala a un tenant.">
            {storeError  && <Notice tone="error">{storeError}</Notice>}
            {storeResult && <Notice tone="success">Tienda <strong>{storeResult.name}</strong> creada. El dueño puede personalizarla desde su panel.</Notice>}
            <Form onSubmit={handleStoreSubmit}>
              <FormGrid>
                <Field label="Tenant *">
                  <select className={controlDeckStyles.select} required
                    value={storeForm.tenant_id}
                    onChange={e => setStoreForm(f => ({ ...f, tenant_id: e.target.value }))}>
                    <option value="">Selecciona tenant</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Nombre *">
                  <input className={controlDeckStyles.input} required value={storeForm.name}
                    onChange={e => setStoreForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                    placeholder="Pizza Roma" />
                </Field>
                <Field label="Slug *">
                  <input className={controlDeckStyles.input} required value={storeForm.slug}
                    onChange={e => setStoreForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="pizza-roma" />
                </Field>
                <Field label="Nicho">
                  <select className={controlDeckStyles.select} value={storeForm.niche}
                    onChange={e => {
                      const n = NICHES.find(x => x.id === e.target.value) || NICHES[0]
                      setStoreForm(f => ({ ...f, niche: n.id, template_id: n.template }))
                    }}>
                    {NICHES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </Field>
                <Field label="Ciudad">
                  <input className={controlDeckStyles.input} value={storeForm.city}
                    onChange={e => setStoreForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Madrid" />
                </Field>
              </FormGrid>
              <Actions>
                <Button type="submit" disabled={storeSaving}>{storeSaving ? 'Creando…' : 'Crear tienda'}</Button>
                <GhostButton type="button" onClick={() => setStoreForm(f => ({ ...INITIAL_STORE_FORM, tenant_id: f.tenant_id }))}>Limpiar</GhostButton>
              </Actions>
            </Form>
          </Panel>

          <Panel title={`Tiendas (${stores.length})`} dark>
            {storesLoading && <Notice>Cargando…</Notice>}
            {!storesLoading && !stores.length && <Notice>Sin tiendas todavía.</Notice>}
            {stores.map(s => (
              <article className={controlDeckStyles.listCard} key={s.id}>
                <div className={controlDeckStyles.listTop}>
                  <div>
                    <h3 className={controlDeckStyles.listTitle}>{s.name}</h3>
                    <p className={controlDeckStyles.listMeta}>{s.slug} · {s.city || 'Sin ciudad'} · {s.niche || s.business_type}</p>
                  </div>
                  <span className={controlDeckStyles.badge}>{s.status}</span>
                </div>
                <BadgeRow items={[s.template_id || 'delivery', s.public_visible ? 'pública' : 'oculta']} />
                <Actions>
                  <GhostButton type="button" onClick={() => window.open(`/s/${s.slug}/menu`, '_blank')}>Ver menú</GhostButton>
                  <GhostButton type="button" onClick={() => window.open(`/tenant/admin`, '_self')}>Panel tenant</GhostButton>
                </Actions>
              </article>
            ))}
          </Panel>
        </Grid>
      )}

      {/* ── CHATBOT ──────────────────────────────────────────────── */}
      {activeTab === 'chatbot' && (
        <Panel title="Chatbot portable por sede" text="Autoriza sedes y descarga el ZIP del bot WhatsApp.">
          <ChatbotAuthManager />
        </Panel>
      )}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// SUB-TABS
// ══════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const [stats, setStats] = React.useState(null)

  React.useEffect(() => {
    Promise.all([
      supabaseAuth.from('tenants').select('id', { count:'exact', head:true }),
      supabaseAuth.from('stores').select('id', { count:'exact', head:true }),
      supabaseAuth.from('branches').select('id', { count:'exact', head:true }),
      supabaseAuth.from('user_memberships').select('id', { count:'exact', head:true }),
      supabaseAuth.from('landing_requests').select('id', { count:'exact', head:true }).eq('status','pending'),
      supabaseAuth.from('orders').select('id', { count:'exact', head:true })
        .gte('created_at', new Date(Date.now()-86400000).toISOString()),
    ]).then(([t, s, b, m, l, o]) => setStats({
      tenants: t.count||0, stores: s.count||0, branches: b.count||0,
      members: m.count||0, leads: l.count||0, orders24h: o.count||0,
    }))
  }, [])

  return (
    <Stats items={[
      { label:'Tenants',        value: String(stats?.tenants   ?? '…'), hint:'Negocios en la plataforma' },
      { label:'Tiendas',        value: String(stats?.stores    ?? '…'), hint:'Marcas activas' },
      { label:'Sedes',          value: String(stats?.branches  ?? '…'), hint:'Puntos físicos' },
      { label:'Usuarios',       value: String(stats?.members   ?? '…'), hint:'Staff y dueños' },
      { label:'Leads pendientes', value: String(stats?.leads ?? '…'),   hint:'Sin contactar' },
      { label:'Pedidos (24h)',  value: String(stats?.orders24h ?? '…'), hint:'Últimas 24 horas' },
    ]} />
  )
}

const STATUS_COLOR = {
  pending:'#ca8a04', contacted:'#2563eb', demo_scheduled:'#7c3aed',
  onboarding:'#0891b2', converted:'#16a34a', rejected:'#dc2626', ghosted:'#9ca3af',
}
const PIPELINE_STATES = ['pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted']

function PipelineTab() {
  const [requests, setRequests] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [filter,   setFilter]   = React.useState('pending')
  const [saving,   setSaving]   = React.useState(null)

  React.useEffect(() => {
    supabaseAuth.from('landing_requests').select('*').order('created_at',{ascending:false})
      .then(({ data }) => { setRequests(data??[]); setLoading(false) })
  }, [])

  async function advance(id, status) {
    setSaving(id)
    const patch = { status, updated_at: new Date().toISOString() }
    if (status==='contacted') patch.contacted_at = new Date().toISOString()
    if (status==='converted') patch.converted_at = new Date().toISOString()
    await supabaseAuth.from('landing_requests').update(patch).eq('id', id)
    setRequests(rs => rs.map(r => r.id===id ? {...r,...patch} : r))
    setSaving(null)
  }

  async function sendInvite(r) {
    if (!window.confirm(`Aprobar y enviar enlace a ${r.email}?`)) return
    setSaving(r.id)
    try {
      await inviteLandingRequest(r.id, `${window.location.origin}/onboarding`)
      setRequests(rs => rs.map(x => x.id===r.id ? {...x, status:'onboarding'} : x))
      window.alert(`Enlace enviado a ${r.email}.`)
    } catch (e) { window.alert('Error: ' + e.message) }
    setSaving(null)
  }

  const byStatus = requests.reduce((a,r) => { a[r.status]=(a[r.status]||0)+1; return a }, {})
  const filtered = filter==='all' ? requests : requests.filter(r => r.status===filter)

  if (loading) return <Notice>Cargando solicitudes…</Notice>

  return (
    <div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {['all',...PIPELINE_STATES].map(s => (
          <button key={s} type="button" onClick={() => setFilter(s)} style={{
            padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit',
            border: filter===s?'none':'1px solid var(--color-border-secondary)',
            background: filter===s?(STATUS_COLOR[s]||'var(--color-text-primary)'):'transparent',
            color: filter===s?'#fff':'var(--color-text-secondary)',
          }}>{s==='all'?'Todos':s}{byStatus[s]?` (${byStatus[s]})`:''}</button>
        ))}
      </div>
      {!filtered.length && <Notice>Sin solicitudes en este estado</Notice>}
      {filtered.map(r => (
        <div key={r.id} style={{ padding:'14px', marginBottom:8, borderRadius:10,
          border:'1px solid var(--color-border-tertiary)', background:'var(--color-background-primary)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <div>
              <div style={{ fontWeight:500, fontSize:14 }}>{r.full_name}</div>
              <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                {r.email} · {r.phone} · {r.business_name} · {r.city}
              </div>
              {r.message && <div style={{ fontSize:12, marginTop:6, padding:'6px 10px',
                background:'var(--color-background-secondary)', borderRadius:6, fontStyle:'italic' }}>
                "{r.message}"</div>}
            </div>
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500, whiteSpace:'nowrap',
              background:`${STATUS_COLOR[r.status]}20`, color:STATUS_COLOR[r.status] }}>{r.status}</span>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
            {r.status==='pending' && (
              <button type="button" onClick={() => advance(r.id,'contacted')} disabled={saving===r.id}
                style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                  background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none' }}>
                Contactar
              </button>
            )}
            {['contacted','demo_scheduled'].includes(r.status) && (
              <button type="button" onClick={() => sendInvite(r)} disabled={saving===r.id}
                style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                  background:'#16a34a', color:'#fff', border:'none' }}>
                Aprobar y enviar invitación
              </button>
            )}
            {!['converted','rejected'].includes(r.status) && (
              <button type="button" onClick={() => advance(r.id,'rejected')} disabled={saving===r.id}
                style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                  background:'transparent', color:'#dc2626', border:'1px solid #dc2626' }}>
                Rechazar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TenantsTab() {
  const [tenants, setTenants] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm]       = React.useState({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'' })
  const [plan, setPlan]       = React.useState('growth')
  const [saving, setSaving]   = React.useState(false)
  const [error, setError]     = React.useState('')

  const reload = () => supabaseAuth.from('tenants')
    .select('*, tenant_subscriptions(plan_id,status), stores(count)')
    .order('created_at',{ascending:false})
    .then(({ data }) => { setTenants(data??[]); setLoading(false) })

  React.useEffect(() => { reload() }, [])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { data: t, error: te } = await supabaseAuth.from('tenants').insert({
        ...form, status:'active', monthly_fee:0,
      }).select().single()
      if (te) throw te
      await supabaseAuth.from('tenant_subscriptions').insert({
        tenant_id:t.id, plan_id:plan, status:'active',
        current_period_end: new Date(Date.now()+30*86400000).toISOString(),
      })
      setForm({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'' })
      reload()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleStatus(t) {
    const next = t.status==='active' ? 'suspended' : 'active'
    await supabaseAuth.from('tenants').update({ status:next }).eq('id', t.id)
    setTenants(prev => prev.map(x => x.id===t.id ? {...x,status:next} : x))
  }

  return (
    <Grid>
      <Panel title="Nuevo Tenant">
        {error && <Notice tone="error">{error}</Notice>}
        <Form onSubmit={handleCreate}>
          <FormGrid>
            <Field label="Nombre *">
              <input className={controlDeckStyles.input} required value={form.name}
                onChange={e => { const n=e.target.value; setForm(f => ({ ...f, name:n, slug:f.slug||n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') })) }}
                placeholder="Panadería Demo" />
            </Field>
            <Field label="Slug *">
              <input className={controlDeckStyles.input} required value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-') }))}
                placeholder="panaderia-demo" />
            </Field>
            <Field label="Dueño">
              <input className={controlDeckStyles.input} value={form.owner_name}
                onChange={e => setForm(f => ({ ...f, owner_name:e.target.value }))} placeholder="Laura Morales" />
            </Field>
            <Field label="Email">
              <input className={controlDeckStyles.input} type="email" value={form.owner_email}
                onChange={e => setForm(f => ({ ...f, owner_email:e.target.value }))} placeholder="laura@negocio.com" />
            </Field>
            <Field label="Teléfono">
              <input className={controlDeckStyles.input} value={form.owner_phone}
                onChange={e => setForm(f => ({ ...f, owner_phone:e.target.value }))} placeholder="+57 300 000 0000" />
            </Field>
            <Field label="Plan">
              <select className={controlDeckStyles.select} value={plan} onChange={e => setPlan(e.target.value)}>
                {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </FormGrid>
          <Actions><Button type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear Tenant'}</Button></Actions>
        </Form>
      </Panel>

      <Panel title={`Tenants (${tenants.length})`} dark>
        {loading && <Notice>Cargando…</Notice>}
        {tenants.map(t => {
          const sub    = t.tenant_subscriptions?.[0]
          const nStores= t.stores?.[0]?.count ?? 0
          return (
            <div key={t.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--color-border-tertiary)',
              display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div>
                <div style={{ fontWeight:500, fontSize:13 }}>{t.name}</div>
                <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:2 }}>
                  {t.owner_email} · {nStores} tienda{nStores!==1?'s':''} · {sub?.plan_id||'sin plan'}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500,
                  background:t.status==='active'?'#dcfce7':'#fef2f2',
                  color:t.status==='active'?'#16a34a':'#dc2626' }}>{t.status}</span>
                <GhostButton type="button" style={{ fontSize:11, padding:'3px 8px' }} onClick={() => toggleStatus(t)}>
                  {t.status==='active'?'Suspender':'Activar'}
                </GhostButton>
              </div>
            </div>
          )
        })}
      </Panel>
    </Grid>
  )
}
