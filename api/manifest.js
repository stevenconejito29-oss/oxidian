// api/manifest.js — Vercel Serverless Function
// Genera un Web App Manifest dinámico por tienda y tipo
// URL: /api/manifest?store=<storeId>&type=<menu|cocina|repartidor>
//
// Variables de entorno necesarias en Vercel (Settings → Environment Variables):
//   SUPABASE_URL            → URL del proyecto Supabase (sin VITE_ prefix)
//   SUPABASE_ANON_KEY       → Anon key (sin VITE_ prefix)
//   SUPABASE_SERVICE_ROLE_KEY → Service role key (opcional, preferido)
//
// NOTA: Las variables VITE_* solo existen en el bundle del navegador (Vite).
//       En Vercel Serverless Functions se deben usar sin el prefijo VITE_.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY

const DEFAULTS = {
  color: '#2D6A4F', bg: '#FFF5EE', name: 'CarmoCream', icon: '/logo.png',
}

function slugify(str) {
  return String(str || '').toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'default'
}

const TYPE_META = {
  cocina:     { suffix: ' · Cocina',   shortSuffix: 'Cocina',  page: '/pedidos',    display: 'standalone', orientation: 'landscape-primary' },
  repartidor: { suffix: ' · Reparto',  shortSuffix: 'Reparto', page: '/repartidor', display: 'standalone', orientation: 'portrait-primary' },
  menu:       { suffix: '',            shortSuffix: '',         page: '/menu',       display: 'standalone', orientation: 'portrait-primary' },
}

async function loadStoreCfg(storeId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const sb  = createClient(SUPABASE_URL, SUPABASE_KEY)
    const slug = slugify(storeId)
    if (slug === 'default') {
      const { data } = await sb.from('config_tienda')
        .select('business_name,logo_url,theme_primary_color,theme_surface_color')
        .eq('id', 'default').maybeSingle()
      return data
    }
    const { data: rows } = await sb.from('store_settings')
      .select('key,value').eq('store_id', slug)
      .in('key', ['business_name', 'logo_url', 'theme_primary_color', 'theme_surface_color'])
    if (!rows?.length) return null
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  } catch { return null }
}

export default async function handler(req, res) {
  const { store = 'default', type = 'menu' } = req.query
  const meta    = TYPE_META[type] || TYPE_META.menu
  const storeId = slugify(store)
  const cfg     = await loadStoreCfg(storeId)

  const name  = String(cfg?.business_name || DEFAULTS.name)
  const color = /^#[0-9a-fA-F]{3,6}$/.test(cfg?.theme_primary_color) ? cfg.theme_primary_color : DEFAULTS.color
  const bg    = /^#[0-9a-fA-F]{3,6}$/.test(cfg?.theme_surface_color) ? cfg.theme_surface_color : DEFAULTS.bg
  const icon  = String(cfg?.logo_url || DEFAULTS.icon)

  const base     = storeId === 'default' ? '' : `/s/${storeId}`
  const startUrl = `${base}${meta.page}` || '/'
  const scope    = base || '/'

  const manifest = {
    name:             `${name}${meta.suffix}`,
    short_name:       meta.shortSuffix ? `${name} ${meta.shortSuffix}`.trim() : name,
    description:      `${name} — pedidos online`,
    start_url:        startUrl,
    display:          meta.display,
    orientation:      meta.orientation,
    background_color: bg,
    theme_color:      color,
    scope,
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  res.status(200).json(manifest)
}
