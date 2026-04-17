/**
 * api/manifest.js — Vercel Serverless Function
 * ─────────────────────────────────────────────────────────────────────────────
 * INSTRUCCIONES DE INSTALACIÓN:
 *   1. Crear carpeta /api en la raíz del proyecto (al mismo nivel que /src)
 *   2. Copiar este archivo a /api/manifest.js
 *   3. Verificar que vercel.json tenga el rewrite (ya añadido automáticamente)
 *
 * Genera Web App Manifests (PWA) dinámicos por tienda.
 * Cada tienda tiene su propio nombre, color e icono en la PWA instalada.
 *
 * GET /api/manifest?store=<storeId>&type=menu       → menú público
 * GET /api/manifest?store=<storeId>&type=cocina     → panel de cocina
 * GET /api/manifest?store=<storeId>&type=repartidor → panel de repartidor
 *
 * Variables de entorno requeridas (ya en .env):
 *   VITE_SUPABASE_URL  (o SUPABASE_URL para server-side)
 *   VITE_SUPABASE_ANON_KEY  (o SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || ''
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

const TYPE_DEFAULTS = {
  menu: {
    bg: '#F2EEE8', theme: '#1A4733',
    orientation: 'portrait-primary',
    shortName: 'Menú', startPath: '/menu', scope: '/',
    categories: ['food', 'shopping'],
  },
  cocina: {
    bg: '#102418', theme: '#2D6A4F',
    orientation: 'landscape-primary',
    shortName: 'Cocina', startPath: '/pedidos', scope: '/pedidos',
    categories: ['business', 'productivity'],
  },
  repartidor: {
    bg: '#102418', theme: '#B8955A',
    orientation: 'portrait-primary',
    shortName: 'Repartidor', startPath: '/repartidor', scope: '/repartidor',
    categories: ['business', 'productivity'],
  },
}

function buildManifest({ type, storeId, businessName, themeColor, logoUrl }) {
  const d = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.menu
  const q = storeId && storeId !== 'default' ? `?store=${encodeURIComponent(storeId)}` : ''
  const startUrl = `${d.startPath}${q}${q ? '&' : '?'}source=pwa`
  const scopeUrl = type === 'menu' ? `/${q}` : `${d.scope}${q}`
  const name     = type === 'menu' ? businessName : `${businessName} · ${d.shortName}`
  const shortName = type === 'menu'
    ? (businessName.split(/[\s·\-]/)[0] || 'Tienda').slice(0, 12)
    : d.shortName

  return {
    name,
    short_name:   shortName,
    description:  type === 'menu'
      ? `Pedidos online de ${businessName}`
      : `Panel de ${d.shortName.toLowerCase()} de ${businessName}`,
    start_url:    startUrl,
    scope:        scopeUrl,
    id:           `${d.startPath}${q}`,
    display:      'standalone',
    background_color: d.bg,
    theme_color:  themeColor || d.theme,
    orientation:  d.orientation,
    lang: 'es', dir: 'ltr',
    icons: [
      { src: logoUrl || '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: logoUrl || '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    categories: d.categories,
    prefer_related_applications: false,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')

  const storeId = String(req.query.store || '').trim()
  const type    = TYPE_DEFAULTS[req.query.type] ? req.query.type : 'menu'

  if (!storeId || storeId === 'default') {
    return res.status(200).json(buildManifest({ type, storeId: '', businessName: 'Mi Tienda' }))
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(200).json(buildManifest({ type, storeId, businessName: 'Tienda' }))
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
    const [storeRes, settingsRes] = await Promise.all([
      sb.from('stores').select('name').eq('id', storeId).maybeSingle(),
      sb.from('store_settings').select('key,value').eq('store_id', storeId)
        .in('key', ['business_name', 'theme_primary_color', 'logo_url']),
    ])
    const storeName    = storeRes.data?.name || 'Tienda'
    const sm           = Object.fromEntries((settingsRes.data || []).map(r => [r.key, r.value]))
    const businessName = sm.business_name || storeName
    return res.status(200).json(buildManifest({
      type, storeId,
      businessName,
      themeColor: sm.theme_primary_color || null,
      logoUrl:    sm.logo_url || null,
    }))
  } catch (err) {
    console.error('[api/manifest]', err.message)
    return res.status(200).json(buildManifest({ type, storeId, businessName: 'Tienda' }))
  }
}
