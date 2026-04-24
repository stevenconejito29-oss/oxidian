/**
 * PublicMenuPage — Router del menú público multi-estilo.
 * Detecta la tienda por slug, aplica el tema, selecciona la plantilla correcta,
 * y pasa las props modulares según las features activas de cada tienda.
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
import { MenuStyleExpress }      from '../styles/MenuStyleExpress'
import CartDrawer                from '../components/CheckoutDrawer'

// Mapa template → componente
const STYLE_MAP = {
  delivery:           MenuStyleDelivery,
  vitrina:            MenuStyleGrid,
  portfolio:          MenuStyleBoutique,
  minimal:            MenuStyleCatalog,
  booking:            MenuStyleBooking,
  express:            MenuStyleExpress,
  // fallbacks por niche
  restaurant:         MenuStyleDelivery,
  fastfood:           MenuStyleDelivery,
  food:               MenuStyleDelivery,
  supermarket:        MenuStyleGrid,
  minimarket:         MenuStyleGrid,
  neighborhood_store: MenuStyleExpress,
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
    primary:   tokens.theme_primary_color   || tmpl.theme_primary_color   || '#6366f1',
    secondary: tokens.theme_secondary_color || tmpl.theme_secondary_color || '#f59e0b',
    accent:    tokens.theme_accent_color    || tmpl.theme_accent_color    || '#10b981',
    surface:   tokens.theme_surface_color   || tmpl.theme_surface_color   || '#ffffff',
    text:      tokens.theme_text_color      || tmpl.theme_text_color      || '#111111',
    fontBody:  tokens.theme_font_body       || tmpl.theme_font_body       || 'inherit',
    fontDisplay:tokens.theme_font_display   || tmpl.theme_font_display    || 'inherit',
    radius:    tokens.theme_button_radius   || tmpl.theme_button_radius   || '8px',
  }
}

function LoadingScreen({ color }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f9f9f9',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: `3px solid ${color || '#6366f1'}30`,
        borderTopColor: color || '#6366f1',
        animation: 'spin .7s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: '#aaa', fontSize: 14, margin: 0 }}>Cargando menú…</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>🍽️</div>
      <h2 style={{ fontSize: 20, margin: 0, color: '#111' }}>Menú no disponible</h2>
      <p style={{ color: '#888', fontSize: 14, maxWidth: 320, margin: 0, lineHeight: 1.6 }}>
        {message || 'No pudimos cargar este menú. Inténtalo más tarde.'}
      </p>
    </div>
  )
}

export default function PublicMenuPage() {
  const { storeSlug, branchSlug } = useParams()
  const [searchParams]            = useSearchParams()
  const [cartOpen, setCartOpen]   = React.useState(false)

  const legacyStoreId = searchParams.get('store') || searchParams.get('store_id')
  const resolvedSlug  = storeSlug || legacyStoreId || ''

  const { store, branches, branch, menu, loading, error } =
    useStorePublicConfig(resolvedSlug, branchSlug || null)

  const { items, addToCart, updateQty, removeItem, clearCart, cartCount, cartTotal } =
    usePublicCart(store?.id)

  const theme = React.useMemo(() => resolveTheme(store), [store])

  // Aplicar CSS variables del tema al root
  React.useEffect(() => {
    if (!store) return
    const vars = {
      '--pub-primary':    theme.primary,
      '--pub-secondary':  theme.secondary,
      '--pub-accent':     theme.accent,
      '--pub-surface':    theme.surface,
      '--pub-text':       theme.text,
      '--pub-radius':     theme.radius,
    }
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    return () => Object.keys(vars).forEach(k => document.documentElement.style.removeProperty(k))
  }, [theme, store])

  if (loading) return <LoadingScreen color={theme.primary} />
  if (error)   return <ErrorScreen message={error} />
  if (!store)  return <ErrorScreen message="Esta tienda no está disponible." />

  const templateKey    = store.template_id || store.niche || store.business_type || 'delivery'
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
    onUpdateQty: updateQty,
    onRemoveItem:removeItem,
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
        onUpdateQty={updateQty}
        onRemoveItem={removeItem}
      />
    </>
  )
}
