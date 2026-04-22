import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { enrichProductsFromStock } from '../lib/catalogInsights'
import { buildProductSalesMap, getProductMarginSnapshot } from '../lib/adminMetrics'
import {
  buildSalesDataFromOrders,
  getCashBreakdown,
  printDailyCashTicket,
  todayKey,
} from '../lib/cashReporting'
import { loadMergedSettingsMap } from '../lib/storeSettings'
import {
  buildRiderCashCloseNotes,
  buildRiderDeliveryPayoutNotes,
  isRiderCashCloseEntry,
  isRiderDeliveryPayoutEntry,
  parseRiderCashCloseNotes,
  parseRiderDeliveryPayoutNotes,
} from '../lib/riderCash'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'

function euro(value) {
  return `EUR ${Number(value || 0).toFixed(2)}`
}

function daysAgo(count) {
  const date = new Date()
  date.setDate(date.getDate() - count)
  date.setHours(0, 0, 0, 0)
  return date
}

function dateKey(value) {
  return String(value || '').slice(0, 10)
}

function groupOrdersByRider(deliveredOrders, paidOrderIds, defaultFee = 0) {
  const groups = {}

  deliveredOrders.forEach(order => {
    if (!order.assigned_rider_id || paidOrderIds.has(order.id)) return
    const fee = Number(order.delivery_fee || 0) > 0 ? Number(order.delivery_fee || 0) : Number(defaultFee || 0)
    if (!groups[order.assigned_rider_id]) {
      groups[order.assigned_rider_id] = {
        riderId: order.assigned_rider_id,
        riderName: order.assigned_rider_name || 'Repartidor',
        pendingAmount: 0,
        perOrderFee: fee,
        orders: [],
      }
    }

    groups[order.assigned_rider_id].pendingAmount += fee
    groups[order.assigned_rider_id].orders.push(order)
  })

  return Object.values(groups)
    .filter(group => group.pendingAmount > 0 && group.orders.length > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
}

function QuickExpenseModal({ onClose, onSaved, storeId = 'default' }) {
  const { isPhone } = useResponsiveAdminLayout()
  const [form, setForm] = useState({ concept: '', amount: '', category: 'ingredientes', notes: '' })
  const [saving, setSaving] = useState(false)

  async function saveExpense() {
    const amount = Number(form.amount || 0)
    if (!form.concept.trim()) {
      toast.error('Concepto requerido')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Importe invalido')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('cash_entries').insert({
      date: new Date().toISOString().slice(0, 10),
      type: 'gasto',
      concept: form.concept.trim(),
      amount,
      category: form.category,
      notes: form.notes.trim() || null,
      store_id: storeId,
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Gasto registrado')
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={event => event.target === event.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 440, background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#1C3829' }}>Registrar gasto operativo</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer' }}>X</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <input value={form.concept} onChange={event => setForm(current => ({ ...current, concept: event.target.value }))} placeholder="Concepto" style={fieldStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10 }}>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="Importe" style={fieldStyle} />
            <select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} style={fieldStyle}>
              {['ingredientes', 'packaging', 'reparto', 'nomina', 'local', 'marketing', 'otro'].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <input value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Nota opcional" style={fieldStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={ghostButtonStyle}>Cancelar</button>
          <button onClick={saveExpense} disabled={saving} style={primaryButtonStyle}>{saving ? 'Guardando...' : 'Guardar gasto'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminBusinessTab({ products = [], onOpenOrders, onOpenStock, onOpenProducts, storeId = 'default' }) {
  const { isPhone, isCompact } = useResponsiveAdminLayout()
  const [period, setPeriod] = useState(30)
  const [orders, setOrders] = useState([])
  const [entries, setEntries] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [stockLinks, setStockLinks] = useState([])
  const [settingsMap, setSettingsMap] = useState({})
  const [ticketDate, setTicketDate] = useState(todayKey())
  const [loading, setLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [confirmingClosureId, setConfirmingClosureId] = useState(null)
  const [payingRiderId, setPayingRiderId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      ordersRes,
      entriesRes,
      stockRes,
      linksRes,
      settingsRes,
    ] = await Promise.all([
      supabase.from('orders').select('id,order_number,total,delivery_fee,created_at,delivered_at,status,assigned_rider_id,assigned_rider_name,items').eq('store_id', storeId).order('created_at', { ascending: false }).limit(500),
      supabase.from('cash_entries').select('*').eq('store_id', storeId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
      supabase.from('stock_items').select('*').eq('store_id', storeId).order('updated_at', { ascending: false }).limit(500),
      supabase.from('stock_item_products').select('stock_item_id,product_id').eq('store_id', storeId).limit(500),
      loadMergedSettingsMap(storeId, supabase),
    ])

    if (ordersRes.error) toast.error(ordersRes.error.message)
    if (entriesRes.error) toast.error(entriesRes.error.message)
    if (stockRes.error) toast.error(stockRes.error.message)
    if (linksRes.error && !/relation .* does not exist/i.test(String(linksRes.error.message || ''))) {
      toast.error(linksRes.error.message)
    }

    setOrders(ordersRes.data || [])
    setEntries(entriesRes.data || [])
    setStockItems(stockRes.data || [])
    setStockLinks(linksRes.data || [])
    setSettingsMap(settingsRes || {})
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    load()
  }, [load])

  const cutoff = useMemo(() => daysAgo(period), [period])
  const deliveredOrders = useMemo(
    () => orders.filter(order => order.status === 'delivered' && new Date(order.delivered_at || order.created_at) >= cutoff),
    [orders, cutoff]
  )
  const activeOrders = useMemo(
    () => orders.filter(order => ['pending', 'preparing', 'ready', 'delivering'].includes(order.status)),
    [orders]
  )
  const filteredEntries = useMemo(
    () => entries.filter(entry => new Date(`${entry.date}T00:00:00`) >= cutoff),
    [entries, cutoff]
  )
  const salesData = useMemo(
    () => buildSalesDataFromOrders(orders),
    [orders]
  )
  const selectedTicketEntries = useMemo(
    () => entries.filter(entry => entry.date === ticketDate),
    [entries, ticketDate]
  )
  const selectedTicketSales = useMemo(
    () => salesData.find(row => row.date === ticketDate) || null,
    [salesData, ticketDate]
  )
  const selectedTicketBreakdown = useMemo(
    () => getCashBreakdown(selectedTicketEntries),
    [selectedTicketEntries]
  )

  const salesRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const averageTicket = deliveredOrders.length > 0 ? salesRevenue / deliveredOrders.length : 0
  const operatingExpenses = filteredEntries
    .filter(entry => entry.type === 'gasto' && !isRiderDeliveryPayoutEntry(entry))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const withdrawals = filteredEntries
    .filter(entry => entry.type === 'retiro' && !isRiderCashCloseEntry(entry))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const riderPayouts = filteredEntries
    .filter(entry => isRiderDeliveryPayoutEntry(entry))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const estimatedOperationalProfit = salesRevenue - operatingExpenses - riderPayouts
  const selectedTicketProfit = Number(selectedTicketSales?.confirmed_revenue || 0)
    + Number(selectedTicketBreakdown.manualIncome || 0)
    + Number(selectedTicketBreakdown.riderIncome || 0)
    - Number(selectedTicketBreakdown.expense || 0)
    - Number(selectedTicketBreakdown.withdraw || 0)

  const pendingRiderClosures = useMemo(
    () => entries.filter(entry => isRiderCashCloseEntry(entry) && !parseRiderCashCloseNotes(entry.notes)?.admin_confirmed_at),
    [entries]
  )
  const pendingClosureAmount = pendingRiderClosures.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const paidDeliveryOrderIds = new Set(
    entries
      .filter(entry => isRiderDeliveryPayoutEntry(entry))
      .flatMap(entry => parseRiderDeliveryPayoutNotes(entry.notes)?.order_ids || [])
  )
  const pendingPayoutGroups = useMemo(
    () => groupOrdersByRider(orders.filter(order => order.status === 'delivered'), paidDeliveryOrderIds, settingsMap.delivery_fee),
    [orders, paidDeliveryOrderIds, settingsMap.delivery_fee]
  )
  const pendingPayoutAmount = pendingPayoutGroups.reduce((sum, group) => sum + group.pendingAmount, 0)

  const activeStockItems = stockItems.filter(item => !item.deleted_at)
  const inventoryValue = activeStockItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_per_unit || 0), 0)
  const noExpiryCount = activeStockItems.filter(item => !item.expiry_date).length
  const stockUrgentCount = activeStockItems.filter(item => {
    if (!item.expiry_date) return false
    const expiry = new Date(`${item.expiry_date}T00:00:00`)
    const daysLeft = Math.round((expiry - new Date()) / 86400000)
    return daysLeft >= 0 && daysLeft <= Number(item.alert_days || 2)
  }).length
  const stockExpiredCount = activeStockItems.filter(item => {
    if (!item.expiry_date) return false
    const expiry = new Date(`${item.expiry_date}T00:00:00`)
    return expiry < new Date(daysAgo(0))
  }).length

  const dailyTrend = useMemo(() => {
    const points = Array.from({ length: Math.min(period, 14) }, (_, index) => {
      const day = daysAgo(Math.min(period, 14) - index - 1)
      const key = dateKey(day.toISOString())
      const dayOrders = deliveredOrders.filter(order => dateKey(order.delivered_at || order.created_at) === key)
      return {
        key,
        label: key.slice(5),
        revenue: dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        ordersCount: dayOrders.length,
      }
    })
    const maxRevenue = Math.max(1, ...points.map(point => point.revenue))
    return { points, maxRevenue }
  }, [deliveredOrders, period])

  const enrichedProducts = useMemo(
    () => enrichProductsFromStock(products, stockItems, stockLinks, orders),
    [products, stockItems, stockLinks, orders]
  )
  const productSalesMap = useMemo(
    () => buildProductSalesMap(deliveredOrders, period),
    [deliveredOrders, period]
  )
  const productRows = useMemo(() => {
    return enrichedProducts.map(product => {
      const units = productSalesMap[product.id] || 0
      const snapshot = getProductMarginSnapshot(product)
      const profitContribution = snapshot.unitProfit != null ? snapshot.unitProfit * units : null
      return {
        ...product,
        soldUnits: units,
        margin: snapshot.margin,
        unitProfit: snapshot.unitProfit,
        profitContribution,
      }
    })
  }, [enrichedProducts, productSalesMap])
  const topPerformers = productRows
    .filter(row => row.soldUnits > 0)
    .sort((a, b) => Number(b.profitContribution || 0) - Number(a.profitContribution || 0))
    .slice(0, 5)
  const catalogAlerts = productRows
    .filter(row => row.soldUnits > 0 || row.out_of_stock)
    .filter(row => row.out_of_stock || row.margin == null || row.margin < 0.35)
    .sort((a, b) => {
      const scoreA = rowAlertScore(a)
      const scoreB = rowAlertScore(b)
      return scoreB - scoreA
    })
    .slice(0, 6)

  async function confirmRiderClosure(entry) {
    const closure = parseRiderCashCloseNotes(entry?.notes)
    if (!closure || closure.admin_confirmed_at) return

    setConfirmingClosureId(entry.id)
    const { error } = await supabase
      .from('cash_entries')
      .update({
        notes: buildRiderCashCloseNotes({
          ...closure,
          admin_confirmed_at: new Date().toISOString(),
          admin_confirmed_by: 'admin',
        }),
      })
      .eq('id', entry.id)
      .eq('store_id', storeId)
    setConfirmingClosureId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Caja de repartidor confirmada')
    load()
  }

  async function payRider(group) {
    if (!group || group.pendingAmount <= 0) return
    if (!window.confirm(`Registrar pago de ${euro(group.pendingAmount)} a ${group.riderName}?`)) return

    setPayingRiderId(group.riderId)
    const payload = {
      rider_id: group.riderId,
      rider_name: group.riderName,
      paid_at: new Date().toISOString(),
      order_ids: group.orders.map(order => order.id),
      order_numbers: group.orders.map(order => order.order_number).filter(Boolean),
      order_count: group.orders.length,
    }
    const { error } = await supabase.from('cash_entries').insert({
      date: new Date().toISOString().slice(0, 10),
      type: 'gasto',
      concept: `Pago delivery ${group.riderName}`,
      amount: Number(group.pendingAmount.toFixed(2)),
      category: 'reparto',
      notes: buildRiderDeliveryPayoutNotes(payload),
      store_id: storeId,
    })
    setPayingRiderId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Pago de repartidor registrado')
    load()
  }

  function printTicket() {
    printDailyCashTicket({
      entries,
      salesData,
      date: ticketDate,
      businessName: settingsMap.business_name || 'Oxidian',
      headerNote: settingsMap.cash_ticket_header || 'Oxidian · Ticket operativo de caja',
      footerText: settingsMap.cash_ticket_footer || 'Documento interno de caja diaria',
    })
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando centro de negocio...</div>
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg,#1C3829,#2D6A4F)', borderRadius: 22, padding: '20px 22px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.68)' }}>
              Operaciones de negocio
            </div>
            <div style={{ fontSize: '1.18rem', fontWeight: 900, marginTop: 4 }}>
              Ventas, utilidad, reparto y caja en un solo sistema.
            </div>
            <div style={{ fontSize: '.78rem', lineHeight: 1.6, color: 'rgba(255,255,255,.78)', marginTop: 6 }}>
              Enfoque tipo delivery: ventas netas, gasto operativo, pagos a riders, caja pendiente y alertas del catalogo.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[7, 30, 90].map(value => (
              <button key={value} onClick={() => setPeriod(value)} style={period === value ? activePillStyle : pillStyle}>
                {value}d
              </button>
            ))}
            <button onClick={printTicket} style={secondaryHeroButtonStyle}>Imprimir ticket</button>
            <button onClick={() => setShowExpenseModal(true)} style={secondaryHeroButtonStyle}>Registrar gasto</button>
            <button onClick={load} style={secondaryHeroButtonStyle}>Actualizar</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Ventas netas', value: euro(salesRevenue), sub: `${deliveredOrders.length} entregados`, tone: '#DCFCE7', color: '#166534' },
            { label: 'Ticket medio', value: euro(averageTicket), sub: 'por pedido entregado', tone: '#DBEAFE', color: '#1D4ED8' },
            { label: 'Gasto operativo', value: euro(operatingExpenses), sub: 'sin payouts riders', tone: '#FEE2E2', color: '#B91C1C' },
            { label: 'Pagos riders', value: euro(riderPayouts), sub: `${pendingPayoutGroups.length} pendientes`, tone: '#FEF3C7', color: '#92400E' },
            { label: 'Utilidad estimada', value: euro(estimatedOperationalProfit), sub: 'ventas - gastos - payouts', tone: estimatedOperationalProfit >= 0 ? '#D1FAE5' : '#FEE2E2', color: estimatedOperationalProfit >= 0 ? '#166534' : '#B91C1C' },
            { label: 'Caja pendiente', value: euro(pendingClosureAmount), sub: `${pendingRiderClosures.length} cierres por validar`, tone: '#F3E8FF', color: '#7C3AED' },
          ].map(card => (
            <div key={card.label} style={{ background: card.tone, borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ fontSize: '.66rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: card.color, opacity: 0.76 }}>{card.label}</div>
              <div style={{ fontSize: '1.24rem', fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
              <div style={{ fontSize: '.72rem', color: card.color, opacity: 0.75, marginTop: 4 }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.15fr .85fr', gap: 14 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Gestor de tickets</div>
              <div style={panelTitleStyle}>Caja diaria lista para imprimir</div>
            </div>
            <button onClick={printTicket} style={linkButtonStyle}>Imprimir</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={ticketDate} onChange={event => setTicketDate(event.target.value)} style={fieldStyle} />
              <div style={{ fontSize: '.78rem', color: '#6B7280', fontWeight: 700, minWidth: 0, flex: isPhone ? '1 1 100%' : '1 1 260px' }}>
                Selecciona el día para revisar ventas, caja, gastos y retiros antes de imprimir.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
              {[
                { label: 'Ventas', value: euro(selectedTicketSales?.confirmed_revenue || 0), note: `${selectedTicketSales?.delivered_count || 0} entregados`, tone: '#DCFCE7', color: '#166534' },
                { label: 'Ingreso manual', value: euro(selectedTicketBreakdown.manualIncome), note: `${selectedTicketEntries.filter(entry => entry.type === 'ingreso').length} movimientos`, tone: '#ECFDF5', color: '#166534' },
                { label: 'Liquidado riders', value: euro(selectedTicketBreakdown.riderIncome), note: 'cierres confirmados por admin', tone: '#DBEAFE', color: '#1D4ED8' },
                { label: 'Gastos', value: euro(selectedTicketBreakdown.expense), note: `${selectedTicketEntries.filter(entry => entry.type === 'gasto').length} salidas`, tone: '#FEE2E2', color: '#B91C1C' },
                { label: 'Retiros', value: euro(selectedTicketBreakdown.withdraw), note: 'salida de caja', tone: '#FEF3C7', color: '#92400E' },
                { label: 'Resultado', value: euro(selectedTicketProfit), note: 'resumen neto del día', tone: selectedTicketProfit >= 0 ? '#D1FAE5' : '#FEE2E2', color: selectedTicketProfit >= 0 ? '#166534' : '#B91C1C' },
              ].map(card => (
                <div key={card.label} style={{ padding: '12px 14px', borderRadius: 14, background: card.tone, border: '1px solid rgba(15,23,42,.04)' }}>
                  <div style={{ fontSize: '.66rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: card.color, opacity: 0.78 }}>{card.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
                  <div style={{ fontSize: '.72rem', color: card.color, opacity: 0.76, marginTop: 4 }}>{card.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Control del día</div>
              <div style={panelTitleStyle}>Qué va a salir en el ticket</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: '#F9FAFB', border: '1px solid #EEF2F7' }}>
              <div style={{ fontSize: '.70rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7280' }}>Pedidos</div>
              <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#1C3829', marginTop: 5 }}>{selectedTicketSales?.orders_count || 0} creados / {selectedTicketSales?.delivered_count || 0} entregados</div>
              <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>El ticket separa actividad comercial y caja operativa.</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: '#F9FAFB', border: '1px solid #EEF2F7' }}>
              <div style={{ fontSize: '.70rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7280' }}>Movimientos</div>
              <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#1C3829', marginTop: 5 }}>{selectedTicketEntries.length}</div>
              <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>Incluye gastos, retiros, ingresos manuales y liquidaciones de riders confirmadas.</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <div style={{ fontSize: '.70rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9A3412' }}>Ticket operativo</div>
              <div style={{ fontSize: '.92rem', fontWeight: 800, color: '#7C2D12', marginTop: 5 }}>
                Úsalo para cierre de caja del día, revisión de gasto real y respaldo imprimible.
              </div>
              <button onClick={printTicket} style={{ marginTop: 10, ...secondaryMiniButtonStyle, background: '#C2410C' }}>
                Imprimir ticket del día
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.2fr .8fr', gap: 14 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Ventas del periodo</div>
              <div style={panelTitleStyle}>Ritmo diario</div>
            </div>
            <button onClick={onOpenOrders} style={linkButtonStyle}>Abrir pedidos</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 180, paddingTop: 18 }}>
            {dailyTrend.points.map(point => (
              <div key={point.key} style={{ flex: 1, display: 'grid', gap: 6, justifyItems: 'center' }}>
                <div title={`${point.ordersCount} pedidos · ${euro(point.revenue)}`} style={{ width: '100%', height: `${Math.max(8, (point.revenue / dailyTrend.maxRevenue) * 120)}px`, borderRadius: 10, background: point.revenue > 0 ? 'linear-gradient(180deg,#40916C,#2D6A4F)' : '#E5E7EB' }} />
                <div style={{ fontSize: '.66rem', fontWeight: 800, color: '#6B7280' }}>{point.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Pulso operativo</div>
              <div style={panelTitleStyle}>Lo que pide accion</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { title: 'Pedidos activos', value: activeOrders.length, note: 'pendientes, cocina y reparto', action: onOpenOrders },
              { title: 'Pago riders pendiente', value: euro(pendingPayoutAmount), note: `${pendingPayoutGroups.length} repartidores por pagar`, action: null },
              { title: 'Inventario inmovilizado', value: euro(inventoryValue), note: `${noExpiryCount} sin caducidad · ${stockUrgentCount} urgentes`, action: onOpenStock },
              { title: 'Retiros del periodo', value: euro(withdrawals), note: 'salida de caja no operativa', action: null },
            ].map(item => (
              <div key={item.title} style={{ padding: '12px 14px', borderRadius: 14, background: '#F9FAFB', border: '1px solid #EEF2F7' }}>
                <div style={{ fontSize: '.70rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B7280' }}>{item.title}</div>
                <div style={{ fontSize: '1.06rem', fontWeight: 900, color: '#1C3829', marginTop: 5 }}>{item.value}</div>
                <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>{item.note}</div>
                {item.action && (
                  <button onClick={item.action} style={{ marginTop: 8, ...linkButtonStyle }}>
                    Abrir
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Caja de reparto</div>
              <div style={panelTitleStyle}>Cierres pendientes</div>
            </div>
          </div>

          {pendingRiderClosures.length === 0 ? (
            <div style={emptyStateStyle}>No hay cierres de repartidor pendientes de validacion.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pendingRiderClosures.slice(0, 6).map(entry => {
                const closure = parseRiderCashCloseNotes(entry.notes)
                return (
                  <div key={entry.id} style={rowCardStyle}>
                    <div>
                      <div style={{ fontWeight: 900, color: '#1C3829' }}>{closure?.rider_name || 'Repartidor'}</div>
                      <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>
                        {Number(closure?.delivered_count || 0)} pedidos · {dateKey(closure?.closed_at || entry.created_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#166534' }}>{euro(entry.amount)}</div>
                      <button onClick={() => confirmRiderClosure(entry)} disabled={confirmingClosureId === entry.id} style={{ marginTop: 8, ...primaryMiniButtonStyle }}>
                        {confirmingClosureId === entry.id ? 'Validando...' : 'Validar caja'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Pagos a repartidores</div>
              <div style={panelTitleStyle}>Pendientes de abono</div>
            </div>
          </div>

          {pendingPayoutGroups.length === 0 ? (
            <div style={emptyStateStyle}>No hay pagos de delivery pendientes ahora mismo.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pendingPayoutGroups.slice(0, 6).map(group => (
                <div key={group.riderId} style={rowCardStyle}>
                  <div>
                    <div style={{ fontWeight: 900, color: '#1C3829' }}>{group.riderName}</div>
                    <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>
                      {group.orders.length} entregas pendientes de pago · {euro(group.perOrderFee)} por entrega
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: '#92400E' }}>{euro(group.pendingAmount)}</div>
                    <button onClick={() => payRider(group)} disabled={payingRiderId === group.riderId} style={{ marginTop: 8, ...secondaryMiniButtonStyle }}>
                      {payingRiderId === group.riderId ? 'Registrando...' : 'Registrar pago'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Productos rentables</div>
              <div style={panelTitleStyle}>Lo que empuja ganancia</div>
            </div>
            <button onClick={onOpenProducts} style={linkButtonStyle}>Abrir catalogo</button>
          </div>

          {topPerformers.length === 0 ? (
            <div style={emptyStateStyle}>Todavia no hay suficientes ventas para leer rentabilidad del periodo.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {topPerformers.map(product => (
                <div key={product.id} style={rowCardStyle}>
                  <div>
                    <div style={{ fontWeight: 900, color: '#1C3829' }}>{product.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>
                      {product.soldUnits} unidades · margen {product.margin != null ? `${(product.margin * 100).toFixed(1)}%` : 'sin coste'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: '#166534' }}>{euro(product.profitContribution)}</div>
                    <div style={{ fontSize: '.70rem', color: '#6B7280', marginTop: 4 }}>{product.out_of_stock ? 'agotado' : 'activo'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Alertas del catalogo</div>
              <div style={panelTitleStyle}>Quitar duplicados y revisar lo importante</div>
            </div>
          </div>

          {catalogAlerts.length === 0 ? (
            <div style={emptyStateStyle}>Sin alertas fuertes de margen o disponibilidad en el periodo.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {catalogAlerts.map(product => (
                <div key={product.id} style={rowCardStyle}>
                  <div>
                    <div style={{ fontWeight: 900, color: '#1C3829' }}>{product.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>
                      {product.out_of_stock ? 'Agotado' : product.margin == null ? 'Falta coste' : `Margen bajo ${(product.margin * 100).toFixed(1)}%`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: product.out_of_stock ? '#B91C1C' : '#92400E' }}>
                      {product.soldUnits} uds
                    </div>
                    <div style={{ fontSize: '.70rem', color: '#6B7280', marginTop: 4 }}>{euro(product.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Stock util para finanzas</div>
            <div style={panelTitleStyle}>Inventario que afecta venta y coste</div>
          </div>
          <button onClick={onOpenStock} style={linkButtonStyle}>Abrir stock</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          {[
            { label: 'Valor inventario', value: euro(inventoryValue), note: 'cantidad por coste por unidad' },
            { label: 'Caducados', value: stockExpiredCount, note: 'deben salir o descartarse' },
            { label: 'Urgentes', value: stockUrgentCount, note: 'proximos a mover' },
            { label: 'Sin caducidad', value: noExpiryCount, note: 'controlados solo por coste y cantidad' },
          ].map(card => (
            <div key={card.label} style={{ padding: '12px 14px', borderRadius: 14, background: '#F9FAFB', border: '1px solid #EEF2F7' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em' }}>{card.label}</div>
              <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#1C3829', marginTop: 5 }}>{card.value}</div>
              <div style={{ fontSize: '.72rem', color: '#6B7280', marginTop: 4 }}>{card.note}</div>
            </div>
          ))}
        </div>
      </section>

      {showExpenseModal && <QuickExpenseModal onClose={() => setShowExpenseModal(false)} onSaved={load} storeId={storeId} />}
    </div>
  )
}

function rowAlertScore(row) {
  if (row.out_of_stock) return 3
  if (row.margin == null) return 2
  return row.margin < 0.35 ? 1 : 0
}

const fieldStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 12,
  border: '1.5px solid #E5E7EB',
  fontFamily: 'inherit',
  fontSize: '.88rem',
  boxSizing: 'border-box',
  background: 'white',
}

const panelStyle = {
  background: 'white',
  borderRadius: 18,
  border: '1px solid #E5E7EB',
  padding: 16,
  boxShadow: '0 4px 20px rgba(15,31,22,.05)',
}

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 14,
  flexWrap: 'wrap',
}

const panelTitleStyle = {
  fontSize: '.98rem',
  fontWeight: 900,
  color: '#1C3829',
}

const eyebrowStyle = {
  fontSize: '.68rem',
  fontWeight: 900,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: 4,
}

const pillStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1.5px solid rgba(255,255,255,.16)',
  background: 'rgba(255,255,255,.08)',
  color: 'white',
  fontSize: '.78rem',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const activePillStyle = {
  ...pillStyle,
  background: 'white',
  color: '#1C3829',
}

const primaryButtonStyle = {
  flex: 1,
  padding: '11px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#1C3829',
  color: 'white',
  fontWeight: 900,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ghostButtonStyle = {
  padding: '11px 14px',
  borderRadius: 12,
  border: '1.5px solid #E5E7EB',
  background: 'white',
  color: '#374151',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryHeroButtonStyle = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1.5px solid rgba(255,255,255,.18)',
  background: 'rgba(255,255,255,.08)',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const linkButtonStyle = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  background: '#F9FAFB',
  color: '#374151',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '.76rem',
}

const rowCardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: 14,
  background: '#F9FAFB',
  border: '1px solid #EEF2F7',
}

const primaryMiniButtonStyle = {
  padding: '7px 10px',
  borderRadius: 10,
  border: 'none',
  background: '#166534',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '.74rem',
}

const secondaryMiniButtonStyle = {
  padding: '7px 10px',
  borderRadius: 10,
  border: 'none',
  background: '#92400E',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '.74rem',
}

const emptyStateStyle = {
  padding: 20,
  borderRadius: 14,
  background: '#F9FAFB',
  color: '#6B7280',
  fontSize: '.84rem',
  fontWeight: 700,
}
