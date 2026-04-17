// AdminDashboardTab.jsx — CarmoCream · Dashboard Operativo v2
// Kanban Realtime · KPIs día · Productos Estrella · Control total
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeOrders } from '../lib/useRealtimeOrders'
import { sendWhatsAppRaw } from '../lib/sendWhatsApp'
import { isGiftOrderItem } from '../lib/clubGift'
import toast from 'react-hot-toast'
import { loadMergedSettingsMap } from '../lib/storeSettings'
import { buildStoreBrandingSnapshot } from '../lib/adminBranding'
import { buildAdminFallbackStatusMessageWithBrand } from '../lib/adminOrderUtils'

const STATUS_META = {
  pending:   { label:'⏳ Pendientes', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', next:'preparing',  nextLabel:'▶ Preparar'   },
  preparing: { label:'👨‍🍳 Prep.',   color:'#7C3AED', bg:'#F5F3FF', border:'#C4B5FD', next:'delivering', nextLabel:'🛵 En camino' },
  delivering:{ label:'🛵 Reparto',   color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE', next:'delivered',  nextLabel:'✅ Entregado'  },
  delivered: { label:'✅ Entregados', color:'#166534', bg:'#F0FDF4', border:'#86EFAC', next:null,         nextLabel:null            },
}

// ── DayKPIs ── KPIs del día calculados en tiempo real
function DayKPIs({ orders }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const todayOrders = orders.filter(o => new Date(o.created_at) >= today)
  const delivered   = todayOrders.filter(o => o.status === 'delivered')
  const active      = todayOrders.filter(o => ['pending','preparing','delivering'].includes(o.status))
  const revenue     = delivered.reduce((s,o) => s+Number(o.total||0), 0)
  const avgTicket   = delivered.length ? revenue / delivered.length : 0
  const pending     = todayOrders.filter(o => o.status === 'pending').length

  const kpis = [
    { icon:'📦', label:'Pedidos Hoy',   value:todayOrders.length,       color:'#1D4ED8', bg:'#DBEAFE' },
    { icon:'💰', label:'Ingresos Hoy',  value:`€${revenue.toFixed(2)}`, color:'#166534', bg:'#DCFCE7' },
    { icon:'🧾', label:'Ticket Medio',  value:`€${avgTicket.toFixed(2)}`,color:'#7C3AED', bg:'#EDE9FE' },
    { icon:'⏳', label:'En Curso',      value:active.length,             color:'#D97706', bg:'#FEF3C7', alert:pending>=3 },
  ]

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:20}}>
      {kpis.map((k,i) => (
        <div key={i} style={{
          background:k.bg, border:`1.5px solid ${k.color}22`,
          borderRadius:16, padding:'12px 14px', textAlign:'center',
          boxShadow:'0 2px 10px rgba(0,0,0,.06)',
          animation:k.alert?'kpiAlert 2s ease infinite':'none',
        }}>
          <div style={{fontSize:'1.3rem',marginBottom:4}}>{k.icon}</div>
          <div style={{fontWeight:900,fontSize:'1.05rem',color:k.color}}>{k.value}</div>
          <div style={{fontSize:'0.6rem',fontWeight:800,color:k.color,opacity:.7,letterSpacing:'0.06em',textTransform:'uppercase'}}>{k.label}</div>
          {k.alert && <div style={{fontSize:'0.58rem',fontWeight:900,color:'#DC2626',marginTop:3}}>¡Revisar!</div>}
        </div>
      ))}
      <style>{`@keyframes kpiAlert{0%,100%{box-shadow:0 2px 10px rgba(0,0,0,.06)}50%{box-shadow:0 0 0 4px rgba(220,38,38,.18)}}`}</style>
    </div>
  )
}

// ── StarProducts — Productos más vendidos del día ─────────────
function StarProducts({ orders }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const todayDelivered = orders.filter(o => o.status==='delivered' && new Date(o.created_at)>=today)

  const countMap = {}
  todayDelivered.forEach(order => {
    (order.items||[]).forEach(item => {
      if (isGiftOrderItem(item)) return
      const key = item.product_name
      if (!countMap[key]) countMap[key] = { name:key, emoji:item.emoji||'🍓', qty:0, revenue:0 }
      countMap[key].qty     += item.qty||1
      countMap[key].revenue += (item.price||0) * (item.qty||1)
    })
  })

  const top = Object.values(countMap).sort((a,b)=>b.qty-a.qty).slice(0,5)
  if (top.length === 0) return null

  return (
    <div style={{background:'white',border:'1.5px solid #E5E7EB',borderRadius:16,padding:'14px 16px',marginBottom:16}}>
      <div style={{fontWeight:900,fontSize:'.85rem',color:'#1C3829',marginBottom:12}}>⭐ Productos Estrella Hoy</div>
      {top.map((p,i) => (
        <div key={p.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <span style={{fontSize:'.7rem',fontWeight:900,color:'#9CA3AF',width:16,textAlign:'center'}}>{i+1}</span>
          <span style={{fontSize:'1.1rem'}}>{p.emoji}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:'.82rem',color:'#1C3829'}}>{p.name}</div>
            <div style={{fontSize:'.68rem',color:'#6B7280'}}>€{p.revenue.toFixed(2)} generados</div>
          </div>
          <div style={{
            background:i===0?'#FEF3C7':i===1?'#F5F3FF':'#F0FDF4',
            color:i===0?'#92400E':i===1?'#7C3AED':'#166534',
            fontWeight:900,fontSize:'.78rem',padding:'3px 9px',borderRadius:20,
          }}>×{p.qty}</div>
        </div>
      ))}
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────
function OrderCard({ order, onAdvance, onCancel, advancing }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[order.status] || STATUS_META.pending
  const items = order.items || []
  const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000)

  return (
    <div style={{
      background:meta.bg, border:`2px solid ${meta.border}`,
      borderRadius:18, padding:'14px 16px', marginBottom:10,
      boxShadow:'0 2px 12px rgba(0,0,0,.07)',
      animation:'cardIn .35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:900,fontSize:'1rem',color:'#1C3829'}}>#{order.order_number}</span>
            <span style={{fontSize:'0.62rem',fontWeight:900,color:meta.color,background:`${meta.border}66`,padding:'2px 8px',borderRadius:50}}>{meta.label}</span>
            {age > 0 && <span style={{fontSize:'0.6rem',fontWeight:700,color:'#9CA3AF'}}>hace {age}m</span>}
            {order.status==='pending' && age>=8 && (
              <span style={{fontSize:'0.6rem',fontWeight:900,color:'#DC2626',background:'#FEE2E2',padding:'2px 7px',borderRadius:50,animation:'urgentPulse 1.5s ease infinite'}}>⚠ URGENTE</span>
            )}
          </div>
          <div style={{fontSize:'0.82rem',fontWeight:700,color:'#374151',marginTop:4}}>
            📞 {order.customer_name} · {order.customer_phone}
          </div>
          <div style={{fontSize:'0.75rem',color:'#6B7280',fontWeight:600,marginTop:2}}>
            📍 {order.delivery_address || order.address || 'Dirección no indicada'}
          </div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontWeight:900,fontSize:'1.1rem',color:'#2D6A4F'}}>€{Number(order.total||0).toFixed(2)}</div>
          <div style={{fontSize:'0.62rem',color:'#9CA3AF',fontWeight:600}}>
            {new Date(order.created_at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      </div>

      <div style={{marginTop:10,padding:'8px 10px',borderRadius:12,background:'rgba(255,255,255,0.7)',fontSize:'0.75rem',fontWeight:700,color:'#2D6A4F',lineHeight:1.6}}>
        {items.slice(0,expanded?items.length:3).map((it,i)=>(
          <div key={i}>{it.emoji||'🍓'} {it.product_name} ×{it.qty}{it.size&&it.size!=='small'?` · ${it.size}`:''}</div>
        ))}
        {!expanded && items.length>3 && (
          <button onClick={()=>setExpanded(true)} style={{background:'none',border:'none',color:'#40916C',fontWeight:800,cursor:'pointer',padding:0,fontSize:'0.72rem'}}>
            +{items.length-3} más →
          </button>
        )}
      </div>

      {order.notes && (
        <div style={{marginTop:8,fontSize:'0.72rem',color:'#92400E',fontWeight:700,background:'rgba(252,211,77,0.2)',padding:'6px 10px',borderRadius:10}}>
          📝 {order.notes}
        </div>
      )}

      {meta.next && (
        <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>onAdvance(order,meta.next)} disabled={advancing}
            style={{flex:1,padding:'11px 14px',borderRadius:14,border:'none',
              background:`linear-gradient(135deg,${meta.color},${meta.color}cc)`,
              color:'white',fontWeight:900,fontSize:'0.82rem',cursor:'pointer',
              fontFamily:"'Nunito',sans-serif",boxShadow:`0 4px 16px ${meta.color}44`,
              opacity:advancing?.5:1,transition:'transform .18s,opacity .18s'}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
            onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
            {advancing?'Actualizando…':meta.nextLabel}
          </button>
          {order.status==='pending' && (
            <button onClick={()=>onCancel(order)}
              style={{padding:'11px 14px',borderRadius:14,border:'1.5px solid #FECACA',background:'#FFF5F5',color:'#DC2626',fontWeight:800,fontSize:'0.78rem',cursor:'pointer',fontFamily:"'Nunito',sans-serif"}}>
              ✕
            </button>
          )}
        </div>
      )}
      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>
    </div>
  )
}

// ── AdminDashboardTab — Componente principal ──────────────────
export default function AdminDashboardTab({ orders: initialOrders, onOrderUpdate, storeId = 'default' }) {
  const [advancing, setAdv]   = useState(null)
  const [filter,    setFilter] = useState('active')
  const [searchQ,   setSearch] = useState('')
  const [showStar,  setShowStar] = useState(true)
  const [brand, setBrand] = useState(() => buildStoreBrandingSnapshot({}, null, storeId))

  // Realtime propio del dashboard — no depende del prop del padre
  const { orders, refresh } = useRealtimeOrders({ limit: 150, storeId })

  // Sincronizar hacia arriba para compatibilidad con Admin.jsx
  useEffect(() => { onOrderUpdate?.(orders) }, [orders, onOrderUpdate])
  useEffect(() => {
    loadMergedSettingsMap(storeId, supabase)
      .then(settingsMap => setBrand(buildStoreBrandingSnapshot(settingsMap, null, storeId)))
      .catch(() => setBrand(buildStoreBrandingSnapshot({}, null, storeId)))
  }, [storeId])

  async function advanceOrder(order, nextStatus) {
    setAdv(order.id)
    const { error } = await supabase.from('orders').update({ status:nextStatus }).eq('id', order.id).eq('store_id', storeId)
    if (error) { toast.error('Error al actualizar'); setAdv(null); return }
    const msg = buildAdminFallbackStatusMessageWithBrand(order, nextStatus, brand)
    if (msg && order.customer_phone) {
      const waResult = await sendWhatsAppRaw(order.customer_phone, msg)
      const ok = waResult.sent === true
      ok ? toast.success('WhatsApp enviado ✓') : toast(`Estado actualizado (WA no disponible)`,{icon:'⚠️'})
    } else {
      toast.success(`#${order.order_number} → ${STATUS_META[nextStatus]?.label}`)
    }
    setAdv(null)
  }

  async function cancelOrder(order) {
    if (!window.confirm(`¿Cancelar pedido #${order.order_number}?`)) return
    await supabase.from('orders').update({ status:'cancelled' }).eq('id', order.id).eq('store_id', storeId)
    toast.success('Pedido cancelado')
  }

  const activeCount  = orders.filter(o=>['pending','preparing','delivering'].includes(o.status)).length
  const pendingCount = orders.filter(o=>o.status==='pending').length

  const filtered = orders.filter(o => {
    const q = searchQ.toLowerCase()
    const matchQ = !q ||
      String(o.order_number).includes(q) ||
      (o.customer_name||'').toLowerCase().includes(q) ||
      (o.customer_phone||'').includes(q)
    if (!matchQ) return false
    if (filter==='active')    return ['pending','preparing','delivering'].includes(o.status)
    if (filter==='delivered') return o.status==='delivered'
    return true
  })

  const cols = ['pending','preparing','delivering']
  const byStatus = {}
  cols.forEach(s => { byStatus[s] = filtered.filter(o=>o.status===s) })

  return (
    <div style={{fontFamily:"'Nunito',sans-serif"}}>
      {/* Indicador Realtime */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <span style={{fontSize:'.68rem',fontWeight:900,color:'#4ADE80',
          background:'rgba(74,222,128,.1)',border:'1px solid rgba(74,222,128,.25)',
          padding:'3px 10px',borderRadius:20}}>
          ⚡ Dashboard en tiempo real
        </span>
        <button onClick={refresh} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.8rem',color:'#9CA3AF',fontWeight:700}}>↻ Actualizar</button>
      </div>

      <DayKPIs orders={orders} />

      {showStar && <StarProducts orders={orders} />}

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4}}>
          {[
            {id:'active',    label:`⚡ Activos (${activeCount})`},
            {id:'delivered', label:'✅ Entregados'},
            {id:'all',       label:'📋 Todos'},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:'7px 14px',borderRadius:50,border:'none',cursor:'pointer',
              fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:'0.76rem',
              background:filter===f.id?'#2D6A4F':'#F3F4F6',
              color:filter===f.id?'white':'#374151',transition:'all .18s',
              boxShadow:filter===f.id?'0 3px 12px rgba(45,106,79,.3)':'none',
            }}>{f.label}</button>
          ))}
        </div>
        <input placeholder="🔍 Buscar pedido, cliente…" value={searchQ}
          onChange={e=>setSearch(e.target.value)}
          style={{flex:1,minWidth:160,padding:'8px 14px',borderRadius:50,border:'1.5px solid #E5E7EB',
            background:'white',fontFamily:"'Nunito',sans-serif",fontWeight:600,fontSize:'0.82rem',outline:'none'}}/>
      </div>

      {/* Kanban activos / Lista entregados */}
      {filter==='active' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:16,alignItems:'start'}}>
          {cols.map(status=>{
            const colMeta   = STATUS_META[status]
            const colOrders = byStatus[status]
            return (
              <div key={status} style={{
                background:'rgba(255,255,255,0.7)',backdropFilter:'blur(12px)',
                border:`1.5px solid ${colMeta.border}`,borderRadius:22,padding:'14px',minHeight:120,
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  marginBottom:14,paddingBottom:10,borderBottom:`2px solid ${colMeta.border}`}}>
                  <span style={{fontWeight:900,fontSize:'0.85rem',color:colMeta.color}}>{colMeta.label}</span>
                  <span style={{background:`${colMeta.color}22`,color:colMeta.color,
                    borderRadius:50,padding:'2px 10px',fontWeight:900,fontSize:'0.75rem'}}>
                    {colOrders.length}
                  </span>
                </div>
                {colOrders.length===0 ? (
                  <div style={{textAlign:'center',padding:'20px 10px',color:'#D1D5DB',fontSize:'0.78rem',fontWeight:700}}>
                    Sin pedidos aquí ✓
                  </div>
                ) : colOrders.map(o=>(
                  <OrderCard key={o.id} order={o}
                    onAdvance={advanceOrder} onCancel={cancelOrder}
                    advancing={advancing===o.id}/>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'#9CA3AF',fontWeight:700}}>
              No hay pedidos en este filtro
            </div>
          ) : filtered.map(o=>(
            <OrderCard key={o.id} order={o}
              onAdvance={advanceOrder} onCancel={cancelOrder}
              advancing={advancing===o.id}/>
          ))}
        </div>
      )}
    </div>
  )
}

