import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import styles from './Admin.module.css'
import {
  buildSalesDataFromOrders,
  euro,
  formatCashDate as fmt,
  getCashBreakdown,
  getCashEntryDisplay,
  printDailyCashTicket,
  todayKey as today,
} from '../lib/cashReporting'
import { buildOrderItem } from '../lib/orderUtils'
import {
  buildPosOrderNote,
  buildPosSaleNotes,
  POS_PAYMENT_METHODS,
} from '../lib/posCash'
import {
  buildRiderCashCloseNotes,
  buildRiderDeliveryPayoutNotes,
  isRiderCashCloseEntry,
  parseRiderCashCloseNotes,
  parseRiderDeliveryPayoutNotes,
} from '../lib/riderCash'
import { loadMergedSettingsMap } from '../lib/storeSettings'

const CATEGORIES = ['ventas', 'ingredientes', 'packaging', 'reparto', 'nomina', 'local', 'marketing', 'otro']
const CATEGORY_ICONS = {
  ventas: '💰',
  ingredientes: '🥛',
  packaging: '📦',
  reparto: '🛵',
  nomina: '👤',
  local: '🏠',
  marketing: '📢',
  otro: '📝',
}

function isConfirmedRiderClosure(entry) {
  const closure = parseRiderCashCloseNotes(entry?.notes)
  return Boolean(closure?.admin_confirmed_at)
}

function getCatalogSalePrice(product) {
  const basePrice = Number(product?.price || 0)
  const discountPercent = Math.max(0, Number(product?.discount_percent || 0))
  if (discountPercent <= 0) return basePrice
  return Number((basePrice * (1 - discountPercent / 100)).toFixed(2))
}

function buildPosLine(product) {
  return {
    productId: product.id,
    name: product.name || 'Producto',
    emoji: product.emoji || '🍨',
    imageUrl: product.image_url || null,
    unitPrice: getCatalogSalePrice(product),
    qty: 1,
  }
}

function emptyManualEntry() {
  return { type: 'gasto', concept: '', amount: '', category: 'otro', notes: '' }
}

function emptyPosSale() {
  return { customerName: '', paymentMethod: 'cash', notes: '', lines: [] }
}

export default function AdminAccountingTab({ storeId = 'default' }) {
  const [entries, setEntries] = useState([])
  const [salesData, setSalesData] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [catalogProducts, setCatalogProducts] = useState([])
  const [settingsMap, setSettingsMap] = useState({})
  const [selectedDate, setSelectedDate] = useState(today())
  const [ticketDate, setTicketDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('today')
  const [addModal, setAddModal] = useState(false)
  const [manualForm, setManualForm] = useState(emptyManualEntry())
  const [savingManual, setSavingManual] = useState(false)
  const [posModal, setPosModal] = useState(false)
  const [posForm, setPosForm] = useState(emptyPosSale())
  const [posSaving, setPosSaving] = useState(false)
  const [posSearch, setPosSearch] = useState('')
  const [confirmingClosureId, setConfirmingClosureId] = useState(null)
  const [payingRiderId, setPayingRiderId] = useState(null)

  useEffect(() => {
    load()
  }, [storeId])

  async function load() {
    setLoading(true)

    const [
      entriesRes,
      salesResponse,
      ordersRes,
      productsRes,
      settingsMapData,
    ] = await Promise.all([
      supabase
        .from('cash_entries')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('daily_sales_summary').select('*').eq('store_id', storeId).limit(90),
      supabase
        .from('orders')
        .select('id,order_number,assigned_rider_id,assigned_rider_name,delivery_fee,total,created_at,delivered_at,status')
        .eq('store_id', storeId)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .limit(500),
      supabase
        .from('products')
        .select('id,name,price,discount_percent,emoji,image_url,available,out_of_stock,sort_order')
        .eq('store_id', storeId)
        .eq('available', true)
        .order('sort_order', { ascending: true })
        .limit(300),
      loadMergedSettingsMap(storeId, supabase),
    ])

    if (entriesRes.error) toast.error(entriesRes.error.message)
    if (ordersRes.error) toast.error(ordersRes.error.message)
    if (productsRes.error) toast.error(productsRes.error.message)

    setEntries(entriesRes.data || [])
    setDeliveredOrders(ordersRes.data || [])
    setCatalogProducts((productsRes.data || []).filter(product => !product.out_of_stock))
    setSettingsMap(settingsMapData || {})

    const sales = salesResponse?.data
    const salesError = salesResponse?.error

    if (salesError && /column .*store_id.* does not exist|schema cache/i.test(String(salesError.message || ''))) {
      setSalesData(buildSalesDataFromOrders(ordersRes.data || []))
    } else if (sales) {
      setSalesData(sales)
    } else {
      setSalesData([])
    }

    setLoading(false)
  }

  async function saveManualEntry() {
    if (!manualForm.concept.trim()) {
      toast.error('Concepto requerido')
      return
    }

    const amount = Number(manualForm.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Importe invalido')
      return
    }

    setSavingManual(true)
    const { error } = await supabase.from('cash_entries').insert({
      date: selectedDate,
      type: manualForm.type,
      concept: manualForm.concept.trim(),
      amount,
      category: manualForm.category,
      notes: manualForm.notes.trim() || null,
      store_id: storeId,
    })
    setSavingManual(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Entrada registrada')
    setAddModal(false)
    setManualForm(emptyManualEntry())
    await load()
  }

  async function deleteEntry(id) {
    if (!window.confirm('Eliminar esta entrada?')) return
    const { error } = await supabase.from('cash_entries').delete().eq('id', id).eq('store_id', storeId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Movimiento eliminado')
    await load()
  }

  async function confirmRiderClosure(entry) {
    const closure = parseRiderCashCloseNotes(entry?.notes)
    if (!closure || closure.admin_confirmed_at) return

    setConfirmingClosureId(entry.id)
    const payload = {
      ...closure,
      admin_confirmed_at: new Date().toISOString(),
      admin_confirmed_by: 'admin',
    }

    const { error } = await supabase
      .from('cash_entries')
      .update({ notes: buildRiderCashCloseNotes(payload) })
      .eq('id', entry.id)
      .eq('store_id', storeId)

    setConfirmingClosureId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Caja del repartidor confirmada')
    await load()
  }

  async function payRiderDelivery(group) {
    if (!group || group.pendingAmount <= 0) return
    if (!window.confirm(`Registrar pago de ${euro(group.pendingAmount)} a ${group.riderName}?`)) return

    setPayingRiderId(group.riderId)
    const payout = {
      rider_id: group.riderId,
      rider_name: group.riderName,
      paid_at: new Date().toISOString(),
      order_ids: group.orders.map(order => order.id),
      order_numbers: group.orders.map(order => order.order_number).filter(Boolean),
      order_count: group.orders.length,
      per_order_fee: group.perOrderFee,
    }

    const { error } = await supabase.from('cash_entries').insert({
      date: today(),
      type: 'gasto',
      concept: `Pago delivery ${group.riderName}`,
      amount: Number(group.pendingAmount.toFixed(2)),
      category: 'reparto',
      notes: buildRiderDeliveryPayoutNotes(payout),
      store_id: storeId,
    })

    setPayingRiderId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Pago de delivery registrado')
    await load()
  }

  function updatePosQty(productId, nextQty) {
    setPosForm(current => ({
      ...current,
      lines: current.lines
        .map(line => (line.productId === productId ? { ...line, qty: Math.max(0, Number(nextQty || 0)) } : line))
        .filter(line => line.qty > 0),
    }))
  }

  function addProductToPos(product) {
    setPosForm(current => {
      const existing = current.lines.find(line => line.productId === product.id)
      if (existing) {
        return {
          ...current,
          lines: current.lines.map(line =>
            line.productId === product.id ? { ...line, qty: line.qty + 1 } : line
          ),
        }
      }

      return { ...current, lines: [...current.lines, buildPosLine(product)] }
    })
  }

  const posItemCount = useMemo(
    () => posForm.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    [posForm.lines]
  )

  const posSubtotal = useMemo(
    () => posForm.lines.reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.qty || 0), 0),
    [posForm.lines]
  )

  async function savePosSale() {
    if (posForm.lines.length === 0) {
      toast.error('Añade al menos un producto')
      return
    }

    if (posSubtotal <= 0) {
      toast.error('El total de la venta es invalido')
      return
    }

    setPosSaving(true)

    const { data: lastOrder, error: lastOrderError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('store_id', storeId)
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastOrderError) {
      toast.error(lastOrderError.message)
      setPosSaving(false)
      return
    }

    const nextOrderNumber = Number(lastOrder?.order_number || 0) + 1
    const nowIso = new Date().toISOString()
    const customerName = posForm.customerName.trim() || 'Cliente mostrador'
    const orderItems = posForm.lines.map(line =>
      buildOrderItem({
        id: line.productId,
        product_name: line.name,
        emoji: line.emoji,
        image_url: line.imageUrl,
        qty: line.qty,
        price: line.unitPrice,
      })
    )

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        store_id: storeId,
        order_number: nextOrderNumber,
        customer_name: customerName,
        customer_phone: null,
        delivery_address: 'Venta en mostrador',
        notes: buildPosOrderNote({
          paymentMethod: posForm.paymentMethod,
          internalNote: posForm.notes,
        }),
        items: orderItems,
        subtotal: posSubtotal,
        discount: 0,
        delivery_fee: null,
        total: posSubtotal,
        status: 'delivered',
        ready_at: nowIso,
        picked_at: nowIso,
        delivered_at: nowIso,
      })
      .select('id,order_number,total')
      .single()

    if (orderError || !createdOrder) {
      toast.error(orderError?.message || 'No se pudo registrar la venta en pedidos')
      setPosSaving(false)
      return
    }

    const { error: cashError } = await supabase.from('cash_entries').insert({
      date: today(),
      type: 'ingreso',
      concept: `Venta mostrador #${createdOrder.order_number}`,
      amount: Number(createdOrder.total || posSubtotal),
      category: 'ventas',
      notes: buildPosSaleNotes({
        order_id: createdOrder.id,
        order_number: createdOrder.order_number,
        payment_method: posForm.paymentMethod,
        customer_name: customerName,
        item_count: posItemCount,
        item_summary: posForm.lines.map(line => `${line.qty}x ${line.name}`),
        note: posForm.notes.trim() || null,
      }),
      store_id: storeId,
    })

    if (cashError) {
      await supabase.from('orders').delete().eq('id', createdOrder.id).eq('store_id', storeId)
      toast.error(cashError.message)
      setPosSaving(false)
      return
    }

    setPosSaving(false)
    setPosModal(false)
    setPosForm(emptyPosSale())
    setPosSearch('')
    setTicketDate(today())
    toast.success(`Venta mostrador #${createdOrder.order_number} registrada`)
    await load()
  }

  const filteredEntries = useMemo(() => {
    const now = new Date()
    return entries.filter(entry => {
      const entryDate = new Date(`${entry.date}T00:00:00`)
      if (view === 'today') return entry.date === today()
      if (view === 'week') {
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - 7)
        return entryDate >= cutoff
      }
      if (view === 'month') {
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - 30)
        return entryDate >= cutoff
      }
      return true
    })
  }, [entries, view])

  const pendingRiderClosures = useMemo(
    () => entries.filter(entry => isRiderCashCloseEntry(entry) && !isConfirmedRiderClosure(entry)),
    [entries]
  )

  const paidDeliveryOrderIds = useMemo(() => {
    const ids = new Set()
    entries.forEach(entry => {
      const payout = parseRiderDeliveryPayoutNotes(entry?.notes)
      if (!payout) return
      ;(payout.order_ids || []).forEach(id => ids.add(id))
    })
    return ids
  }, [entries])

  const riderDeliveryGroups = useMemo(() => {
    const defaultFee = Math.max(0, Number(settingsMap.delivery_fee || 0))
    const groups = {}

    deliveredOrders.forEach(order => {
      if (!order.assigned_rider_id || paidDeliveryOrderIds.has(order.id)) return
      const riderId = order.assigned_rider_id
      if (!groups[riderId]) {
        groups[riderId] = {
          riderId,
          riderName: order.assigned_rider_name || 'Repartidor',
          perOrderFee: Number(order.delivery_fee || 0) > 0 ? Number(order.delivery_fee || 0) : defaultFee,
          pendingAmount: 0,
          orders: [],
        }
      }

      const fee = Number(order.delivery_fee || 0) > 0 ? Number(order.delivery_fee || 0) : defaultFee
      groups[riderId].pendingAmount += fee
      groups[riderId].orders.push(order)
    })

    return Object.values(groups)
      .filter(group => group.pendingAmount > 0 && group.orders.length > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
  }, [deliveredOrders, paidDeliveryOrderIds, settingsMap.delivery_fee])

  const todaySales = salesData.find(row => row.date === today())
  const { manualIncome, posSales, riderIncome, expense, withdraw, balance } = useMemo(
    () => getCashBreakdown(filteredEntries),
    [filteredEntries]
  )
  const last14 = salesData.slice(0, 14)
  const typeColor = { ingreso: '#166534', gasto: '#991B1B', retiro: '#92400E' }
  const typeBg = { ingreso: '#DCFCE7', gasto: '#FEE2E2', retiro: '#FEF3C7' }

  const posCatalog = useMemo(() => {
    const search = posSearch.trim().toLowerCase()
    return catalogProducts.filter(product => {
      if (!search) return true
      return [product.name, product.emoji]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(search))
    })
  }, [catalogProducts, posSearch])

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 className={styles.tabTitle}>Caja & Contabilidad</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={ticketDate}
              onChange={event => setTicketDate(event.target.value)}
              style={{
                padding: '8px 10px',
                border: '2px solid #FFE8CC',
                borderRadius: 10,
                fontSize: '.8rem',
                fontFamily: 'inherit',
                background: '#FFF8EE',
                color: '#1C3829',
              }}
            />
            <button
              onClick={() => printDailyCashTicket({
                entries,
                salesData,
                date: ticketDate,
                businessName: settingsMap.business_name || 'Tienda',
                headerNote: settingsMap.cash_ticket_header || 'Contabilidad diaria',
                footerText: settingsMap.cash_ticket_footer || 'Documento interno generado automaticamente',
              })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: '#1D4ED8',
                color: 'white',
                border: 'none',
                borderRadius: 11,
                fontSize: '.82rem',
                fontWeight: 800,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 12px rgba(29,78,216,.28)',
              }}
            >
              Imprimir tiquet
            </button>
          </div>
          <button
            type="button"
            data-testid="cash-pos-open"
            className={styles.btnPrimary}
            onClick={() => setPosModal(true)}
            style={{ background: '#166534' }}
          >
            + Venta mostrador
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => {
              setSelectedDate(today())
              setAddModal(true)
            }}
          >
            + Nueva entrada
          </button>
        </div>
      </div>
      {todaySales && (
        <div className={styles.accountingTodayCard}>
          <h3 className={styles.accountingTodayTitle}>Ventas de hoy</h3>
          <div className={styles.accountingTodayGrid}>
            <div className={styles.accountingKPI}>
              <span className={styles.accountingKPINum}>{todaySales.orders_count}</span>
              <span className={styles.accountingKPILabel}>Pedidos</span>
            </div>
            <div className={styles.accountingKPI}>
              <span className={styles.accountingKPINum}>{todaySales.delivered_count}</span>
              <span className={styles.accountingKPILabel}>Entregados</span>
            </div>
            <div className={`${styles.accountingKPI} ${styles.accountingKPIGreen}`}>
              <span className={styles.accountingKPINum}>{euro(todaySales.confirmed_revenue)}</span>
              <span className={styles.accountingKPILabel}>Ingresos</span>
            </div>
            <div className={styles.accountingKPI}>
              <span className={styles.accountingKPINum}>{euro(todaySales.avg_ticket)}</span>
              <span className={styles.accountingKPILabel}>Ticket medio</span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.accountingReportCard}>
        <h3 className={styles.accountingSubTitle}>Ventas · Ultimos 14 dias</h3>
        <div className={styles.salesTable}>
          <div className={styles.salesTableHeader}>
            <span>Fecha</span>
            <span>Pedidos</span>
            <span>Entregados</span>
            <span>Ingresos</span>
            <span>Ticket medio</span>
          </div>
          {last14.map(row => (
            <div key={row.date} className={`${styles.salesTableRow} ${row.date === today() ? styles.salesTableRowToday : ''}`}>
              <span className={styles.salesDate}>{fmt(row.date)}</span>
              <span>{row.orders_count}</span>
              <span>{row.delivered_count}</span>
              <span className={styles.salesAmount}>{euro(row.confirmed_revenue)}</span>
              <span>{euro(row.avg_ticket)}</span>
            </div>
          ))}
          {last14.length === 0 && <p className={styles.emptyNote}>Sin datos aun</p>}
        </div>
      </div>

      {(pendingRiderClosures.length > 0 || riderDeliveryGroups.length > 0) && (
        <div className={styles.accountingReportCard}>
          <h3 className={styles.accountingSubTitle}>Reparto y cierres</h3>

          {pendingRiderClosures.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginBottom: riderDeliveryGroups.length > 0 ? 18 : 0 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#92400E' }}>
                Liquidaciones pendientes de validar
              </div>
              {pendingRiderClosures.map(entry => {
                const closure = parseRiderCashCloseNotes(entry.notes) || {}
                return (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: '#FFF7ED', border: '1.5px solid #FDBA74' }}>
                    <div style={{ minWidth: 220, flex: 1 }}>
                      <div style={{ fontSize: '.84rem', fontWeight: 900, color: '#7C2D12' }}>
                        {closure.rider_name || 'Repartidor'}
                      </div>
                      <div style={{ fontSize: '.74rem', color: '#9A3412', marginTop: 4, lineHeight: 1.6 }}>
                        {closure.delivered_count || 0} entregas · {euro(closure.delivered_total || entry.amount)}
                      </div>
                      {Array.isArray(closure.order_numbers) && closure.order_numbers.length > 0 && (
                        <div style={{ fontSize: '.7rem', color: '#C2410C', fontWeight: 700, marginTop: 6 }}>
                          Pedidos: {closure.order_numbers.map(number => `#${number}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmRiderClosure(entry)}
                      disabled={confirmingClosureId === entry.id}
                      style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#C2410C', color: 'white', fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer', minWidth: 180 }}
                    >
                      {confirmingClosureId === entry.id ? 'Confirmando...' : 'Confirmar caja'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {riderDeliveryGroups.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#166534' }}>
                Pagos de delivery pendientes
              </div>
              {riderDeliveryGroups.map(group => (
                <div key={group.riderId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: '#F0FDF4', border: '1.5px solid #86EFAC' }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={{ fontSize: '.84rem', fontWeight: 900, color: '#14532D' }}>
                      {group.riderName}
                    </div>
                    <div style={{ fontSize: '.74rem', color: '#166534', marginTop: 4, lineHeight: 1.6 }}>
                      {group.orders.length} entregas · {euro(group.pendingAmount)} pendientes
                    </div>
                    <div style={{ fontSize: '.7rem', color: '#15803D', fontWeight: 700, marginTop: 6 }}>
                      Fee por pedido: {euro(group.perOrderFee)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => payRiderDelivery(group)}
                    disabled={payingRiderId === group.riderId}
                    style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#166534', color: 'white', fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer', minWidth: 180 }}
                  >
                    {payingRiderId === group.riderId ? 'Registrando...' : 'Registrar pago'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.accountingReportCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 className={styles.accountingSubTitle}>Diario de caja</h3>
          <div className={styles.periodPills}>
            {[['today', 'Hoy'], ['week', '7d'], ['month', '30d'], ['all', 'Todo']].map(([value, label]) => (
              <button
                key={value}
                className={view === value ? styles.periodPillActive : styles.periodPill}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.balanceRow}>
          <div className={styles.balanceItem} style={{ color: '#166534', background: '#DCFCE7' }}>
            <span>Ingresos manuales</span>
            <strong>{euro(manualIncome)}</strong>
          </div>
          <div className={styles.balanceItem} style={{ color: '#166534', background: '#ECFDF5' }}>
            <span>Ventas mostrador</span>
            <strong>{euro(posSales)}</strong>
          </div>
          <div className={styles.balanceItem} style={{ color: '#166534', background: '#ECFDF5' }}>
            <span>Reparto liquidado</span>
            <strong>{euro(riderIncome)}</strong>
          </div>
          <div className={styles.balanceItem} style={{ color: '#991B1B', background: '#FEE2E2' }}>
            <span>Gastos</span>
            <strong>{euro(expense)}</strong>
          </div>
          <div className={styles.balanceItem} style={{ color: '#92400E', background: '#FEF3C7' }}>
            <span>Retiros</span>
            <strong>{euro(withdraw)}</strong>
          </div>
          <div className={styles.balanceItem} style={{ color: balance >= 0 ? '#166534' : '#991B1B', background: balance >= 0 ? '#D1FAE5' : '#FEE2E2', fontWeight: 900 }}>
            <span>Balance</span>
            <strong>{euro(balance)}</strong>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingSpinner} />
        ) : (
          <div className={styles.entriesList}>
            {filteredEntries.length === 0 && <p className={styles.emptyNote}>Sin entradas en este periodo</p>}
            {filteredEntries.map(entry => {
              const display = getCashEntryDisplay(entry)
              return (
                <div key={entry.id} className={styles.entryRow}>
                  <span className={styles.entryType} style={{ background: typeBg[display.type], color: typeColor[display.type] }}>
                    {display.type}
                  </span>
                  <div className={styles.entryMain}>
                    <span className={styles.entryConcept}>{display.concept}</span>
                    <span className={styles.entryDate}>{fmt(entry.date)}</span>
                    {display.notes && <span className={styles.entryNotes}>{display.notes}</span>}
                  </div>
                  <span className={styles.entryAmount} style={{ color: typeColor[display.type] }}>
                    {display.type === 'ingreso' ? '+' : '-'}{euro(entry.amount)}
                  </span>
                  <button className={styles.entryDelete} onClick={() => deleteEntry(entry.id)} title="Eliminar">×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {addModal && (
        <div className={styles.modalOverlay} onClick={event => event.target === event.currentTarget && setAddModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Nueva entrada de caja</h3>
              <button className={styles.modalClose} onClick={() => setAddModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Fecha</label>
                <input type="date" className={styles.formInput} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['ingreso', 'gasto', 'retiro'].map(type => (
                    <button
                      key={type}
                      className={`${styles.roleBtn} ${manualForm.type === type ? styles.roleBtnActive : ''}`}
                      onClick={() => setManualForm(current => ({ ...current, type }))}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Concepto *</label>
                <input className={styles.formInput} value={manualForm.concept} onChange={event => setManualForm(current => ({ ...current, concept: event.target.value }))} placeholder="ej: Compra de ingredientes" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Importe (EUR) *</label>
                <input type="number" step="0.01" min="0" className={styles.formInput} value={manualForm.amount} onChange={event => setManualForm(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Categoria</label>
                <select className={styles.formInput} value={manualForm.category} onChange={event => setManualForm(current => ({ ...current, category: event.target.value }))}>
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {CATEGORY_ICONS[category]} {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Notas (opcional)</label>
                <input className={styles.formInput} value={manualForm.notes} onChange={event => setManualForm(current => ({ ...current, notes: event.target.value }))} placeholder="Descripcion adicional" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className={styles.btnSecondary} onClick={() => setAddModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={saveManualEntry} disabled={savingManual} style={{ flex: 2 }}>
                  {savingManual ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {posModal && (
        <div className={styles.modalOverlay} onClick={event => event.target === event.currentTarget && setPosModal(false)}>
          <div className={styles.modal} style={{ maxWidth: 1080, width: '100%' }}>
            <div className={styles.modalHeader}>
              <h3>🛒 Venta mostrador</h3>
              <button className={styles.modalClose} onClick={() => setPosModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, .9fr)' }}>

                {/* ── Catálogo visual ── */}
                <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>

                  {/* Buscador */}
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
                    <input
                      data-testid="cash-pos-search"
                      className={styles.formInput}
                      value={posSearch}
                      onChange={event => setPosSearch(event.target.value)}
                      placeholder="Buscar producto por nombre..."
                      style={{ paddingLeft: 36, margin: 0 }}
                    />
                  </div>

                  {/* Resumen rápido del carrito */}
                  {posForm.lines.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', fontSize: '.78rem', fontWeight: 800, color: '#166534' }}>
                      ✅ {posItemCount} producto{posItemCount !== 1 ? 's' : ''} en carrito · {euro(posSubtotal)}
                      <button
                        type="button"
                        onClick={() => setPosForm(current => ({ ...current, lines: [] }))}
                        style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#991B1B', fontWeight: 900, cursor: 'pointer', fontSize: '.76rem' }}
                      >
                        Limpiar
                      </button>
                    </div>
                  )}

                  {/* Grid visual de productos */}
                  <div style={{ maxHeight: 460, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10, paddingRight: 4 }}>
                    {posCatalog.map(product => {
                      const inCart = posForm.lines.find(line => line.productId === product.id)
                      const salePrice = getCatalogSalePrice(product)
                      const hasDiscount = Number(product.discount_percent || 0) > 0
                      return (
                        <button
                          key={product.id}
                          type="button"
                          data-testid={`cash-pos-add-${product.id}`}
                          onClick={() => addProductToPos(product)}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            padding: 0,
                            borderRadius: 14,
                            border: inCart ? '2.5px solid #16A34A' : '1.5px solid #E5E7EB',
                            background: inCart ? '#F0FDF4' : 'white',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            overflow: 'hidden',
                            boxShadow: inCart ? '0 0 0 3px rgba(22,163,74,.15)' : '0 1px 4px rgba(0,0,0,.06)',
                            transition: 'border-color .15s, box-shadow .15s',
                            textAlign: 'left',
                          }}
                        >
                          {/* Imagen / emoji */}
                          <div style={{ height: 108, background: '#FFF8EE', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                            {product.image_url
                              ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: '2.6rem' }}>{product.emoji || '🍨'}</span>}
                          </div>

                          {/* Badge descuento */}
                          {hasDiscount && (
                            <div style={{ position: 'absolute', top: 7, right: 7, background: '#DC2626', color: 'white', fontSize: '.6rem', fontWeight: 900, borderRadius: 6, padding: '2px 7px', letterSpacing: '.03em', zIndex: 2 }}>
                              -{product.discount_percent}%
                            </div>
                          )}

                          {/* Badge qty en carrito */}
                          {inCart && (
                            <div style={{ position: 'absolute', top: 7, left: 7, background: '#166534', color: 'white', fontSize: '.72rem', fontWeight: 900, borderRadius: 20, padding: '3px 9px', minWidth: 28, textAlign: 'center', boxShadow: '0 2px 8px rgba(22,101,52,.35)', zIndex: 2 }}>
                              ×{inCart.qty}
                            </div>
                          )}

                          {/* Info */}
                          <div style={{ padding: '8px 10px 4px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontSize: '.79rem', fontWeight: 800, color: '#1C3829', lineHeight: 1.25, wordBreak: 'break-word' }}>{product.name}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                              <span style={{ fontSize: '.9rem', fontWeight: 900, color: '#166534' }}>{euro(salePrice)}</span>
                              {hasDiscount && (
                                <span style={{ fontSize: '.68rem', color: '#9CA3AF', textDecoration: 'line-through' }}>{euro(Number(product.price || 0))}</span>
                              )}
                            </div>
                          </div>

                          {/* Footer acción */}
                          <div style={{ background: inCart ? '#16A34A' : '#F3F4F6', color: inCart ? 'white' : '#6B7280', fontSize: '.67rem', fontWeight: 900, textAlign: 'center', padding: '5px 0', borderTop: '1px solid rgba(0,0,0,.05)', letterSpacing: '.02em' }}>
                            {inCart ? '✓ En carrito · +1 al tocar' : '＋ Añadir'}
                          </div>
                        </button>
                      )
                    })}
                    {posCatalog.length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '36px 0', color: '#9CA3AF', fontSize: '.85rem', fontWeight: 700 }}>
                        {posSearch ? `Sin resultados para "${posSearch}"` : 'No hay productos disponibles para mostrador.'}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                  <div style={{ padding: 16, borderRadius: 18, background: '#FFF8EE', border: '1px solid #FDE5C2' }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div className={styles.formField} style={{ margin: 0 }}>
                        <label className={styles.formLabel}>Cliente (opcional)</label>
                        <input className={styles.formInput} value={posForm.customerName} onChange={event => setPosForm(current => ({ ...current, customerName: event.target.value }))} placeholder="Cliente mostrador" />
                      </div>
                      <div className={styles.formField} style={{ margin: 0 }}>
                        <label className={styles.formLabel}>Metodo de cobro</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {POS_PAYMENT_METHODS.map(method => (
                            <button key={method.value} type="button" className={`${styles.roleBtn} ${posForm.paymentMethod === method.value ? styles.roleBtnActive : ''}`} onClick={() => setPosForm(current => ({ ...current, paymentMethod: method.value }))}>
                              {method.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className={styles.formField} style={{ margin: 0 }}>
                        <label className={styles.formLabel}>Nota interna</label>
                        <input className={styles.formInput} value={posForm.notes} onChange={event => setPosForm(current => ({ ...current, notes: event.target.value }))} placeholder="Ej: mesa 2 o recogida mostrador" />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, borderRadius: 18, background: 'white', border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#1C3829' }}>Carrito TPV</div>
                      <div style={{ fontSize: '.75rem', fontWeight: 800, color: '#6B7280' }}>{posItemCount} uds</div>
                    </div>

                    <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflow: 'auto', paddingRight: 4 }}>
                      {posForm.lines.map(line => (
                        <div key={line.productId} style={{ display: 'grid', gap: 8, padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '.86rem', fontWeight: 800, color: '#1C3829' }}>{line.emoji} {line.name}</div>
                              <div style={{ fontSize: '.74rem', color: '#6B7280' }}>{euro(line.unitPrice)} por unidad</div>
                            </div>
                            <button type="button" onClick={() => updatePosQty(line.productId, 0)} style={{ border: 'none', background: 'transparent', color: '#991B1B', fontWeight: 900, cursor: 'pointer' }}>
                              Quitar
                            </button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" onClick={() => updatePosQty(line.productId, line.qty - 1)} className={styles.roleBtn}>-</button>
                              <input data-testid={`cash-pos-qty-${line.productId}`} type="number" min="1" value={line.qty} onChange={event => updatePosQty(line.productId, event.target.value)} className={styles.formInput} style={{ width: 76, textAlign: 'center', margin: 0 }} />
                              <button type="button" onClick={() => updatePosQty(line.productId, line.qty + 1)} className={styles.roleBtn}>+</button>
                            </div>
                            <div style={{ fontSize: '.84rem', fontWeight: 900, color: '#166534' }}>
                              {euro(Number(line.unitPrice || 0) * Number(line.qty || 0))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {posForm.lines.length === 0 && <p className={styles.emptyNote}>Todavia no has agregado productos.</p>}
                    </div>

                    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#6B7280' }}>
                        <span>Items</span>
                        <strong>{posItemCount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 900, color: '#1C3829' }}>
                        <span>Total TPV</span>
                        <span>{euro(posSubtotal)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button className={styles.btnSecondary} onClick={() => setPosModal(false)} style={{ flex: 1 }}>Cancelar</button>
                      <button data-testid="cash-pos-save" className={styles.btnPrimary} onClick={savePosSale} disabled={posSaving} style={{ flex: 2, background: '#166534' }}>
                        {posSaving ? 'Registrando...' : 'Registrar venta'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
