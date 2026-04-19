import React from 'react'
import DashboardLayout from '../../../core/app/DashboardLayout'
import {
  listTenants, createOwnerAccount, updateOwnerAccount, listOwnerAccounts,
  listStores, createStore, inviteLandingRequest,
} from '../../../shared/lib/supabaseApi'
import { PLANS, FEATURES, FEATURE_LABELS, planHasFeature } from '../../../shared/lib/planFeatures'
import { supabaseAuth } from '../../../shared/supabase/client'
import ChatbotAuthManager from '../components/ChatbotAuthManager'


// ─── UI Atoms ─────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', type = 'button', style: s = {} }) {
  const pad = size === 'sm' ? '5px 12px' : '9px 18px'
  const fs  = size === 'sm' ? 11 : 13
  const bg  = variant === 'primary' ? 'var(--color-text-primary)'
             : variant === 'danger'  ? '#dc2626'
             : variant === 'success' ? '#16a34a'
             : variant === 'indigo'  ? '#6366f1'
             : 'transparent'
  const cl  = variant === 'ghost' ? 'var(--color-text-secondary)' : '#fff'
  const bd  = variant === 'ghost' ? '1px solid var(--color-border-secondary)' : 'none'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: pad, borderRadius: 8, border: bd,
      background: disabled ? 'var(--color-background-secondary)' : bg,
      color: disabled ? 'var(--color-text-secondary)' : cl,
      fontSize: fs, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', transition: '.15s', whiteSpace: 'nowrap', ...s,
    }}>{children}</button>
  )
}

function Input({ label, ...p }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>{label}</label>}
      <input {...p} style={{
        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
        border: '1px solid var(--color-border-secondary)', boxSizing: 'border-box',
        background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
        fontFamily: 'inherit', outline: 'none', ...(p.style || {}),
      }} />
    </div>
  )
}

function Sel({ label, children, ...p }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>{label}</label>}
      <select {...p} style={{
        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
        border: '1px solid var(--color-border-secondary)', boxSizing: 'border-box',
        background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
        fontFamily: 'inherit', ...(p.style || {}),
      }}>{children}</select>
    </div>
  )
}

function Alert({ children, type = 'error' }) {
  const c = { error: '#dc2626', success: '#16a34a', info: '#2563eb', warn: '#d97706' }
  const b = { error: '#fef2f2', success: '#f0fdf4', info: '#eff6ff', warn: '#fffbeb' }
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 12,
      background: b[type] || b.info, color: c[type] || c.info,
      fontSize: 13, border: `1px solid ${c[type] || c.info}30`,
    }}>{children}</div>
  )
}

function Card({ children, title, sub, action, p = '18px', style: s = {} }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 14, overflow: 'hidden', ...s,
    }}>
      {(title || action) && (
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--color-border-tertiary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: p }}>{children}</div>
    </div>
  )
}

function StatCard({ label, value, icon, hint, color = '#6366f1' }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1.5px', marginTop: 8, color }}>{value ?? '…'}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Badge({ children, color = '#64748b' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function Empty({ icon = '📭', text }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-secondary)' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

function Grid2({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
      {children}
    </div>
  )
}

function slugify(v) {
  return String(v || '').toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

const STATUS_META = {
  active:          { label: 'Activo',      color: '#16a34a' },
  suspended:       { label: 'Suspendido',  color: '#dc2626' },
  archived:        { label: 'Archivado',   color: '#64748b' },
  draft:           { label: 'Borrador',    color: '#64748b' },
  paused:          { label: 'Pausado',     color: '#f59e0b' },
  pending:         { label: 'Pendiente',   color: '#ca8a04' },
  contacted:       { label: 'Contactado',  color: '#2563eb' },
  demo_scheduled:  { label: 'Demo',        color: '#7c3aed' },
  onboarding:      { label: 'Onboarding',  color: '#0891b2' },
  converted:       { label: 'Convertido',  color: '#16a34a' },
  rejected:        { label: 'Rechazado',   color: '#dc2626' },
  ghosted:         { label: 'Ghosted',     color: '#9ca3af' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#64748b' }
  return <Badge color={m.color}>{m.label}</Badge>
}


// ─── TABS ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  icon: '📊', label: 'Visión Global' },
  { id: 'tenants',   icon: '🏢', label: 'Tenants' },
  { id: 'plans',     icon: '💎', label: 'Planes' },
  { id: 'owners',    icon: '👤', label: 'Dueños' },
  { id: 'pipeline',  icon: '📋', label: 'Solicitudes' },
  { id: 'stores',    icon: '🏪', label: 'Tiendas' },
  { id: 'chatbot',   icon: '🤖', label: 'Chatbot' },
]

const NICHES = [
  { id: 'restaurant',          icon: '🍕', label: 'Restaurante',   template: 'delivery'  },
  { id: 'supermarket',         icon: '🛒', label: 'Supermercado',  template: 'vitrina'   },
  { id: 'boutique_fashion',    icon: '👗', label: 'Moda',          template: 'portfolio' },
  { id: 'pharmacy',            icon: '💊', label: 'Farmacia',      template: 'minimal'   },
  { id: 'neighborhood_store',  icon: '🏪', label: 'Tienda Barrio', template: 'minimal'   },
  { id: 'barbershop',          icon: '✂️', label: 'Barbería',      template: 'booking'   },
  { id: 'beauty_salon',        icon: '💅', label: 'Salón',         template: 'booking'   },
  { id: 'services',            icon: '🛠️', label: 'Servicios',     template: 'booking'   },
  { id: 'universal',           icon: '⭐', label: 'Otro',          template: 'delivery'  },
]

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
export default function SuperAdminPage() {
  const [tab, setTab] = React.useState('overview')

  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} title="Super Admin" subtitle="Oxidian">
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 22, flexWrap: 'wrap',
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400, fontFamily: 'inherit',
            background: tab === t.id ? 'var(--color-text-primary)' : 'transparent',
            color: tab === t.id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', gap: 5, transition: '.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab setTab={setTab} />}
      {tab === 'tenants'  && <TenantsTab />}
      {tab === 'plans'    && <PlansTab />}
      {tab === 'owners'   && <OwnersTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'stores'   && <StoresTab />}
      {tab === 'chatbot'  && <ChatbotAuthManager />}
    </DashboardLayout>
  )
}


// ══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════
function OverviewTab({ setTab }) {
  const [stats, setStats] = React.useState(null)
  const [recent, setRecent] = React.useState([])

  React.useEffect(() => {
    Promise.all([
      supabaseAuth.from('tenants').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('stores').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('branches').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('user_memberships').select('id', { count: 'exact', head: true }),
      supabaseAuth.from('landing_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAuth.from('orders').select('total')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabaseAuth.from('tenants')
        .select('id, name, status, created_at, tenant_subscriptions(plan_id)')
        .order('created_at', { ascending: false }).limit(5),
    ]).then(([t, s, b, m, l, o, rt]) => {
      const rev = (o.data || []).reduce((sum, x) => sum + Number(x.total || 0), 0)
      setStats({ tenants: t.count || 0, stores: s.count || 0, branches: b.count || 0,
        members: m.count || 0, leads: l.count || 0, orders: o.data?.length || 0,
        revenue: rev.toFixed(2) })
      setRecent(rt.data || [])
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Tenants"      value={stats?.tenants}   icon="🏢" color="#6366f1" hint="Negocios" />
        <StatCard label="Tiendas"      value={stats?.stores}    icon="🏪" color="#2563eb" hint="Marcas" />
        <StatCard label="Sedes"        value={stats?.branches}  icon="📍" color="#0891b2" hint="Puntos op." />
        <StatCard label="Usuarios"     value={stats?.members}   icon="👥" color="#7c3aed" hint="Staff+dueños" />
        <StatCard label="Leads"        value={stats?.leads}     icon="📋" color="#ca8a04" hint="Sin contactar" />
        <StatCard label="Pedidos (24h)" value={stats?.orders}   icon="📦" color="#16a34a" hint={`${stats?.revenue ?? '0.00'} EUR`} />
      </div>

      <Grid2>
        {/* Tenants recientes */}
        <Card title="Últimos tenants" action={<Btn size="sm" onClick={() => setTab('tenants')}>Ver todos</Btn>}>
          {!recent.length && <Empty icon="🏢" text="Sin tenants todavía" />}
          {recent.map(t => {
            const plan = t.tenant_subscriptions?.[0]
            const p = PLANS[plan?.plan_id] || PLANS.starter
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: '1px solid var(--color-border-tertiary)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: '#6366f115', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>🏢</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {new Date(t.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <Badge color={p.color}>{p.emoji} {p.name}</Badge>
                <StatusBadge status={t.status} />
              </div>
            )
          })}
        </Card>

        {/* Panel de estado + acciones rápidas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="Estado del sistema">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Supabase',  ok: true,  note: 'Conectado' },
                { label: 'Auth + RLS', ok: true,  note: 'SECURITY DEFINER ✓' },
                { label: 'Vercel',    ok: true,  note: 'Desplegado' },
                { label: 'Flask API', ok: true,  note: '/api/backend activo' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{s.label}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: s.ok ? '#f0fdf4' : '#fef2f2',
                    color: s.ok ? '#16a34a' : '#dc2626',
                  }}>● {s.note}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Acciones rápidas">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '🏢', label: 'Crear tenant',          tab: 'tenants' },
                { icon: '👤', label: 'Crear cuenta de dueño', tab: 'owners' },
                { icon: '🏪', label: 'Crear tienda directa',  tab: 'stores' },
                { icon: '📋', label: 'Revisar solicitudes',   tab: 'pipeline' },
                { icon: '💎', label: 'Gestionar planes',      tab: 'plans' },
              ].map(a => (
                <button key={a.tab} onClick={() => setTab(a.tab)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 9, border: '1px solid var(--color-border-tertiary)',
                  background: 'var(--color-background-secondary)', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', transition: '.15s',
                }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }}>→</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </Grid2>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// PLANS TAB — El corazón del SaaS: Super Admin gestiona qué puede
// hacer cada tenant. Cambio de plan + overrides de features.
// ══════════════════════════════════════════════════════════════════
function PlansTab() {
  const [rows,      setRows]      = React.useState([])
  const [loading,   setLoading]   = React.useState(true)
  const [selected,  setSelected]  = React.useState(null)  // tenant activo en editor
  const [editPlan,  setEditPlan]  = React.useState('growth')
  const [overrides, setOverrides] = React.useState({})
  const [notes,     setNotes]     = React.useState('')
  const [saving,    setSaving]    = React.useState(false)
  const [notice,    setNotice]    = React.useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabaseAuth
      .from('tenants')
      .select('id, name, owner_email, status, tenant_subscriptions(plan_id, status, feature_overrides, notes, current_period_end), stores(count)')
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }
  React.useEffect(() => { load() }, [])

  function openEditor(row) {
    const sub = row.tenant_subscriptions?.[0] || {}
    setSelected(row)
    setEditPlan(sub.plan_id || 'growth')
    setOverrides(sub.feature_overrides || {})
    setNotes(sub.notes || '')
    setNotice(null)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true); setNotice(null)
    const { error } = await supabaseAuth.rpc('change_tenant_plan', {
      p_tenant_id: selected.id,
      p_plan_id:   editPlan,
      p_overrides: overrides,
      p_notes:     notes || null,
    })
    if (error) setNotice({ type: 'error', msg: error.message })
    else {
      setNotice({ type: 'success', msg: `Plan actualizado a ${PLANS[editPlan]?.name}` })
      await load()
    }
    setSaving(false)
  }

  function toggleOverride(feature) {
    const current = overrides[feature]
    if (current === undefined) {
      // No override → bloquear explícitamente aunque el plan lo incluya
      setOverrides(o => ({ ...o, [feature]: false }))
    } else if (current === false) {
      // Bloqueado → desbloquear explícitamente aunque el plan no lo incluya
      setOverrides(o => ({ ...o, [feature]: true }))
    } else {
      // Desbloqueado → quitar override (vuelve al plan)
      const next = { ...overrides }
      delete next[feature]
      setOverrides(next)
    }
  }

  function featureState(feature) {
    if (overrides[feature] === true)  return 'unlocked'   // verde: desbloqueado manualmente
    if (overrides[feature] === false) return 'locked'     // rojo: bloqueado manualmente
    return planHasFeature(editPlan, feature) ? 'plan' : 'off' // plan o no incluido
  }

  const FEAT_GROUPS = [
    { label: '🛒 Menú y pedidos',  feats: [FEATURES.MENU_PUBLIC, FEATURES.MENU_CUSTOM_STYLE, FEATURES.MENU_CUSTOM_THEME, FEATURES.ORDERS, FEATURES.ORDERS_REALTIME] },
    { label: '📦 Operaciones',     feats: [FEATURES.KITCHEN_PANEL, FEATURES.RIDERS_PANEL, FEATURES.STOCK, FEATURES.FINANCE] },
    { label: '📣 Marketing',       feats: [FEATURES.COUPONS, FEATURES.LOYALTY, FEATURES.AFFILIATES, FEATURES.REVIEWS] },
    { label: '🤖 Chatbot',         feats: [FEATURES.CHATBOT_BASIC, FEATURES.CHATBOT_AI, FEATURES.CHATBOT_PORTABLE] },
    { label: '📊 Analytics',       feats: [FEATURES.ANALYTICS_BASIC, FEATURES.ANALYTICS_FULL] },
  ]

  const STATE_META = {
    unlocked: { icon: '✅', label: 'Desbloqueado (override)',  color: '#16a34a', bg: '#f0fdf4' },
    locked:   { icon: '🔴', label: 'Bloqueado (override)',     color: '#dc2626', bg: '#fef2f2' },
    plan:     { icon: '✓',  label: 'Incluido en plan',         color: '#2563eb', bg: '#eff6ff' },
    off:      { icon: '—',  label: 'No incluido en este plan', color: '#9ca3af', bg: 'transparent' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Gestión de planes</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Cambia el plan de cualquier tenant y activa/bloquea features individualmente.
        </p>
      </div>

      {/* Tarjetas de planes disponibles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {Object.values(PLANS).map(p => (
          <div key={p.id} style={{
            background: p.highlight ? `${p.color}08` : 'var(--color-background-primary)',
            border: `1px solid ${p.highlight ? p.color : 'var(--color-border-tertiary)'}`,
            borderRadius: 12, padding: '16px',
            position: 'relative',
          }}>
            {p.highlight && (
              <div style={{
                position: 'absolute', top: -1, right: 12,
                background: p.color, color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: '0 0 8px 8px',
              }}>POPULAR</div>
            )}
            <div style={{ fontSize: 26, marginBottom: 6 }}>{p.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: p.color }}>{p.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0', letterSpacing: '-1px' }}>
              {p.price === 0 ? 'Gratis' : `${p.price}€`}
              {p.price > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)' }}>/mes</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {p.description_items.slice(0, 3).map((it, i) => <div key={i}>· {it}</div>)}
            </div>
          </div>
        ))}
      </div>

      <Grid2>
        {/* Lista de tenants con su plan */}
        <Card title="Tenants y planes activos" sub={`${rows.length} tenants`}>
          {loading && <Empty icon="⏳" text="Cargando…" />}
          {rows.map(row => {
            const sub = row.tenant_subscriptions?.[0]
            const p   = PLANS[sub?.plan_id] || PLANS.starter
            const nStores = row.stores?.[0]?.count ?? 0
            const hasOverrides = sub?.feature_overrides && Object.keys(sub.feature_overrides).length > 0
            return (
              <div key={row.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--color-border-tertiary)', flexWrap: 'wrap',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: `${p.color}15`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {row.owner_email || 'sin email'} · {nStores} tienda{nStores !== 1 ? 's' : ''}
                    {hasOverrides && <span style={{ color: '#f59e0b', marginLeft: 6 }}>⚡ overrides activos</span>}
                  </div>
                </div>
                <Badge color={p.color}>{p.emoji} {p.name}</Badge>
                <StatusBadge status={row.status} />
                <Btn size="sm" variant="indigo" onClick={() => openEditor(row)}>Editar plan</Btn>
              </div>
            )
          })}
        </Card>

        {/* Editor de plan */}
        {selected ? (
          <Card
            title={`Editar: ${selected.name}`}
            sub="Cambia plan y activa/bloquea features específicas"
            action={<Btn size="sm" variant="ghost" onClick={() => setSelected(null)}>✕ Cerrar</Btn>}
          >
            {notice && <Alert type={notice.type}>{notice.msg}</Alert>}

            <div style={{ marginBottom: 16 }}>
              <Sel label="Plan activo" value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                {Object.values(PLANS).map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name} — {p.price === 0 ? 'Gratis' : `${p.price}€/mes`}</option>
                ))}
              </Sel>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Feature overrides <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                (sobreescriben el plan)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {Object.entries(STATE_META).map(([k, v]) => (
                <span key={k}>{v.icon} {v.label}</span>
              ))}
            </div>

            {FEAT_GROUPS.map(g => (
              <div key={g.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{g.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.feats.map(f => {
                    const state = featureState(f)
                    const meta  = STATE_META[state]
                    return (
                      <button key={f} onClick={() => toggleOverride(f)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${state !== 'off' ? meta.color + '40' : 'var(--color-border-tertiary)'}`,
                        background: meta.bg, fontFamily: 'inherit', textAlign: 'left',
                        transition: '.15s',
                      }}>
                        <span style={{ fontSize: 14 }}>{meta.icon}</span>
                        <span style={{ fontSize: 12, flex: 1, color: state !== 'off' ? meta.color : 'var(--color-text-secondary)' }}>
                          {FEATURE_LABELS[f] || f}
                        </span>
                        {(state === 'unlocked' || state === 'locked') && (
                          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>OVERRIDE</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <Input label="Notas internas" value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Descuento especial, etc." style={{ marginBottom: 14 }} />

            <Btn disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando…' : '✓ Guardar cambios'}
            </Btn>
          </Card>
        ) : (
          <Card title="Editor de plan" sub="Selecciona un tenant para editar su plan">
            <Empty icon="✏️" text="Haz clic en 'Editar plan' en un tenant para configurarlo." />
          </Card>
        )}
      </Grid2>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// TENANTS TAB
// ══════════════════════════════════════════════════════════════════
function TenantsTab() {
  const [tenants,   setTenants]   = React.useState([])
  const [loading,   setLoading]   = React.useState(true)
  const [showForm,  setShowForm]  = React.useState(false)
  const [error,     setError]     = React.useState('')
  const [saving,    setSaving]    = React.useState(false)
  const [form, setForm] = React.useState({ name: '', slug: '', owner_name: '', owner_email: '', owner_phone: '', notes: '', plan: 'growth' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabaseAuth.from('tenants')
      .select('*, tenant_subscriptions(plan_id, status), stores(count)')
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }
  React.useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { data: t, error: te } = await supabaseAuth.from('tenants')
        .insert({ name: form.name, slug: form.slug, owner_name: form.owner_name, owner_email: form.owner_email, owner_phone: form.owner_phone, notes: form.notes, status: 'active', monthly_fee: 0 })
        .select().single()
      if (te) throw te
      await supabaseAuth.from('tenant_subscriptions').insert({ tenant_id: t.id, plan_id: form.plan, status: 'active', current_period_end: new Date(Date.now() + 30 * 86400000).toISOString() })
      setForm({ name: '', slug: '', owner_name: '', owner_email: '', owner_phone: '', notes: '', plan: 'growth' })
      setShowForm(false)
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'suspended' : 'active'
    await supabaseAuth.from('tenants').update({ status: next }).eq('id', t.id)
    setTenants(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Tenants ({tenants.length})</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Negocios clientes de la plataforma</p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? '✕ Cancelar' : '+ Nuevo tenant'}</Btn>
      </div>

      {showForm && (
        <Card title="Crear tenant">
          {error && <Alert>{error}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
              <Input label="Nombre *" required value={form.name} onChange={e => { const n = e.target.value; setForm(f => ({ ...f, name: n, slug: f.slug || slugify(n) })) }} placeholder="Panadería Demo" />
              <Input label="Slug *" required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="panaderia-demo" />
              <Input label="Nombre del dueño" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="Laura Morales" />
              <Input label="Email" type="email" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} placeholder="laura@negocio.com" />
              <Input label="Teléfono" value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} placeholder="+34 600 000 000" />
              <Sel label="Plan inicial" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {Object.values(PLANS).map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name} — {p.price === 0 ? 'Gratis' : `${p.price}€/mes`}</option>)}
              </Sel>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear tenant'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      {loading ? <Empty icon="⏳" text="Cargando…" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!tenants.length && <Empty icon="🏢" text="Sin tenants todavía." />}
          {tenants.map(t => {
            const sub = t.tenant_subscriptions?.[0]
            const p   = PLANS[sub?.plan_id] || PLANS.starter
            const n   = t.stores?.[0]?.count ?? 0
            return (
              <div key={t.id} style={{
                background: 'var(--color-background-primary)',
                border: '1px solid var(--color-border-tertiary)',
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{t.owner_email || 'Sin email'} · {n} tienda{n !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge color={p.color}>{p.emoji} {p.name}</Badge>
                  <StatusBadge status={t.status} />
                  <Btn size="sm" variant="ghost" onClick={() => toggleStatus(t)}>{t.status === 'active' ? 'Suspender' : 'Activar'}</Btn>
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
// OWNERS TAB
// ══════════════════════════════════════════════════════════════════
function OwnersTab() {
  const [tenants,  setTenants]  = React.useState([])
  const [accounts, setAccounts] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [error,    setError]    = React.useState('')
  const [success,  setSuccess]  = React.useState('')
  const [saving,   setSaving]   = React.useState(false)
  const [form, setForm] = React.useState({ tenant_id: '', role: 'tenant_owner', full_name: '', email: '', password: '' })

  const load = React.useCallback(async () => {
    setLoading(true)
    const [ts, os] = await Promise.all([listTenants(), listOwnerAccounts()])
    setTenants(Array.isArray(ts) ? ts : [])
    setAccounts(Array.isArray(os) ? os : [])
    setForm(f => ({ ...f, tenant_id: f.tenant_id || ts?.[0]?.id || '' }))
    setLoading(false)
  }, [])
  React.useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      await createOwnerAccount(form)
      setSuccess(`Cuenta creada para ${form.email}`)
      setForm(f => ({ ...f, full_name: '', email: '', password: '' }))
      setShowForm(false); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Dueños ({accounts.length})</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Cuentas con acceso al panel del negocio</p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? '✕ Cancelar' : '+ Nueva cuenta'}</Btn>
      </div>

      {showForm && (
        <Card title="Crear cuenta de dueño">
          {error   && <Alert>{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
              <Sel label="Tenant *" required value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">Selecciona un tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Sel>
              <Sel label="Rol" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="tenant_owner">tenant_owner — Dueño principal</option>
                <option value="tenant_admin">tenant_admin — Admin secundario</option>
              </Sel>
              <Input label="Nombre completo" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="María García" />
              <Input label="Email *" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="dueno@marca.com" />
              <Input label="Password *" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      <Card title="Cuentas activas" sub="Cada fila = acceso al panel /tenant/admin">
        {loading && <Empty icon="⏳" text="Cargando…" />}
        {!loading && !accounts.length && <Empty icon="👤" text="Sin cuentas de dueños todavía." />}
        {accounts.map(a => (
          <div key={a.membership_id || a.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: '1px solid var(--color-border-tertiary)', flexWrap: 'wrap',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>
              {(a.full_name || a.role || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.full_name || a.user_id}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{a.tenant_name} · {a.role}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={a.is_active ? 'active' : 'suspended'} />
              <Btn size="sm" variant="ghost" onClick={async () => { await updateOwnerAccount(a.membership_id, { is_active: !a.is_active }); load() }}>
                {a.is_active ? 'Pausar' : 'Activar'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={async () => { const pw = window.prompt(`Nueva password para ${a.full_name || a.role}`); if (pw) { await updateOwnerAccount(a.membership_id, { password: pw }); load() } }}>
                Reset PW
              </Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// PIPELINE TAB
// ══════════════════════════════════════════════════════════════════
const PIPELINE_STAGES = ['pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted']

function PipelineTab() {
  const [requests, setRequests] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [filter,   setFilter]   = React.useState('pending')
  const [busy,     setBusy]     = React.useState(null)

  React.useEffect(() => {
    supabaseAuth.from('landing_requests').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRequests(data || []); setLoading(false) })
  }, [])

  async function advance(id, status) {
    setBusy(id)
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'contacted') patch.contacted_at = new Date().toISOString()
    if (status === 'converted') patch.converted_at = new Date().toISOString()
    await supabaseAuth.from('landing_requests').update(patch).eq('id', id)
    setRequests(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    setBusy(null)
  }

  async function sendInvite(r) {
    if (!window.confirm(`¿Enviar invitación a ${r.email}?`)) return
    setBusy(r.id)
    try {
      await inviteLandingRequest(r.id, `${window.location.origin}/onboarding`)
      setRequests(rs => rs.map(x => x.id === r.id ? { ...x, status: 'onboarding' } : x))
    } catch (e) { window.alert('Error: ' + e.message) }
    setBusy(null)
  }

  const byStatus = requests.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {})
  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Pipeline de solicitudes</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Leads del landing page ordenados por estado</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['all', ...PIPELINE_STAGES].map(s => {
          const m = STATUS_META[s] || { label: 'Todos', color: '#64748b' }
          const count = s === 'all' ? requests.length : (byStatus[s] || 0)
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${filter === s ? m.color : 'var(--color-border-secondary)'}`,
              background: filter === s ? `${m.color}15` : 'transparent',
              color: filter === s ? m.color : 'var(--color-text-secondary)',
              fontWeight: filter === s ? 600 : 400,
            }}>{s === 'all' ? 'Todos' : m.label} {count > 0 ? `(${count})` : ''}</button>
          )
        })}
      </div>
      {loading && <Empty icon="⏳" text="Cargando…" />}
      {!loading && !filtered.length && <Empty icon="📭" text="Sin solicitudes en este estado." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} style={{
            background: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-tertiary)',
            borderRadius: 12, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {r.email} {r.phone && `· ${r.phone}`} {r.business_name && `· ${r.business_name}`} {r.city && `· ${r.city}`}
                </div>
                {r.message && (
                  <div style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', background: 'var(--color-background-secondary)', borderRadius: 8, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    "{r.message}"
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <StatusBadge status={r.status} />
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{new Date(r.created_at).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {r.status === 'pending' && <Btn size="sm" onClick={() => advance(r.id, 'contacted')} disabled={busy === r.id}>Marcar contactado</Btn>}
              {['contacted', 'demo_scheduled'].includes(r.status) && <Btn size="sm" variant="success" onClick={() => sendInvite(r)} disabled={busy === r.id}>✉️ Enviar invitación</Btn>}
              {!['converted', 'rejected'].includes(r.status) && <Btn size="sm" variant="danger" onClick={() => advance(r.id, 'rejected')} disabled={busy === r.id}>Rechazar</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// STORES TAB — Super Admin puede crear tiendas directamente
// ══════════════════════════════════════════════════════════════════
function StoresTab() {
  const [tenants,  setTenants]  = React.useState([])
  const [stores,   setStores]   = React.useState([])
  const [loading,  setLoading]  = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [error,    setError]    = React.useState('')
  const [success,  setSuccess]  = React.useState('')
  const [saving,   setSaving]   = React.useState(false)
  const [form, setForm] = React.useState({ tenant_id: '', name: '', slug: '', niche: 'restaurant', city: '' })

  const load = async () => {
    setLoading(true)
    const [ts, ss] = await Promise.all([listTenants(), listStores()])
    setTenants(Array.isArray(ts) ? ts : [])
    setStores(Array.isArray(ss) ? ss : [])
    setForm(f => ({ ...f, tenant_id: f.tenant_id || ts?.[0]?.id || '' }))
    setLoading(false)
  }
  React.useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const niche = NICHES.find(n => n.id === form.niche) || NICHES[0]
      await createStore({
        id: form.slug, slug: form.slug, name: form.name,
        tenant_id: form.tenant_id, niche: form.niche,
        business_type: niche.template, template_id: niche.template,
        city: form.city, status: 'active', public_visible: true, theme_tokens: {},
      })
      setSuccess(`Tienda "${form.name}" creada. Slug público: /s/${form.slug}/menu`)
      setForm(f => ({ ...NICHES[0], tenant_id: f.tenant_id, name: '', slug: '', city: '', niche: 'restaurant' }))
      setShowForm(false); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Tiendas ({stores.length})</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>El super admin puede crear tiendas para cualquier tenant</p>
        </div>
        <Btn onClick={() => setShowForm(s => !s)}>{showForm ? '✕ Cancelar' : '+ Crear tienda'}</Btn>
      </div>

      {showForm && (
        <Card title="Crear tienda (desde Super Admin)">
          {error   && <Alert>{error}</Alert>}
          {success && <Alert type="success">✅ {success}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
              <Sel label="Tenant *" required value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">Selecciona tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Sel>
              <Input label="Nombre *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} placeholder="Pizza Roma" />
              <Input label="Slug (URL) *" required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="pizza-roma" />
              <Sel label="Nicho" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}>
                {NICHES.map(n => <option key={n.id} value={n.id}>{n.icon} {n.label}</option>)}
              </Sel>
              <Input label="Ciudad" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Madrid" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={saving || !form.tenant_id}>{saving ? 'Creando…' : 'Crear tienda'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      {loading ? <Empty icon="⏳" text="Cargando…" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {!stores.length && <Empty icon="🏪" text="Sin tiendas todavía." />}
          {stores.map(s => {
            const niche = NICHES.find(n => n.id === s.niche || n.template === s.business_type) || NICHES[NICHES.length - 1]
            return (
              <div key={s.id} style={{
                background: 'var(--color-background-primary)',
                border: '1px solid var(--color-border-tertiary)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{niche.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>/{s.slug} · {s.city || 'Sin ciudad'}</div>
                  </div>
                  <StatusBadge status={s.status || 'draft'} />
                </div>
                <Btn size="sm" variant="ghost" onClick={() => window.open(`/s/${s.slug}/menu`, '_blank')}>Ver menú ↗</Btn>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
