import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import { applyStoreDesign, loadGoogleFont } from './lib/style_generator'
import { loadStoreConfig } from './lib/storeConfig'
import { isOxidianAccessPath, OXIDIAN_ENTRY_PATH } from './lib/oxidianAccess'
import { DEFAULT_STORE_ID, resolveConfiguredStoreContext } from './lib/currentStore'

// ── Redirect helper para rutas /s/:storeSlug/<sección> ───────────────────────
// DEPRECATED: ya no se usa redirect. Las páginas leen el slug directamente
// desde la URL via currentStore.js → getRequestedStoreId() → path detection.
// Se mantiene como fallback por compatibilidad con links viejos.
function StoreSlugRedirect({ to }) {
  const { storeSlug } = useParams()
  const navigate = useNavigate()
  React.useEffect(() => {
    const dest = `/${to}?store=${encodeURIComponent(storeSlug || '')}`
    navigate(dest, { replace: true })
  }, [storeSlug, to, navigate])
  return null
}

const Menu = lazy(() => import('./pages/Menu'))
const Admin = lazy(() => import('./pages/Admin'))
const OxidianLanding = lazy(() => import('./pages/OxidianLanding'))
const OxidianPage = lazy(() => import('./pages/OxidianPage'))
const OxidianOnboarding = lazy(() => import('./pages/OxidianOnboarding'))
const Pedidos = lazy(() => import('./pages/Pedidos'))
const Repartidor = lazy(() => import('./pages/Repartidor'))
const AffiliatePortal = lazy(() => import('./pages/AffiliatePortal'))

const OXIDIAN_THEME_CONFIG = {
  business_name: 'OXIDIAN',
  theme_primary_color: '#4F46E5',
  theme_secondary_color: '#06B6D4',
  theme_accent_color: '#F97316',
  theme_surface_color: '#020617',
  theme_text_color: '#E2E8F0',
  theme_font_display: 'Space Grotesk',
  theme_font_body: 'Manrope',
  theme_button_radius: '18px',
  theme_daisy_theme: 'oxidian',
  order_flow_type: 'standard',
  catalog_mode: 'generic',
}

function hasExplicitStoreRoute(pathname = '', search = '') {
  const hasStoreQuery = new URLSearchParams(search).get('store')
  return Boolean(hasStoreQuery) || /^\/s\/[^/]+/.test(pathname)
}

function isOxidianRoute(pathname = '', search = '', storeContext = { resolvedByDomain: false }) {
  if (pathname.startsWith('/onboarding')) return true
  if (isOxidianAccessPath(pathname)) return true
  return pathname === '/' && !hasExplicitStoreRoute(pathname, search) && !storeContext?.resolvedByDomain
}

async function resolveRouteThemeConfig(
  pathname = window.location.pathname,
  search = window.location.search,
  storeContext = { storeId: DEFAULT_STORE_ID, resolvedByDomain: false },
) {
  if (isOxidianRoute(pathname, search, storeContext)) {
    return OXIDIAN_THEME_CONFIG
  }

  const config = await loadStoreConfig(storeContext?.storeId || DEFAULT_STORE_ID, undefined, { visibility: 'public' }).catch(() => null)
  return config || OXIDIAN_THEME_CONFIG
}

function applyRouteTheme(storeConfig = OXIDIAN_THEME_CONFIG) {
  applyStoreDesign(storeConfig || OXIDIAN_THEME_CONFIG)
}

function RootEntry() {
  const location = useLocation()
  const [entryComponent, setEntryComponent] = React.useState(() => {
    if (hasExplicitStoreRoute(location.pathname, location.search)) return Menu
    return null
  })

  React.useEffect(() => {
    let active = true

    if (hasExplicitStoreRoute(location.pathname, location.search)) {
      setEntryComponent(() => Menu)
      return () => { active = false }
    }

    resolveConfiguredStoreContext()
      .then(context => {
        if (!active) return
        setEntryComponent(() => (context?.resolvedByDomain ? Menu : OxidianLanding))
      })
      .catch(() => {
        if (active) setEntryComponent(() => OxidianLanding)
      })

    return () => { active = false }
  }, [location.pathname, location.search])

  if (!entryComponent) return <PageLoader />
  return <LazyPage Component={entryComponent} />
}

function MenuEntry() {
  const location = useLocation()
  const [allowTenantRoute, setAllowTenantRoute] = React.useState(() => (
    hasExplicitStoreRoute(location.pathname, location.search) ? true : null
  ))

  React.useEffect(() => {
    let active = true

    if (hasExplicitStoreRoute(location.pathname, location.search)) {
      setAllowTenantRoute(true)
      return () => { active = false }
    }

    resolveConfiguredStoreContext()
      .then(context => {
        if (active) setAllowTenantRoute(Boolean(context?.resolvedByDomain))
      })
      .catch(() => {
        if (active) setAllowTenantRoute(false)
      })

    return () => { active = false }
  }, [location.pathname, location.search])

  if (allowTenantRoute == null) return <PageLoader />
  if (!allowTenantRoute) return <Navigate to="/" replace />
  return <LazyPage Component={Menu} />
}

// Lee el emoji del tenant activo desde sessionStorage (escrito por resolveDomainStoreContext)
function getLoaderEmoji() {
  try {
    const raw = window.sessionStorage?.getItem('cc_domain_store_context')
    if (raw) {
      const ctx = JSON.parse(raw)
      if (ctx?.emoji) return ctx.emoji
    }
  } catch { /* ignorar */ }
  // Fallback neutro mientras no hay contexto de tienda resuelto
  return null
}

function PageLoader() {
  const emoji = getLoaderEmoji()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: 'var(--brand-surface, #0f172a)',
        fontFamily: "'Nunito', sans-serif",
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {emoji
        ? <span style={{ fontSize: '2.2rem' }}>{emoji}</span>
        : (
          <span style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: 'var(--brand-primary, #4F46E5)',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }} />
        )
      }
      <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
        Cargando...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function LazyPage({ Component }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

function ThemeBoot() {
  React.useEffect(() => {
    loadGoogleFont('Pacifico')
    loadGoogleFont('Nunito')
    loadGoogleFont('Space Grotesk')
    loadGoogleFont('Manrope')
    resolveConfiguredStoreContext()
      .then(context => {
        syncManifestForRoute(window.location.pathname, window.location.search, context?.storeId, context?.resolvedByDomain)
        return resolveRouteThemeConfig(window.location.pathname, window.location.search, context)
          .then(storeConfig => applyRouteTheme(storeConfig))
      })
      .catch(() => {
        applyRouteTheme(OXIDIAN_THEME_CONFIG)
      })
  }, [])
  return null
}

// Detecta el tipo de manifest según la ruta
function manifestTypeForPath(pathname) {
  const parts = pathname.split('/')
  if (parts.includes('pedidos'))    return 'cocina'
  if (parts.includes('repartidor')) return 'repartidor'
  return 'menu'
}

// Estáticos de fallback (usados si /api/manifest no está disponible)
const STATIC_MANIFESTS = {
  menu:       '/manifest.json',
  cocina:     '/manifest-cocina.json',
  repartidor: '/manifest-repartidor.json',
}

function syncManifestForRoute(pathname, search = '', resolvedStoreId = '', resolvedByDomain = false) {
  // Detecta store desde ?store= o desde /s/:slug/...
  let storeId = new URLSearchParams(search).get('store') || ''
  if (!storeId) {
    const pathMatch = pathname.match(/^\/s\/([^/]+)/)
    if (pathMatch?.[1]) storeId = pathMatch[1]
  }
  if (!storeId && resolvedByDomain) {
    storeId = resolvedStoreId || ''
  }
  const type = manifestTypeForPath(pathname)

  // Solo activar manifest para rutas que lo necesitan
  const needsManifest = type !== 'menu' || storeId
  const existingLink = document.querySelector('link[rel="manifest"]')
  if (!needsManifest) {
    existingLink?.remove()
    return
  }

  let link = existingLink
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }

  if (storeId && storeId !== 'default') {
    // API dinámica: nombre, color e icono de cada tienda
    // Vercel Serverless Function en /api/manifest.js
    // NOTA: requiere crear la carpeta /api en la raíz del proyecto manualmente
    // o via terminal: mkdir api && crear el archivo api/manifest.js
    // Ver plantilla completa en docs/API_MANIFEST_TEMPLATE.md
    link.href = `/api/manifest?store=${encodeURIComponent(storeId)}&type=${type}`
  } else {
    // Fallback estático para la tienda por defecto
    link.href = STATIC_MANIFESTS[type]
  }
}

syncManifestForRoute(window.location.pathname, window.location.search)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  )
}

window.__pwaInstallEvt = null
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  window.__pwaInstallEvt = event
  window.dispatchEvent(new Event('pwainstallready'))
})
window.addEventListener('appinstalled', () => {
  window.__pwaInstallEvt = null
  window.dispatchEvent(new Event('pwainstalled'))
})

function setVH() {
  const height = window.visualViewport ? window.visualViewport.height : window.innerHeight
  document.documentElement.style.setProperty('--vh', `${height * 0.01}px`)
  document.documentElement.style.setProperty('--dvh', `${height * 0.01}px`)
}

setVH()
window.addEventListener('resize', setVH, { passive: true })
window.addEventListener('orientationchange', () => setTimeout(setVH, 200), { passive: true })

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setVH, { passive: true })
  window.visualViewport.addEventListener('scroll', setVH, { passive: true })
}

const router = createBrowserRouter([
  // ── Rutas canónicas (sin slug) — resuelven store por ?store= o config local ──
  { path: '/', element: <RootEntry /> },
  { path: '/menu', element: <MenuEntry /> },
  { path: '/admin', element: <LazyPage Component={Admin} /> },
  { path: OXIDIAN_ENTRY_PATH, element: <LazyPage Component={OxidianPage} /> },
  { path: '/oxidian', element: <LazyPage Component={OxidianPage} /> },
  { path: '/onboarding', element: <LazyPage Component={OxidianOnboarding} /> },
  { path: '/pedidos', element: <LazyPage Component={Pedidos} /> },
  { path: '/repartidor', element: <LazyPage Component={Repartidor} /> },
  { path: '/afiliado', element: <LazyPage Component={AffiliatePortal} /> },
  { path: '/app', element: <Navigate to="/menu" replace /> },

  // ── Rutas con slug de tienda — /s/:storeSlug/<sección> ──────────────────────
  // Renderizan la página directamente. currentStore.js detecta el slug del path.
  // No hay redirect: la URL /s/carmona/menu permanece limpia en el navegador.
  {
    path: '/s/:storeSlug',
    element: <LazyPage Component={Menu} />,
  },
  {
    path: '/s/:storeSlug/menu',
    element: <LazyPage Component={Menu} />,
  },
  {
    path: '/s/:storeSlug/admin',
    element: <LazyPage Component={Admin} />,
  },
  {
    path: '/s/:storeSlug/pedidos',
    element: <LazyPage Component={Pedidos} />,
  },
  {
    path: '/s/:storeSlug/repartidor',
    element: <LazyPage Component={Repartidor} />,
  },
  {
    path: '/s/:storeSlug/afiliado',
    element: <LazyPage Component={AffiliatePortal} />,
  },
  // OXIDIAN super admin: solo en la ruta oculta configurada (global, no por tienda)
  // La ruta /s/:storeSlug/oxidian fue eliminada intencionalmente para evitar
  // acceso al panel maestro desde una URL de tienda específica.
])

router.subscribe(state => {
  resolveConfiguredStoreContext()
    .then(context => {
      syncManifestForRoute(state.location.pathname, state.location.search, context?.storeId, context?.resolvedByDomain)
      return resolveRouteThemeConfig(state.location.pathname, state.location.search, context)
        .then(storeConfig => applyRouteTheme(storeConfig))
    })
    .catch(() => {
      syncManifestForRoute(state.location.pathname, state.location.search)
      applyRouteTheme(OXIDIAN_THEME_CONFIG)
    })
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeBoot />
    <RouterProvider router={router} />
    <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
  </React.StrictMode>
)
