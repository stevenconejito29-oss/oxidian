import {
  isRiderCashCloseEntry,
  parseRiderCashCloseNotes,
  parseRiderDeliveryPayoutNotes,
} from './riderCash'
import {
  getPosPaymentMethodLabel,
  isPosSaleEntry,
  parsePosSaleNotes,
} from './posCash'

const CATEGORY_ICONS = {
  ventas: '💰',
  ingredientes: '🥛',
  packaging: '📦',
  reparto: '🛵',
  nomina: '👤',
  'nómina': '👤',
  local: '🏠',
  marketing: '📢',
  otro: '📝',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sumAmount(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}

function ensureSalesRow(map, key) {
  if (!key) return null
  if (!map[key]) {
    map[key] = {
      date: key,
      orders_count: 0,
      delivered_count: 0,
      confirmed_revenue: 0,
      avg_ticket: 0,
    }
  }
  return map[key]
}

function isConfirmedRiderClosure(entry) {
  const closure = parseRiderCashCloseNotes(entry?.notes)
  return Boolean(closure?.admin_confirmed_at)
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function euro(value) {
  return `EUR ${Number(value || 0).toFixed(2)}`
}

export function formatCashDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

export function getCashBreakdown(entries = []) {
  const riderClosures = entries.filter(entry => isRiderCashCloseEntry(entry) && isConfirmedRiderClosure(entry))
  const posSales = sumAmount(entries.filter(isPosSaleEntry))
  const manualIncome = sumAmount(entries.filter(entry =>
    entry.type === 'ingreso' &&
    !isRiderCashCloseEntry(entry) &&
    !isPosSaleEntry(entry)
  ))
  const riderIncome = sumAmount(riderClosures)
  const expense = sumAmount(entries.filter(entry => entry.type === 'gasto'))
  const withdraw = sumAmount(entries.filter(entry => entry.type === 'retiro' && !isRiderCashCloseEntry(entry)))
  const balance = manualIncome + posSales + riderIncome - expense - withdraw

  return { manualIncome, posSales, riderIncome, expense, withdraw, balance }
}

export function getCashEntryDisplay(entry) {
  const closure = parseRiderCashCloseNotes(entry?.notes)
  const payout = parseRiderDeliveryPayoutNotes(entry?.notes)
  const posSale = parsePosSaleNotes(entry?.notes)

  if (!closure) {
    if (posSale) {
      const summary = Array.isArray(posSale.item_summary) && posSale.item_summary.length > 0
        ? posSale.item_summary.join(', ')
        : `${Number(posSale.item_count || 0)} ud.`

      return {
        type: 'ingreso',
        concept: `${CATEGORY_ICONS.ventas} Venta mostrador #${posSale.order_number || 'TPV'} · ${getPosPaymentMethodLabel(posSale.payment_method)}`,
        notes: [summary, posSale.customer_name, posSale.note].filter(Boolean).join(' · ') || null,
      }
    }

    if (payout) {
      return {
        type: 'gasto',
        concept: `${CATEGORY_ICONS.reparto} Pago delivery ${payout.rider_name || 'repartidor'}`,
        notes: `${Number(payout.order_count || 0)} reparto${Number(payout.order_count || 0) === 1 ? '' : 's'}${payout.order_numbers?.length ? ` · #${payout.order_numbers.join(', #')}` : ''}`,
      }
    }

    return {
      type: entry.type,
      concept: `${CATEGORY_ICONS[entry.category] || CATEGORY_ICONS.otro} ${entry.concept}`,
      notes: entry.notes || null,
    }
  }

  const deliveredCount = Number(closure.delivered_count || 0)
  const closedAt = closure.closed_at
    ? new Date(closure.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null
  const noteParts = [
    `${deliveredCount} pedido${deliveredCount === 1 ? '' : 's'} liquidados`,
    closure.order_numbers?.length ? `#${closure.order_numbers.join(', #')}` : null,
    closedAt,
    closure.admin_confirmed_at ? 'confirmado por admin' : 'pendiente de confirmar',
  ].filter(Boolean)

  return {
    type: 'ingreso',
    concept: `${CATEGORY_ICONS.reparto} Liquidacion ${closure.rider_name || 'repartidor'}`,
    notes: noteParts.join(' · '),
  }
}

export function buildSalesDataFromOrders(orders = []) {
  const byDate = {}

  orders.forEach(order => {
    const createdKey = String(order.created_at || '').slice(0, 10)
    const createdRow = ensureSalesRow(byDate, createdKey)
    if (createdRow) createdRow.orders_count += 1

    if (order.status === 'delivered' || order.delivered_at) {
      const deliveredKey = String(order.delivered_at || order.created_at || '').slice(0, 10)
      const deliveredRow = ensureSalesRow(byDate, deliveredKey)
      if (deliveredRow) {
        deliveredRow.delivered_count += 1
        deliveredRow.confirmed_revenue += Number(order.total || 0)
      }
    }
  })

  return Object.values(byDate)
    .map(row => ({
      ...row,
      avg_ticket: row.delivered_count > 0 ? row.confirmed_revenue / row.delivered_count : 0,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function printDailyCashTicket({
  entries,
  salesData,
  date,
  businessName = 'Oxidian',
  headerNote = 'Oxidian · Contabilidad diaria',
  footerText = 'Documento generado automaticamente - no valido como factura',
}) {
  const dateStr = formatCashDate(date)
  const dayEntries = entries.filter(entry => entry.date === date)
  const todaySales = salesData.find(row => row.date === date)
  const { manualIncome, posSales, riderIncome, expense, withdraw } = getCashBreakdown(dayEntries)
  const salesRevenue = Number(todaySales?.confirmed_revenue || 0)
  const remoteRevenue = Math.max(0, salesRevenue - posSales)
  const netBalance = manualIncome + riderIncome + salesRevenue - expense - withdraw

  const entriesHtml = dayEntries.length
    ? dayEntries.map(entry => {
      const display = getCashEntryDisplay(entry)
      return `
      <tr>
        <td>${escapeHtml(formatCashDate(entry.date))}</td>
        <td><span class="tag tag-${escapeHtml(display.type)}">${escapeHtml(display.type)}</span></td>
        <td>${escapeHtml(display.concept)}</td>
        <td class="num ${display.type === 'ingreso' ? 'pos' : 'neg'}">${display.type === 'ingreso' ? '+' : '-'}${escapeHtml(euro(entry.amount))}</td>
      </tr>`
    }).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:16px">Sin movimientos de caja</td></tr>`

  const generatedAt = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const popup = window.open('', '_blank', 'width=600,height=900')
  if (!popup) {
    window.alert('Permite ventanas emergentes para imprimir')
    return
  }

  popup.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tiquet del dia ${escapeHtml(dateStr)} - ${escapeHtml(businessName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #111;
    background: white;
    padding: 20px;
    max-width: 580px;
    margin: 0 auto;
  }
  h1 { font-size: 20px; font-weight: 900; color: #2D6A4F; text-align: center; margin-bottom: 2px; }
  .sub { text-align: center; color: #888; font-size: 10px; margin-bottom: 4px; }
  .date-line { text-align: center; font-size: 13px; font-weight: 900; margin-bottom: 4px; }
  .ts { text-align: center; font-size: 9px; color: #aaa; margin-bottom: 14px; }
  hr { border: none; border-top: 2px dashed #ccc; margin: 12px 0; }
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .kpi { background: #F3F4F6; border-radius: 8px; padding: 10px 12px; }
  .kpi.green { background: #D1FAE5; }
  .kpi.red { background: #FEE2E2; }
  .kpi.gold { background: #FEF3C7; }
  .kpi.main { background: linear-gradient(135deg,#1e4535,#2D6A4F); color: white; grid-column: 1/-1; }
  .kpi-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; opacity: .65; margin-bottom: 3px; }
  .kpi-val { font-size: 18px; font-weight: 900; }
  .kpi.main .kpi-val { font-size: 22px; }
  .kpi.main .kpi-label { opacity: .55; }
  .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: #888; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; color: #888; padding: 6px 4px; border-bottom: 2px solid #E5E7EB; text-align: left; }
  td { padding: 7px 4px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
  td.num { text-align: right; font-weight: 900; }
  td.pos { color: #166534; }
  td.neg { color: #991B1B; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
  .tag-ingreso { background: #D1FAE5; color: #166534; }
  .tag-gasto { background: #FEE2E2; color: #991B1B; }
  .tag-retiro { background: #FEF3C7; color: #92400E; }
  .ventas-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
  .ventas-val { font-weight: 900; color: #166534; }
  .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #aaa; line-height: 1.5; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(businessName)}</h1>
  <div class="sub">${escapeHtml(headerNote)}</div>
  <div class="date-line">${escapeHtml(dateStr.charAt(0).toUpperCase() + dateStr.slice(1))}</div>
  <div class="ts">Generado: ${escapeHtml(generatedAt)}</div>
  <hr>

  ${todaySales ? `
  <div class="section-title">Resumen de ventas</div>
  <div style="margin-bottom:12px">
    <div class="ventas-row"><span>Pedidos totales</span><span class="ventas-val">${escapeHtml(String(todaySales.orders_count || 0))}</span></div>
    <div class="ventas-row"><span>Pedidos entregados</span><span class="ventas-val">${escapeHtml(String(todaySales.delivered_count || 0))}</span></div>
    <div class="ventas-row"><span>Ingresos confirmados</span><span class="ventas-val">${escapeHtml(euro(todaySales.confirmed_revenue))}</span></div>
    <div class="ventas-row"><span>Ventas delivery / online</span><span class="ventas-val">${escapeHtml(euro(remoteRevenue))}</span></div>
    <div class="ventas-row"><span>Ticket medio</span><span class="ventas-val">${escapeHtml(euro(todaySales.avg_ticket))}</span></div>
  </div>
  <hr>
  ` : `<div style="text-align:center;color:#9CA3AF;padding:10px;font-size:11px">Sin ventas registradas para este dia</div><hr>`}

  <div class="section-title">Caja del dia</div>
  <div class="kpi-grid">
    <div class="kpi green">
      <div class="kpi-label">Ingresos manuales</div>
      <div class="kpi-val">${escapeHtml(euro(manualIncome))}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Ventas mostrador</div>
      <div class="kpi-val">${escapeHtml(euro(posSales))}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Liquidado por reparto</div>
      <div class="kpi-val">${escapeHtml(euro(riderIncome))}</div>
    </div>
    <div class="kpi red">
      <div class="kpi-label">Gastos</div>
      <div class="kpi-val">${escapeHtml(euro(expense))}</div>
    </div>
    <div class="kpi gold">
      <div class="kpi-label">Retiros</div>
      <div class="kpi-val">${escapeHtml(euro(withdraw))}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Ventas de pedidos</div>
      <div class="kpi-val">${escapeHtml(euro(salesRevenue))}</div>
    </div>
    <div class="kpi main">
      <div class="kpi-label">Balance neto del dia</div>
      <div class="kpi-val">${escapeHtml(euro(netBalance))}</div>
    </div>
  </div>
  <hr>

  <div class="section-title">Movimientos de caja</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Tipo</th><th>Concepto</th><th style="text-align:right">Importe</th>
      </tr>
    </thead>
    <tbody>${entriesHtml}</tbody>
  </table>

  <div class="footer">
    ${escapeHtml(footerText)}<br>
    ${escapeHtml(businessName)}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`)

  popup.document.close()
}
