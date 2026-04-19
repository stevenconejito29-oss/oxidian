/**
 * PublicMenuPage — Menú público multi-estilo.
 *
 * Detecta el storeSlug desde la URL, carga la configuración de la tienda
 * (colores, niche, menu_style, template) y renderiza el estilo correcto.
 *
 * 5 estilos disponibles (mapeados desde stores.template_id o niche):
 *   delivery   → MenuStyleDelivery   (restaurantes, comida rápida)
 *   vitrina    → MenuStyleGrid       (supermercado, tienda de barrio)
 *   portfolio  → MenuStyleBoutique   (moda, boutique)
 *   minimal    → MenuStyleCatalog    (farmacia, catálogo)
 *   booking    → MenuStyleBooking    (barbería, salón, servicios)
 */
import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { useStorePublicConfig }  from '../hooks/useStorePublicConfig'
import { usePublicCart }         from '../hooks/usePublicCart'
import { MenuStyleDelivery }     from '../styles/MenuStyleDelivery'
import { MenuStyleGrid }         from '../styles/MenuStyleGrid'
import { MenuStyleBoutique }     from '../styles/MenuStyleBoutique'
import { MenuStyleCatalog }      from '../styles/MenuStyleCatalog'
import { MenuStyleBooking }      from '../styles/MenuStyleBooking'
import CartDrawer                from '../components/CheckoutDrawer'

// Mapa: template_id / niche → componente de estilo
const STYLE_MAP = {
  // Por template_id (campo stores.template_id)
  delivery:  MenuStyleDelivery,
  vitrina:   MenuStyleGrid,
  portfolio: MenuStyleBoutique,
  minimal:   MenuStyleCatalog,
  booking:   MenuStyleBooking,

  // Por niche (fallback si no hay template_id)
  restaurant:         MenuStyleDelivery,
  fastfood:           MenuStyleDelivery,
  food:               MenuStyleDelivery,
  supermarket:        MenuStyleGrid,
  minimarket:         MenuStyleGrid,
  neighborhood_store: MenuStyleCatalog,
  boutique_fashion:   MenuStyleBoutique,
  clothing:           MenuStyleBoutique,
  pharmacy:           MenuStyleCatalog,
  barbershop:         MenuStyleBooking,
  beauty_salon:       MenuStyleBooking,
  nail_salon:         MenuStyleBooking,
  services:           MenuStyleBooking,
  universal:          MenuStyleDelivery,
}

function resolveTheme(store) {
  const tokens = store?.theme_tokens || {}
  const tmpl   = store?.store_templates?.default_theme || {}
  return {
    primary:  tokens.theme_primary_color   || tmpl.theme_primary_color   || '#6366f1',
    secondary:tokens.theme_secondary_color || tmpl.theme_secondary_color || '#f59e0b',
    accent:   tokens.theme_accent_color    || tmpl.theme_accent_color    || '#10b981',
    surface:  tokens.theme_surface_color   || tmpl.theme_surface_color   || '#ffffff',
    text:     tokens.theme_text_color      || tmpl.theme_text_color      || '#111111',
    font:     tokens.theme_font_body       || tmpl.theme_font_body       || 'inherit',
  }
}

function LoadingScreen({ primaryColor }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#f9f9f9',
    }}>
      <div style={{
        width: 40, height: 40, border: `3px solid ${primaryColor || '#6366f1'}`,
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: '#aaa', fontSize: 14 }}>Cargando menú…</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>🍽️</div>
      <h2 style={{ fontSize: 20, margin: 0 }}>Menú no disponible</h2>
      <p style={{ color: '#888', fontSize: 14, maxWidth: 320 }}>
        {message || 'No pudimos cargar este menú. Inténtalo más tarde.'}
      </p>
    </div>
  )
}

export default function PublicMenuPage() {
  const { storeSlug, branchSlug } = useParams()
  const [searchParams]            = useSearchParams()
  const [cartOpen, setCartOpen]   = React.useState(false)

  // Soporte para URL legacy: /storefront/menu?store=slug
  const legacyStoreId = searchParams.get('store') || searchParams.get('store_id')
  const resolvedSlug  = storeSlug || legacyStoreId || ''

  const { store, branches, branch, menu, loading, error } =
    useStorePublicConfig(resolvedSlug, branchSlug || null)

  const { items, addToCart, updateQty, removeItem, clearCart, cartCount, cartTotal } =
    usePublicCart(store?.id)

  // Aplicar fuente y colores del tema en <html> (para que el body refleje la marca)
  const theme = React.useMemo(() => resolveTheme(store), [store])
  React.useEffect(() => {
    if (!store) return
    document.documentElement.style.setProperty('--pub-primary',   theme.primary)
    document.documentElement.style.setProperty('--pub-secondary', theme.secondary)
    document.documentElement.style.setProperty('--pub-accent',    theme.accent)
    document.documentElement.style.setProperty('--pub-surface',   theme.surface)
    document.documentElement.style.setProperty('--pub-text',      theme.text)
    return () => {
      ;['--pub-primary','--pub-secondary','--pub-accent','--pub-surface','--pub-text']
        .forEach(v => document.documentElement.style.removeProperty(v))
    }
  }, [theme, store])

  if (loading) return <LoadingScreen primaryColor={theme.primary} />
  if (error)   return <ErrorScreen message={error} />
  if (!store)  return <ErrorScreen message="Tienda no encontrada." />

  // Resolver el componente de estilo correcto
  const templateKey = store.template_id || store.niche || store.business_type || 'universal'
  const StyleComponent = STYLE_MAP[templateKey] || MenuStyleDelivery

  const sharedProps = {
    store,
    menu,
    branch,
    branches,
    cart:        items,
    cartCount,
    cartTotal,
    onAddToCart: addToCart,
    onOpenCart:  () => setCartOpen(true),
    theme,
  }

  return (
    <>
      <StyleComponent {...sharedProps} />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        storeId={store.id}
        cart={items}
        cartTotal={cartTotal}
        deliveryFee={0}
        minOrder={0}
        onClearCart={clearCart}
        currency={store.currency || 'EUR'}
        branch={branch}
        store={store}
      />
    </>
  )
}
