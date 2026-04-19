/**
 * BranchAdminPage.jsx — Panel de Administración de Sede
 * Incluye: Dashboard, Productos, Pedidos, Staff, Marketing, Chatbot, Config
 * Diseño moderno, responsive, formularios completos para cada nivel.
 */
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'
import DashboardLayout from '../../../core/app/DashboardLayout'
import {
  Card, Btn, Input, Select, Textarea, Alert, Avatar, StatGrid,
  Grid2, Empty, Badge, StatusBadge, Divider,
} from '../../../shared/ui/OxidianDS'

// ─── Helpers ──────────────────────────────────────────────────────
function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}

const TABS = [
  { id:'dashboard', icon:'📊', label:'Panel'       },
  { id:'products',  icon:'🛍️', label:'Productos'   },
  { id:'orders',    icon:'📦', label:'Pedidos'     },
  { id:'staff',     icon:'👥', label:'Staff'       },
  { id:'marketing', icon:'🏷️', label:'Marketing'  },
  { id:'chatbot',   icon:'🤖', label:'Chatbot'     },
  { id:'config',    icon:'⚙️', label:'Config'      },
]

const ORDER_STATUS = ['pending','preparing','ready','delivering','delivered','cancelled']
const STATUS_COLORS = {
  pending:'#ca8a04', preparing:'#2563eb', ready:'#22c55e',
  delivering:'#8b5cf6', delivered:'#16a34a', cancelled:'#dc2626',
}

// ─── Main Page ────────────────────────────────────────────────────
export default function BranchAdminPage() {
  const [params] = useSearchParams()
  const { tenantId, role, membership } = useAuth()
  const storeId  = params.get('store_id') || params.get('store') || ''
  const branchId = params.get('branch_id')|| params.get('branch')|| ''

  const [tab,      setTab]      = React.useState('dashboard')
  const [branch,   setBranch]   = React.useState(null)
  const [store,    setStore]    = React.useState(null)
  const [loading,  setLoading]  = React.useState(true)

  React.useEffect(() => {
    if (!storeId) return setLoading(false)
    Promise.all([
      branchId ? supabaseAuth.from('branches').select('*').eq('id', branchId).maybeSingle() : Promise.resolve({ data:null }),
      supabaseAuth.from('stores').select('*').eq('id', storeId).maybeSingle(),
    ]).then(([b, s]) => {
      setBranch(b.data)
      setStore(s.data)
      setLoading(false)
    })
  }, [storeId, branchId])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--color-text-secondary)' }}>
      Cargando…
    </div>
  )

  if (!storeId) return (
    <div style={{ padding:24 }}>
      <Alert type="warn">No se proporcionó store_id. Accede desde el panel del tenant.</Alert>
    </div>
  )

  return (
    <DashboardLayout
      activeTab={tab} onTabChange={setTab}
      title={branch?.name || 'Sede'}
      subtitle={store?.name}
    >
      {/* Tab bar */}
      <div style={{
        display:'flex', gap:4, marginBottom:20, flexWrap:'wrap',
        background:'var(--color-background-primary)',
        border:'1px solid var(--color-border-tertiary)',
        borderRadius:12, padding:4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer',
            fontSize:13, fontWeight:tab===t.id?600:400, fontFamily:'inherit',
            background:tab===t.id?'var(--color-text-primary)':'transparent',
            color:tab===t.id?'var(--color-background-primary)':'var(--color-text-secondary)',
            display:'flex', alignItems:'center', gap:5, transition:'.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab branch={branch} store={store} storeId={storeId} branchId={branchId} />}
      {tab === 'products'  && <ProductsTab  storeId={storeId} />}
      {tab === 'orders'    && <OrdersTab    storeId={storeId} branchId={branchId} />}
      {tab === 'staff'     && <StaffTab     storeId={storeId} branchId={branchId} store={store} branch={branch} />}
      {tab === 'marketing' && <MarketingTab storeId={storeId} />}
      {tab === 'chatbot'   && <ChatbotTab   branchId={branchId} storeId={storeId} />}
      {tab === 'config'    && <ConfigTab    branch={branch} setBranch={setBranch} branchId={branchId} />}
    </DashboardLayout>
  )
}


// ─── DASHBOARD TAB ────────────────────────────────────────────────
function DashboardTab({ branch, store, storeId, branchId }) {
  const [stats, setStats] = React.useState(null)

  React.useEffect(() => {
    if (!storeId) return
    const since = new Date(Date.now()-86400000).toISOString()
    Promise.all([
      supabaseAuth.from('orders').select('id,total,status').eq('store_id',storeId).gte('created_at',since),
      supabaseAuth.from('staff_users').select('id,is_online').eq('store_id',storeId),
      supabaseAuth.from('stock_items').select('id,name,quantity,min_quantity').eq('store_id',storeId),
    ]).then(([orders, staff, stock]) => {
      const os   = orders.data||[]
      const sdf  = staff.data||[]
      const stk  = stock.data||[]
      setStats({
        orders_today:   os.length,
        revenue_today:  os.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total||0),0).toFixed(2),
        pending:        os.filter(o=>o.status==='pending').length,
        staff_online:   sdf.filter(s=>s.is_online).length,
        low_stock:      stk.filter(s=>Number(s.quantity)<=Number(s.min_quantity)).length,
        low_stock_items:stk.filter(s=>Number(s.quantity)<=Number(s.min_quantity)).slice(0,5),
      })
    })
  }, [storeId])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <StatGrid items={[
        { label:'Pedidos hoy',   value:stats?.orders_today??'…',  icon:'📦', color:'#2563eb' },
        { label:'Ingresos (24h)',value:`€${stats?.revenue_today??'0.00'}`, icon:'💰', color:'#16a34a' },
        { label:'Pendientes',    value:stats?.pending??'…',       icon:'⏳', color:'#ca8a04' },
        { label:'Staff online',  value:stats?.staff_online??'…',  icon:'🟢', color:'#16a34a' },
        { label:'Stock bajo',    value:stats?.low_stock??'…',     icon:'⚠️', color:'#dc2626' },
      ]} />

      <Grid2>
        <Card title="Vistas operativas">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { icon:'🍳', label:'Panel de Cocina',       href:`/branch/kitchen?store_id=${storeId}&branch_id=${branchId}`, color:'#f97316' },
              { icon:'🛵', label:'Panel de Repartidores', href:`/branch/riders?store_id=${storeId}&branch_id=${branchId}`,  color:'#8b5cf6' },
            ].map(l => (
              <a key={l.href} href={l.href} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                borderRadius:10, border:`1px solid ${l.color}30`,
                background:`${l.color}08`, textDecoration:'none',
                color:'var(--color-text-primary)', fontWeight:600, fontSize:14,
              }}>
                <span style={{fontSize:24}}>{l.icon}</span>
                <span>{l.label}</span>
                <span style={{marginLeft:'auto',color:l.color}}>→</span>
              </a>
            ))}
          </div>
        </Card>

        {stats?.low_stock > 0 && (
          <Card title="⚠️ Stock bajo" accent="#f97316">
            {stats.low_stock_items.map(item => (
              <div key={item.id} style={{
                display:'flex', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--color-border-tertiary)',
                fontSize:13,
              }}>
                <span>{item.name}</span>
                <span style={{color:'#dc2626',fontWeight:600}}>
                  {item.quantity} / mín {item.min_quantity}
                </span>
              </div>
            ))}
          </Card>
        )}
      </Grid2>
    </div>
  )
}


// ─── PRODUCTS TAB ─────────────────────────────────────────────────
function ProductsTab({ storeId }) {
  const [products, setProducts] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [form,     setForm]     = React.useState({ name:'', price:'', category:'general', emoji:'🍽️', description:'' })
  const [editId,   setEditId]   = React.useState(null)
  const [saving,   setSaving]   = React.useState(false)
  const [error,    setError]    = React.useState('')
  const [search,   setSearch]   = React.useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabaseAuth.from('products').select('*').eq('store_id',storeId).order('sort_order')
    setProducts(data||[])
    setLoading(false)
  }
  React.useEffect(() => { load() }, [storeId])

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, price:Number(form.price), store_id:storeId }
      if (editId) await supabaseAuth.from('products').update(payload).eq('id',editId)
      else        await supabaseAuth.from('products').insert(payload)
      setForm({ name:'', price:'', category:'general', emoji:'🍽️', description:'' })
      setEditId(null); load()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Grid2>
      <Card title={editId?'Editar producto':'Nuevo producto'}>
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Input label="Nombre *" required value={form.name}
            onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Margherita" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Input label="Precio (€) *" type="number" step="0.01" required value={form.price}
              onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="9.99" />
            <Input label="Emoji" value={form.emoji}
              onChange={e => setForm(f=>({...f,emoji:e.target.value}))} />
          </div>
          <Input label="Categoría" value={form.category}
            onChange={e => setForm(f=>({...f,category:e.target.value}))} placeholder="pizzas, postres…" />
          <Textarea label="Descripción" value={form.description}
            onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:8 }}>
            <Btn type="submit" full disabled={saving}>{saving?'Guardando…':editId?'Actualizar':'Crear producto'}</Btn>
            {editId && <Btn variant="ghost" onClick={()=>{setEditId(null);setForm({name:'',price:'',category:'general',emoji:'🍽️',description:''})}}>Cancelar</Btn>}
          </div>
        </form>
      </Card>

      <Card title={`Catálogo (${products.length})`}
        action={<input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--color-border-secondary)',fontSize:12,background:'var(--color-background-secondary)'}} />}>
        {loading && <Empty icon="⏳" title="Cargando…" />}
        <div style={{ maxHeight:480, overflowY:'auto' }}>
          {filtered.map(p => (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 0', borderBottom:'1px solid var(--color-border-tertiary)',
            }}>
              <span style={{fontSize:24,flexShrink:0}}>{p.emoji||'🍽️'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                <div style={{fontSize:12,color:'var(--color-text-secondary)'}}>
                  {p.category} · €{Number(p.price).toFixed(2)}
                </div>
              </div>
              <StatusBadge status={p.is_active&&!p.out_of_stock?'active':p.out_of_stock?'cancelled':'paused'} size="sm" />
              <div style={{display:'flex',gap:4}}>
                <Btn size="sm" variant="ghost"
                  onClick={()=>{setEditId(p.id);setForm({name:p.name,price:p.price,category:p.category||'general',emoji:p.emoji||'🍽️',description:p.description||''})}}>
                  ✏️
                </Btn>
                <Btn size="sm" variant={p.is_active?'ghost':'success'}
                  onClick={async()=>{await supabaseAuth.from('products').update({is_active:!p.is_active}).eq('id',p.id);load()}}>
                  {p.is_active?'Pausar':'Activar'}
                </Btn>
              </div>
            </div>
          ))}
          {!filtered.length && !loading && <Empty icon="🍽️" title="Sin productos" />}
        </div>
      </Card>
    </Grid2>
  )
}


// ─── ORDERS TAB ───────────────────────────────────────────────────
function OrdersTab({ storeId, branchId }) {
  const [orders,  setOrders]  = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filter,  setFilter]  = React.useState('active')
  const [busy,    setBusy]    = React.useState(null)

  const load = async () => {
    setLoading(true)
    let q = supabaseAuth.from('orders').select('*').eq('store_id',storeId)
      .order('created_at',{ascending:false}).limit(50)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setOrders(data||[])
    setLoading(false)
  }
  React.useEffect(() => { load() }, [storeId, branchId])

  async function changeStatus(order, status) {
    setBusy(order.id)
    await supabaseAuth.from('orders').update({ status, updated_at:new Date().toISOString() }).eq('id',order.id)
    load(); setBusy(null)
  }

  const FILTERS = [
    { id:'active',    label:'Activos', fn: o=>!['delivered','cancelled'].includes(o.status) },
    { id:'delivered', label:'Entregados', fn: o=>o.status==='delivered' },
    { id:'cancelled', label:'Cancelados', fn: o=>o.status==='cancelled' },
    { id:'all',       label:'Todos', fn: ()=>true },
  ]
  const visible = orders.filter(FILTERS.find(f=>f.id===filter)?.fn||FILTERS[0].fn)

  const NEXT_STATUS = {
    pending:   [{s:'preparing',l:'▶ Preparar'},{s:'cancelled',l:'✕ Cancelar'}],
    preparing: [{s:'ready',l:'✓ Listo'},{s:'cancelled',l:'✕ Cancelar'}],
    ready:     [{s:'delivering',l:'🛵 Despachar'},{s:'delivered',l:'✅ Entregado'}],
    delivering:[{s:'delivered',l:'✅ Entregado'}],
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit',
            border:`1px solid var(--color-border-secondary)`,
            background:filter===f.id?'var(--color-text-primary)':'transparent',
            color:filter===f.id?'var(--color-background-primary)':'var(--color-text-secondary)',
            fontWeight:filter===f.id?600:400,
          }}>{f.label} ({orders.filter(FILTERS.find(x=>x.id===f.id)?.fn||FILTERS[0].fn).length})</button>
        ))}
        <button onClick={load} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid var(--color-border-secondary)',background:'transparent',cursor:'pointer'}}>↻ Actualizar</button>
      </div>

      {loading && <Empty icon="⏳" title="Cargando pedidos…" />}
      {!loading && !visible.length && <Empty icon="🎉" title="Sin pedidos en este estado" />}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {visible.map(o => {
          const c = STATUS_COLORS[o.status]||'#64748b'
          let items = []; try { items = typeof o.items==='string'?JSON.parse(o.items):(o.items||[]) } catch {}
          return (
            <div key={o.id} style={{
              background:'var(--color-background-primary)',
              border:`1px solid var(--color-border-tertiary)`,
              borderLeft:`4px solid ${c}`,
              borderRadius:10, padding:'12px 14px',
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div>
                  <span style={{fontWeight:700,fontSize:15}}>#{o.order_number||o.id.slice(-6).toUpperCase()}</span>
                  <span style={{marginLeft:10,fontSize:13,color:'var(--color-text-secondary)'}}>{o.customer_name}</span>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:14}}>€{Number(o.total||0).toFixed(2)}</span>
                  <StatusBadge status={o.status} size="sm" />
                </div>
              </div>

              {/* Items */}
              {items.length>0 && (
                <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:8}}>
                  {items.slice(0,3).map((it,i)=>(
                    <span key={i}>{it.qty||1}× {it.product_name||it.name||'ítem'}{i<Math.min(items.length,3)-1?', ':''}</span>
                  ))}
                  {items.length>3&&` +${items.length-3} más`}
                </div>
              )}

              {/* Dirección + teléfono */}
              <div style={{display:'flex',gap:16,fontSize:12,color:'var(--color-text-secondary)',marginBottom:8}}>
                {(o.delivery_address||o.address)&&<span>📍 {o.delivery_address||o.address}</span>}
                {o.customer_phone&&<a href={`tel:${o.customer_phone}`} style={{color:'#2563eb',textDecoration:'none'}}>📞 {o.customer_phone}</a>}
              </div>

              {/* Acciones */}
              {NEXT_STATUS[o.status] && (
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {NEXT_STATUS[o.status].map(ns=>(
                    <Btn key={ns.s} size="sm"
                      variant={ns.s==='cancelled'?'danger':ns.s==='delivered'?'success':'blue'}
                      disabled={busy===o.id}
                      onClick={()=>changeStatus(o,ns.s)}>
                      {busy===o.id?'…':ns.l}
                    </Btn>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── STAFF TAB ────────────────────────────────────────────────────
function StaffTab({ storeId, branchId, store, branch }) {
  const [staff,   setStaff]   = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [showForm,setShowForm]= React.useState(false)
  const [form,    setForm]    = React.useState({ name:'', role:'cashier', phone:'', email:'', pin:'', notes:'' })
  const [saving,  setSaving]  = React.useState(false)
  const [error,   setError]   = React.useState('')
  const [copied,  setCopied]  = React.useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabaseAuth.from('staff_users').select('*')
      .eq('store_id',storeId).order('name')
    setStaff(data||[])
    setLoading(false)
  }
  React.useEffect(() => { load() }, [storeId])

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { error:er } = await supabaseAuth.from('staff_users').insert({
        store_id:storeId, branch_id:branchId||null, name:form.name,
        role:form.role, phone:form.phone, email:form.email||null,
        pin:form.pin, notes:form.notes, is_active:true,
      })
      if (er) throw er
      setForm({ name:'', role:'cashier', phone:'', email:'', pin:'', notes:'' })
      setShowForm(false); load()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function toggle(s) {
    await supabaseAuth.from('staff_users').update({ is_active:!s.is_active }).eq('id',s.id)
    load()
  }

  const storeSlug  = store?.slug  || storeId
  const branchSlug = branch?.slug || 'principal'
  const loginUrl   = `${window.location.origin}/s/${storeSlug}/${branchSlug}/login`

  const ROLES = [
    ['branch_manager','Manager de sede'],['cashier','Caja'],
    ['kitchen','Cocina'],['rider','Repartidor'],['store_operator','Operador'],
  ]

  const ROLE_COLORS = { branch_manager:'#6366f1', cashier:'#2563eb', kitchen:'#f97316', rider:'#8b5cf6', store_operator:'#0891b2' }

  return (
    <Grid2>
      <Card title="Personal de la sede"
        action={<Btn size="sm" onClick={()=>setShowForm(s=>!s)}>{showForm?'✕ Cancelar':'+ Añadir'}</Btn>}>

        {showForm && (
          <div style={{marginBottom:16,padding:16,background:'var(--color-background-secondary)',borderRadius:10}}>
            {error && <Alert type="error">{error}</Alert>}
            <form onSubmit={handleCreate} style={{display:'flex',flexDirection:'column',gap:10}}>
              <Input label="Nombre completo *" required value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Camila Ruiz" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Select label="Rol *" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(([id,l])=><option key={id} value={id}>{l}</option>)}
                </Select>
                <Input label="PIN (4-8 dígitos) *" required type="password" inputMode="numeric"
                  maxLength={8} value={form.pin}
                  onChange={e=>setForm(f=>({...f,pin:e.target.value}))} placeholder="1234" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Input label="Teléfono" value={form.phone}
                  onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+34 600 000 000" />
                <Input label="Email" type="email" value={form.email}
                  onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="opconal@mail.com" />
              </div>
              <Textarea label="Notas" value={form.notes}
                onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Turno, especialidad…" />
              <Btn type="submit" full disabled={saving}>{saving?'Creando…':'Crear perfil de staff'}</Btn>
            </form>
          </div>
        )}

        {/* Link de acceso */}
        <div style={{
          padding:'10px 12px', borderRadius:8, marginBottom:12,
          background:'var(--color-background-secondary)',
          border:'1px solid var(--color-border-tertiary)', fontSize:12,
        }}>
          <div style={{fontWeight:500,marginBottom:4}}>🔗 Link de acceso para esta sede:</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <code style={{fontSize:11,color:'var(--color-text-secondary)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{loginUrl}</code>
            <Btn size="sm" variant="ghost" onClick={()=>{navigator.clipboard.writeText(loginUrl);setCopied('url');setTimeout(()=>setCopied(null),2000)}}>
              {copied==='url'?'✓ Copiado':'Copiar'}
            </Btn>
          </div>
        </div>

        {loading && <Empty icon="⏳" title="Cargando…" />}
        {!loading && !staff.length && <Empty icon="👥" title="Sin personal registrado" sub="Crea el primer perfil de staff" />}

        <div style={{maxHeight:420,overflowY:'auto'}}>
          {staff.map(s => {
            const color = ROLE_COLORS[s.role]||'#64748b'
            return (
              <div key={s.id} style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'10px 0',borderBottom:'1px solid var(--color-border-tertiary)',
              }}>
                <div style={{
                  width:38,height:38,borderRadius:9,flexShrink:0,
                  background:`${color}20`,color,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:700,fontSize:14,
                }}>{s.name.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                    {s.name}
                    <span style={{fontSize:10,background:`${color}15`,color,padding:'1px 6px',borderRadius:20,fontWeight:600}}>
                      {s.role}
                    </span>
                    {s.is_online && <span style={{fontSize:10,color:'#16a34a'}}>🟢</span>}
                  </div>
                  <div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:2}}>
                    {s.phone||'Sin tel.'} · PIN: {s.pin?'••••':'sin PIN'}
                  </div>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <StatusBadge status={s.is_active?'active':'paused'} size="sm" />
                  <Btn size="sm" variant="ghost" onClick={()=>toggle(s)}>
                    {s.is_active?'Pausar':'Activar'}
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Roles y permisos" sub="Qué puede hacer cada rol">
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[
            { role:'branch_manager', icon:'🏢', desc:'Acceso completo al panel de sede. Gestiona todo el equipo.' },
            { role:'cashier',        icon:'🧾', desc:'Gestión de pedidos y caja. No ve finanzas ni staff.' },
            { role:'kitchen',        icon:'🍳', desc:'Solo ve la vista de cocina con los tickets activos.' },
            { role:'rider',          icon:'🛵', desc:'Solo ve los pedidos listos para despacho y entrega.' },
            { role:'store_operator', icon:'📊', desc:'Acceso amplio a productos y pedidos. Sin finanzas.' },
          ].map(r => {
            const c = ROLE_COLORS[r.role]||'#64748b'
            return (
              <div key={r.role} style={{
                padding:'12px 14px',borderRadius:10,
                border:`1px solid ${c}30`,background:`${c}06`,
              }}>
                <div style={{fontWeight:600,fontSize:13,color:c,marginBottom:4}}>
                  {r.icon} {r.role}
                </div>
                <div style={{fontSize:12,color:'var(--color-text-secondary)'}}>{r.desc}</div>
              </div>
            )
          })}
        </div>
      </Card>
    </Grid2>
  )
}


// ─── MARKETING TAB ────────────────────────────────────────────────
function MarketingTab({ storeId }) {
  const [tab, setTab] = React.useState('coupons')
  const [coupons,  setCoupons]  = React.useState([])
  const [reviews,  setReviews]  = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [form,     setForm]     = React.useState({ code:'', type:'percentage', value:'', min_order:'0', description:'' })
  const [saving,   setSaving]   = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    Promise.all([
      supabaseAuth.from('coupons').select('*').eq('store_id',storeId).order('created_at',{ascending:false}),
      supabaseAuth.from('reviews').select('*').eq('store_id',storeId).order('created_at',{ascending:false}).limit(20),
    ]).then(([c,r]) => { setCoupons(c.data||[]); setReviews(r.data||[]); setLoading(false) })
  }, [storeId])

  async function createCoupon(e) {
    e.preventDefault(); setSaving(true)
    await supabaseAuth.from('coupons').insert({ ...form, value:Number(form.value), min_order:Number(form.min_order), store_id:storeId, is_active:true })
    setForm({ code:'', type:'percentage', value:'', min_order:'0', description:'' })
    const { data } = await supabaseAuth.from('coupons').select('*').eq('store_id',storeId).order('created_at',{ascending:false})
    setCoupons(data||[])
    setSaving(false)
  }

  async function toggleCoupon(c) {
    await supabaseAuth.from('coupons').update({ is_active:!c.is_active }).eq('id',c.id)
    setCoupons(prev=>prev.map(x=>x.id===c.id?{...x,is_active:!x.is_active}:x))
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['coupons','🏷️ Cupones'],['reviews','💬 Reseñas']].map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:'7px 16px',borderRadius:20,fontSize:13,cursor:'pointer',fontFamily:'inherit',
            border:'1px solid var(--color-border-secondary)',
            background:tab===id?'var(--color-text-primary)':'transparent',
            color:tab===id?'var(--color-background-primary)':'var(--color-text-secondary)',
            fontWeight:tab===id?600:400,
          }}>{l}</button>
        ))}
      </div>

      {tab==='coupons' && (
        <Grid2>
          <Card title="Crear cupón de descuento">
            <form onSubmit={createCoupon} style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Input label="Código *" required value={form.code}
                  onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="BIENVENIDA10" />
                <Select label="Tipo" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Fijo (€)</option>
                  <option value="free_delivery">Envío gratis</option>
                </Select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Input label={form.type==='percentage'?'Descuento (%)':'Descuento (€)'} type="number" step="0.01"
                  value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} placeholder="10" />
                <Input label="Pedido mínimo (€)" type="number" step="0.01"
                  value={form.min_order} onChange={e=>setForm(f=>({...f,min_order:e.target.value}))} />
              </div>
              <Input label="Descripción interna" value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Campaña de captación" />
              <Btn type="submit" full disabled={saving}>{saving?'Creando…':'Crear cupón'}</Btn>
            </form>
          </Card>
          <Card title={`Cupones activos (${coupons.length})`}>
            {!coupons.length && <Empty icon="🏷️" title="Sin cupones todavía" />}
            {coupons.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--color-border-tertiary)'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,fontFamily:'monospace'}}>{c.code}</div>
                  <div style={{fontSize:12,color:'var(--color-text-secondary)'}}>
                    {c.type==='percentage'?`${c.value}%`:`€${c.value}`} · mín €{c.min_order} · {c.uses_count||0} usos
                  </div>
                </div>
                <StatusBadge status={c.is_active?'active':'paused'} size="sm" />
                <Btn size="sm" variant="ghost" onClick={()=>toggleCoupon(c)}>{c.is_active?'Pausar':'Activar'}</Btn>
              </div>
            ))}
          </Card>
        </Grid2>
      )}

      {tab==='reviews' && (
        <div>
          <div style={{display:'flex',gap:16,marginBottom:16}}>
            {[
              {l:'Total', v:reviews.length},
              {l:'Aprobadas', v:reviews.filter(r=>r.approved).length},
              {l:'Pendientes',v:reviews.filter(r=>!r.approved).length},
              {l:'Promedio', v:reviews.length?(reviews.reduce((s,r)=>s+(r.rating||5),0)/reviews.length).toFixed(1):'—'},
            ].map(s=>(
              <div key={s.l} style={{padding:'12px 16px',background:'var(--color-background-primary)',border:'1px solid var(--color-border-tertiary)',borderRadius:10,textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800}}>{s.v}</div>
                <div style={{fontSize:11,color:'var(--color-text-secondary)'}}>{s.l}</div>
              </div>
            ))}
          </div>
          {!reviews.length && <Empty icon="💬" title="Sin reseñas todavía" />}
          {reviews.map(r=>(
            <div key={r.id} style={{background:'var(--color-background-primary)',border:'1px solid var(--color-border-tertiary)',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontWeight:500,fontSize:13}}>
                  {'⭐'.repeat(Math.min(r.rating||5,5))} {r.customer_name||'Cliente'}
                </div>
                <StatusBadge status={r.approved?'active':'pending'} size="sm" />
              </div>
              <div style={{fontSize:13,color:'var(--color-text-secondary)',marginBottom:8}}>{r.comment||'(sin comentario)'}</div>
              {!r.approved && (
                <Btn size="sm" variant="success"
                  onClick={async()=>{await supabaseAuth.from('reviews').update({approved:true}).eq('id',r.id);setReviews(prev=>prev.map(x=>x.id===r.id?{...x,approved:true}:x))}}>
                  ✓ Aprobar
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CHATBOT TAB ──────────────────────────────────────────────────
function ChatbotTab({ branchId, storeId }) {
  const [data,    setData]    = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!branchId) return setLoading(false)
    supabaseAuth.from('branches').select('chatbot_authorized,chatbot_authorized_at,chatbot_last_seen,chatbot_version,chatbot_wa_secret')
      .eq('id',branchId).maybeSingle().then(({data}) => { setData(data); setLoading(false) })
  }, [branchId])

  if (loading) return <Empty icon="⏳" title="Cargando…" />
  if (!data?.chatbot_authorized) return (
    <Card title="Chatbot WhatsApp portable">
      <Empty icon="🔒" title="No autorizado"
        sub="El Super Admin debe autorizar esta sede desde el panel de administración para habilitar el chatbot." />
    </Card>
  )

  const downloadUrl = `/api/backend/admin/chatbot/download/${branchId}`

  return (
    <Grid2>
      <Card title="✅ Chatbot autorizado" accent="#22c55e">
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {l:'Estado', v:data.chatbot_last_seen?`🟢 Activo · ${new Date(data.chatbot_last_seen).toLocaleDateString('es-ES')}`:'⚫ No conectado'},
            {l:'Versión', v:data.chatbot_version||'Pendiente de primera conexión'},
          ].map(s=>(
            <div key={s.l} style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
              <span style={{color:'var(--color-text-secondary)'}}>{s.l}</span>
              <span style={{fontWeight:500}}>{s.v}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:16,display:'flex',gap:8}}>
          <a href={downloadUrl} download style={{textDecoration:'none',flex:1}}>
            <Btn full variant="success">📦 Descargar ZIP portable</Btn>
          </a>
        </div>
      </Card>
      <Card title="Instrucciones de instalación">
        <ol style={{margin:0,padding:'0 0 0 18px',fontSize:13,lineHeight:2.2,color:'var(--color-text-secondary)'}}>
          <li>Descarga y extrae el ZIP en tu PC</li>
          <li>Abre el archivo <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4}}>.env</code> y verifica tus datos</li>
          <li>Windows: doble clic en <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4}}>iniciar.bat</code></li>
          <li>Mac/Linux: ejecuta <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4}}>./iniciar.sh</code></li>
          <li>Abre <a href="http://localhost:3001/qr-page" target="_blank" rel="noreferrer" style={{color:'#2563eb'}}>http://localhost:3001/qr-page</a></li>
          <li>Escanea el QR con WhatsApp en tu móvil</li>
          <li>¡El bot queda activo!</li>
        </ol>
      </Card>
    </Grid2>
  )
}

// ─── CONFIG TAB ───────────────────────────────────────────────────
function ConfigTab({ branch, setBranch, branchId }) {
  const [form,   setForm]   = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [saved,  setSaved]  = React.useState(false)
  const [error,  setError]  = React.useState('')

  React.useEffect(() => {
    if (branch) setForm({ ...branch })
  }, [branch])

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { error:er } = await supabaseAuth.from('branches').update({
        name:form.name, address:form.address, city:form.city, phone:form.phone,
        open_hour:Number(form.open_hour)||10, close_hour:Number(form.close_hour)||22,
        open_days:form.open_days, public_visible:form.public_visible,
      }).eq('id', branchId)
      if (er) throw er
      setBranch(form); setSaved(true); setTimeout(()=>setSaved(false),3000)
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  if (!form) return <Empty icon="⏳" title="Cargando configuración…" />

  return (
    <div style={{ maxWidth:600 }}>
      {error && <Alert type="error">{error}</Alert>}
      {saved  && <Alert type="success">✓ Configuración guardada correctamente</Alert>}
      <Card title="Configuración de la sede">
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Input label="Nombre de la sede" value={form.name||''}
              onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            <Input label="Teléfono" value={form.phone||''}
              onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Input label="Ciudad" value={form.city||''}
              onChange={e=>setForm(f=>({...f,city:e.target.value}))} />
            <Input label="Dirección" value={form.address||''}
              onChange={e=>setForm(f=>({...f,address:e.target.value}))} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <Input label="Hora apertura" type="number" min="0" max="23" value={form.open_hour||10}
              onChange={e=>setForm(f=>({...f,open_hour:e.target.value}))} />
            <Input label="Hora cierre" type="number" min="0" max="23" value={form.close_hour||22}
              onChange={e=>setForm(f=>({...f,close_hour:e.target.value}))} />
            <Input label="Días activos" value={form.open_days||'L-D'}
              onChange={e=>setForm(f=>({...f,open_days:e.target.value}))}
              placeholder="L-D ó Lun,Mar,Mié" />
          </div>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13}}>
            <input type="checkbox" checked={!!form.public_visible}
              onChange={e=>setForm(f=>({...f,public_visible:e.target.checked}))} />
            Sede visible públicamente en el menú
          </label>
          <Btn type="submit" disabled={saving} size="lg">{saving?'Guardando…':'Guardar configuración'}</Btn>
        </form>
      </Card>
    </div>
  )
}
