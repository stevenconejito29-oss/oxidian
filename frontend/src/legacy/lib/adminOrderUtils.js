import { normalizeToppings, SIZE_LABELS_ES } from './orderUtils'
import { isGiftOrderItem } from './clubGift'
import { buildOrderStatusFallbackMessage, buildOrderTicketMessage } from './adminBranding'

export const ADMIN_STATUS_COLORS = {
  pending: '#C05621',
  preparing: '#1D4ED8',
  ready: '#7C3AED',
  delivering: '#2D5A45',
  delivered: '#9CA3AF',
  cancelled: '#DC2626',
}

export const ADMIN_STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Esp. repartidor',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const ADMIN_STATUS_CLASS = {
  pending: 'order_pending',
  preparing: 'order_preparing',
  ready: 'order_ready',
  delivering: 'order_delivering',
  delivered: 'order_delivered',
  cancelled: 'order_cancelled',
}

export const ADMIN_WA_AUTO_STATUSES = ['pending', 'preparing', 'delivering', 'delivered']
export const ADMIN_WA_TICKET_PHONE = import.meta.env.VITE_WHATSAPP_NUMBER || '34622663874'

export function buildAdminTicket(order, brand = {}) {
  if (brand && Object.keys(brand).length > 0) {
    return buildOrderTicketMessage(order, brand)
  }

  const itemsText = (order.items || []).map(item => {
    const isCombo = !!(item.isCombo || item.is_combo)
    const giftLabel = isGiftOrderItem(item) ? ' [REGALO CLUB]' : ''
    const priceLabel = isGiftOrderItem(item)
      ? 'Gratis'
      : `€${(Number(item.price || 0) * Number(item.qty || 1)).toFixed(2)}`

    if (isCombo && item.combo_items) {
      const lines = item.combo_items.map((ci, idx) => {
        const sizeLabel = ci.size && ci.size !== 'small'
          ? ` (${SIZE_LABELS_ES[ci.size] || ci.size})`
          : ''
        const toppingLines = normalizeToppings(ci.toppings).map(v => `    - ${v}`).join('\n')
        return `  ${idx + 1}. ${ci.productName || ci.product_name}${sizeLabel}${toppingLines ? `\n${toppingLines}` : ''}`
      }).join('\n')
      return `*${item.product_name}${giftLabel}* x${item.qty} — ${priceLabel}\n${lines}`
    }

    const sizeLabel = item.size && item.size !== 'small'
      ? ` (${SIZE_LABELS_ES[item.size] || item.size})`
      : ''
    const toppingLines = normalizeToppings(item.toppings).map(v => `  - ${v}`).join('\n')
    return `*${item.product_name}${giftLabel}${sizeLabel}* x${item.qty} — ${priceLabel}${toppingLines ? `\n${toppingLines}` : ''}`
  }).join('\n')

  let message = `*PEDIDO TIENDA*\n#${order.order_number}\n━━━━━━━━━━━━\n`
  message += `*Cliente:* ${order.customer_name || 'Sin nombre'}\n`
  if (order.customer_phone) message += `*Tel:* ${order.customer_phone}\n`
  message += `*Dirección:* ${order.address || order.delivery_address || '—'}\n`
  if (order.notes) message += `*Notas:* ${order.notes}\n`
  message += `━━━━━━━━━━━━\n${itemsText}\n━━━━━━━━━━━━\n`
  if (order.affiliate_code) message += `Afiliado: ${order.affiliate_code}\n`
  if (order.coupon_code) message += `Cupón: ${order.coupon_code}\n`
  message += `*TOTAL: €${Number(order.total || 0).toFixed(2)}*\n_La tienda_`
  return message
}

export function buildAdminFallbackStatusMessage(order, status) {
  return buildAdminFallbackStatusMessageWithBrand(order, status)
}

export function buildAdminFallbackStatusMessageWithBrand(order, status, brand = {}) {
  if (brand && Object.keys(brand).length > 0) {
    return buildOrderStatusFallbackMessage(order, status, brand)
  }
  const customerName = order.customer_name || 'Cliente'
  const orderNumber = order.order_number || '—'
  const fallbackByStatus = {
    pending:    `¡Hola ${customerName}! Tu pedido #${orderNumber} ha sido confirmado. ¡Lo preparamos pronto! 🍓`,
    preparing:  `¡Hola ${customerName}! Tu pedido #${orderNumber} está siendo preparado 👨‍🍳`,
    delivering: `¡Hola ${customerName}! Tu pedido #${orderNumber} está en camino 🛵`,
    delivered:  `¡Hola ${customerName}! Tu pedido #${orderNumber} ha sido entregado. ¡Que lo disfrutes! 🎉`,
  }
  return fallbackByStatus[status] || null
}

export function openWhatsAppChat(phone, message) {
  if (!phone || !message) return
  const clean = String(phone).replace(/[^\d+]/g, '').replace(/^\+/, '')
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank')
}
