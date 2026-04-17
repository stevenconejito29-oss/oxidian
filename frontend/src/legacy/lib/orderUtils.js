/**
 * orderUtils.js — CarmoCream
 * ─────────────────────────────────────────────────────────────
 * Funciones puras compartidas entre Admin, Cocina y Repartidor.
 * Centraliza la lógica de normalización y formato de pedidos.
 * ─────────────────────────────────────────────────────────────
 */

// Normaliza el array de toppings desde cualquier formato Supabase
export function normalizeToppings(toppings) {
  if (!toppings) return []
  if (Array.isArray(toppings))
    return toppings.filter(Boolean).map(t => (typeof t === 'string' ? t : t.name || '')).filter(Boolean)
  return Object.values(toppings)
    .filter(Boolean)
    .flatMap(v => (Array.isArray(v) ? v.filter(Boolean) : [String(v)]))
    .filter(s => s && s !== 'null' && s !== 'undefined')
}

// Etiquetas de tamaño en español
export const SIZE_LABELS_ES = { small: 'Pequeña', medium: 'Mediana', large: 'Grande' }

// Estados del pedido — la única fuente de verdad
export const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']

export const STATUS_LABELS = {
  pending:    'Pendiente',
  preparing:  'Preparando',
  ready:      'Listo',
  delivering: 'En camino',
  delivered:  'Entregado',
  cancelled:  'Cancelado',
}

export const STATUS_COLORS = {
  pending:    '#C05621',
  preparing:  '#1D4ED8',
  ready:      '#166534',
  delivering: '#0891B2',
  delivered:  '#6B7280',
  cancelled:  '#DC2626',
}

export const STATUS_NEXT = {
  pending:   'preparing',
  preparing: 'ready',
  ready:     null,
  delivering:null,
  delivered: null,
  cancelled: null,
}

// Normaliza teléfono a formato internacional español
export function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('34') && digits.length === 11) return digits
  if (digits.length === 9) return '34' + digits
  if (digits.length >= 10) return digits
  return digits
}

// Calcula tiempo transcurrido en formato legible
export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000
  if (diff < 1)  return 'ahora'
  if (diff < 60) return `${Math.floor(diff)}m`
  return `${Math.floor(diff / 60)}h ${Math.floor(diff % 60)}m`
}

// Construye el objeto completo de item para guardar en Supabase
export function buildOrderItem(item) {
  return {
    id:          item.id         || null,
    product_name:item.product_name,
    emoji:       item.emoji      || '',
    image_url:   item.image_url  || null,
    qty:         item.qty,
    price:       item.price,
    size:        item.size       || null,
    toppings:    item.toppings   || {},
    isCombo:     item.isCombo    || false,
    comboId:     item.comboId    || null,
    combo_items: item.combo_items|| null,
    is_gift:     item.is_gift    || false,
    gift_source: item.gift_source || null,
    gift_level:  item.gift_level || null,
    gift_note:   item.gift_note  || null,
  }
}

// Verifica si un pedido lleva demasiado tiempo en su estado actual
export function isOrderLate(order) {
  const thresholds = { pending: 10, preparing: 20, ready: 15, delivering: 40 }
  const threshold = thresholds[order.status]
  if (!threshold) return false
  const mins = (Date.now() - new Date(order.created_at).getTime()) / 60000
  return mins > threshold
}
