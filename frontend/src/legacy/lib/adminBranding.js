import { buildAffiliateLoginLink, buildAffiliateMenuLink } from './affiliateAuth'
import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'

const PUBLIC_WEB_URL = (
  import.meta.env.VITE_PUBLIC_WEB_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '')

const URL_BASE = PUBLIC_WEB_URL || 'http://localhost'

export const SUPER_ADMIN_BRAND = {
  name: 'OXIDIAN',
  adminName: 'OXIDIAN Admin',
  subtitle: 'SaaS multi-tienda para operar, supervisar y escalar marcas independientes.',
}

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function normalizeInstagramHandle(value) {
  const raw = normalizeText(value)
  if (!raw) return ''
  return raw.startsWith('@') ? raw : `@${raw.replace(/^@+/, '')}`
}

export function buildStorePublicUrl(storeId = DEFAULT_STORE_ID) {
  const normalizedStoreId = normalizeStoreId(storeId)
  const canonicalPath = normalizedStoreId === DEFAULT_STORE_ID
    ? '/menu'
    : `/s/${normalizedStoreId}/menu`
  const url = new URL(canonicalPath, `${URL_BASE}/`)
  return url.toString()
}

export function buildStoreBrandingSnapshot(settingsMap = {}, storeConfig = null, storeId = DEFAULT_STORE_ID) {
  const merged = {
    ...(settingsMap || {}),
    ...(storeConfig || {}),
  }
  const normalizedStoreId = normalizeStoreId(storeId || merged.store_code || DEFAULT_STORE_ID)
  const businessName = normalizeText(merged.business_name, 'Mi tienda')
  const publicUrl = buildStorePublicUrl(normalizedStoreId)

  return {
    storeId: normalizedStoreId,
    businessName,
    tagline: normalizeText(merged.tagline),
    locationLabel: normalizeText(merged.address || merged.city),
    instagramHandle: normalizeInstagramHandle(merged.instagram_handle),
    instagramUrl: normalizeText(merged.instagram_url),
    whatsappNumber: normalizeText(merged.whatsapp_number),
    supportPhone: normalizeText(merged.support_phone),
    publicUrl,
    affiliateUrl: normalizeText(merged.affiliate_url) || buildAffiliateLoginLink(normalizedStoreId),
    reviewUrl: normalizeText(merged.review_url) || publicUrl,
  }
}

export function buildBrandFooter(brand = {}) {
  return [brand.businessName || 'La tienda', brand.locationLabel || ''].filter(Boolean).join(' · ')
}

export function buildAffiliateShareLink(code, storeId = DEFAULT_STORE_ID) {
  return buildAffiliateMenuLink(code, storeId)
}

export function buildOrderTicketMessage(order, brand = {}) {
  const itemsText = (order.items || []).map(item => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const isCombo = Boolean(item.isCombo || item.is_combo)

    if (isCombo && item.combo_items) {
      const comboLines = item.combo_items.map((comboItem, index) => {
        const sizeLabel = comboItem.size && comboItem.size !== 'small' ? ` (${comboItem.size})` : ''
        const toppings = Array.isArray(comboItem.toppings) ? comboItem.toppings : Object.values(comboItem.toppings || {})
        const toppingLines = toppings.filter(Boolean).map(value => `    - ${value}`).join('\n')
        return `  ${index + 1}. ${comboItem.productName || comboItem.product_name}${sizeLabel}${toppingLines ? `\n${toppingLines}` : ''}`
      }).join('\n')
      return `*${item.product_name}* x${qty} — €${(price * qty).toFixed(2)}\n${comboLines}`
    }

    const sizeLabel = item.size && item.size !== 'small' ? ` (${item.size})` : ''
    const toppings = Array.isArray(item.toppings) ? item.toppings : Object.values(item.toppings || {})
    const toppingLines = toppings.filter(Boolean).map(value => `  - ${value}`).join('\n')
    return `*${item.product_name}${sizeLabel}* x${qty} — €${(price * qty).toFixed(2)}${toppingLines ? `\n${toppingLines}` : ''}`
  }).join('\n')

  const footer = buildBrandFooter(brand)
  let message = `*PEDIDO ${String(brand.businessName || 'TIENDA').toUpperCase()}*\n#${order.order_number}\n━━━━━━━━━━━━\n`
  message += `*Cliente:* ${order.customer_name || 'Sin nombre'}\n`
  if (order.customer_phone) message += `*Tel:* ${order.customer_phone}\n`
  message += `*Dirección:* ${order.address || order.delivery_address || 'Sin dirección'}\n`
  if (order.notes) message += `*Notas:* ${order.notes}\n`
  message += `━━━━━━━━━━━━\n${itemsText}\n━━━━━━━━━━━━\n`
  if (order.affiliate_code) message += `Afiliado: ${order.affiliate_code}\n`
  if (order.coupon_code) message += `Cupón: ${order.coupon_code}\n`
  message += `*TOTAL: €${Number(order.total || 0).toFixed(2)}*`
  if (footer) message += `\n_${footer}_`
  return message
}

export function buildOrderStatusFallbackMessage(order, status, brand = {}) {
  const customerName = order.customer_name || 'Cliente'
  const orderNumber = order.order_number || '—'
  const businessName = brand.businessName || 'tu tienda'
  const footer = buildBrandFooter(brand)
  const suffix = footer ? `\n\n_${footer}_` : ''

  const fallbackByStatus = {
    pending: `Hola ${customerName}. Tu pedido en ${businessName} #${orderNumber} ha sido confirmado.${suffix}`,
    preparing: `Hola ${customerName}. Tu pedido en ${businessName} #${orderNumber} ya está en preparación.${suffix}`,
    delivering: `Hola ${customerName}. Tu pedido en ${businessName} #${orderNumber} ya va en camino.${suffix}`,
    delivered: `Hola ${customerName}. Tu pedido en ${businessName} #${orderNumber} ha sido entregado. Gracias por confiar en nosotros.${suffix}`,
  }

  return fallbackByStatus[status] || null
}

export function buildUrgentPromoCopies(item, brand = {}) {
  const businessName = brand.businessName || 'la tienda'
  const handle = brand.instagramHandle || businessName
  const publicUrl = brand.publicUrl || buildStorePublicUrl(brand.storeId || DEFAULT_STORE_ID)
  const locationLine = brand.locationLabel ? `Cobertura activa en ${brand.locationLabel}.` : 'Disponible hasta agotar existencias.'

  return [
    `🔥 Oferta flash en ${businessName}: ${item.name} con salida inmediata. Stock corto y prioridad de venta hoy. Pide aquí ${publicUrl}`,
    `⚡ ${item.name} entra en rotación rápida en ${businessName}. Si quieres aprovecharlo antes de que salga del stock, entra ahora: ${publicUrl}`,
    `📣 Movimiento urgente de stock en ${businessName}: ${item.name}. ${locationLine} Si quieres ver más novedades, sigue ${handle}.`,
  ]
}
