// RepartidorContent.jsx — CarmoCream Repartidor v5 — Móvil vertical
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import styles from './Repartidor.module.css'
import { supabase } from '../lib/supabase'
import { useRealtimeOrders } from '../lib/useRealtimeOrders'
import { useNotifPermission } from '../lib/useNotifications'
import { runAutoAssign } from '../lib/autoAssign'
import { fetchPriorityLevelIds, getFallbackPriorityLevelIds, isPriorityClubOrder, sortOrdersByClubPriority } from '../lib/orderPriority'
import { normalizeToppings, timeAgo } from '../lib/orderUtils'
import {
  buildRiderCashCloseNotes,
  parseRiderCashCloseNotes,
} from '../lib/riderCash'
import { useSettings } from '../lib/useSettings'
import { setStaffOnlineState } from '../lib/staffPresence'
import { usePWAInstall } from '../lib/usePWAInstall'
import toast from 'react-hot-toast'

// ─── helpers ───────────────────────────────────────────────
function genCode() { return String(Math.floor(1000 + Math.random() * 9000)) }
function nowIso() { return new Date().toISOString() }
function buildDeliveringPatch(order, extra = {}) {
  return {
    status: 'delivering',
    ready_at: order?.ready_at || nowIso(),
    picked_at: order?.picked_at || nowIso(),
    review_requested_at: null,
    ...extra,
  }
}
function buildDeliveredPatch(order, extra = {}) {
  return {
    status: 'delivered',
    ready_at: order?.ready_at || nowIso(),
    picked_at: order?.picked_at || nowIso(),
    arrived_at: order?.arrived_at || nowIso(),
    delivered_at: nowIso(),
    review_requested_at: null,
    ...extra,
  }
}
function mapsUrl(addr) {
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr + ', Carmona, Sevilla')}&travelmode=driving`
}
function waUrl(order, businessName) {
  if (!order?.customer_phone) return null
  const d = order.customer_phone.replace(/\D/g, '').replace(/^34/, '')
  const name = businessName || 'tu tienda'
  return `https://wa.me/34${d}?text=${encodeURIComponent(`Hola ${order.customer_name}, soy el repartidor de ${name}. Tu pedido #${order.order_number} esta en camino.`)}`
}

function needsRiderAssignment(order) {
  return order?.status === 'ready' && !order?.assigned_rider_id
}

function euro(value) {
  return String.fromCharCode(8364) + Number(value || 0).toFixed(2)
}

function sameDeliveryCode(left, right) {
  return String(left || '').replace(/\D/g, '') === String(right || '').replace(/\D/g, '')
}

function isMissingSchemaObject(error) {
  return /does not exist|Could not find the table|schema cache/i.test(String(error?.message || error?.details || ''))
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── MODAL CÓDIGO ───────────────────────────────────────────
function CodeModal({ order, code, onVerify, onCancel }) {
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)

  function verify() {
    if (input === code) { onVerify(input); return }
    setShake(true); setTimeout(() => setShake(false), 500); setInput('')
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.codeSheet}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:'2.4rem', marginBottom:6 }}>COD</div>
          <div style={{ color:'white', fontWeight:900, fontSize:'1.1rem' }}>Verificar entrega</div>
          <div style={{ color:'rgba(255,255,255,.55)', fontSize:'.8rem', marginTop:4 }}>
            #{order.order_number} - {order.customer_name}
          </div>
          <div style={{ color:'rgba(255,255,255,.4)', fontSize:'.74rem', marginTop:4 }}>El cliente tiene el codigo en WhatsApp</div>
        </div>

        <div style={{ animation: shake ? 'shake .45s ease' : 'none', marginBottom:14 }}>
          <input type="number" inputMode="numeric" maxLength={4} value={input}
            onChange={e => setInput(e.target.value.slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && input.length === 4 && verify()}
            placeholder="0000"
            style={{ width:'100%', boxSizing:'border-box', height:68, borderRadius:16, border:'1.5px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.09)', color:'white', textAlign:'center', fontSize:'2rem', fontWeight:900, letterSpacing:'.3em', outline:'none', fontFamily:'inherit', caretColor:'transparent' }}
            readOnly />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:14 }}>
          {['1','2','3','4','5','6','7','8','9','','0','<'].map((k, i) => (
            <button key={i} onClick={() => { if (k === '<') setInput(p => p.slice(0, -1)); else if (k && input.length < 4) setInput(p => p + k) }}
              style={{ minHeight:52, borderRadius:12, border:'none', cursor: k?'pointer':'default', background: k === '<' ? 'rgba(220,38,38,.22)' : k ? 'rgba(255,255,255,.09)' : 'transparent', color: k ? 'white' : 'transparent', fontSize: k === '<' ? '1rem' : '1.15rem', fontWeight:900, fontFamily:'inherit' }}>
              {k}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onCancel} style={{ flex:1, minHeight:48, borderRadius:13, border:'1.5px solid rgba(255,255,255,.15)', background:'transparent', color:'rgba(255,255,255,.65)', fontWeight:800, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
          <button onClick={verify} disabled={input.length !== 4}
            style={{ flex:2, minHeight:48, borderRadius:13, border:'none', fontWeight:900, fontFamily:'inherit', cursor: input.length===4?'pointer':'not-allowed', background: input.length===4?'linear-gradient(135deg,#059669,#10b981)':'rgba(255,255,255,.08)', color: input.length===4?'white':'rgba(255,255,255,.3)', transition:'all .2s' }}>Verificar codigo</button>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────
export default function RepartidorContent({ session, onLogout }) {
  const storeId = session?.store_id || 'default'
  const [isOnline,    setIsOnline]    = useState(false)
  const [codeModal,   setCodeModal]   = useState(null)  // { order, code }
  const [showMenu,    setShowMenu]    = useState(false)
  const [sendingCode, setSendingCode] = useState(null)
  const [showDetail,  setShowDetail]  = useState(null)  // orderId para ver items
  const [confirming,  setConfirming]  = useState(null)  // orderId confirmacion manual
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [cashClosures, setCashClosures] = useState([])
  const [cashLoading, setCashLoading] = useState(false)
  const [closingCash, setClosingCash] = useState(false)
  const [priorityLevelIds, setPriorityLevelIds] = useState(getFallbackPriorityLevelIds)
  const autoAssignRef = useRef({ running: false, queued: false })

  useNotifPermission()
  const { settings } = useSettings()
  const { showButton, showIOSHint, setShowIOSHint, install, getButtonLabel } = usePWAInstall()

  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['ready', 'delivering'],
    riderId: session.id,
    storeId,
  })

  const triggerRiderAutoAssign = useCallback(async () => {
    if (!isOnline) return 0
    if (autoAssignRef.current.running) {
      autoAssignRef.current.queued = true
      return 0
    }

    autoAssignRef.current.running = true
    let assignedTotal = 0

    try {
      do {
        autoAssignRef.current.queued = false
        const assigned = await runAutoAssign({ role: 'repartidor', storeId })
        assignedTotal += assigned
        if (assigned > 0) await refresh()
      } while (autoAssignRef.current.queued)
    } finally {
      autoAssignRef.current.running = false
    }

    return assignedTotal
  }, [isOnline, refresh, storeId])

  async function loadCashStatus() {
    setCashLoading(true)
    const [{ data: deliveredData, error: deliveredError }, { data: entryData, error: entryError }] = await Promise.all([
      supabase
        .from('orders')
        .select('id,order_number,total,delivery_fee,delivered_at,status,assigned_rider_id,assigned_rider_name')
        .eq('store_id', storeId)
        .eq('assigned_rider_id', session.id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .limit(200),
      supabase
        .from('cash_entries')
        .select('id,date,type,amount,concept,notes,created_at')
        .eq('store_id', storeId)
        .in('type', ['ingreso', 'retiro', 'gasto'])
        .eq('category', 'reparto')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (deliveredError) {
      toast.error(deliveredError.message)
    } else {
      setDeliveredOrders(Array.isArray(deliveredData) ? deliveredData : [])
    }

    if (entryError) {
      toast.error(entryError.message)
    } else {
      const entries = Array.isArray(entryData) ? entryData : []
      const parsedClosures = entries
        .map(entry => ({ ...entry, closure: parseRiderCashCloseNotes(entry.notes) }))
        .filter(entry => entry.closure?.rider_id === session.id)
      setCashClosures(parsedClosures)
    }

    setCashLoading(false)
  }
  useEffect(() => {
    supabase.from('staff_users').select('is_online').eq('id', session.id).maybeSingle()
      .then(({ data }) => { if (data != null) setIsOnline(data.is_online === true) })
    loadCashStatus()
  }, [session.id, storeId])

  useEffect(() => {
    fetchPriorityLevelIds({ storeId }).then(setPriorityLevelIds).catch(() => {})
  }, [storeId])

  useEffect(() => {
    if (!isOnline) return undefined

    triggerRiderAutoAssign().catch(() => {})

    const channel = supabase
      .channel(`rider-autoassign-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        if (payload.new?.store_id === storeId && needsRiderAssignment(payload.new)) triggerRiderAutoAssign().catch(() => {})
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        if (payload.new?.store_id === storeId && needsRiderAssignment(payload.new)) triggerRiderAutoAssign().catch(() => {})
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, session.id, triggerRiderAutoAssign, storeId])

  async function toggleOnline() {
    const next = !isOnline
    setIsOnline(next)
    await setStaffOnlineState(session.id, next, session.store_id)
    if (next) {
      toast('Online', { style: { background: '#166534', color: 'white' } })
      const n = await runAutoAssign({ role: 'repartidor', storeId })
      if (n > 0) await refresh()
      if (n > 0) toast.success(`${n} pedido${n > 1 ? 's' : ''} asignado${n > 1 ? 's' : ''}`)
      if (n === 0) {
        toast('Sin pedidos listos pendientes ahora mismo.', {
          style: { background: '#1F2937', color: 'white' },
        })
      }
    } else {
      toast('Offline', { style: { background: '#991B1B', color: 'white' } })
    }
  }

  async function pickUp(order) {
    const { error } = await supabase
      .from('orders')
      .update(buildDeliveringPatch(order))
      .eq('id', order.id)
      .eq('store_id', storeId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`#${order.order_number} recogido -> en camino`)
    await triggerRiderAutoAssign()
  }

  async function markArrived(order) {
    setSendingCode(order.id)
    const code = genCode()
    const { error } = await supabase
      .from('orders')
      .update(buildDeliveringPatch(order, { delivery_code: code, arrived_at: nowIso() }))
      .eq('id', order.id)
      .eq('store_id', storeId)

    if (error) {
      setSendingCode(null)
      toast.error(error.message)
      return
    }

    const { error: notificationResetError } = await supabase
      .from('chatbot_notifications')
      .delete()
      .eq('order_id', order.id)
      .eq('notification_type', 'delivery_code')

    if (notificationResetError && !isMissingSchemaObject(notificationResetError)) {
      setSendingCode(null)
      toast.error(notificationResetError.message)
      return
    }

    setSendingCode(null)
    setCodeModal({ order: { ...order, delivery_code: code }, code })
    await refresh()
    toast.success('Codigo guardado. El bot lo enviara por WhatsApp.')
  }

  async function verifyAndDeliver(inputCode) {
    if (!codeModal) return
    const { order } = codeModal
    const { data: latestOrder, error: latestOrderError } = await supabase
      .from('orders')
      .select('id,order_number,delivery_code')
      .eq('id', order.id)
      .eq('store_id', storeId)
      .maybeSingle()

    if (latestOrderError) {
      toast.error(latestOrderError.message)
      return
    }

    const persistedCode = latestOrder?.delivery_code || order.delivery_code || codeModal.code
    if (!sameDeliveryCode(inputCode, persistedCode)) {
      toast.error('El codigo no coincide con el ultimo enviado al cliente.')
      return
    }

    const { error } = await supabase
      .from('orders')
      .update(buildDeliveredPatch({ ...order, delivery_code: persistedCode }))
      .eq('id', order.id)
      .eq('store_id', storeId)

    if (error) {
      toast.error(error.message)
      return
    }

    setCodeModal(null)
    await triggerRiderAutoAssign()
    await refreshAll()
    toast.success(`#${order.order_number} OK entregado. El bot enviara cierre y reseña.`)
  }

  async function manualDeliver(order) {
    const { error } = await supabase
      .from('orders')
      .update(buildDeliveredPatch(order))
      .eq('id', order.id)
      .eq('store_id', storeId)
    if (error) {
      toast.error(error.message)
      return
    }
    setConfirming(null)
    await triggerRiderAutoAssign()
    await refreshAll()
    toast.success(`#${order.order_number} OK entregado. El bot enviara cierre y reseña.`)
  }

  function addr(order) { return order.delivery_address || order.address || '' }

  async function refreshAll() {
    await Promise.all([refresh(), loadCashStatus()])
  }

  const delivering = useMemo(
    () => sortOrdersByClubPriority(orders.filter(o => o.status === 'delivering'), priorityLevelIds),
    [orders, priorityLevelIds]
  )
  const ready = useMemo(
    () => sortOrdersByClubPriority(orders.filter(o => o.status === 'ready'), priorityLevelIds),
    [orders, priorityLevelIds]
  )
  const allOrders  = [...delivering, ...ready]
  const mission    = allOrders[0] || null   // el pedido mas urgente siempre al frente
  const missionPriority = mission ? isPriorityClubOrder(mission, priorityLevelIds) : false
  const missionAddr = mission ? addr(mission) : ''
  const closedOrderIds = new Set(cashClosures.flatMap(entry => Array.isArray(entry.closure?.order_ids) ? entry.closure.order_ids : []))
  const pendingDeliveredOrders = deliveredOrders.filter(order => !closedOrderIds.has(order.id))
  const pendingCash = pendingDeliveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const todayDeliveredCount = deliveredOrders.filter(order => String(order.delivered_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const lastClosure = cashClosures[0] || null
  const riderCloseNote = String(settings.rider_close_note || '').trim()
  const dispatchNoteText = cashLoading
    ? 'Sincronizando estado del reparto...'
    : pendingDeliveredOrders.length > 0
      ? `${pendingDeliveredOrders.length} entrega${pendingDeliveredOrders.length === 1 ? '' : 's'} cobrada${pendingDeliveredOrders.length === 1 ? '' : 's'} enviada${pendingDeliveredOrders.length === 1 ? '' : 's'} a revisión de admin.${riderCloseNote ? ` ${riderCloseNote}` : ''}`
      : riderCloseNote || 'Sin entregas cobradas pendientes de revisión.'

  async function closeCashShift() {
    if (pendingCash <= 0 || pendingDeliveredOrders.length === 0) {
      toast('No hay efectivo pendiente para cerrar', { style: { background: '#1F2937', color: 'white' } })
      return
    }

    setClosingCash(true)
    const payload = {
      rider_id: session.id,
      rider_name: session.name,
      closed_at: new Date().toISOString(),
      admin_confirmed_at: null,
      admin_confirmed_by: null,
      delivered_count: pendingDeliveredOrders.length,
      delivered_total: Number(pendingCash.toFixed(2)),
      order_ids: pendingDeliveredOrders.map(order => order.id),
      order_numbers: pendingDeliveredOrders.map(order => order.order_number).filter(Boolean),
    }

    const { error } = await supabase.from('cash_entries').insert({
      date: new Date().toISOString().slice(0, 10),
      store_id: storeId,
      type: 'ingreso',
      concept: 'Liquidacion repartidor ' + session.name,
      amount: Number(pendingCash.toFixed(2)),
      category: 'reparto',
      notes: buildRiderCashCloseNotes(payload),
    })

    setClosingCash(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Caja entregada por ' + euro(pendingCash))
    await loadCashStatus()
  }
  return (
    <div className={styles.page}>
      {codeModal && <CodeModal order={codeModal.order} code={codeModal.code} onVerify={verifyAndDeliver} onCancel={() => setCodeModal(null)} />}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Header */}
      <div className={styles.bar}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative', width:40, height:40, borderRadius:13, background:'rgba(255,255,255,.12)', border:'1.5px solid rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem' }}>
            {session.avatar_emoji || 'R'}
            <span style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background: isOnline ? '#4ADE80' : '#F87171', border:'2px solid #1a3828' }} />
          </div>
          <div>
            <div style={R.barTitle}>{session.name}</div>
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={toggleOnline} style={{ ...R.iconBtn, width:'auto', padding:'0 12px', background: isOnline ? 'rgba(74,222,128,.2)' : 'rgba(248,113,113,.2)', borderColor: isOnline ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.3)' }}>
            {isOnline ? 'Online' : 'Offline'}
          </button>
          <button onClick={refreshAll} style={R.iconBtn}>{'\u21BB'}</button>
          <button onClick={() => setShowMenu(true)} style={R.iconBtn}>☰</button>
        </div>
      </div>

      {!isOnline && (
        <div className={styles.offlineBanner} onClick={toggleOnline}>Repartidor offline. Toca para volver a entrar al reparto.</div>
      )}

      {/* Resumen */}
      <div className={styles.summary}>
        <div className={styles.kpi}><span className={styles.kpiVal}>{ready.length}</span><span className={styles.kpiLbl}>Recoger</span></div>
        <div className={styles.kpi}><span className={styles.kpiVal}>{delivering.length}</span><span className={styles.kpiLbl}>En ruta</span></div>
        <div className={styles.kpi}><span className={styles.kpiVal} style={{color:'#FCD34D'}}>{pendingDeliveredOrders.length}</span><span className={styles.kpiLbl}>Pend. admin</span></div>
        <div className={styles.kpi}><span className={styles.kpiVal} style={{color:'#FCD34D'}}>{todayDeliveredCount}</span><span className={styles.kpiLbl}>Entregados</span></div>
      </div>
      <div className={styles.dispatchNote}>{dispatchNoteText}</div>

      {showMenu && (
        <div className={styles.menuOverlay} onClick={event => event.target === event.currentTarget && setShowMenu(false)}>
          <div className={styles.menuSheet}>
            <div className={styles.menuHead}>
              <div>
                <div className={styles.menuTitle}>Menú de reparto</div>
                <div className={styles.menuSub}>Acciones rápidas sin mostrar caja ni pagos al rider.</div>
              </div>
              <button onClick={() => setShowMenu(false)} className={styles.menuCloseBtn}>✕</button>
            </div>

            <div className={styles.menuStats}>
              <div className={styles.menuStat}>
                <span className={styles.menuStatLabel}>Pendientes admin</span>
                <strong className={styles.menuStatValue}>{pendingDeliveredOrders.length}</strong>
              </div>
              <div className={styles.menuStat}>
                <span className={styles.menuStatLabel}>Último cierre</span>
                <strong className={styles.menuStatValue}>{lastClosure?.closure?.admin_confirmed_at ? 'Validado' : lastClosure ? 'Pendiente' : 'Sin cierre'}</strong>
              </div>
            </div>

            <div className={styles.menuActions}>
              {showButton && <button onClick={install} className={styles.menuPrimaryBtn}>📲 {getButtonLabel()}</button>}
              <button onClick={closeCashShift} disabled={closingCash || pendingCash <= 0} className={styles.menuPrimaryBtn}>
                {closingCash ? 'Enviando...' : 'Entregas cobradas para revisión'}
              </button>
              <button onClick={toggleOnline} className={styles.menuGhostBtn}>{isOnline ? 'Poner offline' : 'Poner online'}</button>
              <button onClick={refreshAll} className={styles.menuGhostBtn}>Actualizar reparto</button>
              <button onClick={onLogout} className={styles.menuDangerBtn}>Cerrar sesión</button>
            </div>

            {showIOSHint && (
              <div className={styles.menuHint}>
                En Safari: toca Compartir → Añadir a pantalla de inicio.
                <button onClick={() => setShowIOSHint(false)} className={styles.menuHintBtn}>Cerrar</button>
              </div>
            )}

            <div className={styles.menuFoot}>
              {lastClosure
                ? `Último envío al admin: ${formatDateTime(lastClosure.created_at || lastClosure.date)} · ${lastClosure.closure?.admin_confirmed_at ? 'validado' : 'pendiente'}`
                : 'Aún no has enviado entregas cobradas al admin.'}
            </div>
          </div>
        </div>
      )}

      {!loading && allOrders.length === 0 && (
        <div style={R.empty}>
          <div style={{ fontSize:'3rem', opacity:.35 }}>{'\u2713'}</div>
          <div style={{ fontFamily:"'Pacifico',cursive", fontSize:'1.2rem', color:'#2D6A4F', marginTop:12 }}>Todo entregado</div>
          <div style={{ color:'#8AAF80', fontSize:'.82rem', marginTop:6 }}>Los pedidos listos aparecerán aquí</div>
          {!isOnline && <button onClick={toggleOnline} style={R.connectBtn}>Conectarme</button>}
        </div>
      )}

      {/* Mision activa */}
      {mission && (
        <div className={styles.missionCard}>
          {missionPriority && (
            <div style={R.priorityBanner}>Prioridad club activa</div>
          )}
          <div style={{ ...R.missionHead, background: mission.status === 'ready' ? '#FFF3E0' : '#EEF5FF', borderLeft: `5px solid ${mission.status === 'ready' ? '#E67E22' : '#1D4ED8'}` }}>
            <div>
              <div style={{ fontSize:'.66rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.12em', color: mission.status === 'ready' ? '#E67E22' : '#1D4ED8', marginBottom:3 }}>
                {mission.status === 'ready' ? 'Pedido listo · recoger' : 'En camino'}
              </div>
              <div style={{ fontFamily:"'Pacifico',cursive", fontSize:'1.4rem', color:'#1C2D1A', lineHeight:1 }}>
                #{mission.order_number}
              </div>
              <div style={{ fontWeight:900, fontSize:'1.05rem', marginTop:3 }}>{mission.customer_name}</div>
              {missionPriority && (
                <div style={{ marginTop: 6 }}>
                  <span style={R.priorityPill}>Prioridad club</span>
                </div>
              )}
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontFamily:"'Pacifico',cursive", fontSize:'1.2rem', color:'#2D6A4F' }}>{euro(Number(mission.total||0))}</div>
              <div style={{ fontSize:'.72rem', color:'#8AAF80', marginTop:2 }}>{timeAgo(mission.created_at)}</div>
              {mission.delivery_code && <div style={{ marginTop:3, padding:'2px 7px', borderRadius:99, background:'#EEF5FF', color:'#1D4ED8', fontSize:'.64rem', fontWeight:900 }}>Código enviado</div>}
            </div>
          </div>

          {mission.notes && <div style={R.noteAlert}>{mission.notes}</div>}

          {missionAddr ? (
            <a href={mapsUrl(missionAddr)} target="_blank" rel="noopener noreferrer" className={styles.addrBlock}>
              <div>
                <div style={{ fontSize:'.64rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.1em', color:'#1D4ED8', marginBottom:3 }}>Dirección</div>
                <div style={{ fontSize:'1rem', fontWeight:900, color:'#163d8b', lineHeight:1.4 }}>{missionAddr}</div>
                <div style={{ fontSize:'.72rem', color:'#1D4ED8', marginTop:4, fontWeight:800 }}>Toca para abrir Maps</div>
              </div>
            </a>
          ) : (
            <div style={{ padding:'12px 16px', color:'#8AAF80', fontSize:'.82rem', fontWeight:700 }}>Sin dirección registrada</div>
          )}

          {mission.customer_phone && (
            <div style={{ padding:'0 14px 10px', display:'flex', gap:8 }}>
              <a href={`tel:${mission.customer_phone}`} style={R.contactBtn}>Llamar</a>
              {waUrl(mission, settings.business_name) && <a href={waUrl(mission, settings.business_name)} target="_blank" rel="noopener noreferrer" style={{ ...R.contactBtn, background:'#DCFCE7', color:'#166534', borderColor:'rgba(22,101,52,.2)' }}>WhatsApp</a>}
            </div>
          )}

          <button onClick={() => setShowDetail(showDetail === mission.id ? null : mission.id)} style={R.detailToggle}>
            {showDetail === mission.id ? 'Ocultar productos' : `Ver ${(mission.items||[]).reduce((s,i)=>s+i.qty,0)} productos`}
          </button>
          {showDetail === mission.id && (
            <div style={R.itemsList}>
              {(mission.items || []).map((item, i) => {
                const isCombo = !!(item.isCombo || item.is_combo)
                const t = normalizeToppings(item.toppings)
                return (
                  <div key={i} style={R.itemRow}>
                    <span style={{ fontSize:'1.15rem' }}>{item.emoji || (isCombo ? '[C]' : '[P]')}</span>
                    <div>
                      <div style={{ fontWeight:900, fontSize:'.9rem' }}>
                        {item.product_name}
                        {item.size && item.size !== 'small' && <span style={R.tag}>{item.size === 'medium' ? 'M' : 'G'}</span>}
                        {item.qty > 1 && <span style={{ ...R.tag, background:'#D8F3DC', color:'#166534' }}>x{item.qty}</span>}
                      </div>
                      {t.length > 0 && <div style={{ fontSize:'.72rem', color:'#8AAF80', marginTop:2 }}>{t.join(', ')}</div>}
                      {isCombo && item.combo_items?.map((ci, ci_i) => {
                        const ct = normalizeToppings(ci.toppings)
                        return (
                          <div key={ci_i} style={{ fontSize:'.78rem', color:'#4A6A3F', marginTop:2 }}>
                            - {ci.emoji || '[P]'} {ci.productName || ci.product_name}{ct.length ? ` - ${ct.join(', ')}` : ''}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ padding:'10px 14px 16px', display:'grid', gap:9 }}>
            {mission.status === 'ready' && (
              <button onClick={() => pickUp(mission)} className={styles.mainBtnOrange}>
                Recoger y salir
              </button>
            )}
            {mission.status === 'delivering' && !sendingCode && confirming !== mission.id && (
              <>
                <button onClick={() => markArrived(mission)} className={styles.mainBtnBlue}>
                  Llegué al destino · Generar código
                </button>
                <button onClick={() => setConfirming(mission.id)} className={styles.secondaryBtn}>
                  Marcar entregado manualmente
                </button>
              </>
            )}

            {mission.status === 'delivering' && sendingCode === mission.id && (
              <div style={{ padding:'14px', borderRadius:14, background:'#EEF5FF', textAlign:'center', fontWeight:800, color:'#1D4ED8', fontSize:'.9rem' }}>
                Enviando código al cliente por WhatsApp...
              </div>
            )}

            {confirming === mission.id && (
              <div style={{ background:'#F0FDF4', borderRadius:14, padding:'13px' }}>
                <div style={{ fontWeight:800, color:'#166534', fontSize:'.86rem', marginBottom:10 }}>{'\u00bfConfirmas que entregaste el pedido a '}{mission.customer_name}{'?'}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => manualDeliver(mission)} style={{ ...R.mainBtnGreen, flex:2 }}>Sí, entregado</button>
                  <button onClick={() => setConfirming(null)} className={styles.secondaryBtn} style={{ flex:1 }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cola */}
      {allOrders.length > 1 && (
        <div style={{ padding:'0 12px 12px' }}>
          <div style={{ fontSize:'.66rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.1em', color:'#8AAF80', marginBottom:8, padding:'0 4px' }}>
            Más pedidos en cola
          </div>
          {allOrders.slice(1).map((order) => {
            const a = addr(order)
            const isDetail = showDetail === order.id
            const priorityOrder = isPriorityClubOrder(order, priorityLevelIds)
            return (
              <div key={order.id} style={R.queueCard}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:"'Pacifico',cursive", fontSize:'1rem' }}>#{order.order_number}</span>
                      <span style={{ padding:'2px 7px', borderRadius:99, fontSize:'.62rem', fontWeight:900, background: order.status==='ready'?'#FFF3E0':'#EEF5FF', color: order.status==='ready'?'#E67E22':'#1D4ED8' }}>
                        {order.status === 'ready' ? 'Recoger' : 'En ruta'}
                      </span>
                      {priorityOrder && <span style={R.priorityPill}>Prioridad club</span>}
                    </div>
                    <div style={{ fontWeight:900, fontSize:'.9rem', marginTop:2 }}>{order.customer_name}</div>
                    {a && <div style={{ fontSize:'.76rem', color:'#4A6A3F', marginTop:2 }}>{a}</div>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontWeight:900, color:'#2D6A4F', fontSize:'.94rem' }}>{euro(order.total)}</div>
                    <div style={{ fontSize:'.66rem', color:'#8AAF80', marginTop:2 }}>{timeAgo(order.created_at)}</div>
                  </div>
                </div>

                {order.notes && <div style={{ ...R.noteAlert, margin:'8px 0 0', fontSize:'.74rem' }}>Nota: {order.notes}</div>}

                <div style={{ display:'flex', gap:7, marginTop:10, flexWrap:'wrap' }}>
                  {a && <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer" style={R.smallBtn}>Maps</a>}
                  {order.customer_phone && <a href={`tel:${order.customer_phone}`} style={R.smallBtn}>Llamar</a>}
                  <button onClick={() => setShowDetail(isDetail ? null : order.id)} style={{ ...R.smallBtn, cursor:'pointer' }}>{isDetail ? 'Ocultar items' : 'Ver items'}</button>
                  {order.status === 'ready' && <button onClick={() => pickUp(order)} style={{ ...R.smallBtn, background:'#FFF3E0', color:'#E67E22', borderColor:'rgba(230,126,34,.2)', cursor:'pointer', fontWeight:900 }}>Recoger</button>}
                  {order.status === 'delivering' && <button onClick={() => markArrived(order)} disabled={sendingCode === order.id} style={{ ...R.smallBtn, background:'#EEF5FF', color:'#1D4ED8', borderColor:'rgba(29,78,216,.2)', cursor:'pointer', fontWeight:900 }}>{sendingCode===order.id ? 'Guardando...' : 'Llegué'}</button>}
                </div>

                {isDetail && (
                  <div style={{ ...R.itemsList, margin:'10px 0 0', padding:0, background:'transparent', borderTop:'1px solid #F0EDE5' }}>
                    {(order.items || []).map((item, i) => {
                      const t = normalizeToppings(item.toppings)
                      return (
                        <div key={i} style={{ ...R.itemRow, paddingTop:8 }}>
                          <span style={{ fontSize:'1rem' }}>{item.emoji || '[P]'}</span>
                          <div style={{ fontWeight:800, fontSize:'.84rem' }}>
                            {item.product_name}{item.qty > 1 ? ` x${item.qty}` : ''}
                            {t.length > 0 && <div style={{ fontSize:'.7rem', color:'#8AAF80', fontWeight:600 }}>{t.join(', ')}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const R = {
  barTitle:    { color:'white', fontFamily:"'Pacifico',cursive", fontSize:'.96rem', lineHeight:1.2 },
  barSub:      { color:'rgba(255,255,255,.52)', fontSize:'.62rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.08em' },
  iconBtn:     { width:44, height:44, border:'1.5px solid rgba(255,255,255,.16)', borderRadius:13, background:'rgba(255,255,255,.1)', color:'white', fontSize:'.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' },

  kpi:    { flex:1, textAlign:'center', padding:'10px 8px', borderRadius:16, background:'rgba(255,255,255,.09)', border:'1px solid rgba(255,255,255,.08)' },
  kpiVal: { display:'block', fontSize:'1.3rem', fontWeight:900, color:'white', lineHeight:1 },
  kpiLbl: { display:'block', marginTop:4, color:'rgba(255,255,255,.52)', fontSize:'.58rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.08em' },

  empty:      { margin:'20px 12px', padding:'48px 20px', background:'white', borderRadius:22, border:'1px solid #E5E7EB', boxShadow:'0 4px 20px rgba(22,41,31,.08)', textAlign:'center' },
  connectBtn: { marginTop:14, minHeight:48, padding:'0 22px', border:'none', borderRadius:14, background:'linear-gradient(135deg,#195f3f,#2d6a4f)', color:'white', fontSize:'.9rem', fontWeight:900, cursor:'pointer', fontFamily:'inherit' },

  missionHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, padding:'14px 16px' },
  priorityBanner: { margin:'12px 14px 0', padding:'10px 14px', borderRadius:14, background:'linear-gradient(135deg,#fff4d6,#ffe7a8)', color:'#8a5a00', fontSize:'.74rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', border:'1px solid rgba(180,120,0,.18)' },
  priorityPill: { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'3px 8px', borderRadius:999, background:'#FFF4D6', color:'#8A5A00', border:'1px solid rgba(180,120,0,.16)', fontSize:'.58rem', fontWeight:900, letterSpacing:'.04em', textTransform:'uppercase' },
  noteAlert:     { margin:'0 14px 2px', padding:'9px 12px', background:'#FEF2F2', borderLeft:'4px solid #F87171', borderRadius:'0 10px 10px 0', color:'#B91C1C', fontSize:'.8rem', fontWeight:800, lineHeight:1.45 },
  contactBtn:    { flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', minHeight:42, borderRadius:12, background:'#EEF5FF', color:'#1D4ED8', border:'1px solid rgba(29,78,216,.14)', textDecoration:'none', fontSize:'.76rem', fontWeight:900 },
  detailToggle:  { width:'100%', padding:'9px 16px', border:'none', borderTop:'1px solid #F0EDE5', background:'transparent', color:'#4A6A3F', fontSize:'.76rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  itemsList:     { padding:'4px 14px 4px', background:'#FAFAF8', borderTop:'1px solid #F0EDE5' },
  itemRow:       { display:'flex', gap:10, alignItems:'flex-start', padding:'7px 0', borderBottom:'1px solid #F0EDE5' },
  tag:           { padding:'2px 6px', borderRadius:99, background:'#EEF5FF', color:'#1D4ED8', fontSize:'.6rem', fontWeight:900, marginLeft:4 },

  mainBtnGreen: { minHeight:50, border:'none', borderRadius:14, background:'linear-gradient(135deg,#166534,#2d6a4f)', color:'white', fontSize:'.9rem', fontWeight:900, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(45,106,79,.28)' },

  queueCard: { background:'white', borderRadius:18, border:'1px solid #E5E7EB', padding:'13px 14px', marginBottom:9, boxShadow:'0 2px 10px rgba(22,41,31,.06)' },
  smallBtn:  { display:'inline-flex', alignItems:'center', justifyContent:'center', minHeight:36, padding:'0 12px', borderRadius:10, background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', textDecoration:'none', fontSize:'.74rem', fontWeight:800 },
}
