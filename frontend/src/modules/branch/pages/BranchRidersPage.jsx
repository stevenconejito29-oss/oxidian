/**
 * BranchRidersPage.jsx — Vista de Repartidores
 * Diseño optimizado para uso en móvil. Pedidos con dirección prominente,
 * botones grandes, enlace a Google Maps, teléfono clickeable.
 */
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useRealtimeOrders } from '../../../legacy/lib/useRealtimeOrders'
import { useResolvedStoreId } from '../../../shared/hooks/useResolvedStoreId'
import { buildOrderStatusUpdate } from '../../../legacy/lib/orderStatusUpdate'
import { timeAgo } from '../../../legacy/lib/orderUtils'
import { OrderTimer, Btn, Spinner, Empty } from '../../../shared/ui/OxidianDS'

const COL = [
  { id:'ready',      label:'📦 Listos',     color:'#22c55e', bg:'#dcfce7', next:'delivering', nextLabel:'🛵 Recoger'   },
  { id:'delivering', label:'🛵 En camino',  color:'#8b5cf6', bg:'#ede9fe', next:'delivered',  nextLabel:'✅ Entregado' },
]

function DeliveryCard({ order, onAdvance, busy }) {
  const col      = COL.find(c => c.id === order.status) || COL[0]
  const address  = order.delivery_address || order.address || ''
  const phone    = order.customer_phone || ''
  const mapsUrl  = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  return (
    <div style={{
      background:'var(--color-background-primary)',
      border:`2px solid ${col.color}50`,
      borderRadius:14,
      boxShadow:'0 2px 12px rgba(0,0,0,.08)',
      overflow:'hidden',
    }}>
      {/* Accent bar */}
      <div style={{ height:4, background:col.color }} />

      <div style={{ padding:16 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:22, letterSpacing:'-1px' }}>
              #{order.order_number || order.id.slice(-4).toUpperCase()}
            </div>
            <div style={{ fontSize:14, color:'var(--color-text-secondary)', marginTop:2 }}>
              {order.customer_name || 'Cliente'}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            <span style={{
              fontSize:18, fontWeight:800, color:col.color,
            }}>€{Number(order.total||0).toFixed(2)}</span>
            <OrderTimer createdAt={order.created_at} />
          </div>
        </div>

        {/* Dirección — PROMINENTE */}
        {address ? (
          <a
            href={mapsUrl} target="_blank" rel="noreferrer"
            style={{
              display:'block', padding:'12px 14px', borderRadius:10, marginBottom:12,
              background:'#eff6ff', border:'1px solid #bfdbfe',
              color:'#1e40af', textDecoration:'none', fontWeight:600, fontSize:14,
              lineHeight:1.4,
            }}
          >
            📍 {address}
            <span style={{ display:'block', fontSize:11, fontWeight:400, color:'#3b82f6', marginTop:3 }}>
              Abrir en Google Maps →
            </span>
          </a>
        ) : (
          <div style={{
            padding:'10px 12px', borderRadius:8, marginBottom:12,
            background:'#fef9c3', border:'1px solid #fde047',
            color:'#713f12', fontSize:13,
          }}>⚠️ Sin dirección registrada</div>
        )}

        {/* Teléfono */}
        {phone && (
          <a href={`tel:${phone}`} style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
            borderRadius:8, marginBottom:12, background:'#f0fdf4',
            border:'1px solid #86efac', color:'#14532d',
            textDecoration:'none', fontWeight:600, fontSize:14,
          }}>
            📞 {phone}
          </a>
        )}

        {/* Notas */}
        {order.notes && (
          <div style={{
            padding:'8px 12px', borderRadius:8, marginBottom:12,
            background:'#fff7ed', border:'1px solid #fed7aa',
            color:'#9a3412', fontSize:13,
          }}>📋 {order.notes}</div>
        )}

        {/* Resumen ítems */}
        {(() => {
          let items = []
          try { items = typeof order.items==='string' ? JSON.parse(order.items) : (order.items||[]) } catch {}
          return items.length > 0 ? (
            <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:12, lineHeight:1.6 }}>
              {items.slice(0,3).map((it,i) => (
                <span key={i}>{it.qty||1}× {it.product_name||it.name}{i<Math.min(items.length,3)-1?', ':''}</span>
              ))}
              {items.length>3 && ` +${items.length-3} más`}
            </div>
          ) : null
        })()}

        {/* Acción */}
        {col.next && (
          <Btn
            full size="lg" variant={col.id==='ready'?'purple':'success'}
            disabled={busy===order.id}
            onClick={() => onAdvance(order, col.next)}
          >
            {busy===order.id ? '⏳ Actualizando…' : col.nextLabel}
          </Btn>
        )}
      </div>
    </div>
  )
}

export default function BranchRidersPage() {
  const [params]  = useSearchParams()
  const storeId   = useResolvedStoreId()
  const branchId  = params.get('branch_id') || params.get('branch') || null
  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['ready','delivering'], storeId, branchId,
  })
  const [busy,  setBusy]  = React.useState(null)
  const [error, setError] = React.useState('')
  const [view,  setView]  = React.useState('all') // 'all' | 'ready' | 'delivering'

  async function handleAdvance(order, nextStatus) {
    setBusy(order.id); setError('')
    try {
      const patch = buildOrderStatusUpdate(order, nextStatus)
      const { error: e } = await supabaseAuth.from('orders').update(patch).eq('id', order.id)
      if (e) throw e
      await refresh()
    } catch (e) { setError(e?.message||'Error al actualizar') }
    setBusy(null)
  }

  const ready     = orders.filter(o=>o.status==='ready')
  const delivering= orders.filter(o=>o.status==='delivering')
  const visible   = view==='ready' ? ready : view==='delivering' ? delivering : orders

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--color-background-secondary)',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Topbar */}
      <div style={{
        background:'var(--color-background-primary)',
        borderBottom:'1px solid var(--color-border-tertiary)',
        padding:'12px 16px', position:'sticky', top:0, zIndex:10,
        boxShadow:'0 2px 8px rgba(0,0,0,.06)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18 }}>🛵 Repartidores</div>
            <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{storeId}</div>
          </div>
          <button onClick={refresh} style={{
            padding:'8px 12px',borderRadius:8,
            border:'1px solid var(--color-border-secondary)',
            background:'transparent',cursor:'pointer',fontSize:16,
          }}>↻</button>
        </div>

        {/* Filtros + contadores */}
        <div style={{ display:'flex', gap:6 }}>
          {[
            { id:'all',       label:`Todos (${orders.length})`,     color:'#64748b' },
            { id:'ready',     label:`📦 Listos (${ready.length})`,     color:'#22c55e' },
            { id:'delivering',label:`🛵 En ruta (${delivering.length})`,color:'#8b5cf6' },
          ].map(f => (
            <button key={f.id} onClick={()=>setView(f.id)} style={{
              padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit',
              border:`1px solid ${view===f.id?f.color:'var(--color-border-secondary)'}`,
              background: view===f.id?`${f.color}15`:'transparent',
              color: view===f.id?f.color:'var(--color-text-secondary)',
              fontWeight: view===f.id?700:400,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{background:'#dc2626',color:'#fff',padding:'10px 16px',fontSize:13}}>
          ⚠️ {error}
        </div>
      )}

      {/* Content */}
      <div style={{ padding:12, maxWidth:600, margin:'0 auto' }}>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}>
            <Spinner size={32} />
          </div>
        ) : !visible.length ? (
          <div style={{
            textAlign:'center', padding:'4rem 1rem',
            color:'var(--color-text-secondary)',
          }}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Todo despachado</div>
            <div style={{fontSize:13}}>No hay pedidos activos en este momento</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Listos primero */}
            {(view==='all'||view==='ready') && ready.map(o => (
              <DeliveryCard key={o.id} order={o} onAdvance={handleAdvance} busy={busy} />
            ))}
            {/* En camino */}
            {(view==='all'||view==='delivering') && delivering.map(o => (
              <DeliveryCard key={o.id} order={o} onAdvance={handleAdvance} busy={busy} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
