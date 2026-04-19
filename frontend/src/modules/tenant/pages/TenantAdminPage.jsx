import React from 'react'
import { useNavigate } from 'react-router-dom'
import AdminStoreCustomizationPanel from '../../../legacy/pages/AdminStoreCustomizationPanel'
import { useAuth } from '../../../core/providers/AuthProvider'
import {
  createBranch,
  createStaffAccount,
  createStore,
  getTenantDashboard,
  getTenantPlan,
  listBranches,
  listMemberships,
  listStores,
  updateStaffAccount,
  updateStore,
} from '../../../shared/lib/supabaseApi'
import {
  createStorePayload,
  getAvailableMenuStyles,
  getMenuStyleDefinition,
  getNicheDefinition,
  TENANT_NICHES,
} from '../lib/storeCatalog'

const UI = {
  shell: { maxWidth: 1120, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 24px', paddingBottom: 8, borderBottom: '1px solid var(--color-border-tertiary)' },
  tab: (active) => ({
    padding: '8px 16px',
    borderRadius: 999,
    border: active ? 'none' : '1px solid var(--color-border-secondary)',
    background: active ? 'var(--color-text-primary)' : 'transparent',
    color: active ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  }),
  card: { background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 },
  muted: { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 },
  grid: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
  stats: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 16 },
  stat: { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 12, padding: 14 },
  label: { display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' },
  cols: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  primary: { padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)', fontFamily: 'inherit', cursor: 'pointer' },
  notice: (tone) => ({
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 12,
    background: tone === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
    color: tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)',
    fontSize: 13,
  }),
}

const MENU_STYLES = getAvailableMenuStyles()

const STAFF_ROLES = [
  ['tenant_admin', 'Admin de tenant', 'tenant'],
  ['store_admin', 'Admin de tienda', 'store'],
  ['store_operator', 'Operador', 'store'],
  ['branch_manager', 'Manager de sede', 'branch'],
  ['cashier', 'Caja', 'branch'],
  ['kitchen', 'Preparacion', 'branch'],
  ['rider', 'Repartidor', 'branch'],
]

const TABS = [
  ['overview', 'Resumen'],
  ['stores', 'Tiendas'],
  ['branches', 'Sedes'],
  ['staff', 'Staff'],
  ['customize', 'Personalizar'],
]

const EMPTY_STORE_FORM = {
  name: '',
  slug: '',
  niche: '',
  city: '',
  initial_branch_name: 'Sede principal',
  initial_branch_slug: 'principal',
  initial_branch_city: '',
  initial_branch_address: '',
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function Badge({ ok, text }) {
  const color = ok ? '#16a34a' : '#9ca3af'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}20`, padding: '3px 8px', borderRadius: 999 }}>
      {text}
    </span>
  )
}

function NichePicker({ value, onChange }) {
  return (
    <div>
      <label style={UI.label}>Tipo de negocio (nicho) *</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {TENANT_NICHES.map((niche) => (
          <button
            key={niche.id}
            type="button"
            onClick={() => onChange(niche)}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: value === niche.id ? `2px solid ${niche.color}` : '1px solid var(--color-border-secondary)',
              background: value === niche.id ? `${niche.color}12` : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: '.15s',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{niche.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: value === niche.id ? niche.color : 'var(--color-text-primary)' }}>
              {niche.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function getStoreNiche(store) {
  return getNicheDefinition(store?.niche || 'universal')
}

function getRecommendedMenuStyle(store) {
  return getMenuStyleDefinition(getStoreNiche(store).recommendedMenuStyleId)
}

export default function TenantAdminPage() {
  const navigate = useNavigate()
  const { tenantId, role } = useAuth()

  const [tab, setTab] = React.useState('overview')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [dashboard, setDashboard] = React.useState({})
  const [stores, setStores] = React.useState([])
  const [branches, setBranches] = React.useState([])
  const [accounts, setAccounts] = React.useState([])
  const [planId, setPlanId] = React.useState('growth')
  const [selectedStoreId, setSelectedStoreId] = React.useState('')
  const [busy, setBusy] = React.useState('')

  const [storeForm, setStoreForm] = React.useState(EMPTY_STORE_FORM)
  const [branchForm, setBranchForm] = React.useState({
    name: 'Nueva sede',
    slug: 'nueva-sede',
    city: '',
    address: '',
    phone: '',
  })
  const [staffForm, setStaffForm] = React.useState({
    full_name: '',
    email: '',
    password: '',
    role: 'store_admin',
    store_id: '',
    branch_id: '',
  })

  const selectedStore = stores.find((store) => store.id === selectedStoreId) || stores[0] || null
  const selectedRole = STAFF_ROLES.find((entry) => entry[0] === staffForm.role) || STAFF_ROLES[0]
  const selectedNiche = getNicheDefinition(storeForm.niche || 'universal')
  const selectedStoreMenuStyle = selectedStore ? getRecommendedMenuStyle(selectedStore) : null
  const storeBranches = branches.filter((branch) => branch.store_id === selectedStore?.id)
  const scopedBranches = branches.filter((branch) => branch.store_id === staffForm.store_id)

  const load = React.useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextDashboard, nextStores, nextBranches, nextAccounts, nextPlan] = await Promise.all([
        getTenantDashboard(tenantId),
        listStores(tenantId),
        listBranches(tenantId),
        listMemberships({
          tenant_id: tenantId,
          roles: ['tenant_admin', 'store_admin', 'store_operator', 'branch_manager', 'cashier', 'kitchen', 'rider'],
        }),
        getTenantPlan(tenantId),
      ])

      setDashboard(nextDashboard && typeof nextDashboard === 'object' && !Array.isArray(nextDashboard) ? nextDashboard : {})
      setStores(Array.isArray(nextStores) ? nextStores : [])
      setBranches(Array.isArray(nextBranches) ? nextBranches : [])
      setAccounts(Array.isArray(nextAccounts) ? nextAccounts : [])
      setPlanId(typeof nextPlan === 'string' ? nextPlan : 'growth')
      setSelectedStoreId((current) => (current && (Array.isArray(nextStores) ? nextStores : []).some((store) => store.id === current) ? current : (nextStores?.[0]?.id || '')))
      setStaffForm((current) => ({ ...current, store_id: current.store_id || nextStores?.[0]?.id || '' }))
    } catch (nextError) {
      setError(nextError.message || 'No se pudo cargar el panel.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  React.useEffect(() => {
    load()
  }, [load])

  async function run(label, action, onDone) {
    setBusy(label)
    setError('')
    try {
      await action()
      await load()
      onDone?.()
    } catch (nextError) {
      setError(nextError.message || 'Operacion fallida')
    } finally {
      setBusy('')
    }
  }

  async function handleCreateStore() {
    if (!storeForm.name || !storeForm.slug || !storeForm.niche) {
      setError('Completa nombre, slug y nicho')
      return
    }

    const payload = createStorePayload({
      name: storeForm.name,
      slug: storeForm.slug,
      nicheId: storeForm.niche,
      city: storeForm.city,
      initialBranchName: storeForm.initial_branch_name,
      initialBranchSlug: storeForm.initial_branch_slug,
      initialBranchCity: storeForm.initial_branch_city,
      initialBranchAddress: storeForm.initial_branch_address,
    })

    await run(
      'store',
      async () => {
        const store = await createStore({
          ...payload,
          tenant_id: tenantId,
          status: 'active',
          public_visible: true,
          theme_tokens: {},
        })

        if (payload.initial_branch_name) {
          await createBranch({
            tenant_id: tenantId,
            store_id: store.id,
            slug: payload.initial_branch_slug || 'principal',
            name: payload.initial_branch_name,
            address: payload.initial_branch_address || '',
            city: payload.initial_branch_city || payload.city || '',
            phone: '',
            status: 'active',
            is_primary: true,
            public_visible: true,
          })
        }
      },
      () => {
        setSelectedStoreId(storeForm.slug)
        setTab('customize')
        setStoreForm(EMPTY_STORE_FORM)
      },
    )
  }

  async function handleCreateStaff() {
    if (!staffForm.email || !staffForm.password || !staffForm.role) {
      setError('Email, password y rol son requeridos')
      return
    }

    await run(
      'staff',
      () => createStaffAccount({ ...staffForm, tenant_id: tenantId }),
      () => setStaffForm((current) => ({ ...current, full_name: '', email: '', password: '', branch_id: '' })),
    )
  }

  if (!tenantId) {
    return (
      <div style={UI.shell}>
        <div style={UI.notice('error')}>Sin tenant asignado. Solicita acceso al administrador.</div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ ...UI.shell, color: 'var(--color-text-secondary)' }}>Cargando panel...</div>
  }

  return (
    <div style={UI.shell}>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Panel del dueno · {role}
      </div>
      <h1 style={{ fontSize: 26, margin: '6px 0 8px' }}>Mis tiendas, sedes y staff</h1>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Crea tiendas por nicho, personaliza el menu y gestiona tu equipo.
      </p>

      <div style={UI.stats}>
        {[['Plan', planId], ['Tiendas', stores.length], ['Sedes', branches.length], ['Staff', accounts.length], ['Pedidos hoy', dashboard.orders_today || 0]].map(([label, value]) => (
          <div key={label} style={UI.stat}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ ...UI.notice('error'), marginTop: 12 }}>{error}</div>}

      <div style={UI.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" style={UI.tab(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Bienvenido</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Cada tienda arranca con un nicho canonico y una plantilla base valida. Los cinco estilos reales del menu
              se ajustan despues desde Personalizar.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={UI.primary} type="button" onClick={() => setTab('stores')}>+ Crear tienda</button>
              <button style={UI.ghost} type="button" onClick={() => setTab('staff')}>Crear staff</button>
            </div>
          </div>
          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Tiendas activas ({stores.length})</h2>
            {stores.map((store) => {
              const niche = getStoreNiche(store)
              const menuStyle = getRecommendedMenuStyle(store)
              return (
                <div key={store.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                  <div style={UI.row}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{store.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {niche.icon} {niche.label} · {store.city || 'Sin ciudad'} · Menu recomendado: {menuStyle.label}
                      </div>
                    </div>
                    <Badge ok={store.status === 'active'} text={store.status || 'draft'} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button style={UI.ghost} type="button" onClick={() => window.open(`/s/${store.slug || store.id}/menu`, '_blank')}>Ver menu</button>
                    <button style={UI.primary} type="button" onClick={() => { setSelectedStoreId(store.id); setTab('customize') }}>Personalizar</button>
                  </div>
                </div>
              )
            })}
            {!stores.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Aun no hay tiendas.</div>}
          </div>
        </div>
      )}

      {tab === 'stores' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Crear nueva tienda</h2>
            <div style={{ ...UI.cols, marginBottom: 16 }}>
              <div>
                <label style={UI.label}>Nombre *</label>
                <input
                  style={UI.input}
                  value={storeForm.name}
                  onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))}
                  placeholder="Mi restaurante"
                />
              </div>
              <div>
                <label style={UI.label}>Slug (URL) *</label>
                <input
                  style={UI.input}
                  value={storeForm.slug}
                  onChange={(event) => setStoreForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                  placeholder="mi-restaurante"
                />
              </div>
              <div>
                <label style={UI.label}>Ciudad</label>
                <input style={UI.input} value={storeForm.city} onChange={(event) => setStoreForm((current) => ({ ...current, city: event.target.value }))} placeholder="Madrid" />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <NichePicker
                value={storeForm.niche}
                onChange={(niche) => setStoreForm((current) => ({ ...current, niche: niche.id }))}
              />
            </div>

            {storeForm.niche && (
              <div style={{ ...UI.muted, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Configuracion inicial</div>
                <div style={UI.cols}>
                  <div>
                    <div style={UI.label}>Business type</div>
                    <div>{selectedNiche.businessType}</div>
                  </div>
                  <div>
                    <div style={UI.label}>Plantilla base</div>
                    <div>{selectedNiche.templateId}</div>
                  </div>
                  <div>
                    <div style={UI.label}>Menu recomendado</div>
                    <div>{getMenuStyleDefinition(selectedNiche.recommendedMenuStyleId).label}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...UI.muted, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Sede inicial</div>
              <div style={UI.cols}>
                <div><label style={UI.label}>Nombre</label><input style={UI.input} value={storeForm.initial_branch_name} onChange={(event) => setStoreForm((current) => ({ ...current, initial_branch_name: event.target.value }))} /></div>
                <div><label style={UI.label}>Ciudad</label><input style={UI.input} value={storeForm.initial_branch_city} onChange={(event) => setStoreForm((current) => ({ ...current, initial_branch_city: event.target.value }))} /></div>
                <div><label style={UI.label}>Direccion</label><input style={UI.input} value={storeForm.initial_branch_address} onChange={(event) => setStoreForm((current) => ({ ...current, initial_branch_address: event.target.value }))} /></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={UI.primary} type="button" disabled={busy === 'store'} onClick={handleCreateStore}>
                {busy === 'store' ? 'Creando...' : 'Crear tienda'}
              </button>
              <button style={UI.ghost} type="button" onClick={() => setStoreForm(EMPTY_STORE_FORM)}>Limpiar</button>
            </div>
          </div>

          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Mis tiendas ({stores.length})</h2>
            {stores.map((store) => {
              const niche = getStoreNiche(store)
              const menuStyle = getRecommendedMenuStyle(store)
              return (
                <div key={store.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                  <div style={UI.row}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{store.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {niche.label} · Base: {store.template_id || niche.templateId} · Menu: {menuStyle.label}
                      </div>
                    </div>
                    <Badge ok={store.public_visible} text={store.public_visible ? 'publica' : 'oculta'} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button style={UI.ghost} type="button" onClick={() => run('toggle', () => updateStore(store.id, { public_visible: !store.public_visible }))}>
                      {store.public_visible ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button style={UI.primary} type="button" onClick={() => { setSelectedStoreId(store.id); setTab('customize') }}>Personalizar</button>
                  </div>
                </div>
              )
            })}
            {!stores.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Crea tu primera tienda.</div>}
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Sedes de la tienda</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={UI.label}>Tienda</label>
              <select style={UI.input} value={selectedStore?.id || ''} onChange={(event) => setSelectedStoreId(event.target.value)}>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </div>
            {storeBranches.map((branch) => (
              <div key={branch.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{branch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{branch.city} · {branch.slug}</div>
                  </div>
                  <Badge ok={branch.status === 'active'} text={branch.status || 'active'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button" onClick={() => window.open(`/s/${selectedStore?.slug}/${branch.slug}/login`, '_blank')}>Login staff</button>
                  <button style={UI.primary} type="button" onClick={() => navigate(`/branch/admin?store_id=${selectedStore?.id}&branch_id=${branch.id}`)}>Panel sede</button>
                </div>
              </div>
            ))}
          </div>

          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Anadir sede</h2>
            <div style={UI.cols}>
              {[['Nombre *', 'name', 'Nueva sede'], ['Slug *', 'slug', 'nueva-sede'], ['Ciudad', 'city', 'Madrid'], ['Telefono', 'phone', '+34 600 000 000']].map(([label, key, placeholder]) => (
                <div key={key}>
                  <label style={UI.label}>{label}</label>
                  <input style={UI.input} value={branchForm[key]} onChange={(event) => setBranchForm((current) => ({ ...current, [key]: key === 'slug' ? slugify(event.target.value) : event.target.value }))} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={UI.label}>Direccion</label>
              <input style={UI.input} value={branchForm.address} onChange={(event) => setBranchForm((current) => ({ ...current, address: event.target.value }))} placeholder="Calle Ejemplo 123" />
            </div>
            <button
              style={{ ...UI.primary, marginTop: 12 }}
              type="button"
              disabled={!selectedStore || busy === 'branch'}
              onClick={() => run('branch', () => createBranch({ tenant_id: tenantId, store_id: selectedStore.id, ...branchForm, status: 'active', public_visible: true }))}
            >
              {busy === 'branch' ? 'Creando...' : 'Crear sede'}
            </button>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div style={UI.grid}>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Crear cuenta de staff</h2>
            <div style={UI.cols}>
              {[['Nombre *', 'full_name', 'text', 'Maria Garcia'], ['Email *', 'email', 'email', 'maria@tienda.com'], ['Password *', 'password', 'text', 'Min. 8 caracteres']].map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label style={UI.label}>{label}</label>
                  <input style={UI.input} type={type} value={staffForm[key]} onChange={(event) => setStaffForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} />
                </div>
              ))}
              <div>
                <label style={UI.label}>Rol *</label>
                <select style={UI.input} value={staffForm.role} onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value, branch_id: '' }))}>
                  {STAFF_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={UI.label}>Tienda {selectedRole[2] !== 'tenant' ? '*' : ''}</label>
                <select style={UI.input} value={staffForm.store_id} disabled={selectedRole[2] === 'tenant'} onChange={(event) => setStaffForm((current) => ({ ...current, store_id: event.target.value, branch_id: '' }))}>
                  <option value="">Selecciona tienda</option>
                  {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </div>
              <div>
                <label style={UI.label}>Sede {selectedRole[2] === 'branch' ? '*' : ''}</label>
                <select style={UI.input} value={staffForm.branch_id} disabled={selectedRole[2] !== 'branch'} onChange={(event) => setStaffForm((current) => ({ ...current, branch_id: event.target.value }))}>
                  <option value="">Selecciona sede</option>
                  {scopedBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
            </div>
            <button style={{ ...UI.primary, marginTop: 12 }} type="button" disabled={busy === 'staff'} onClick={handleCreateStaff}>
              {busy === 'staff' ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>

          <div style={UI.muted}>
            <h2 style={{ marginTop: 0 }}>Staff activo ({accounts.length})</h2>
            {accounts.map((account) => (
              <div key={account.id || account.user_id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={UI.row}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{account.metadata?.full_name || account.user_id}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{account.role}</div>
                  </div>
                  <Badge ok={account.is_active} text={account.is_active ? 'activo' : 'pausado'} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button style={UI.ghost} type="button" onClick={() => run('staff-update', () => updateStaffAccount(account.id, { is_active: !account.is_active }))}>
                    {account.is_active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button
                    style={UI.ghost}
                    type="button"
                    onClick={() => {
                      const password = window.prompt('Nueva password', '')
                      if (password) {
                        run('pw', () => updateStaffAccount(account.id, { password }))
                      }
                    }}
                  >
                    Reset password
                  </button>
                </div>
              </div>
            ))}
            {!accounts.length && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Sin cuentas de staff todavia.</div>}
          </div>
        </div>
      )}

      {tab === 'customize' && (
        <>
          <div style={UI.card}>
            <h2 style={{ marginTop: 0 }}>Personalizar tienda</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={UI.label}>Tienda</label>
              <select style={UI.input} value={selectedStore?.id || ''} onChange={(event) => setSelectedStoreId(event.target.value)}>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </div>
            {selectedStore && (
              <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                <strong>Plantilla base:</strong> {selectedStore.template_id || 'delivery'} {' · '}
                <strong>Menu recomendado:</strong> {selectedStoreMenuStyle?.label || 'Brutalist'} {' · '}
                <a href={`/s/${selectedStore.slug}/menu`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-primary)' }}>
                  Ver menu publico ↗
                </a>
              </div>
            )}
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {MENU_STYLES.map((preset) => (
                <div key={preset.id} style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 10, background: selectedStoreMenuStyle?.id === preset.id ? 'var(--color-background-secondary)' : 'transparent' }}>
                  <div style={{ fontSize: 20 }}>{preset.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{preset.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{preset.description}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedStore ? (
            <AdminStoreCustomizationPanel key={selectedStore.id} storeId={selectedStore.id} capabilityScope="oxidian" onSaved={load} />
          ) : (
            <div style={{ ...UI.muted, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>Primero crea una tienda.</div>
          )}
        </>
      )}
    </div>
  )
}
