// PedidosContent.jsx — CarmoCream Cocina v5 — Tablet optimizado
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeOrders } from '../lib/useRealtimeOrders'
import { notify, useNotifPermission } from '../lib/useNotifications'
import { normalizeToppings, STATUS_LABELS, STATUS_NEXT } from '../lib/orderUtils'
import { isGiftOrderItem } from '../lib/clubGift'
import { runAutoAssign } from '../lib/autoAssign'
import { fetchPriorityLevelIds, getFallbackPriorityLevelIds, isPriorityClubOrder, sortOrdersByClubPriority } from '../lib/orderPriority'
import { setStaffOnlineState } from '../lib/staffPresence'
import { usePWAInstall } from '../lib/usePWAInstall'
import { useSettings } from '../lib/useSettings'
import toast from 'react-hot-toast'
import styles from './Pedidos.module.css'

// ─── helpers ───────────────────────────────────────────────
function mins(dateStr) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
}
function clock(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function tops(t) { return normalizeToppings(t) }
function needsCookAssignment(order) {
  return ['pending', 'preparing'].includes(order?.status) && !order?.assigned_cook_id
}

const STATE = {
  pending:   { label: 'Nuevo',      bar: '#E67E22', light: '#FFF3E0' },
  preparing: { label: 'Preparando', bar: '#1D4ED8', light: '#EEF5FF' },
  ready:     { label: 'Listo',      bar: '#16A34A', light: '#F0FDF4' },
}

// ─── impresión ──────────────────────────────────────────────
function printTicket(order, businessName = 'CarmoCream') {
  const win = window.open('', '_blank', 'width=380,height=640')
  if (!win) { toast.error('Permite ventanas emergentes'); return }
  const now = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const itemsHtml = (order.items || []).map(item => {
    const isCombo = !!(item.isCombo || item.is_combo)
    const t = tops(item.toppings)
    const size = item.size && item.size !== 'small' ? ` (${item.size})` : ''
    if (isCombo && item.combo_items?.length) {
      const sub = item.combo_items.map(ci => {
        const ct = tops(ci.toppings)
        const csize = ci.size && ci.size !== 'small' ? ` (${ci.size})` : ''
        return `<div style="padding-left:14px;font-size:12px;color:#444">↳ ${ci.emoji || ''}${ci.productName || ci.product_name || ''}${csize}</div>${ct.length ? `<div style="padding-left:22px;font-size:11px;color:#888">${ct.join(', ')}</div>` : ''}`
      }).join('')
      return `<div style="margin:8px 0;padding-bottom:8px;border-bottom:1px dotted #ddd"><b>${item.emoji || '🎁'} ${item.product_name}${isGiftOrderItem(item) ? ' · REGALO CLUB' : ''}</b>${item.qty > 1 ? ` ×${item.qty}` : ''}${sub}</div>`
    }
    return `<div style="margin:8px 0;padding-bottom:8px;border-bottom:1px dotted #ddd"><b>${item.emoji || '🍨'} ${item.product_name}${isGiftOrderItem(item) ? ' · REGALO CLUB' : ''}${size}</b>${item.qty > 1 ? ` ×${item.qty}` : ''}${t.length ? `<div style="font-size:12px;color:#555;padding-left:14px">${t.join(', ')}</div>` : ''}</div>`
  }).join('')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:monospace;font-size:13px;padding:12px;width:72mm}h2{font-size:22px;margin:4px 0}hr{border:none;border-top:1px dashed #999;margin:8px 0}.stamp{background:#16A34A;color:white;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold}@media print{body{padding:0}}</style></head><body><div style="text-align:center"><div style="font-size:16px;font-weight:900;color:#2D6A4F">${businessName}</div><h2>#${order.order_number}</h2><div style="font-size:11px;color:#999">${now}</div><div class="stamp">LISTO PARA REPARTIR</div></div><hr><div style="font-size:12px;color:#888">CLIENTE</div><div style="font-size:15px;font-weight:900">${order.customer_name || '—'}</div><div style="font-size:12px;color:#555">${order.address || order.delivery_address || ''}</div>${order.notes ? `<div style="background:#FEF2F2;padding:5px 8px;margin-top:6px;font-size:11px;font-weight:700;color:#B91C1C;border-radius:3px">⚠️ ${order.notes}</div>` : ''}<hr><div style="font-size:12px;color:#888">PRODUCTOS</div>${itemsHtml}<hr><div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900"><span>TOTAL</span><span style="color:#2D6A4F">€${Number(order.total || 0).toFixed(2)}</span></div><div style="text-align:center;margin-top:10px;font-size:10px;color:#aaa">CarmoCream · Carmona</div><script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — COCINA
// ═══════════════════════════════════════════════════════════
export default function PedidosContent({ session, onLogout }) {
  const storeId = session?.store_id || 'default'
  const [openId,    setOpenId]    = useState(null)
  const [checks,    setChecks]    = useState({})
  const [toppings,  setToppings]  = useState([])
  const [sound,     setSound]     = useState(true)
  const [spinning,  setSpinning]  = useState(false)
  const [isOnline,  setIsOnline]  = useState(false)
  const [priorityLevelIds, setPriorityLevelIds] = useState(getFallbackPriorityLevelIds)
  const audioRef = useRef(null)
  const prevRef  = useRef(null)
  const autoAssignRef = useRef({ running: false, queued: false })
  const { showButton, showIOSHint, setShowIOSHint, install, getButtonLabel } = usePWAInstall()
  const { settings } = useSettings()

  useNotifPermission()

  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['pending', 'preparing', 'ready'],
    cookId: session.id,
    storeId,
  })

  const triggerCookAutoAssign = useCallback(async () => {
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
        const assigned = await runAutoAssign({ role: 'cocina', storeId })
        assignedTotal += assigned
        if (assigned > 0) await refresh()
      } while (autoAssignRef.current.queued)
    } finally {
      autoAssignRef.current.running = false
    }

    return assignedTotal
  }, [isOnline, refresh, storeId])

  const pending = useMemo(
    () => sortOrdersByClubPriority(orders.filter(order => order.status === 'pending'), priorityLevelIds),
    [orders, priorityLevelIds]
  )
  const preparing = useMemo(
    () => sortOrdersByClubPriority(orders.filter(order => order.status === 'preparing'), priorityLevelIds),
    [orders, priorityLevelIds]
  )
  const ready = useMemo(
    () => sortOrdersByClubPriority(orders.filter(order => order.status === 'ready'), priorityLevelIds),
    [orders, priorityLevelIds]
  )
  const sortedOrders = useMemo(
    () => [...pending, ...preparing, ...ready],
    [pending, preparing, ready]
  )

  // Alarma al entrar pedido nuevo
  useEffect(() => {
    if (prevRef.current === null) { prevRef.current = orders.map(o => o.id); return }
    const newOnes = orders.filter(o => !prevRef.current.includes(o.id) && o.status === 'pending')
    if (newOnes.length) { newOnes.forEach(o => notify.newOrder?.(o.order_number, o.customer_name)); beep() }
    prevRef.current = orders.map(o => o.id)
  }, [orders]) // eslint-disable-line

  // Abrir primer pedido pending automáticamente
  useEffect(() => {
    if (openId) return
    const first = pending[0] || preparing[0] || ready[0] || null
    if (first) setOpenId(first.id)
  }, [openId, pending, preparing, ready])

  useEffect(() => {
    supabase.from('toppings').select('id,name,emoji,image_url').eq('store_id', storeId).then(({ data }) => { if (data) setToppings(data) })
  }, [storeId])

  useEffect(() => {
    supabase.from('staff_users').select('is_online').eq('id', session.id).maybeSingle()
      .then(({ data }) => { if (data != null) setIsOnline(data.is_online === true) })
  }, [session.id])

  useEffect(() => {
    fetchPriorityLevelIds({ storeId }).then(setPriorityLevelIds).catch(() => {})
  }, [storeId])

  useEffect(() => {
    if (!isOnline) return undefined

    triggerCookAutoAssign().catch(() => {})

    const channel = supabase
      .channel(`cook-autoassign-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        if (payload.new?.store_id === storeId && needsCookAssignment(payload.new)) triggerCookAutoAssign().catch(() => {})
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        if (payload.new?.store_id === storeId && needsCookAssignment(payload.new)) triggerCookAutoAssign().catch(() => {})
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, session.id, triggerCookAutoAssign, storeId])

  function beep() {
    if (!sound) return
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      if (ctx.state === 'suspended') { ctx.resume().then(() => doBeep(ctx)); return }
      doBeep(ctx)
    } catch {}
  }
  function doBeep(ctx) {
    [440, 550, 660].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.frequency.value = f
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      o.start(t); o.stop(t + 0.3)
    })
  }

  async function toggleOnline() {
    const next = !isOnline
    setIsOnline(next)
    await setStaffOnlineState(session.id, next, session.store_id)
    if (next) {
      toast('Online', { style: { background: '#166534', color: 'white' } })
      const assigned = await runAutoAssign({ role: 'cocina', storeId })
      if (assigned > 0) await refresh()
      if (assigned > 0) toast.success(`${assigned} pedido${assigned > 1 ? 's' : ''} asignado${assigned > 1 ? 's' : ''}`)
      if (assigned === 0) {
        toast('No hay pedidos pendientes por asignar ahora mismo.', {
          style: { background: '#1F2937', color: 'white' },
        })
      }
    } else {
      toast('Offline', { style: { background: '#991B1B', color: 'white' } })
    }
  }

  async function advance(order) {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    const updates = { status: next }
    if (next === 'ready') updates.ready_at = new Date().toISOString()
    await supabase.from('orders').update(updates).eq('id', order.id).eq('store_id', storeId)
    toast.success(`#${order.order_number} → ${STATUS_LABELS[next]}`)
    if (next === 'ready') {
      const riderAssignments = await runAutoAssign({ role: 'repartidor', storeId })
      printTicket(order, settings.business_name || 'CarmoCream')
      setOpenId(null)
      if (riderAssignments === 0) {
        toast('Pedido listo. Esperando repartidor online.', {
          style: { background: '#1F2937', color: 'white' },
        })
      }
    }
  }

  function tick(orderId, key) {
    setChecks(p => ({ ...p, [`${orderId}_${key}`]: !p[`${orderId}_${key}`] }))
  }

  // Conteo de checks para un pedido
  function countChecks(order) {
    const items = order.items || []
    let total = 0, done = 0
    items.forEach((item, idx) => {
      const isCombo = !!(item.isCombo || item.is_combo)
      if (isCombo && item.combo_items?.length) {
        item.combo_items.forEach((ci, ci_i) => {
          total++; if (checks[`${order.id}_${idx}_${ci_i}`]) done++
          tops(ci.toppings).forEach((_, ti) => { total++; if (checks[`${order.id}_${idx}_${ci_i}_t${ti}`]) done++ })
        })
      } else {
        total++; if (checks[`${order.id}_${idx}`]) done++
        tops(item.toppings).forEach((_, ti) => { total++; if (checks[`${order.id}_${idx}_t${ti}`]) done++ })
      }
    })
    return { total, done, allDone: total > 0 && done === total }
  }

  const openOrder = sortedOrders.find(o => o.id === openId) || null
  const openChecks = openOrder ? countChecks(openOrder) : null
  const isPreparing = openOrder?.status === 'preparing'
  const canAdvance = !isPreparing || (openChecks?.allDone ?? true)
  const queueSections = [
    { key: 'pending', title: 'Entrando', subtitle: 'Por iniciar', accent: '#E67E22', orders: pending },
    { key: 'preparing', title: 'En cocina', subtitle: 'En produccion', accent: '#1D4ED8', orders: preparing },
    { key: 'ready', title: 'Listos', subtitle: 'Esperando rider', accent: '#16A34A', orders: ready },
  ]

  function toppingMeta(name) {
    return toppings.find(t => t.name === name) || {}
  }

  return (
    <div className={styles.page}>
      {/* ── TOP BAR ── */}
      <div className={styles.bar}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo.png" alt="" style={css.logo} onError={e => e.currentTarget.style.display='none'} />
          <div>
            <div style={css.barTitle}>Cocina</div>
            <div style={css.barSub}>{session.name}</div>
          </div>
          <span style={{ ...css.live, background: isOnline ? 'rgba(74,222,128,.14)' : 'rgba(248,113,113,.14)', borderColor: isOnline ? 'rgba(74,222,128,.22)' : 'rgba(248,113,113,.22)', color: isOnline ? '#86efac' : '#fca5a5' }}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {showButton && (
            <button style={{ ...css.iconBtn, width:'auto', padding:'0 12px' }} onClick={install}>
              📲 {getButtonLabel()}
            </button>
          )}
          <button style={{ ...css.iconBtn, width: 'auto', padding: '0 12px', background: isOnline ? 'rgba(74,222,128,.16)' : 'rgba(248,113,113,.16)', borderColor: isOnline ? 'rgba(74,222,128,.22)' : 'rgba(248,113,113,.22)' }} onClick={toggleOnline}>
            {isOnline ? 'Poner offline' : 'Poner online'}
          </button>
          <button style={css.iconBtn} onClick={() => setSound(v => !v)} title={sound ? 'Silenciar' : 'Activar'}>{sound ? '🔔' : '🔕'}</button>
          <button style={{ ...css.iconBtn, animation: spinning ? 'spin .6s linear infinite' : 'none' }}
            onClick={() => { setSpinning(true); refresh().finally(() => setTimeout(() => setSpinning(false), 400)) }}>↻</button>
          <button style={css.iconBtn} onClick={onLogout}>🚪</button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {!isOnline && (
        <div style={{ margin: '10px 12px 0', padding: '10px 14px', borderRadius: 14, background: '#FEF2F2', border: '1.5px solid #FCA5A5', color: '#991B1B', fontWeight: 800, fontSize: '.82rem' }}>
          Cocina offline. No entrarás en autoasignación hasta volver a conectarte.
        </div>
      )}
      {showIOSHint && (
        <div style={{ margin:'10px 12px 0', padding:'10px 14px', borderRadius:14, background:'#EFF6FF', border:'1.5px solid #BFDBFE', color:'#1D4ED8', fontWeight:800, fontSize:'.8rem' }}>
          En Safari: toca Compartir → Añadir a pantalla de inicio.
          <button onClick={() => setShowIOSHint(false)} style={{ marginLeft:10, border:'none', background:'transparent', color:'#1D4ED8', fontWeight:900, cursor:'pointer' }}>Cerrar</button>
        </div>
      )}

      {/* ── BODY: cola + ticket ── */}
      <div className={styles.body}>

      {/* ── COLA DE PEDIDOS ── */}
      <div className={styles.queue}>
        {loading ? (
          <div style={css.emptyMsg}>Cargando...</div>
        ) : orders.length === 0 ? (
          <div style={css.emptyMsg}>✅ Sin pedidos activos</div>
        ) : (
          <>
          <div className={styles.queueSummary}>
            {queueSections.map(section => (
              <div key={section.key} className={styles.queueSummaryCard}>
                <span className={styles.queueSummaryLabel}>{section.title}</span>
                <strong className={styles.queueSummaryValue} style={{ color: section.accent }}>
                  {section.orders.length}
                </strong>
              </div>
            ))}
          </div>
          <div style={css.queueRow}>
            {[...pending, ...preparing, ...ready].map(order => {
              const st = STATE[order.status] || STATE.pending
              const m = mins(order.created_at)
              const late = m >= (order.status === 'pending' ? 8 : 15)
              const isOpen = openId === order.id
              const priorityOrder = isPriorityClubOrder(order, priorityLevelIds)
              return (
                <button key={order.id} onClick={() => setOpenId(isOpen ? null : order.id)}
                  style={{ ...css.queueChip, background: isOpen ? st.bar : st.light,
                    color: isOpen ? '#fff' : '#1C2D1A',
                    border: `2px solid ${isOpen ? st.bar : 'transparent'}`,
                    animation: late && !isOpen ? 'pulse 1.5s infinite' : 'none' }}>
                  <span style={{ fontFamily: "'Pacifico',cursive", fontSize: '.92rem' }}>#{order.order_number}</span>
                  <span style={{ fontSize: '.68rem', fontWeight: 900, opacity: .85 }}>{order.customer_name.split(' ')[0]}</span>
                  <span style={{ fontSize: '.62rem', fontWeight: 800, opacity: .7 }}>{m}m</span>
                  {priorityOrder && <span style={{ ...css.priorityPill, ...(isOpen ? css.priorityPillActive : null) }}>Prioridad club</span>}
                  {order.notes && <span style={{ fontSize: '.7rem' }}>⚠️</span>}
                </button>
              )
            })}
          </div>
          </>
        )}

        {/* Totales de estado */}
        {orders.length > 0 && (
          <div style={css.counts}>
            {pending.length > 0 && <span style={{ ...css.countChip, background: '#FFF3E0', color: '#E67E22' }}>🔥 {pending.length} nuevo{pending.length !== 1 ? 's' : ''}</span>}
            {preparing.length > 0 && <span style={{ ...css.countChip, background: '#EEF5FF', color: '#1D4ED8' }}>👨‍🍳 {preparing.length} prep.</span>}
            {ready.length > 0 && <span style={{ ...css.countChip, background: '#F0FDF4', color: '#16A34A' }}>✅ {ready.length} listo{ready.length !== 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      {/* ── TICKET AREA ── */}
      <div className={styles.ticketArea}>
      {openOrder ? (
        <div style={css.ticket}>
          {/* Cabecera del ticket */}
          {isPriorityClubOrder(openOrder, priorityLevelIds) && (
            <div style={css.priorityBanner}>Prioridad club activa</div>
          )}
          <div style={{ ...css.ticketHead, background: (STATE[openOrder.status] || STATE.pending).light,
            borderLeft: `5px solid ${(STATE[openOrder.status] || STATE.pending).bar}` }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontFamily:"'Pacifico',cursive", fontSize:'1.5rem' }}>#{openOrder.order_number}</span>
                <span style={{ ...css.stateBadge, background: (STATE[openOrder.status]||STATE.pending).bar }}>
                  {(STATE[openOrder.status]||STATE.pending).label}
                </span>
                <span style={css.timer}>{mins(openOrder.created_at)}m</span>
              </div>
              <div style={{ fontSize:'1.05rem', fontWeight:900, marginTop:4 }}>{openOrder.customer_name}</div>
              {isPriorityClubOrder(openOrder, priorityLevelIds) && (
                <div style={{ marginTop: 6 }}>
                  <span style={css.priorityPill}>Prioridad club</span>
                </div>
              )}
              {openOrder.customer_phone && <div style={{ fontSize:'.8rem', color:'#4A6A3F', marginTop:2 }}>📞 {openOrder.customer_phone}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:"'Pacifico',cursive", fontSize:'1.2rem', color:'#2D6A4F' }}>€{Number(openOrder.total||0).toFixed(2)}</div>
              <div style={{ fontSize:'.72rem', color:'#8AAF80', marginTop:2 }}>{clock(openOrder.created_at)}</div>
            </div>
          </div>

          {/* Nota especial — muy visible si existe */}
          {openOrder.notes && (
            <div style={css.noteAlert}>⚠️ {openOrder.notes}</div>
          )}

          {/* Dirección — info para el ticket */}
          {(openOrder.address || openOrder.delivery_address) && (
            <div style={css.addressLine}>📍 {openOrder.address || openOrder.delivery_address}</div>
          )}

          {/* LISTA DE ITEMS — el núcleo del trabajo */}
          {openOrder.status === 'ready' && (
            <div style={css.flowHint}>
              {openOrder.assigned_rider_name
                ? `Asignado a reparto: ${openOrder.assigned_rider_name}`
                : 'Pedido listo. Queda pendiente hasta que un repartidor online lo tome.'}
            </div>
          )}
          <div style={css.itemsSection}>
            {(openOrder.items || []).map((item, idx) => {
              const isCombo = !!(item.isCombo || item.is_combo)
              const itemTops = tops(item.toppings)
              const itemChecked = !!checks[`${openOrder.id}_${idx}`]

              return (
                <div key={idx} style={{ ...css.itemCard, opacity: isPreparing && itemChecked && itemTops.length === 0 && !isCombo ? .45 : 1 }}>
                  <div style={css.itemRow}>
                    {/* Checkbox grande — fácil de pulsar */}
                    {isPreparing && (
                      <button onClick={() => tick(openOrder.id, idx)}
                        style={{ ...css.checkBox, background: itemChecked ? '#16A34A' : 'white',
                          borderColor: itemChecked ? '#16A34A' : '#D1D5DB' }}>
                        {itemChecked && <span style={{ color:'white', fontWeight:900, fontSize:'.9rem' }}>✓</span>}
                      </button>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={css.itemTitle}>
                        <span style={{ fontSize:'1.2rem' }}>{item.emoji || (isCombo ? '🎁' : '🍨')}</span>
                        <span style={{ fontWeight:900, fontSize:'1rem', textDecoration: isPreparing && itemChecked && itemTops.length === 0 && !isCombo ? 'line-through' : 'none' }}>
                          {item.product_name}{isGiftOrderItem(item) ? ' · REGALO CLUB' : ''}
                        </span>
                        {item.size && item.size !== 'small' && (
                          <span style={css.tag}>{item.size === 'medium' ? 'Mediana' : 'Grande'}</span>
                        )}
                        {item.qty > 1 && <span style={{ ...css.tag, background:'#D8F3DC', color:'#166534' }}>×{item.qty}</span>}
                      </div>

                      {/* Toppings del item simple */}
                      {!isCombo && itemTops.length > 0 && (
                        <div style={css.toppingList}>
                          {itemTops.map((t, ti) => {
                            const meta = toppingMeta(t)
                            const tKey = `${idx}_t${ti}`
                            const tChecked = !!checks[`${openOrder.id}_${tKey}`]
                            return (
                              <button key={ti} onClick={() => isPreparing && tick(openOrder.id, tKey)}
                                style={{ ...css.toppingChip,
                                  background: tChecked ? '#D8F3DC' : 'white',
                                  borderColor: tChecked ? '#74C69D' : '#E5E7EB',
                                  color: tChecked ? '#166534' : '#374151',
                                  cursor: isPreparing ? 'pointer' : 'default',
                                  opacity: tChecked ? .6 : 1 }}>
                                {meta.image_url ? <img src={meta.image_url} alt={t} style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover' }} />
                                  : meta.emoji ? <span style={{ fontSize:'.85rem' }}>{meta.emoji}</span>
                                  : <span style={{ width:7, height:7, borderRadius:'50%', background:'#9CA3AF', display:'inline-block' }} />}
                                <span style={{ fontSize:'.76rem', fontWeight:700, textDecoration: tChecked ? 'line-through' : 'none' }}>{t}</span>
                                {isPreparing && <span style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${tChecked?'#16A34A':'#9CA3AF'}`, background: tChecked?'#16A34A':'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.5rem', color:'white', fontWeight:900 }}>{tChecked?'✓':''}</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Combo: cada sub-item con sus toppings */}
                      {isCombo && item.combo_items?.length > 0 && (
                        <div style={css.comboBlock}>
                          {item.combo_items.map((ci, ci_i) => {
                            const ciName = ci.productName || ci.product_name || '?'
                            const ciTops = tops(ci.toppings)
                            const ciChecked = !!checks[`${openOrder.id}_${idx}_${ci_i}`]
                            return (
                              <div key={ci_i} style={css.comboItem}>
                                <div style={css.comboItemRow}>
                                  {isPreparing && (
                                    <button onClick={() => tick(openOrder.id, `${idx}_${ci_i}`)}
                                      style={{ ...css.checkBoxSm, background: ciChecked ? '#16A34A' : 'white', borderColor: ciChecked ? '#16A34A' : '#D1D5DB' }}>
                                      {ciChecked && <span style={{ color:'white', fontSize:'.7rem', fontWeight:900 }}>✓</span>}
                                    </button>
                                  )}
                                  <span style={{ fontSize:'1rem' }}>{ci.emoji || '🍨'}</span>
                                  <span style={{ fontWeight:800, fontSize:'.9rem', textDecoration: isPreparing && ciChecked && ciTops.length === 0 ? 'line-through' : 'none', opacity: isPreparing && ciChecked && ciTops.length === 0 ? .45 : 1 }}>
                                    {ciName}{ci.size && ci.size !== 'small' ? ` · ${ci.size === 'medium' ? 'M' : 'G'}` : ''}
                                  </span>
                                </div>
                                {ciTops.length > 0 && (
                                  <div style={{ ...css.toppingList, paddingLeft: isPreparing ? 38 : 24 }}>
                                    {ciTops.map((t, ti) => {
                                      const meta = toppingMeta(t)
                                      const tKey = `${idx}_${ci_i}_t${ti}`
                                      const tChecked = !!checks[`${openOrder.id}_${tKey}`]
                                      return (
                                        <button key={ti} onClick={() => isPreparing && tick(openOrder.id, tKey)}
                                          style={{ ...css.toppingChip, background: tChecked ? '#D8F3DC' : 'white', borderColor: tChecked ? '#74C69D' : '#E5E7EB', color: tChecked ? '#166534' : '#374151', cursor: isPreparing ? 'pointer' : 'default', opacity: tChecked ? .6 : 1 }}>
                                          {meta.emoji ? <span style={{ fontSize:'.8rem' }}>{meta.emoji}</span> : <span style={{ width:6, height:6, borderRadius:'50%', background:'#9CA3AF', display:'inline-block' }} />}
                                          <span style={{ fontSize:'.72rem', fontWeight:700, textDecoration: tChecked ? 'line-through' : 'none' }}>{t}</span>
                                          {isPreparing && <span style={{ width:13, height:13, borderRadius:3, border:`1.5px solid ${tChecked?'#16A34A':'#9CA3AF'}`, background: tChecked?'#16A34A':'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.48rem', color:'white', fontWeight:900 }}>{tChecked?'✓':''}</span>}
                                        </button>
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
                  </div>
                </div>
              )
            })}
          </div>

          {/* Barra de progreso si está preparando */}
          {isPreparing && openChecks && openChecks.total > 0 && (
            <div style={css.progress}>
              <div style={{ flex:1, height:10, borderRadius:99, background:'#E5E7EB', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, background: openChecks.allDone ? '#16A34A' : '#1D4ED8', width: `${(openChecks.done / openChecks.total) * 100}%`, transition:'width .3s' }} />
              </div>
              <span style={{ fontSize:'.78rem', fontWeight:900, color: openChecks.allDone ? '#16A34A' : '#1D4ED8', whiteSpace:'nowrap' }}>
                {openChecks.done}/{openChecks.total} {openChecks.allDone ? '✓ Todo listo' : ''}
              </span>
            </div>
          )}

          {/* BOTÓN PRINCIPAL — acción del estado */}
          {openOrder.status === 'ready' ? (
            <div style={css.readyBanner}>✅ Listo para repartir · {mins(openOrder.ready_at || openOrder.created_at)}m esperando</div>
          ) : (
            <button onClick={() => canAdvance && advance(openOrder)} style={{
              ...css.mainBtn,
              background: canAdvance ? (openOrder.status === 'pending' ? '#E67E22' : '#16A34A') : '#D1D5DB',
              cursor: canAdvance ? 'pointer' : 'not-allowed',
              color: canAdvance ? 'white' : '#9CA3AF',
            }}>
              {openOrder.status === 'pending' && '👨‍🍳 Iniciar preparación'}
              {openOrder.status === 'preparing' && (canAdvance ? '✅ Marcar como listo' : `Completa los checks (${openChecks?.done||0}/${openChecks?.total||0})`)}
            </button>
          )}
        </div>
      ) : orders.length > 0 ? (
        <div style={css.hintMsg}>👆 Toca un pedido para abrirlo</div>
      ) : null}
      </div>{/* fin ticketArea */}
      </div>{/* fin body */}
    </div>
  )
}

// ─── ESTILOS INLINE ────────────────────────────────────────
const css = {
  // page y bar ahora son clases CSS (styles.page / styles.bar)
  logo: { width:36, height:36, borderRadius:10, objectFit:'cover', border:'1.5px solid rgba(255,255,255,.2)' },
  barTitle: { color:'white', fontFamily:"'Pacifico',cursive", fontSize:'1.05rem', lineHeight:1 },
  barSub: { color:'rgba(255,255,255,.55)', fontSize:'.64rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.08em' },
  live: { padding:'4px 9px', borderRadius:999, background:'rgba(74,222,128,.14)', border:'1px solid rgba(74,222,128,.22)', color:'#86efac', fontSize:'.62rem', fontWeight:900 },
  iconBtn: { width:42, height:42, border:'1.5px solid rgba(255,255,255,.15)', borderRadius:12, background:'rgba(255,255,255,.11)', color:'white', fontSize:'.96rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' },

  queue: { background:'white', borderBottom:'1.5px solid #E5E7EB', padding:'10px 14px 8px' },
  queueRow: { display:'flex', gap:8, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' },
  queueChip: { flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'9px 12px', borderRadius:16, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', minWidth:72 },
  counts: { display:'flex', gap:7, marginTop:8, flexWrap:'wrap' },
  countChip: { padding:'4px 10px', borderRadius:999, fontSize:'.7rem', fontWeight:900 },
  emptyMsg: { textAlign:'center', padding:'16px 0', color:'#8AAF80', fontWeight:800, fontSize:'.9rem' },

  ticket: { margin:'12px', borderRadius:20, background:'white', boxShadow:'0 4px 24px rgba(28,45,26,.10)', overflow:'hidden', paddingBottom:14 },
  priorityBanner: { margin:'12px 12px 0', padding:'10px 14px', borderRadius:14, background:'linear-gradient(135deg,#fff4d6,#ffe7a8)', color:'#8a5a00', fontSize:'.74rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', border:'1px solid rgba(180,120,0,.18)' },
  ticketHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, padding:'14px 16px' },
  stateBadge: { padding:'3px 9px', borderRadius:999, color:'white', fontSize:'.65rem', fontWeight:900, letterSpacing:'.05em', textTransform:'uppercase' },
  timer: { padding:'3px 8px', borderRadius:999, background:'#F3F4F6', color:'#6B7280', fontSize:'.66rem', fontWeight:900 },
  priorityPill: { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'3px 8px', borderRadius:999, background:'#FFF4D6', color:'#8A5A00', border:'1px solid rgba(180,120,0,.16)', fontSize:'.58rem', fontWeight:900, letterSpacing:'.04em', textTransform:'uppercase' },
  priorityPillActive: { background:'rgba(255,244,214,.22)', color:'#FFF4D6', border:'1px solid rgba(255,244,214,.34)' },
  noteAlert: { margin:'0 14px 0', padding:'10px 13px', background:'#FEF2F2', borderLeft:'4px solid #F87171', borderRadius:'0 10px 10px 0', color:'#B91C1C', fontSize:'.82rem', fontWeight:800, lineHeight:1.45 },
  addressLine: { padding:'7px 16px', color:'#4A6A3F', fontSize:'.78rem', fontWeight:700, borderBottom:'1px solid #F3F4F6' },
  flowHint: { margin:'10px 14px 0', padding:'10px 13px', borderRadius:14, background:'#EEF5FF', color:'#1D4ED8', fontSize:'.78rem', fontWeight:800, lineHeight:1.45, border:'1px solid rgba(29,78,216,.12)' },

  itemsSection: { padding:'10px 12px', display:'grid', gap:10 },
  itemCard: { padding:'12px 13px', borderRadius:16, background:'#FAFAF8', border:'1px solid #EEEDE8', transition:'opacity .2s' },
  itemRow: { display:'flex', alignItems:'flex-start', gap:10 },
  itemTitle: { display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:6 },
  tag: { padding:'2px 7px', borderRadius:999, background:'#EEF5FF', color:'#1D4ED8', fontSize:'.62rem', fontWeight:900 },

  checkBox: { width:34, height:34, flexShrink:0, border:'2px solid #D1D5DB', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginTop:1 },
  checkBoxSm: { width:26, height:26, flexShrink:0, border:'2px solid #D1D5DB', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginTop:1 },

  toppingList: { display:'flex', flexWrap:'wrap', gap:5, marginTop:4 },
  toppingChip: { display:'inline-flex', alignItems:'center', gap:5, padding:'4px 8px 4px 5px', borderRadius:99, border:'1.5px solid #E5E7EB', background:'white', cursor:'pointer', fontFamily:'inherit', transition:'all .12s' },

  comboBlock: { marginTop:8, paddingLeft:0, display:'grid', gap:8 },
  comboItem: { background:'#FFF8EE', borderRadius:12, padding:'10px 12px', border:'1px solid #FFE8CC' },
  comboItemRow: { display:'flex', alignItems:'center', gap:7, marginBottom:2 },

  progress: { display:'flex', alignItems:'center', gap:10, padding:'10px 14px 4px' },
  readyBanner: { margin:'10px 12px 0', padding:'14px 16px', borderRadius:16, background:'linear-gradient(135deg,#EDFDF2,#D8F3DC)', color:'#166534', fontWeight:900, fontSize:'.9rem', textAlign:'center', border:'1px solid rgba(22,101,52,.14)' },
  mainBtn: { display:'block', width:'calc(100% - 24px)', margin:'10px 12px 0', minHeight:54, border:'none', borderRadius:16, fontSize:'1rem', fontWeight:900, fontFamily:'inherit', transition:'opacity .15s, transform .1s' },

  hintMsg: { textAlign:'center', padding:'40px 20px', color:'#8AAF80', fontWeight:800, fontSize:'.9rem' },
}
