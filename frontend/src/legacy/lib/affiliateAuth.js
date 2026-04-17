const PUBLIC_WEB_URL = (
  import.meta.env.VITE_PUBLIC_WEB_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '')
const URL_BASE = PUBLIC_WEB_URL || 'http://localhost'

export function normalizeAffiliateCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .trim()
}

export function buildAffiliateCodeSeed(value) {
  const normalized = normalizeAffiliateCode(value)
  if (normalized) return normalized

  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12)
}

export async function sha256Hex(value) {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')))
  return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function generateAffiliateSetupToken() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `aff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function withStoreParam(path, storeId) {
  const url = new URL(path, `${URL_BASE}/`)
  if (storeId && storeId !== 'default') url.searchParams.set('store', storeId)
  return url.toString()
}

export function buildAffiliateMenuLink(code, storeId = null) {
  const url = new URL(withStoreParam('/', storeId))
  url.searchParams.set('ref', normalizeAffiliateCode(code))
  return url.toString()
}

export function buildAffiliateSetupLink(token, storeId = null) {
  const url = new URL(withStoreParam('/afiliado', storeId))
  url.searchParams.set('setup', token || '')
  return url.toString()
}

export function buildAffiliateLoginLink(storeId = null) {
  return withStoreParam('/afiliado', storeId)
}

/**
 * buildStoreLinks — genera todos los links de acceso a una tienda.
 * Útil para OxidianPage, correos de bienvenida, documentación interna, etc.
 *
 * @param {string} storeId  — ID de la tienda (slug o UUID)
 * @returns {object}  — { menu, admin, pedidos, repartidor, afiliado, slug }
 *
 * Ejemplo:
 *   buildStoreLinks('tienda-norte')
 *   → {
 *       menu:        'https://tudominio.com/s/tienda-norte/menu',
 *       admin:       'https://tudominio.com/admin?store=tienda-norte',
 *       pedidos:     'https://tudominio.com/pedidos?store=tienda-norte',
 *       repartidor:  'https://tudominio.com/repartidor?store=tienda-norte',
 *       afiliado:    'https://tudominio.com/afiliado?store=tienda-norte',
 *       slug:        'https://tudominio.com/s/tienda-norte',
 *     }
 */
export function buildStoreLinks(storeId) {
  const id = String(storeId || '').trim()
  if (!id || id === 'default') {
    return {
      menu:       `${URL_BASE}/menu`,
      admin:      `${URL_BASE}/admin`,
      pedidos:    `${URL_BASE}/pedidos`,
      repartidor: `${URL_BASE}/repartidor`,
      afiliado:   `${URL_BASE}/afiliado`,
      slug:       `${URL_BASE}/s/`,
    }
  }
  const q = `?store=${encodeURIComponent(id)}`
  return {
    // URL limpia con slug (amigable para compartir / instalar PWA)
    menu:       `${URL_BASE}/s/${encodeURIComponent(id)}/menu`,
    admin:      `${URL_BASE}/admin${q}`,
    pedidos:    `${URL_BASE}/pedidos${q}`,
    repartidor: `${URL_BASE}/repartidor${q}`,
    afiliado:   `${URL_BASE}/afiliado${q}`,
    slug:       `${URL_BASE}/s/${encodeURIComponent(id)}`,
    // Manifests dinámicos (para información / QR / documentación)
    manifestMenu:       `${URL_BASE}/api/manifest${q}&type=menu`,
    manifestCocina:     `${URL_BASE}/api/manifest${q}&type=cocina`,
    manifestRepartidor: `${URL_BASE}/api/manifest${q}&type=repartidor`,
  }
}

export function buildAffiliateInviteMessage({
  affiliateName,
  affiliateCode,
  discountPercent,
  commissionPercent,
  setupLink,
  businessName,
}) {
  const businessLabel = businessName || 'la tienda'
  return [
    `Hola ${affiliateName || 'afiliado'}!`,
    '',
    `Tu solicitud de afiliado para ${businessLabel} ha sido aprobada.`,
    `Codigo: *${normalizeAffiliateCode(affiliateCode)}*`,
    `Descuento para tus clientes: *${Number(discountPercent || 0)}%*`,
    `Tu comision por pedido referido: *${Number(commissionPercent || 0)}%*`,
    '',
    'Activa ahora tu acceso y crea tu contrasena aqui:',
    setupLink,
    '',
    'Dentro veras solo tus metricas, tu saldo y lo que puedes generar compartiendo tu enlace.',
  ].join('\n')
}

export function buildAffiliateApplicationAdminMessage(application, businessName = 'Tienda') {
  return [
    `Nueva solicitud de afiliado · ${businessName}`,
    '',
    `Nombre: ${application.full_name || '-'}`,
    `Nombre afiliado: ${application.requested_affiliate_name || application.full_name || '-'}`,
    `Telefono: ${application.phone || '-'}`,
    `Instagram: ${application.instagram_handle || '-'}`,
    `Ciudad: ${application.city || '-'}`,
    `Canal principal: ${application.primary_channel || '-'}`,
    `Audiencia: ${application.audience_size || '-'}`,
    `Codigo deseado: ${application.requested_code || '-'}`,
    `Motivacion: ${application.motivation || '-'}`,
  ].join('\n')
}
