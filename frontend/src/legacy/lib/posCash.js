const POS_SALE_PREFIX = 'POS_SALE:'

export const POS_PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
]

export function getPosPaymentMethodLabel(method) {
  return POS_PAYMENT_METHODS.find(option => option.value === method)?.label || 'TPV'
}

export function buildPosSaleNotes(payload = {}) {
  return `${POS_SALE_PREFIX}${JSON.stringify({
    order_id: payload.order_id || null,
    order_number: payload.order_number || null,
    payment_method: payload.payment_method || 'cash',
    customer_name: payload.customer_name || null,
    item_count: Number(payload.item_count || 0),
    item_summary: Array.isArray(payload.item_summary) ? payload.item_summary.slice(0, 6) : [],
    cashier_name: payload.cashier_name || null,
    note: payload.note || null,
  })}`
}

export function parsePosSaleNotes(notes) {
  if (typeof notes !== 'string' || !notes.startsWith(POS_SALE_PREFIX)) return null
  try {
    const parsed = JSON.parse(notes.slice(POS_SALE_PREFIX.length))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function isPosSaleEntry(entry) {
  return Boolean(parsePosSaleNotes(entry?.notes))
}

export function buildPosOrderNote({ paymentMethod = 'cash', internalNote = '' } = {}) {
  const fragments = [`Venta mostrador · ${getPosPaymentMethodLabel(paymentMethod)}`]
  if (internalNote && internalNote.trim()) fragments.push(internalNote.trim())
  return fragments.join(' · ')
}
