import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../legacy/lib/supabase'
import { readCurrentSupabaseAccessToken } from '../../../legacy/lib/appSession'
import { useAuth } from '../../../core/providers/AuthProvider'
import { useStoreModules } from '../../../shared/hooks/useStoreModules'
import {
  Actions, BadgeRow, Button, Field, Form, FormGrid,
  GhostButton, Grid, Hero, Notice, Panel, QuickLinks, Shell, Stats,
  controlDeckStyles,
} from '../../../shared/ui/ControlDeck'

// ─── API helper ───────────────────────────────────────────────────────────────

const API = async (method, path, body) => {
  const token = readCurrentSupabaseAccessToken()
  const res = await fetch(`/branch${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Tabs config — ALL_TABS con módulo requerido (null = siempre visible) ────

const ALL_TABS = [
  { id: 'dashboard',    label: 'Dashboard',     module: null },
  { id: 'products',     label: 'Productos',     module: 'mod_catalog' },
  { id: 'combos',       label: 'Combos',        module: 'mod_combos' },
  { id: 'orders',       label: 'Pedidos',       module: 'mod_orders' },
  { id: 'appointments', label: 'Agenda',        module: 'mod_appointments' },
  { id: 'tables',       label: 'Mesas',         module: 'mod_tables' },
  { id: 'stock',        label: 'Inventario',    module: 'mod_inventory' },
  { id: 'variants',     label: 'Tallas/Colores',module: 'mod_variants' },
  { id: 'staff',        label: 'Staff',         module: 'mod_staff' },
  { id: 'loyalty',      label: 'Fidelidad',     module: 'mod_loyalty' },
  { id: 'affiliates',   label: 'Afiliados',     module: 'mod_affiliates' },
  { id: 'marketing',    label: 'Marketing',     module: 'mod_coupons' },
  { id: 'reviews',      label: 'Reseñas',       module: 'mod_reviews' },
  { id: 'finance',      label: 'Finanzas',      module: 'mod_finance' },
  { id: 'chatbot',      label: 'Chatbot',       module: 'mod_chatbot' },
  { id: 'config',       label: 'Config',        module: null },
]

// ─── Componentes pequeños ────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20,
      padding: '4px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
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

function StatusBadge({ status }) {
  const colors = {
    active: '#16a34a', pending: '#ca8a04', preparing: '#2563eb',
    ready: '#7c3aed', delivering: '#0891b2', delivered: '#059669',
    cancelled: '#dc2626', paused: '#9ca3af', draft: '#9ca3af',
  }
  return (
    <span style={{
      background: `${colors[status] || '#9ca3af'}18`,
      color: colors[status] || '#9ca3af',
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
    }}>{status}</span>
  )
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div>{message}</div>
    </div>
  )
}

// ─── Tabs individuales ────────────────────────────────────────────────────────

function DashboardTab({ branchId, storeId }) {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    if (!branchId) return
    API('GET', '/dashboard').then(setData).catch(console.error)
  }, [branchId])

  if (!data) return <Notice>Cargando dashboard...</Notice>

  return (
    <Grid>
      <Panel title="Resumen de hoy">
        <Stats items={[
          { label: 'Pedidos hoy', value: String(data.orders_today?.total || 0), hint: 'Todas las órdenes del día' },
          { label: 'Staff online', value: String(data.staff_online || 0), hint: 'Personal activo ahora' },
          { label: 'Stock bajo', value: String(data.low_stock_count || 0), hint: 'Artículos con poco inventario' },
        ]} />
      </Panel>
      <Panel title="Vistas operativas de la sede">
        <QuickLinks
          links={[
            { emoji: '🍽️', title: 'Preparación', text: 'Vista dedicada de cocina para esta sede.', href: `/branch/kitchen?branch=${encodeURIComponent(branchId)}&store=${encodeURIComponent(storeId)}` },
            { emoji: '🛵', title: 'Reparto', text: 'Vista de riders y despacho de esta sede.', href: `/branch/riders?branch=${encodeURIComponent(branchId)}&store=${encodeURIComponent(storeId)}` },
            { emoji: '🔗', title: 'Afiliados', text: 'Gestión comercial desde el tab de afiliados del panel.', href: '/branch/admin?tab=affiliates' },
          ]}
        />
      </Panel>
      <Panel title="Artículos con stock bajo" dark>
        {data.low_stock_items?.length
          ? data.low_stock_items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: 13 }}>
                <span>{item.name}</span>
                <span style={{ color: '#dc2626', fontWeight: 500 }}>{item.quantity} {item.unit || 'ud'}</span>
              </div>
            ))
          : <Notice tone="success">Sin alertas de stock</Notice>
        }
      </Panel>
    </Grid>
  )
}

function ProductsTab({ storeId }) {
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', price: '', category: 'general', emoji: '🍽️', description: '' })
  const [editId, setEditId] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = () => {
    setLoading(true)
    API('GET', '/products?active=false').then(setProducts).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editId) await API('PATCH', `/products/${editId}`, { ...form, price: Number(form.price) })
      else await API('POST', '/products', { ...form, price: Number(form.price) })
      setForm({ name: '', price: '', category: 'general', emoji: '🍽️', description: '' })
      setEditId(null)
      load()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function toggleActive(product) {
    await API('PATCH', `/products/${product.id}`, { is_active: !product.is_active })
    load()
  }

  async function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return
    await API('DELETE', `/products/${id}`)
    load()
  }

  return (
    <Grid>
      <Panel title={editId ? 'Editar producto' : 'Nuevo producto'}>
        {error && <Notice tone="error">{error}</Notice>}
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Nombre"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del producto" /></Field>
            <Field label="Precio (€)"><input className={controlDeckStyles.input} type="number" step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="9.99" /></Field>
            <Field label="Categoría"><input className={controlDeckStyles.input} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="postres, principales..." /></Field>
            <Field label="Emoji"><input className={controlDeckStyles.input} value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} /></Field>
          </FormGrid>
          <Field label="Descripción"><textarea className={controlDeckStyles.textarea} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></Field>
          <Actions>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear producto'}</Button>
            {editId && <GhostButton type="button" onClick={() => { setEditId(null); setForm({ name: '', price: '', category: 'general', emoji: '🍽️', description: '' }) }}>Cancelar</GhostButton>}
          </Actions>
        </Form>
      </Panel>
      <Panel title={`Catálogo (${products.length})`} dark>
        {loading && <Notice>Cargando...</Notice>}
        {!loading && !products.length && <EmptyState icon="🍽️" message="Sin productos aún" />}
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {products.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.category} · €{Number(p.price).toFixed(2)}</div>
              </div>
              <StatusBadge status={p.is_active ? 'active' : 'paused'} />
              <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => { setEditId(p.id); setForm({ name: p.name, price: p.price, category: p.category, emoji: p.emoji, description: p.description || '' }) }}>Editar</GhostButton>
              <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => toggleActive(p)}>{p.is_active ? 'Pausar' : 'Activar'}</GhostButton>
              <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11, color: '#dc2626' }}
                onClick={() => deleteProduct(p.id)}>✕</GhostButton>
            </div>
          ))}
        </div>
      </Panel>
    </Grid>
  )
}

function CombosTab({ storeId }) {
  const [combos, setCombos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', price: '', emoji: '🎁', description: '' })
  const [editId, setEditId] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = () => {
    setLoading(true)
    API('GET', '/combos').then(setCombos).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editId) await API('PATCH', `/combos/${editId}`, { ...form, price: Number(form.price) })
      else await API('POST', '/combos', { ...form, price: Number(form.price) })
      setForm({ name: '', price: '', emoji: '🎁', description: '' })
      setEditId(null)
      load()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <Grid>
      <Panel title={editId ? 'Editar combo' : 'Nuevo combo'}>
        {error && <Notice tone="error">{error}</Notice>}
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Nombre del combo"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Precio (€)"><input className={controlDeckStyles.input} type="number" step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></Field>
            <Field label="Emoji"><input className={controlDeckStyles.input} value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} /></Field>
          </FormGrid>
          <Field label="Descripción"><textarea className={controlDeckStyles.textarea} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></Field>
          <Actions>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear combo'}</Button>
            {editId && <GhostButton type="button" onClick={() => { setEditId(null); setForm({ name: '', price: '', emoji: '🎁', description: '' }) }}>Cancelar</GhostButton>}
          </Actions>
        </Form>
      </Panel>
      <Panel title={`Combos (${combos.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : combos.length === 0 ? <EmptyState icon="🎁" message="Sin combos" /> :
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {combos.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <span style={{ fontSize: 20 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>€{Number(c.price).toFixed(2)}</div>
                </div>
                <StatusBadge status={c.is_active ? 'active' : 'paused'} />
                <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => { setEditId(c.id); setForm({ name: c.name, price: c.price, emoji: c.emoji, description: c.description || '' }) }}>Editar</GhostButton>
              </div>
            ))}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function StockTab({ storeId }) {
  const [stock, setStock] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', quantity: '', min_quantity: '5', unit: 'unidades' })
  const [editId, setEditId] = React.useState(null)
  const [saving, setSaving] = React.useState(false)

  const load = () => {
    setLoading(true)
    API('GET', '/stock').then(setStock).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) await API('PATCH', `/stock/${editId}`, { quantity: Number(form.quantity), min_quantity: Number(form.min_quantity) })
      else await API('POST', '/stock', { ...form, quantity: Number(form.quantity), min_quantity: Number(form.min_quantity) })
      setForm({ name: '', quantity: '', min_quantity: '5', unit: 'unidades' })
      setEditId(null)
      load()
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  return (
    <Grid>
      <Panel title={editId ? 'Editar inventario' : 'Añadir artículo'}>
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Artículo"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!!editId} /></Field>
            <Field label="Unidad"><input className={controlDeckStyles.input} value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></Field>
            <Field label="Cantidad actual"><input className={controlDeckStyles.input} type="number" step="0.1" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></Field>
            <Field label="Mínimo"><input className={controlDeckStyles.input} type="number" step="0.1" value={form.min_quantity}
              onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} /></Field>
          </FormGrid>
          <Actions>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Añadir al stock'}</Button>
            {editId && <GhostButton type="button" onClick={() => setEditId(null)}>Cancelar</GhostButton>}
          </Actions>
        </Form>
      </Panel>
      <Panel title={`Inventario (${stock.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : stock.length === 0 ? <EmptyState icon="📦" message="Sin artículos de stock" /> :
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {stock.map(item => {
              const low = Number(item.quantity) <= Number(item.min_quantity)
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: low ? '#dc2626' : 'var(--color-text-secondary)' }}>
                      {item.quantity} / mín {item.min_quantity} {item.unit}
                    </div>
                  </div>
                  {low && <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626',
                    padding: '2px 8px', borderRadius: 20 }}>⚠️ Bajo</span>}
                  <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => { setEditId(item.id); setForm({ name: item.name, quantity: String(item.quantity), min_quantity: String(item.min_quantity), unit: item.unit || 'unidades' }) }}>Ajustar</GhostButton>
                </div>
              )
            })}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function OrdersTab({ branchId }) {
  const [orders, setOrders] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('')
  const [updating, setUpdating] = React.useState(null)

  const load = () => {
    setLoading(true)
    API('GET', `/orders${statusFilter ? `?status=${statusFilter}` : ''}`).then(setOrders).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [branchId, statusFilter])

  const STATUSES = ['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']

  async function changeStatus(orderId, status) {
    setUpdating(orderId)
    await API('PATCH', `/orders/${orderId}/status`, { status })
    load()
    setUpdating(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <GhostButton type="button" onClick={() => setStatusFilter('')}
          style={{ background: !statusFilter ? 'var(--color-background-secondary)' : undefined }}>Todos</GhostButton>
        {STATUSES.map(s => (
          <GhostButton key={s} type="button" onClick={() => setStatusFilter(s)}
            style={{ background: statusFilter === s ? 'var(--color-background-secondary)' : undefined }}>
            {s}
          </GhostButton>
        ))}
      </div>
      {loading ? <Notice>Cargando pedidos...</Notice> : orders.length === 0 ? <EmptyState icon="🧾" message="Sin pedidos" /> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(order => (
            <div key={order.id} style={{ background: 'var(--color-background-primary)',
              border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>#{order.id.slice(-6).toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusBadge status={order.status} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>€{Number(order.total || 0).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.filter(s => s !== order.status).map(s => (
                  <GhostButton key={s} type="button" disabled={updating === order.id}
                    style={{ padding: '3px 10px', fontSize: 11 }}
                    onClick={() => changeStatus(order.id, s)}>→ {s}</GhostButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

function StaffTab({ storeId, storeSlug, branchSlug }) {
  const [staff, setStaff] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', role: 'cashier', phone: '', pin: '' })
  const [saving, setSaving] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('staff_users').select('*').eq('store_id', storeId).order('name')
      .then(({ data }) => setStaff(data ?? []))
      .catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  const loginBase = `${window.location.origin}/s/${storeSlug}/${branchSlug}/login`

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: branch } = await supabase.from('branches').select('id, tenant_id')
        .eq('slug', branchSlug).maybeSingle()
      await supabase.from('staff_users').insert({
        store_id: storeId, tenant_id: branch?.tenant_id,
        branch_id: branch?.id, name: form.name,
        role: form.role, phone: form.phone, pin: form.pin,
        is_active: true,
      })
      setForm({ name: '', role: 'cashier', phone: '', pin: '' })
      load()
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function toggleActive(s) {
    await supabase.from('staff_users').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  function copyLink(id, link) {
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const ROLES = ['branch_manager', 'kitchen', 'rider', 'cashier']
  const ROLE_DEST = { kitchen:'kitchen', rider:'riders', cashier:'admin', branch_manager:'admin' }

  return (
    <Grid>
      <Panel title="Añadir personal">
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Nombre *"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Camila Ruiz" /></Field>
            <Field label="Rol"><select className={controlDeckStyles.select} value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select></Field>
            <Field label="Teléfono"><input className={controlDeckStyles.input} value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" /></Field>
            <Field label="PIN (4-8 dígitos) *"><input className={controlDeckStyles.input} type="password"
              inputMode="numeric" maxLength={8} value={form.pin} required
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="1234" /></Field>
          </FormGrid>
          <Actions><Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Añadir empleado'}</Button></Actions>
        </Form>
        {storeSlug && branchSlug && (
          <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--color-background-secondary)',
            borderRadius: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Link de acceso de esta sede:
            </div>
            <code style={{ wordBreak: 'break-all', fontSize: 11 }}>{loginBase}</code>
          </div>
        )}
      </Panel>
      <Panel title={`Personal (${staff.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : staff.length === 0 ? <EmptyState icon="👥" message="Sin personal registrado" /> :
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {staff.map(s => {
              const dest = ROLE_DEST[s.role] || 'admin'
              const link = loginBase
              return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-background-info)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500,
                  color: 'var(--color-text-info)', flexShrink: 0 }}>
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {s.role} · PIN: {s.pin ? '••••' : 'sin PIN'} {s.is_online ? '🟢' : '⚫'}
                  </div>
                  {storeSlug && branchSlug && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      /s/{storeSlug}/{branchSlug}/login → {dest}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {storeSlug && branchSlug && (
                    <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 10 }}
                      onClick={() => copyLink(s.id, link)}>
                      {copiedId === s.id ? '✓ Copiado' : 'Copiar link'}
                    </GhostButton>
                  )}
                  <StatusBadge status={s.is_active ? 'active' : 'paused'} />
                  <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => toggleActive(s)}>{s.is_active ? 'Pausar' : 'Activar'}</GhostButton>
                </div>
              </div>
            )})}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function MarketingTab({ storeId }) {
  const [coupons, setCoupons] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ code: '', type: 'percentage', value: '', min_order: '0', description: '' })
  const [saving, setSaving] = React.useState(false)

  const load = () => {
    setLoading(true)
    API('GET', '/coupons').then(setCoupons).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await API('POST', '/coupons', { ...form, value: Number(form.value), min_order: Number(form.min_order) })
      setForm({ code: '', type: 'percentage', value: '', min_order: '0', description: '' })
      load()
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function toggleCoupon(c) {
    await API('PATCH', `/coupons/${c.id}`, { is_active: !c.is_active })
    load()
  }

  async function deleteCoupon(id) {
    if (!confirm('¿Eliminar cupón?')) return
    await API('DELETE', `/coupons/${id}`)
    load()
  }

  return (
    <Grid>
      <Panel title="Crear cupón de descuento">
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Código"><input className={controlDeckStyles.input} value={form.code} required
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="DESCUENTO10" /></Field>
            <Field label="Tipo"><select className={controlDeckStyles.select} value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Fijo (€)</option>
              <option value="free_delivery">Envío gratis</option>
            </select></Field>
            <Field label={form.type === 'percentage' ? 'Descuento (%)' : 'Descuento (€)'}>
              <input className={controlDeckStyles.input} type="number" step="0.01" value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="10" />
            </Field>
            <Field label="Pedido mínimo (€)"><input className={controlDeckStyles.input} type="number" step="0.01" value={form.min_order}
              onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} /></Field>
          </FormGrid>
          <Field label="Descripción (interna)"><input className={controlDeckStyles.input} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <Actions><Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear cupón'}</Button></Actions>
        </Form>
      </Panel>
      <Panel title={`Cupones (${coupons.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : coupons.length === 0 ? <EmptyState icon="🏷️" message="Sin cupones" /> :
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {coupons.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>{c.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {c.type === 'percentage' ? `${c.value}%` : `€${c.value}`} · min €{c.min_order} · {c.uses_count || 0} usos
                  </div>
                </div>
                <StatusBadge status={c.is_active ? 'active' : 'paused'} />
                <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => toggleCoupon(c)}>{c.is_active ? 'Pausar' : 'Activar'}</GhostButton>
                <GhostButton type="button" style={{ padding: '3px 8px', fontSize: 11, color: '#dc2626' }}
                  onClick={() => deleteCoupon(c.id)}>✕</GhostButton>
              </div>
            ))}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function AffiliatesTab({ storeId }) {
  const [affiliates, setAffiliates] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', code: '', commission_pct: '10' })
  const [saving, setSaving] = React.useState(false)

  const load = () => {
    setLoading(true)
    API('GET', '/affiliates').then(setAffiliates).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await API('POST', '/affiliates', { ...form, commission_pct: Number(form.commission_pct) })
      setForm({ name: '', email: '', phone: '', code: '', commission_pct: '10' })
      load()
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  return (
    <Grid>
      <Panel title="Nuevo afiliado / referidor">
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Nombre"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Código único"><input className={controlDeckStyles.input} value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="REF-JUAN" /></Field>
            <Field label="Email"><input className={controlDeckStyles.input} type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Comisión (%)"><input className={controlDeckStyles.input} type="number" value={form.commission_pct}
              onChange={e => setForm(f => ({ ...f, commission_pct: e.target.value }))} /></Field>
          </FormGrid>
          <Actions><Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Añadir afiliado'}</Button></Actions>
        </Form>
      </Panel>
      <Panel title={`Red de afiliados (${affiliates.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : affiliates.length === 0 ? <EmptyState icon="🔗" message="Sin afiliados aún" /> :
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {affiliates.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {a.code} · {a.commission_pct}% comisión
                  </div>
                </div>
                <StatusBadge status={a.is_active ? 'active' : 'paused'} />
              </div>
            ))}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function LoyaltyTab({ storeId }) {
  const [rewards, setRewards] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ name: '', points_required: '100', reward_type: 'discount', reward_value: '10', description: '' })
  const [saving, setSaving] = React.useState(false)

  const load = () => {
    setLoading(true)
    API('GET', '/loyalty').then(setRewards).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await API('POST', '/loyalty', { ...form, points_required: Number(form.points_required), reward_value: Number(form.reward_value) })
      setForm({ name: '', points_required: '100', reward_type: 'discount', reward_value: '10', description: '' })
      load()
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  return (
    <Grid>
      <Panel title="Crear recompensa de fidelidad">
        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Nombre del premio"><input className={controlDeckStyles.input} value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Café gratis" /></Field>
            <Field label="Puntos necesarios"><input className={controlDeckStyles.input} type="number" value={form.points_required}
              onChange={e => setForm(f => ({ ...f, points_required: e.target.value }))} /></Field>
            <Field label="Tipo de premio"><select className={controlDeckStyles.select} value={form.reward_type}
              onChange={e => setForm(f => ({ ...f, reward_type: e.target.value }))}>
              <option value="discount">Descuento</option>
              <option value="free_product">Producto gratis</option>
              <option value="free_delivery">Envío gratis</option>
            </select></Field>
            <Field label="Valor del premio (€ o %)"><input className={controlDeckStyles.input} type="number" step="0.01" value={form.reward_value}
              onChange={e => setForm(f => ({ ...f, reward_value: e.target.value }))} /></Field>
          </FormGrid>
          <Actions><Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear recompensa'}</Button></Actions>
        </Form>
      </Panel>
      <Panel title={`Recompensas (${rewards.length})`} dark>
        {loading ? <Notice>Cargando...</Notice> : rewards.length === 0 ? <EmptyState icon="⭐" message="Sin recompensas" /> :
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {rewards.map(r => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>⭐ {r.name}</span>
                  <StatusBadge status={r.is_active ? 'active' : 'paused'} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {r.points_required} puntos → {r.reward_type} de €{r.reward_value}
                </div>
              </div>
            ))}
          </div>
        }
      </Panel>
    </Grid>
  )
}

function ReviewsTab({ storeId }) {
  const [reviews, setReviews] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  const load = () => {
    setLoading(true)
    API('GET', '/reviews').then(setReviews).catch(console.error).finally(() => setLoading(false))
  }

  React.useEffect(load, [storeId])

  async function approve(id) {
    await API('PATCH', `/reviews/${id}/approve`)
    load()
  }

  return (
    <div>
      <Stats items={[
        { label: 'Total reseñas', value: String(reviews.length) },
        { label: 'Aprobadas', value: String(reviews.filter(r => r.approved).length) },
        { label: 'Pendientes', value: String(reviews.filter(r => !r.approved).length) },
      ]} />
      <div style={{ marginTop: 16 }}>
        {loading ? <Notice>Cargando...</Notice> : reviews.length === 0 ? <EmptyState icon="💬" message="Sin reseñas" /> :
          reviews.map(r => (
            <div key={r.id} style={{ background: 'var(--color-background-primary)',
              border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{'⭐'.repeat(r.rating || 5)} {r.customer_name || 'Cliente'}</div>
                <StatusBadge status={r.approved ? 'active' : 'pending'} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{r.comment || r.text || '(sin comentario)'}</div>
              {!r.approved && (
                <GhostButton type="button" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => approve(r.id)}>
                  Aprobar
                </GhostButton>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

function ConfigTab({ branchId }) {
  const [config, setConfig] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!branchId) return
    API('GET', '/config').then(setConfig).catch(console.error)
  }, [branchId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!config) return
    setSaving(true)
    try {
      await API('PATCH', '/config', {
        name: config.name,
        address: config.address,
        city: config.city,
        phone: config.phone,
        open_hour: Number(config.open_hour),
        close_hour: Number(config.close_hour),
        open_days: config.open_days,
        public_visible: config.public_visible,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  if (!config) return <Notice>Cargando configuración...</Notice>

  return (
    <Form onSubmit={handleSubmit}>
      {saved && <Notice tone="success">Configuración guardada correctamente</Notice>}
      <FormGrid>
        <Field label="Nombre de la sede"><input className={controlDeckStyles.input} value={config.name || ''}
          onChange={e => setConfig(c => ({ ...c, name: e.target.value }))} /></Field>
        <Field label="Teléfono"><input className={controlDeckStyles.input} value={config.phone || ''}
          onChange={e => setConfig(c => ({ ...c, phone: e.target.value }))} /></Field>
        <Field label="Ciudad"><input className={controlDeckStyles.input} value={config.city || ''}
          onChange={e => setConfig(c => ({ ...c, city: e.target.value }))} /></Field>
        <Field label="Dirección"><input className={controlDeckStyles.input} value={config.address || ''}
          onChange={e => setConfig(c => ({ ...c, address: e.target.value }))} /></Field>
        <Field label="Hora apertura"><input className={controlDeckStyles.input} type="number" min="0" max="23" value={config.open_hour || 10}
          onChange={e => setConfig(c => ({ ...c, open_hour: e.target.value }))} /></Field>
        <Field label="Hora cierre"><input className={controlDeckStyles.input} type="number" min="0" max="23" value={config.close_hour || 22}
          onChange={e => setConfig(c => ({ ...c, close_hour: e.target.value }))} /></Field>
        <Field label="Días activos"><input className={controlDeckStyles.input} value={config.open_days || 'L-D'}
          onChange={e => setConfig(c => ({ ...c, open_days: e.target.value }))} /></Field>
      </FormGrid>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="checkbox" id="visible" checked={!!config.public_visible}
          onChange={e => setConfig(c => ({ ...c, public_visible: e.target.checked }))} />
        <label htmlFor="visible" style={{ fontSize: 13 }}>Visible públicamente</label>
      </div>
      <Actions>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
      </Actions>
    </Form>
  )
}

function ChatbotTab({ branchId, storeId }) {
  const [status, setStatus] = React.useState(null)
  const [secret, setSecret] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [showSecret, setShowSecret] = React.useState(false)

  React.useEffect(() => {
    if (!branchId) return
    API('GET', '/chatbot').then(setStatus).catch(console.error).finally(() => setLoading(false))
  }, [branchId])

  async function loadSecret() {
    try {
      const s = await API('GET', '/chatbot/secret')
      setSecret(s)
      setShowSecret(true)
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Notice>Cargando estado del chatbot...</Notice>

  if (!status?.chatbot_authorized) {
    return (
      <div>
        <Hero
          eyebrow="Chatbot WhatsApp portable"
          title="No autorizado aún"
          description="El chatbot portable no está habilitado para esta sede. Contacta con el Super Admin de Oxidian para solicitar la autorización."
        />
        <Notice>El Super Admin debe autorizar esta sede desde el panel de administración para habilitar la descarga del chatbot portable.</Notice>
      </div>
    )
  }

  const downloadUrl = `/admin/chatbot/download/${branchId}`

  return (
    <div>
      <Hero
        eyebrow="Chatbot WhatsApp — Portable autorizado"
        title="Tu chatbot local está listo"
        description="Descarga el portable, configura el .env con tus datos y ejecuta iniciar.bat. El chatbot gestiona WhatsApp directamente desde tu PC usando tu base de datos."
        signals={[
          { label: 'Estado', value: status.chatbot_last_seen ? '🟢 Activo' : '⚫ No conectado' },
          { label: 'Versión', value: status.chatbot_version || 'Pendiente' },
        ]}
      />
      <Grid>
        <Panel title="Descargar portable">
          <Stats items={[
            { label: 'Proveedor IA', value: 'Groq (gratis)', hint: 'Llama 70B incluido por defecto' },
            { label: 'Anti-ban', value: 'Activado', hint: 'Protección automática contra bloqueos de WA' },
            { label: 'Admin relay', value: 'Incluido', hint: 'Responde clientes desde tu propio WhatsApp' },
          ]} />
          <Actions>
            <a href={downloadUrl} download style={{ textDecoration: 'none' }}>
              <Button type="button">📦 Descargar ZIP portable</Button>
            </a>
            <GhostButton type="button" onClick={loadSecret}>
              {showSecret ? '🔑 Ocultar clave' : '🔑 Ver WA_SECRET'}
            </GhostButton>
          </Actions>
        </Panel>
        <Panel title="Instrucciones rápidas" dark>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>1. Descarga el ZIP y extráelo en tu PC</div>
            <div>2. Abre el archivo <code>.env</code> y rellena tus credenciales</div>
            <div>3. Haz doble clic en <code>iniciar.bat</code></div>
            <div>4. Abre <code>http://localhost:3001/qr-page</code></div>
            <div>5. Escanea el QR con tu WhatsApp</div>
            <div>6. El bot queda activo y atiende clientes</div>
          </div>
          {showSecret && secret && (
            <div style={{ marginTop: 16, background: 'var(--color-background-secondary)',
              borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
              <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>WA_SECRET (incluido en el .env):</div>
              <div style={{ wordBreak: 'break-all' }}>{secret.wa_secret}</div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 8, fontSize: 11 }}>
                CHATBOT_STORE_ID: {secret.store_id}
              </div>
            </div>
          )}
        </Panel>
      </Grid>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

function AppointmentsTab({ config }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Módulo de Citas</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 380, margin: '0 auto' }}>
        Slot de {config?.slot_duration_min ?? 30} min · Hasta {config?.max_advance_days ?? 14} días de anticipación.
        La vista completa de agenda estará disponible en la próxima actualización.
      </div>
    </div>
  )
}

function TablesTab({ config }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🪑</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Módulo de Mesas</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 380, margin: '0 auto' }}>
        {config?.total_tables ?? 0} mesas configuradas.
        Zonas: {(config?.zones ?? ['salón']).join(', ')}.
        Gestión de mesas y reservas disponible próximamente.
      </div>
    </div>
  )
}

function VariantsTab({ config }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👗</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Módulo de Variantes</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 380, margin: '0 auto' }}>
        Tallas: {(config?.standard_sizes ?? ['S','M','L','XL']).join(' · ')}.
        Matriz de tallas y colores disponible próximamente.
      </div>
    </div>
  )
}

export default function BranchAdminPage() {
  const { branchId, storeId, tenantId, role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || 'dashboard')
  const [branchName, setBranchName] = React.useState('Mi Sede')
  const [storeSlug, setStoreSlug] = React.useState('')
  const [branchSlug, setBranchSlug] = React.useState('')
  const { isEnabled, getConfig, loading: modulesLoading } = useStoreModules()

  // Tabs dinámicos según módulos activos
  const visibleTabs = modulesLoading
    ? ALL_TABS.filter(t => t.module === null)
    : ALL_TABS.filter(t => !t.module || isEnabled(t.module))

  React.useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && TABS.some(item => item.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  React.useEffect(() => {
    if (!branchId) return
    supabase.from('branches').select('name, slug, stores(slug)').eq('id', branchId).maybeSingle()
      .then(({ data }) => {
        if (data?.name) setBranchName(data.name)
        if (data?.slug) setBranchSlug(data.slug)
        if (data?.stores?.slug) setStoreSlug(data.stores.slug)
      })
  }, [branchId])

  if (!branchId) {
    return (
      <Shell>
        <Notice tone="error">
          Tu cuenta no tiene una sede asignada. Contacta con el administrador.
        </Notice>
      </Shell>
    )
  }

  const tabContent = {
    dashboard:    <DashboardTab branchId={branchId} storeId={storeId} />,
    products:     <ProductsTab storeId={storeId} />,
    combos:       <CombosTab storeId={storeId} />,
    stock:        <StockTab storeId={storeId} />,
    orders:       <OrdersTab branchId={branchId} />,
    staff:        <StaffTab storeId={storeId} storeSlug={storeSlug} branchSlug={branchSlug} />,
    marketing:    <MarketingTab storeId={storeId} />,
    affiliates:   <AffiliatesTab storeId={storeId} />,
    loyalty:      <LoyaltyTab storeId={storeId} />,
    reviews:      <ReviewsTab storeId={storeId} />,
    config:       <ConfigTab branchId={branchId} />,
    chatbot:      <ChatbotTab branchId={branchId} storeId={storeId} />,
    appointments: <AppointmentsTab config={getConfig('mod_appointments')} />,
    tables:       <TablesTab config={getConfig('mod_tables')} />,
    variants:     <VariantsTab config={getConfig('mod_variants')} />,
    finance:      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Módulo de Finanzas — próximamente</div>,
  }

  return (
    <Shell>
      <Hero
        eyebrow={`Panel de sede · ${role}`}
        title={branchName}
        description="Gestiona productos, pedidos, stock, personal, marketing, afiliados y el chatbot portable desde un solo lugar."
        signals={[
          { label: 'Sede', value: branchId?.slice(-8) || '—' },
          { label: 'Tienda', value: storeId || '—' },
        ]}
      />
      <TabBar tabs={visibleTabs} active={activeTab} onChange={nextTab => {
        setActiveTab(nextTab)
        const next = new URLSearchParams(searchParams)
        next.set('tab', nextTab)
        setSearchParams(next)
      }} />
      <div style={{ minHeight: 400 }}>
        {tabContent[activeTab] || null}
      </div>
    </Shell>
  )
}
