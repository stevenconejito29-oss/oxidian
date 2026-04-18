import React from 'react'
import {
  buildStoreDraft,
  cloneStoreCatalogSafe,
  loadStoreCatalog,
  saveStoreBundle,
} from '../../../legacy/lib/storeManagement'
import { BUSINESS_TYPES } from '../../../legacy/lib/storeConfig'
import { adminApi } from '../../../shared/lib/backofficeApi'
import { supabaseAuth } from '../../../shared/supabase/client'
import {
  Actions,
  BadgeRow,
  Button,
  Field,
  Form,
  FormGrid,
  GhostButton,
  Grid,
  Hero,
  Notice,
  Panel,
  QuickLinks,
  Shell,
  Stats,
  controlDeckStyles,
} from '../../../shared/ui/ControlDeck'
import ChatbotAuthManager from '../components/ChatbotAuthManager'

const ADMIN_TABS = [
  { id: 'overview',  label: 'Vision Global' },
  { id: 'pipeline',  label: 'Solicitudes' },
  { id: 'tenants',   label: 'Tenants' },
  { id: 'owners',    label: 'Duenos' },
  { id: 'stores',    label: 'Tiendas' },
  { id: 'chatbot',   label: 'Chatbot' },
]

const INITIAL_FORM = {
  name: '',
  slug: '',
  owner_name: '',
  owner_email: '',
  city: '',
  business_type: 'food',
  plan_id: 'growth',
  source_store_id: 'default',
  notes: '',
}

const INITIAL_OWNER_FORM = {
  tenant_id: '',
  role: 'tenant_owner',
  full_name: '',
  email: '',
  password: '',
}

function buildStatusCount(stores = []) {
  return stores.reduce((acc, item) => {
    const status = item?.store?.status || 'draft'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
}

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
      marginBottom: 20, padding: '4px 0',
      borderBottom: '1px solid var(--color-border-tertiary)',
    }}>
      {ADMIN_TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
            border: active === tab.id ? 'none' : '1px solid var(--color-border-secondary)',
            background: active === tab.id ? 'var(--color-text-primary)' : 'transparent',
            color: active === tab.id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
            fontFamily: 'inherit', transition: '.15s',
          }}
        >{tab.label}</button>
      ))}
    </div>
  )
}

export default function SuperAdminPage() {
  const [catalog, setCatalog] = React.useState({ stores: [], plans: [], missingSchema: false })
  const [tenants, setTenants] = React.useState([])
  const [ownerAccounts, setOwnerAccounts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [ownersLoading, setOwnersLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [ownerError, setOwnerError] = React.useState('')
  const [form, setForm] = React.useState(INITIAL_FORM)
  const [ownerForm, setOwnerForm] = React.useState(INITIAL_OWNER_FORM)
  const [saving, setSaving] = React.useState(false)
  const [ownerSaving, setOwnerSaving] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [ownerResult, setOwnerResult] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('stores')

  const refreshCatalog = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await loadStoreCatalog()
      setCatalog(next)
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo cargar el catalogo de tiendas.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshCatalog()
  }, [refreshCatalog])

  const refreshOwners = React.useCallback(async () => {
    setOwnersLoading(true)
    setOwnerError('')
    try {
      const [nextTenants, nextOwners] = await Promise.all([
        adminApi('GET', '/tenants'),
        adminApi('GET', '/accounts/owners'),
      ])
      setTenants(nextTenants || [])
      setOwnerAccounts(nextOwners || [])
      setOwnerForm(current => ({
        ...current,
        tenant_id: current.tenant_id || nextTenants?.[0]?.id || '',
      }))
    } catch (nextError) {
      setOwnerError(nextError?.message || 'No se pudieron cargar las cuentas de dueños.')
    } finally {
      setOwnersLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshOwners()
  }, [refreshOwners])

  const statusCount = buildStatusCount(catalog.stores)
  const plans = catalog.plans.length > 0 ? catalog.plans : [{ id: 'growth', name: 'Growth' }]

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setResult(null)
    try {
      const bundle = buildStoreDraft({
        ...form,
        code: form.slug || form.name,
        portable_folder_name: `store-${form.slug || form.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      })
      const saved = await saveStoreBundle(bundle)
      let cloneResult = null
      if (form.source_store_id && form.source_store_id !== saved.store.id) {
        cloneResult = await cloneStoreCatalogSafe(form.source_store_id, saved.store.id)
      }
      setResult({ storeId: saved.store.id, cloneResult, sourceStoreId: form.source_store_id })
      setForm(INITIAL_FORM)
      await refreshCatalog()
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo crear la tienda.')
    } finally {
      setSaving(false)
    }
  }

  async function handleOwnerSubmit(event) {
    event.preventDefault()
    setOwnerSaving(true)
    setOwnerError('')
    setOwnerResult(null)
    try {
      const created = await adminApi('POST', '/accounts/owners', ownerForm)
      setOwnerResult(created)
      setOwnerForm(current => ({
        ...INITIAL_OWNER_FORM,
        tenant_id: current.tenant_id || ownerForm.tenant_id,
      }))
      await refreshOwners()
    } catch (nextError) {
      setOwnerError(nextError?.message || 'No se pudo crear la cuenta del dueño.')
    } finally {
      setOwnerSaving(false)
    }
  }

  async function handleOwnerStatusChange(account, isActive) {
    setOwnerError('')
    try {
      await adminApi('PATCH', `/accounts/owners/${account.membership_id}`, { is_active: isActive })
      await refreshOwners()
    } catch (nextError) {
      setOwnerError(nextError?.message || 'No se pudo actualizar la cuenta.')
    }
  }

  async function handleOwnerPasswordReset(account) {
    const nextPassword = window.prompt(`Nueva password para ${account.email}`, '')
    if (!nextPassword) return
    setOwnerError('')
    try {
      await adminApi('PATCH', `/accounts/owners/${account.membership_id}`, { password: nextPassword })
      setOwnerResult({ email: account.email, passwordReset: true })
      await refreshOwners()
    } catch (nextError) {
      setOwnerError(nextError?.message || 'No se pudo actualizar la password.')
    }
  }

  return (
    <Shell>
      <Hero
        eyebrow="Super Admin · Oxidian"
        title="Controla tenants, marcas, sedes y chatbots."
        description="Crea tiendas, clona catálogos, autoriza chatbots portables y gestiona toda la red comercial desde un solo panel."
        signals={[
          { label: 'Tiendas', value: String(catalog.stores.length) },
          { label: 'Activas', value: String(statusCount.active || 0) },
        ]}
      />

      {/* Stats rápidos */}
      <Stats items={[
        { label: 'Total tiendas', value: String(catalog.stores.length), hint: 'Marcas en el sistema.' },
        { label: 'Activas', value: String(statusCount.active || 0), hint: 'Listas para vender.' },
        { label: 'Borrador', value: String(statusCount.draft || 0), hint: 'En preparación.' },
        { label: 'Planes', value: String(plans.length), hint: 'Paquetes disponibles.' },
      ]} />

      {catalog.missingSchema && (
        <Notice tone="error">Schema de Supabase incompleto. Aplica las migraciones antes de crear tiendas.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <Notice tone="success">
          Tienda creada: <strong>{result.storeId}</strong>.{' '}
          {result.cloneResult?.success
            ? `Catálogo clonado desde ${result.sourceStoreId || 'default'}.`
            : result.cloneResult?.reason || 'Sin clonación adicional.'}
        </Notice>
      )}

      {/* Tabs de navegación */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Vision Global ────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab storeCount={catalog.stores.length} statusCount={statusCount} planCount={plans.length} />
      )}

      {/* ── Tab: Solicitudes (Pipeline) ───────────────────────── */}
      {activeTab === 'pipeline' && <PipelineTab />}

      {/* ── Tab: Tenants ──────────────────────────────────────── */}
      {activeTab === 'tenants' && <TenantsTab plans={plans} />}

      {/* ── Tab: Tiendas ──────────────────────────────────────── */}
      {activeTab === 'stores' && (
        <Grid>
          <Panel title="Crear tienda clonada" text="Crea una nueva marca y clona su catálogo desde una tienda origen.">
            <Form onSubmit={handleSubmit}>
              <FormGrid>
                <Field label="Nombre de negocio">
                  <input className={controlDeckStyles.input} value={form.name}
                    onChange={e => setForm(c => ({ ...c, name: e.target.value }))}
                    placeholder="Boutique Aurora" required />
                </Field>
                <Field label="Slug / código">
                  <input className={controlDeckStyles.input} value={form.slug}
                    onChange={e => setForm(c => ({ ...c, slug: e.target.value }))}
                    placeholder="boutique-aurora" required />
                </Field>
                <Field label="Dueño">
                  <input className={controlDeckStyles.input} value={form.owner_name}
                    onChange={e => setForm(c => ({ ...c, owner_name: e.target.value }))}
                    placeholder="Nombre del tenant" />
                </Field>
                <Field label="Email del dueño">
                  <input className={controlDeckStyles.input} value={form.owner_email}
                    onChange={e => setForm(c => ({ ...c, owner_email: e.target.value }))}
                    placeholder="owner@negocio.com" />
                </Field>
                <Field label="Ciudad">
                  <input className={controlDeckStyles.input} value={form.city}
                    onChange={e => setForm(c => ({ ...c, city: e.target.value }))}
                    placeholder="Madrid" />
                </Field>
                <Field label="Tipo de negocio">
                  <select className={controlDeckStyles.select} value={form.business_type}
                    onChange={e => setForm(c => ({ ...c, business_type: e.target.value }))}>
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Plan">
                  <select className={controlDeckStyles.select} value={form.plan_id}
                    onChange={e => setForm(c => ({ ...c, plan_id: e.target.value }))}>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Clonar desde">
                  <select className={controlDeckStyles.select} value={form.source_store_id}
                    onChange={e => setForm(c => ({ ...c, source_store_id: e.target.value }))}>
                    <option value="default">default</option>
                    {catalog.stores.map(item => (
                      <option key={item.store.id} value={item.store.id}>
                        {item.store.name} ({item.store.id})
                      </option>
                    ))}
                  </select>
                </Field>
              </FormGrid>
              <Field label="Notas internas">
                <textarea className={controlDeckStyles.textarea} value={form.notes}
                  onChange={e => setForm(c => ({ ...c, notes: e.target.value }))}
                  placeholder="Observaciones para onboarding, branding o sede inicial." />
              </Field>
              <Actions>
                <Button disabled={saving} type="submit">
                  {saving ? 'Creando tienda...' : 'Crear y clonar'}
                </Button>
                <GhostButton type="button" onClick={() => setForm(INITIAL_FORM)}>Limpiar</GhostButton>
              </Actions>
            </Form>
          </Panel>

          <Panel title="Catálogo actual" text="Inventario administrativo de marcas." dark>
            {loading ? <Notice>Cargando catálogo...</Notice> : null}
            {!loading && (
              <div className={controlDeckStyles.list}>
                {catalog.stores.slice(0, 8).map(item => (
                  <article className={controlDeckStyles.listCard} key={item.store.id}>
                    <div className={controlDeckStyles.listTop}>
                      <div>
                        <h3 className={controlDeckStyles.listTitle}>{item.store.name}</h3>
                        <p className={controlDeckStyles.listMeta}>
                          {item.store.id} · {item.store.city || 'Sin ciudad'} · {item.store.owner_email || 'Sin email'}
                        </p>
                      </div>
                      <span className={controlDeckStyles.badge}>{item.store.status}</span>
                    </div>
                    <BadgeRow items={[
                      item.plan?.name || item.store.plan_id || 'Plan base',
                      item.process?.catalog_mode || 'food',
                      item.process?.order_flow_type || 'standard',
                      item.runtime?.chatbot_url ? 'chatbot runtime' : 'sin chatbot',
                    ]} />
                    <Actions>
                      <GhostButton type="button"
                        onClick={() => window.open(`/tenant/admin?store=${encodeURIComponent(item.store.id)}`, '_self')}>
                        Abrir tenant
                      </GhostButton>
                      <GhostButton type="button"
                        onClick={() => window.open(`/storefront/menu?store=${encodeURIComponent(item.store.id)}`, '_self')}>
                        Ver menú
                      </GhostButton>
                    </Actions>
                  </article>
                ))}
                {!catalog.stores.length && (
                  <Notice>Sin tiendas todavía. Crea la primera desde el formulario.</Notice>
                )}
              </div>
            )}
          </Panel>
        </Grid>
      )}

      {/* ── Tab: Chatbot Auth ─────────────────────────────────── */}
      {activeTab === 'owners' && (
        <Grid>
          <Panel title="Crear cuentas de dueños" text="El super admin gestiona tenant owner y tenant admin sin tocar SQL manual.">
            {ownerError && <Notice tone="error">{ownerError}</Notice>}
            {ownerResult && (
              <Notice tone="success">
                Cuenta lista para <strong>{ownerResult.email}</strong>.
              </Notice>
            )}
            <Form onSubmit={handleOwnerSubmit}>
              <FormGrid>
                <Field label="Tenant">
                  <select
                    className={controlDeckStyles.select}
                    value={ownerForm.tenant_id}
                    onChange={e => setOwnerForm(current => ({ ...current, tenant_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecciona un tenant</option>
                    {tenants.map(tenant => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rol">
                  <select
                    className={controlDeckStyles.select}
                    value={ownerForm.role}
                    onChange={e => setOwnerForm(current => ({ ...current, role: e.target.value }))}
                  >
                    <option value="tenant_owner">tenant_owner</option>
                    <option value="tenant_admin">tenant_admin</option>
                  </select>
                </Field>
                <Field label="Nombre completo">
                  <input
                    className={controlDeckStyles.input}
                    value={ownerForm.full_name}
                    onChange={e => setOwnerForm(current => ({ ...current, full_name: e.target.value }))}
                    placeholder="Maria Perez"
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={controlDeckStyles.input}
                    type="email"
                    value={ownerForm.email}
                    onChange={e => setOwnerForm(current => ({ ...current, email: e.target.value }))}
                    placeholder="dueno@marca.com"
                    required
                  />
                </Field>
                <Field label="Password inicial">
                  <input
                    className={controlDeckStyles.input}
                    type="text"
                    value={ownerForm.password}
                    onChange={e => setOwnerForm(current => ({ ...current, password: e.target.value }))}
                    placeholder="Minimo 8 caracteres"
                    required
                  />
                </Field>
              </FormGrid>
              <Actions>
                <Button disabled={ownerSaving} type="submit">
                  {ownerSaving ? 'Guardando cuenta...' : 'Crear cuenta'}
                </Button>
                <GhostButton
                  type="button"
                  onClick={() => setOwnerForm(current => ({
                    ...INITIAL_OWNER_FORM,
                    tenant_id: current.tenant_id,
                  }))}
                >
                  Limpiar
                </GhostButton>
              </Actions>
            </Form>
          </Panel>

          <Panel title="Dueños y admins de tenant" text="Control de acceso para las cuentas que gobiernan cada negocio." dark>
            {ownersLoading ? <Notice>Cargando cuentas...</Notice> : null}
            {!ownersLoading && ownerAccounts.length === 0 ? (
              <Notice>No hay cuentas registradas todavia.</Notice>
            ) : null}
            {!ownersLoading && ownerAccounts.length > 0 ? (
              <div className={controlDeckStyles.list}>
                {ownerAccounts.map(account => (
                  <article className={controlDeckStyles.listCard} key={account.membership_id}>
                    <div className={controlDeckStyles.listTop}>
                      <div>
                        <h3 className={controlDeckStyles.listTitle}>{account.full_name || account.email}</h3>
                        <p className={controlDeckStyles.listMeta}>
                          {account.email} · {account.tenant_name || 'Tenant sin nombre'}
                        </p>
                      </div>
                      <span className={controlDeckStyles.badge}>
                        {account.is_active ? 'activo' : 'pausado'}
                      </span>
                    </div>
                    <BadgeRow items={[
                      account.role,
                      account.last_sign_in_at ? 'ya entro' : 'sin login',
                    ]} />
                    <Actions>
                      <GhostButton type="button" onClick={() => handleOwnerStatusChange(account, !account.is_active)}>
                        {account.is_active ? 'Pausar acceso' : 'Reactivar acceso'}
                      </GhostButton>
                      <GhostButton type="button" onClick={() => handleOwnerPasswordReset(account)}>
                        Resetear password
                      </GhostButton>
                    </Actions>
                  </article>
                ))}
              </div>
            ) : null}
          </Panel>
        </Grid>
      )}

      {activeTab === 'chatbot' && (
        <Panel title="Autorización de chatbot portable"
          text="Autoriza o revoca el acceso al chatbot portable por sede.">
          <ChatbotAuthManager />
        </Panel>
      )}
    </Shell>
  )
}

// ═══════════════════════════════════════════════════════
// TABS NUEVOS — OverviewTab, PipelineTab, TenantsTab
// ═══════════════════════════════════════════════════════

function OverviewTab({ storeCount, statusCount, planCount }) {
  const [metrics, setMetrics] = React.useState(null)

  React.useEffect(() => {
    Promise.all([
      supabaseAuth.from('tenants').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('branches').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('landing_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAuth.from('orders').select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]).then(([t, b, l, o]) => setMetrics({
      tenants: t.count ?? 0, branches: b.count ?? 0,
      leads: l.count ?? 0, orders24h: o.count ?? 0,
    }))
  }, [])

  return (
    <Stats items={[
      { label: 'Tenants',       value: String(metrics?.tenants ?? '…'),   hint: 'Dueños de negocio activos' },
      { label: 'Tiendas',       value: String(storeCount),                hint: 'Stores en el sistema' },
      { label: 'Sedes',         value: String(metrics?.branches ?? '…'),  hint: 'Puntos de operación' },
      { label: 'Leads pendientes', value: String(metrics?.leads ?? '…'), hint: 'Del landing sin contactar' },
      { label: 'Pedidos (24h)', value: String(metrics?.orders24h ?? '…'), hint: 'Órdenes en las últimas 24h' },
      { label: 'Planes',        value: String(planCount),                 hint: 'Paquetes disponibles' },
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
    supabaseAuth.from('landing_requests').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [])

  async function advance(id, status) {
    setSaving(id)
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'contacted') patch.contacted_at = new Date().toISOString()
    if (status === 'converted') patch.converted_at = new Date().toISOString()
    await supabaseAuth.from('landing_requests').update(patch).eq('id', id)
    setRequests(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    setSaving(null)
  }

  async function sendInvite(r) {
    const ok = window.confirm(
      `Aprobar y enviar enlace a ${r.email}?\n\n` +
      `Recibiran un link magico para entrar directamente al wizard de configuracion de su tienda.`
    )
    if (!ok) return
    setSaving(r.id)
    try {
      const { error } = await supabaseAuth.auth.signInWithOtp({
        email: r.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (error) throw error
      await advance(r.id, 'onboarding')
      window.alert(
        `Enlace enviado a ${r.email}.\n` +
        `El usuario hara clic y llegara al wizard para configurar su tienda.\n\n` +
        `Si no llega el email, verifica la configuracion de Supabase Auth > Email Templates.`
      )
    } catch (e) { window.alert('Error: ' + e.message) }
    setSaving(null)
  }

  const byStatus = requests.reduce((a, r) => { a[r.status] = (a[r.status]||0)+1; return a }, {})
  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  if (loading) return <Notice>Cargando solicitudes...</Notice>

  return (
    <div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {['all', ...PIPELINE_STATES].map(s => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            style={{ padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit',
              border: filter===s ? 'none' : '1px solid var(--color-border-secondary)',
              background: filter===s ? (STATUS_COLOR[s]||'var(--color-text-primary)') : 'transparent',
              color: filter===s ? '#fff' : 'var(--color-text-secondary)' }}>
            {s==='all'?'Todos':s} {byStatus[s]?`(${byStatus[s]})`:''}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <Notice>Sin solicitudes en este estado</Notice>
        : filtered.map(r => (
          <div key={r.id} style={{ padding:'14px', marginBottom:8, borderRadius:10,
            border:'1px solid var(--color-border-tertiary)',
            background:'var(--color-background-primary)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:14 }}>{r.full_name}</div>
                <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                  {r.email} · {r.phone} · {r.business_name} ({r.business_niche}) · {r.city}
                </div>
                {r.message && (
                  <div style={{ fontSize:12, marginTop:6, padding:'6px 10px',
                    background:'var(--color-background-secondary)', borderRadius:6, fontStyle:'italic' }}>
                    "{r.message}"
                  </div>
                )}
              </div>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500, whiteSpace:'nowrap',
                background:`${STATUS_COLOR[r.status]}20`, color:STATUS_COLOR[r.status] }}>{r.status}</span>
            </div>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              {r.status === 'pending' && (
                <button type="button" onClick={() => advance(r.id,'contacted')} disabled={saving===r.id}
                  style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                    background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none' }}>
                  Contactar
                </button>
              )}
              {(r.status === 'contacted' || r.status === 'demo_scheduled') && (
                <button type="button" onClick={() => sendInvite(r)} disabled={saving===r.id}
                  style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                    background:'#16a34a', color:'#fff', border:'none' }}>
                  Aprobar y enviar invitación
                </button>
              )}
              {!['converted','rejected'].includes(r.status) && (
                <button type="button" onClick={() => advance(r.id,'rejected')} disabled={saving===r.id}
                  style={{ padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                    background:'transparent', color:'#dc2626',
                    border:'1px solid #dc2626' }}>
                  Rechazar
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  )
}

function TenantsTab({ plans }) {
  const [tenants, setTenants] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'' })
  const [plan, setPlan] = React.useState('growth')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    supabaseAuth.from('tenants')
      .select('*, tenant_subscriptions(plan_id,status), stores(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTenants(data ?? []); setLoading(false) })
  }, [])

  async function createTenant(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { data: t, error: te } = await supabaseAuth.from('tenants').insert({
        ...form, status:'active', monthly_fee:0,
      }).select().single()
      if (te) throw te
      await supabaseAuth.from('tenant_subscriptions').insert({
        tenant_id: t.id, plan_id: plan, status:'active',
        current_period_end: new Date(Date.now()+30*86400000).toISOString(),
      })
      setForm({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', notes:'' })
      setTenants(prev => [t, ...prev])
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'suspended' : 'active'
    await supabaseAuth.from('tenants').update({ status:next }).eq('id', t.id)
    setTenants(prev => prev.map(x => x.id===t.id ? {...x, status:next} : x))
  }

  const planLabel = id => plans.find(p => p.id===id)?.name ?? id

  return (
    <Grid>
      <Panel title="Nuevo Tenant">
        {error && <Notice tone="error">{error}</Notice>}
        <Form onSubmit={createTenant}>
          <FormGrid>
            <Field label="Nombre *"><input className={controlDeckStyles.input} required
              value={form.name} onChange={e => {
                const name = e.target.value
                setForm(f => ({ ...f, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }))
              }} placeholder="Panadería Demo" /></Field>
            <Field label="Slug *"><input className={controlDeckStyles.input} required
              value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-') }))}
              placeholder="panaderia-demo" /></Field>
            <Field label="Dueño"><input className={controlDeckStyles.input}
              value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
              placeholder="Laura Morales" /></Field>
            <Field label="Email"><input className={controlDeckStyles.input} type="email"
              value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))}
              placeholder="laura@negocio.com" /></Field>
            <Field label="Teléfono"><input className={controlDeckStyles.input}
              value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))}
              placeholder="+57 300 000 0000" /></Field>
            <Field label="Plan SaaS">
              <select className={controlDeckStyles.select} value={plan} onChange={e => setPlan(e.target.value)}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </FormGrid>
          <Actions>
            <Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear Tenant'}</Button>
          </Actions>
        </Form>
      </Panel>
      <Panel title={`Tenants (${tenants.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : tenants.map(t => {
          const sub = t.tenant_subscriptions?.[0]
          const stores = t.stores?.[0]?.count ?? 0
          return (
            <div key={t.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--color-border-tertiary)',
              display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div>
                <div style={{ fontWeight:500, fontSize:13 }}>{t.name}</div>
                <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:2 }}>
                  {t.owner_email} · {stores} tienda{stores!==1?'s':''} · {planLabel(sub?.plan_id)}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500,
                  background: t.status==='active'?'#dcfce7':'#fef2f2',
                  color: t.status==='active'?'#16a34a':'#dc2626' }}>{t.status}</span>
                <GhostButton type="button" style={{ fontSize:11, padding:'3px 8px' }}
                  onClick={() => toggleStatus(t)}>
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
