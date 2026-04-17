import React from 'react'
import { useMenuData } from '../../../legacy/lib/useMenuData'
import { useSettings } from '../../../legacy/lib/useSettings'
import { useCart } from '../../../legacy/lib/useCart'
import { useResolvedStoreId } from '../../../legacy/lib/currentStore'
import { getProductSections, resolveProductSection } from '../../../legacy/lib/productSections'
import { Hero, Notice, Panel, Shell, Stats } from '../../../shared/ui/ControlDeck'
import CheckoutDrawer from '../components/CheckoutDrawer'
import styles from './PublicMenuPage.module.css'

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`
}

function normalizeCategoryId(value) {
  return String(value || 'postres').trim().toLowerCase() || 'postres'
}

function buildSearchText(item = {}) {
  return [item.name, item.description, item.category, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function PublicMenuPage() {
  const storeId = useResolvedStoreId()
  const { settings, loading: loadingSettings } = useSettings()
  const { products, combos, loading } = useMenuData(storeId)
  const { cart, cartCount, cartTotal, addToCart, updateQty, removeItem, clearCart } = useCart()
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState('combos')
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  const sections = React.useMemo(() => getProductSections(settings.product_sections), [settings.product_sections])
  const filteredProducts = React.useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return products
    return products.filter(product => buildSearchText(product).includes(normalized))
  }, [products, search])

  const productCategories = React.useMemo(() => {
    const map = {}
    filteredProducts.forEach(product => {
      const categoryId = normalizeCategoryId(product.category)
      if (!map[categoryId]) map[categoryId] = []
      map[categoryId].push(product)
    })
    return map
  }, [filteredProducts])

  const categories = React.useMemo(() => {
    const dynamic = Object.keys(productCategories).map(categoryId => resolveProductSection(settings.product_sections, categoryId))
    const orderedIds = sections.map(section => section.id)
    const sortedDynamic = dynamic.sort((left, right) => {
      const leftIndex = orderedIds.indexOf(left.id)
      const rightIndex = orderedIds.indexOf(right.id)
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
    })
    return [{ id: 'combos', label: 'Combos', icon: '🎁' }, ...sortedDynamic]
  }, [productCategories, sections, settings.product_sections])

  React.useEffect(() => {
    if (activeCategory === 'combos' || productCategories[activeCategory]) return
    const firstCategory = categories.find(category => category.id !== 'combos')
    setActiveCategory(firstCategory?.id || 'combos')
  }, [activeCategory, categories, productCategories])

  const showcaseStats = [
    { label: 'Store', value: storeId, hint: settings.business_name || 'Marca activa' },
    { label: 'Productos', value: String(products.length), hint: 'Catálogo visible en tiempo real.' },
    { label: 'Combos', value: String(combos.length), hint: 'Packs y propuestas rápidas.' },
    { label: 'Carrito', value: String(cartCount), hint: cartCount ? money(cartTotal) : 'Aún vacío' },
  ]

  return (
    <Shell>
      <Hero
        eyebrow={settings.storefront_intro_eyebrow || 'Storefront · nueva capa pública'}
        title={settings.storefront_intro_title || settings.business_name || 'Explora el catálogo'}
        description={settings.storefront_intro_text || settings.tagline || 'Diseño nuevo para discovery, categorías y acceso rápido a producto.'}
        signals={[
          { label: 'Horario', value: settings.store_hours_text || `${settings.open_hour || '10'}-${settings.close_hour || '21'}` },
          { label: 'Carrito', value: cartCount ? `${cartCount} items` : 'Vacío' },
        ]}
      />

      <Panel title="Exploración" text="Basado en buenas prácticas de navegación ecommerce: categorías visibles, búsqueda clara y acceso rápido a producto.">
        <Stats items={showcaseStats} />
      </Panel>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <Panel title="Navegación" text="Scope visible y descubrimiento rápido.">
            <div className={styles.searchBox}>
              <input
                className={styles.searchInput}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={settings.storefront_search_placeholder || 'Buscar producto, sabor o categoría'}
              />
            </div>
            <div className={styles.categoryList}>
              {categories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.categoryButton} ${activeCategory === category.id ? styles.categoryButtonActive : ''}`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Carrito rápido" text="Checkout ligero dentro del storefront con creación real de pedido.">
            <div className={styles.cartMini}>
              <div className={styles.cartMiniValue}>{cartCount}</div>
              <div className={styles.cartMiniText}>items en carrito</div>
              <div className={styles.cartMiniTotal}>{money(cartTotal)}</div>
              <button className={styles.checkoutButton} type="button" onClick={() => setCheckoutOpen(true)} disabled={!cart.length}>
                Abrir checkout
              </button>
            </div>
            {cart.slice(0, 4).map((item, index) => (
              <div className={styles.cartItem} key={`${item.id}-${index}`}>
                <span>{item.name || item.product_name}</span>
                <div className={styles.cartItemActions}>
                  <button type="button" onClick={() => updateQty(index, Math.max(1, item.qty - 1))}>-</button>
                  <span>{item.qty} × {money(item.price)}</span>
                  <button type="button" onClick={() => updateQty(index, item.qty + 1)}>+</button>
                  <button type="button" onClick={() => removeItem(index)}>x</button>
                </div>
              </div>
            ))}
            {!!cart.length ? (
              <a className={styles.legacyLink} href={`/legacy/menu?store=${encodeURIComponent(storeId)}`}>
                Comparar con flujo legacy
              </a>
            ) : null}
          </Panel>
        </aside>

        <main className={styles.catalog}>
          {loading || loadingSettings ? <Notice>Cargando catálogo...</Notice> : null}

          {!loading && !loadingSettings && activeCategory === 'combos' ? (
            <div className={styles.cardGrid}>
              {combos.map(combo => (
                <article className={styles.productCard} key={combo.id}>
                  <div className={styles.productTop}>
                    <span className={styles.productEmoji}>{combo.emoji || '🎁'}</span>
                    <span className={styles.productPrice}>{money(combo.price)}</span>
                  </div>
                  <h3 className={styles.productName}>{combo.name}</h3>
                  <p className={styles.productDescription}>{combo.description || 'Combo destacado para conversión rápida.'}</p>
                  <div className={styles.productActions}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => addToCart({ ...combo, isCombo: true, comboId: combo.id, qty: 1 })}
                    >
                      Añadir combo
                    </button>
                    <a className={styles.secondaryButton} href={`/legacy/menu?store=${encodeURIComponent(storeId)}`}>
                      Configurar
                    </a>
                  </div>
                </article>
              ))}
              {!combos.length ? <Notice>No hay combos disponibles para esta tienda.</Notice> : null}
            </div>
          ) : null}

          {!loading && !loadingSettings && activeCategory !== 'combos' ? (
            <div className={styles.cardGrid}>
              {(productCategories[activeCategory] || []).map(product => (
                <article className={styles.productCard} key={product.id}>
                  <div className={styles.productTop}>
                    <span className={styles.productEmoji}>{product.emoji || '🍓'}</span>
                    <span className={styles.productPrice}>{money(product.price)}</span>
                  </div>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <p className={styles.productDescription}>{product.description || 'Producto visible en el catálogo público.'}</p>
                  <div className={styles.metaRow}>
                    {product.sold_today ? <span className={styles.metaChip}>{product.sold_today} vendidos hoy</span> : null}
                    {product.out_of_stock ? <span className={styles.metaChipDanger}>sin stock</span> : null}
                  </div>
                  <div className={styles.productActions}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={product.out_of_stock}
                      onClick={() => addToCart({ ...product, qty: 1 })}
                    >
                      {product.out_of_stock ? 'No disponible' : 'Añadir'}
                    </button>
                    <a className={styles.secondaryButton} href={`/legacy/menu?store=${encodeURIComponent(storeId)}`}>
                      Ver detalle
                    </a>
                  </div>
                </article>
              ))}
              {!productCategories[activeCategory]?.length ? <Notice>No hay productos para esta categoría.</Notice> : null}
            </div>
          ) : null}
        </main>
      </div>

      <CheckoutDrawer
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        storeId={storeId}
        cart={cart}
        cartTotal={cartTotal}
        deliveryFee={Number(settings.delivery_fee || 0)}
        minOrder={Number(settings.min_order || 0)}
        onClearCart={clearCart}
      />
    </Shell>
  )
}
