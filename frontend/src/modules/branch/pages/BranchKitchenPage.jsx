/**
 * BranchKitchenPage.jsx — Vista de Cocina / Preparación
 * Diseño optimizado para pantallas de cocina: alto contraste,
 * botones grandes, kanban de 3 columnas, timer por pedido.
 */
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useRealtimeOrders } from '../../../legacy/lib/useRealtimeOrders'
import { useResolvedStoreId } from '../../../shared/hooks/useResolvedStoreId'
import { buildOrderStatusUpdate } from '../../../legacy/lib/orderStatusUpdate'
import { timeAgo } from '../../../legacy/lib/orderUtils'
import { OrderTimer, StatusBadge, Btn, Empty, Spinner } from '../../../shared/ui/OxidianDS'

function parseItems(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || []) } catch { return [] }
}

const COL = [
  { id:'pending',   label:'🟡 Pendientes',  color:'#ca8a04', bg:'#fef9c3', next:'preparing', nextLabel:'▶ Iniciar' },
  { id:'preparing', label:'🔵 Preparando',  color:'#2563eb', bg:'#dbeafe', next:'ready',     nextLabel:'✓ Listo'   },
  { id:'ready',     label:'🟢 Listos',      color:'#16a34a', bg:'#dcfce7', next:null,         nextLabel:null        },
]

function Ticket({ order, onAdvance, busy }) {
  const items = parseItems(order.items)
  const col   = COL.find(c => c.id === order.status) || COL[0]

  return (
    <div style={{
      background:'var(--color-background-primary)',
      border:`2px solid ${col.color}40`,
      borderRadius:12, padding:14,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)',
      transition:'.2s',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.5px' }}>
            #{order.order_number || order.id.slice(-4).toUpperCase()}
          </div>
          <div style={{ fontSize:13, color:'var(--color-text-secondary)', marginTop:2 }}>
            {order.customer_name || 'Cliente'}
          </div>
        </div>
        <OrderTimer createdAt={order.created_at} />
      </div>

      {/* Items */}
      <div style={{ borderTop:'1px solid var(--color-border-tertiary)', paddingTop:10, marginBottom:10 }}>
        {items.length === 0
          ? <div style={{fontSize:12,color:'var(--color-text-secondary)',fontStyle:'italic'}}>Sin detalle de ítems</div>
          : items.slice(0,6).map((item, i) => (
            <div key={i} style={{
              display:'flex', gap:8, alignItems:'flex-start',
              padding:'4px 0', borderBottom:'1px solid var(--color-border-tertiary)',
            }}>
              <span style={{
                fontWeight:800, fontSize:16, minWidth:28, height:28,
                background:`${col.color}15`, color:col.color,
                display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:6, flexShrink:0,
              }}>{item.qty||item.quantity||1}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{item.product_name||item.name||'Producto'}</div>
                {item.notes && <div style={{fontSize:12,color:'#dc2626',fontStyle:'italic'}}>⚠ {item.notes}</div>}
                {item.toppings?.length > 0 && (
                  <div style={{fontSize:11,color:'var(--color-text-secondary)'}}>
                    + {item.toppings.map(tp=>tp.name||tp).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))
        }
        {items.length > 6 && (
          <div style={{fontSize:12,color:'var(--color-text-secondary)',padding:'4px 0'}}>
            +{items.length-6} ítems más
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{timeAgo(order.created_at)}</div>
        {col.next && (
          <Btn
            size="md" variant={col.id==='pending'?'blue':'success'}
            disabled={busy===order.id}
            onClick={() => onAdvance(order, col.next)}
            sx={{ fontSize:14, fontWeight:700 }}
          >
            {busy===order.id ? '⏳' : col.nextLabel}
          </Btn>
        )}
      </div>

      {order.notes && (
        <div style={{
          marginTop:10, padding:'6px 10px', borderRadius:8,
          background:'#fff7ed', color:'#9a3412', fontSize:12,
          border:'1px solid #fed7aa',
        }}>📋 {order.notes}</div>
      )}
    </div>
  )
}

export default function BranchKitchenPage() {
  const [params]  = useSearchParams()
  const storeId   = useResolvedStoreId()
  const branchId  = params.get('branch_id') || params.get('branch') || null
  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['pending','preparing','ready'], storeId, branchId,
  })
  const [busy,    setBusy]    = React.useState(null)
  const [error,   setError]   = React.useState('')
  const [sound,   setSound]   = React.useState(true)
  const prevCount = React.useRef(0)

  // Sonido de nueva orden
  React.useEffect(() => {
    const pending = orders.filter(o=>o.status==='pending').length
    if (sound && pending > prevCount.current) {
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA...').play().catch(()=>{}) } catch {}
    }
    prevCount.current = pending
  }, [orders, sound])

  async function handleAdvance(order, nextStatus) {
    setBusy(order.id); setError('')
    try {
      const patch = buildOrderStatusUpdate(order, nextStatus)
      const { error: e } = await supabaseAuth.from('orders').update(patch).eq('id', order.id).eq('store_id', order.store_id)
      if (e) throw e
      await refresh()
    } catch (e) { setError(e?.message||'Error al actualizar') }
    setBusy(null)
  }

  const byStatus = {
    pending:   orders.filter(o=>o.status==='pending'),
    preparing: orders.filter(o=>o.status==='preparing'),
    ready:     orders.filter(o=>o.status==='ready'),
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#0f172a',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Topbar */}
      <div style={{
        background:'#1e293b', padding:'12px 20px',
        display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
        borderBottom:'1px solid #334155',
      }}>
        <div style={{flex:1}}>
          <div style={{color:'#f1f5f9',fontWeight:800,fontSize:18}}>🍳 Cocina</div>
          <div style={{color:'#64748b',fontSize:12,marginTop:2}}>{storeId} · Tiempo real</div>
        </div>

        {/* Contadores */}
        {COL.map(col => (
          <div key={col.id} style={{
            padding:'8px 16px', borderRadius:10,
            background:`${col.color}20`, border:`1px solid ${col.color}40`,
          }}>
            <div style={{fontSize:24,fontWeight:800,color:col.color}}>{byStatus[col.id].length}</div>
            <div style={{fontSize:11,color:col.color}}>{col.label.split(' ')[1]}</div>
          </div>
        ))}

        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setSound(s=>!s)} style={{
            padding:'8px 12px',borderRadius:8,border:'1px solid #334155',
            background:'#1e293b',color:sound?'#22c55e':'#64748b',cursor:'pointer',fontSize:18,
          }}>{sound?'🔔':'🔕'}</button>
          <button onClick={refresh} style={{
            padding:'8px 12px',borderRadius:8,border:'1px solid #334155',
            background:'#1e293b',color:'#94a3b8',cursor:'pointer',fontSize:18,
          }}>↻</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{background:'#dc2626',color:'#fff',padding:'10px 20px',fontSize:13}}>
          ⚠️ {error}
        </div>
      )}

      {/* Kanban */}
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}>
          <Spinner size={40} />
        </div>
      ) : (
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',
          gap:0, height:'calc(100vh - 80px)',
        }}>
          {COL.map(col => (
            <div key={col.id} style={{
              borderRight:'1px solid #334155',
              display:'flex', flexDirection:'column',
              overflow:'hidden',
            }}>
              {/* Column header */}
              <div style={{
                padding:'14px 16px', background:'#1e293b',
                borderBottom:'2px solid '+col.color,
                display:'flex', justifyContent:'space-between', alignItems:'center',
                flexShrink:0,
              }}>
                <span style={{color:'#f1f5f9',fontWeight:700,fontSize:15}}>{col.label}</span>
                <span style={{
                  fontSize:18,fontWeight:800,
                  background:`${col.color}20`,color:col.color,
                  width:36,height:36,borderRadius:9,
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>{byStatus[col.id].length}</span>
              </div>

              {/* Tickets */}
              <div style={{
                flex:1, overflowY:'auto', padding:12,
                display:'flex', flexDirection:'column', gap:10,
                background:'#0f172a',
              }}>
                {!byStatus[col.id].length
                  ? <div style={{textAlign:'center',padding:'3rem 1rem',color:'#334155'}}>
                      <div style={{fontSize:40,marginBottom:8}}>✓</div>
                      <div style={{fontSize:13}}>Sin pedidos</div>
                    </div>
                  : byStatus[col.id].map(order => (
                    <Ticket key={order.id} order={order} onAdvance={handleAdvance} busy={busy} />
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
