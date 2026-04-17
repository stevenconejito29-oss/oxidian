import React from 'react'
import {
  buildStoreDraft,
  cloneStoreCatalogSafe,
  loadStoreCatalog,
  saveStoreBundle,
} from '../../../legacy/lib/storeManagement'
import { BUSINESS_TYPES } from '../../../legacy/lib/storeConfig'
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
  { id: 'stores', label: '🏪 Tiendas' },
  { id: 'chatbot', label: '🤖 Chatbot Auth' },
  { id: 'links', label: '🧭 Accesos rápidos' },
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
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState(INITIAL_FORM)
  const [saving, setSaving] = React.useState(false)
  const [result, setResult] = React.useState(null)
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
      {activeTab === 'chatbot' && (
        <Panel
          title="Autorización de chatbot portable"
          text="Autoriza o revoca el acceso al chatbot portable por sede. Solo las sedes autorizadas pueden descargarlo."
        >
          <ChatbotAuthManager />
        </Panel>
      )}

      {/* ── Tab: Accesos rápidos ──────────────────────────────── */}
      {activeTab === 'links' && (
        <Grid>
          <Panel title="Accesos del sistema" text="Navegación directa a los módulos principales.">
            <QuickLinks links={[
              { emoji: '🧭', title: 'Tenant admin', text: 'Panel del dueño con módulos operativos.', href: '/tenant/admin' },
              { emoji: '📍', title: 'Branch admin', text: 'Panel completo de sede con 12 módulos.', href: '/branch/admin' },
              { emoji: '🍽️', title: 'Storefront', text: 'Menú público conectado al store activo.', href: '/storefront/menu' },
              { emoji: '📦', title: 'Cocina', text: 'Cola de preparación en tiempo real.', href: '/branch/kitchen' },
              { emoji: '🛵', title: 'Reparto', text: 'Panel de riders y despacho.', href: '/branch/riders' },
              { emoji: '🧪', title: 'Legacy admin', text: 'Interfaz anterior para referencia.', href: '/legacy/admin' },
            ]} />
          </Panel>
          <Panel title="Documentación de la arquitectura" dark>
            <QuickLinks links={[
              { emoji: '📋', title: 'Jerarquía', text: 'Super Admin → Tenant → Store → Branch', href: '#' },
              { emoji: '🔒', title: 'RLS activo', text: 'can_access_scope() en todas las tablas', href: '#' },
              { emoji: '🤖', title: 'Chatbot portable', text: 'WhatsApp + IA + anti-ban + relay', href: '#' },
              { emoji: '🎨', title: '4 templates', text: 'delivery, vitrina, portfolio, minimal', href: '#' },
            ]} />
          </Panel>
        </Grid>
      )}
    </Shell>
  )
}
