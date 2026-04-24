import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'
import DashboardLayout from '../../../core/app/DashboardLayout'
import FeatureGate from '../../../shared/ui/FeatureGate'
import { FEATURES } from '../../../shared/lib/planFeatures'
import { getChatbotDownloadUrl } from '../../../shared/lib/supabaseApi'
import { Card, Btn, Input, Select, Textarea, Alert, StatGrid, Grid2, Empty, Badge, StatusBadge } from '../../../shared/ui/OxidianDS'

const db = supabase
const TABS = [
  { id:'dashboard', label:'Panel' },
  { id:'products', label:'Productos' },
  { id:'combos', label:'Combos' },
  { id:'inventory', label:'Inventario' },
  { id:'orders', label:'Pedidos' },
  { id:'staff', label:'Staff' },
  { id:'marketing', label:'Marketing' },
  { id:'finance', label:'Caja' },
  { id:'chatbot', label:'Chatbot' },
  { id:'config', label:'Config' },
]
const ROLE_TAB_ACCESS = {
  super_admin:['dashboard','products','combos','inventory','orders','staff','marketing','finance','chatbot','config'],
  tenant_owner:['dashboard','products','combos','inventory','orders','staff','marketing','finance','chatbot','config'],
  tenant_admin:['dashboard','products','combos','inventory','orders','staff','marketing','finance','chatbot','config'],
  store_admin:['dashboard','products','combos','inventory','orders','staff','marketing','finance','chatbot','config'],
  branch_manager:['dashboard','products','combos','inventory','orders','staff','marketing','finance','chatbot','config'],
  store_operator:['dashboard','products','combos','inventory','orders'],
  cashier:['dashboard','orders','finance'],
}
const STATUS_COLORS = { pending:'#ca8a04', preparing:'#2563eb', ready:'#16a34a', delivering:'#8b5cf6', delivered:'#0f766e', cancelled:'#dc2626' }
const euro = value => `EUR ${Number(value || 0).toFixed(2)}`
const todayKey = () => new Date().toISOString().slice(0, 10)
const parseNumeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
const formatJsonField = (value, fallback = []) => JSON.stringify(value ?? fallback, null, 2)
function parseJsonField(raw, label, fallback = []) {
  const text = String(raw ?? '').trim()
  if (!text) return fallback
  try { return JSON.parse(text) } catch { throw new Error(`${label} debe ser JSON valido`) }
}
function Check({ label, checked, onChange }) { return <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13 }}><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label> }
function TabBar({ tabs, activeTab, onChange }) { return <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20, padding:4, border:'1px solid var(--color-border-tertiary)', borderRadius:12 }}>{tabs.map(tab => <button key={tab.id} type="button" onClick={() => onChange(tab.id)} style={{ padding:'8px 14px', border:'none', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontWeight:activeTab === tab.id ? 700 : 500, background:activeTab === tab.id ? 'var(--color-text-primary)' : 'transparent', color:activeTab === tab.id ? 'var(--color-background-primary)' : 'var(--color-text-secondary)' }}>{tab.label}</button>)}</div> }
const rowStyle = { display:'flex', gap:12, alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--color-border-tertiary)' }
const actionStyle = { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:14 }

export default function BranchAdminPage() {
  const [params] = useSearchParams()
  const { tenantId, storeId: authStoreId, branchId: authBranchId, role } = useAuth()
  const storeId = params.get('store_id') || params.get('store') || authStoreId || ''
  const branchId = params.get('branch_id') || params.get('branch') || authBranchId || ''
  const [tab, setTab] = React.useState('dashboard')
  const [store, setStore] = React.useState(null)
  const [branch, setBranch] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const visibleTabs = React.useMemo(() => TABS.filter(item => (ROLE_TAB_ACCESS[role] || ROLE_TAB_ACCESS.branch_manager).includes(item.id)), [role])

  React.useEffect(() => {
    if (!storeId) { setLoading(false); return }
    setLoading(true)
    Promise.all([db.from('stores').select('*').eq('id', storeId).maybeSingle(), branchId ? db.from('branches').select('*').eq('id', branchId).maybeSingle() : Promise.resolve({ data:null })]).then(([storeRes, branchRes]) => { setStore(storeRes.data || null); setBranch(branchRes.data || null); setLoading(false) })
  }, [storeId, branchId])
  React.useEffect(() => { if (!visibleTabs.some(item => item.id === tab)) setTab(visibleTabs[0]?.id || 'dashboard') }, [tab, visibleTabs])

  if (loading) return <div style={{ padding:24 }}>Cargando panel de sede...</div>
  if (!storeId) return <div style={{ padding:24 }}><Alert type="warn">No se proporciono store_id. Accede desde el panel del tenant.</Alert></div>

  return <DashboardLayout activeTab={tab} onTabChange={setTab} title={branch?.name || 'Sede'} subtitle={store?.name || storeId}><TabBar tabs={visibleTabs} activeTab={tab} onChange={setTab} />{tab === 'dashboard' && <DashboardTab storeId={storeId} branchId={branchId} />}{tab === 'products' && <ProductsTab storeId={storeId} tenantId={tenantId} />}{tab === 'combos' && <CombosTab storeId={storeId} tenantId={tenantId} />}{tab === 'inventory' && <FeatureGate feature={FEATURES.STOCK}><InventoryTab storeId={storeId} tenantId={tenantId} branchId={branchId} /></FeatureGate>}{tab === 'orders' && <OrdersTab storeId={storeId} branchId={branchId} />}{tab === 'staff' && <StaffTab storeId={storeId} tenantId={tenantId} branchId={branchId} store={store} branch={branch} />}{tab === 'marketing' && <FeatureGate feature={FEATURES.COUPONS}><MarketingTab storeId={storeId} tenantId={tenantId} /></FeatureGate>}{tab === 'finance' && <FinanceTab storeId={storeId} tenantId={tenantId} branchId={branchId} role={role} />}{tab === 'chatbot' && <FeatureGate feature={FEATURES.CHATBOT_BASIC}><ChatbotTab branchId={branchId} /></FeatureGate>}{tab === 'config' && <ConfigTab branch={branch} setBranch={setBranch} branchId={branchId} />}</DashboardLayout>
}

function DashboardTab({ storeId, branchId }) {
  const [stats, setStats] = React.useState(null)
  React.useEffect(() => {
    const since = new Date(Date.now() - 86400000).toISOString()
    let qOrders = db.from('orders').select('id,total,status').eq('store_id', storeId).gte('created_at', since)
    let qStaff = db.from('staff_users').select('id,is_online').eq('store_id', storeId)
    let qStock = db.from('stock_items').select('id,name,quantity,min_quantity').eq('store_id', storeId)
    let qCash = db.from('cash_entries').select('type,amount,date').eq('store_id', storeId).eq('date', todayKey())
    if (branchId) { qOrders = qOrders.eq('branch_id', branchId); qStaff = qStaff.eq('branch_id', branchId); qStock = qStock.or(`branch_id.eq.${branchId},branch_id.is.null`); qCash = qCash.eq('branch_id', branchId) }
    Promise.all([qOrders, qStaff, qStock, qCash]).then(([ordersRes, staffRes, stockRes, cashRes]) => {
      const orders = ordersRes.data || []
      const cash = cashRes.data || []
      const ingresos = cash.filter(item => ['income', 'ingreso'].includes(item.type)).reduce((sum, item) => sum + parseNumeric(item.amount), 0)
      const gastos = cash.filter(item => ['expense', 'gasto', 'retiro'].includes(item.type)).reduce((sum, item) => sum + parseNumeric(item.amount), 0)
      setStats({ ordersToday:orders.length, revenueToday:orders.filter(item => item.status !== 'cancelled').reduce((sum, item) => sum + parseNumeric(item.total), 0), pending:orders.filter(item => item.status === 'pending').length, online:(staffRes.data || []).filter(item => item.is_online).length, lowStock:(stockRes.data || []).filter(item => parseNumeric(item.quantity) <= parseNumeric(item.min_quantity)).slice(0, 5), cashBalance:ingresos - gastos })
    })
  }, [storeId, branchId])
  return <Grid2><Card title="Resumen"><StatGrid items={[{ label:'Pedidos hoy', value:stats?.ordersToday ?? '...', icon:'P', color:'#2563eb' }, { label:'Ventas 24h', value:euro(stats?.revenueToday || 0), icon:'V', color:'#16a34a' }, { label:'Pendientes', value:stats?.pending ?? '...', icon:'O', color:'#ca8a04' }, { label:'Staff online', value:stats?.online ?? '...', icon:'S', color:'#0f766e' }, { label:'Caja hoy', value:euro(stats?.cashBalance || 0), icon:'C', color:'#7c3aed' }]} /></Card><Card title="Alertas">{!stats?.lowStock?.length && <Empty icon="OK" title="Sin alertas de stock" />}{stats?.lowStock?.map(item => <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--color-border-tertiary)' }}><span>{item.name}</span><Badge tone="warning">{parseNumeric(item.quantity)} / {parseNumeric(item.min_quantity)}</Badge></div>)}</Card></Grid2>
}

function ProductsTab({ storeId, tenantId }) {
  const empty = React.useMemo(() => ({ name:'', description:'', category:'general', emoji:'', price:'', compare_price:'', image_url:'', is_active:true, out_of_stock:false, is_featured:false, track_stock:false, stock_quantity:'0', has_variants:false, variants:'[]', modifiers:'[]' }), [])
  const [items, setItems] = React.useState([]), [form, setForm] = React.useState(empty), [editId, setEditId] = React.useState(null), [error, setError] = React.useState(''), [search, setSearch] = React.useState('')
  const load = React.useCallback(async () => { const { data } = await db.from('products').select('*').eq('store_id', storeId).order('sort_order').order('name'); setItems(data || []) }, [storeId])
  React.useEffect(() => { load() }, [load])
  async function submit(event) {
    event.preventDefault(); setError('')
    try {
      const payload = { store_id:storeId, tenant_id:tenantId || null, name:form.name.trim(), description:form.description.trim() || null, category:form.category.trim() || 'general', emoji:form.emoji.trim() || null, price:parseNumeric(form.price), compare_price:form.compare_price ? parseNumeric(form.compare_price) : null, image_url:form.image_url.trim() || null, is_active:form.is_active, out_of_stock:form.out_of_stock, is_featured:form.is_featured, track_stock:form.track_stock, stock_quantity:parseNumeric(form.stock_quantity), has_variants:form.has_variants, variants:parseJsonField(form.variants, 'Variantes', []), modifiers:parseJsonField(form.modifiers, 'Modificadores', []) }
      if (!payload.name) throw new Error('Nombre requerido')
      const query = editId ? db.from('products').update(payload).eq('id', editId).eq('store_id', storeId) : db.from('products').insert(payload)
      const { error: qError } = await query
      if (qError) throw qError
      setForm(empty); setEditId(null); await load()
    } catch (err) { setError(err.message) }
  }
  const filtered = items.filter(item => !search || `${item.name || ''} ${item.category || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <Grid2><Card title={editId ? 'Editar producto' : 'Nuevo producto'}>{error && <Alert type="error">{error}</Alert>}<form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:10 }}><Input label="Nombre" required value={form.name} onChange={event => setForm(prev => ({ ...prev, name:event.target.value }))} /><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}><Input label="Precio" type="number" step="0.01" value={form.price} onChange={event => setForm(prev => ({ ...prev, price:event.target.value }))} /><Input label="Precio comparado" type="number" step="0.01" value={form.compare_price} onChange={event => setForm(prev => ({ ...prev, compare_price:event.target.value }))} /></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}><Input label="Categoria" value={form.category} onChange={event => setForm(prev => ({ ...prev, category:event.target.value }))} /><Input label="Emoji" value={form.emoji} onChange={event => setForm(prev => ({ ...prev, emoji:event.target.value }))} /></div><Input label="Imagen URL" value={form.image_url} onChange={event => setForm(prev => ({ ...prev, image_url:event.target.value }))} /><Textarea label="Descripcion" rows={3} value={form.description} onChange={event => setForm(prev => ({ ...prev, description:event.target.value }))} /><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}><Textarea label="Variantes JSON" rows={5} value={form.variants} onChange={event => setForm(prev => ({ ...prev, variants:event.target.value }))} /><Textarea label="Modificadores JSON" rows={5} value={form.modifiers} onChange={event => setForm(prev => ({ ...prev, modifiers:event.target.value }))} /></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}><Input label="Stock actual" type="number" step="1" value={form.stock_quantity} onChange={event => setForm(prev => ({ ...prev, stock_quantity:event.target.value }))} /><div style={{ display:'flex', flexDirection:'column', gap:8 }}><Check label="Controlar stock" checked={form.track_stock} onChange={event => setForm(prev => ({ ...prev, track_stock:event.target.checked }))} /><Check label="Tiene variantes" checked={form.has_variants} onChange={event => setForm(prev => ({ ...prev, has_variants:event.target.checked }))} /><Check label="Destacado" checked={form.is_featured} onChange={event => setForm(prev => ({ ...prev, is_featured:event.target.checked }))} /><Check label="Activo" checked={form.is_active} onChange={event => setForm(prev => ({ ...prev, is_active:event.target.checked }))} /><Check label="Agotado" checked={form.out_of_stock} onChange={event => setForm(prev => ({ ...prev, out_of_stock:event.target.checked }))} /></div></div><div style={{ display:'flex', gap:8 }}><Btn type="submit" full>{editId ? 'Actualizar producto' : 'Crear producto'}</Btn>{editId && <Btn type="button" variant="ghost" onClick={() => { setEditId(null); setForm(empty) }}>Cancelar</Btn>}</div></form></Card><Card title={`Catalogo (${items.length})`}><div style={actionStyle}><Input label="Buscar" value={search} onChange={event => setSearch(event.target.value)} /><Btn type="button" variant="ghost" onClick={load}>Refrescar</Btn></div>{!filtered.length && <Empty icon="[]" title="Sin productos" />}{filtered.map(item => <div key={item.id} style={rowStyle}><div style={{ flex:1 }}><div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}><strong>{item.name}</strong><StatusBadge status={item.is_active && !item.out_of_stock ? 'active' : item.out_of_stock ? 'cancelled' : 'paused'} size="sm" />{item.has_variants && <Badge tone="info">Variantes</Badge>}{item.track_stock && <Badge tone="warning">Stock</Badge>}</div><div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{item.category || 'general'} · {euro(item.price)}</div></div><Btn type="button" size="sm" variant="ghost" onClick={() => { setEditId(item.id); setForm({ name:item.name || '', description:item.description || '', category:item.category || 'general', emoji:item.emoji || '', price:String(item.price ?? ''), compare_price:String(item.compare_price ?? ''), image_url:item.image_url || '', is_active:item.is_active !== false, out_of_stock:item.out_of_stock === true, is_featured:item.is_featured === true, track_stock:item.track_stock === true, stock_quantity:String(item.stock_quantity ?? 0), has_variants:item.has_variants === true, variants:formatJsonField(item.variants, []), modifiers:formatJsonField(item.modifiers, []) }) }}>Editar</Btn><Btn type="button" size="sm" variant="ghost" onClick={async () => { await db.from('products').update({ is_active:!item.is_active }).eq('id', item.id).eq('store_id', storeId); await load() }}>{item.is_active ? 'Pausar' : 'Activar'}</Btn></div>)}</Card></Grid2>
}
