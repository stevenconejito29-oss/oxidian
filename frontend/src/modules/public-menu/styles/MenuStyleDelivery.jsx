/**
 * MenuStyleDelivery — Plantilla premium para restaurantes y delivery.
 * Hero visual, categorías horizontales sticky, tarjetas con imagen,
 * carrito flotante, soporte de variantes, featured products.
 */
import React from 'react'
import { money, CartFab, HoursBar, DiscountBadge, StockBadge, FeaturedBadge, ProductModal, BranchSelector } from './MenuShared'

export function MenuStyleDelivery({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [search,        setSearch]        = React.useState('')
  const [selected,      setSelected]      = React.useState(null)
  const [activeBranch,  setActiveBranch]  = React.useState(branch)
  const sectionRefs = React.useRef({})

  const primary  = theme?.primary  || '#ef4444'
  const secondary= theme?.secondary|| '#f97316'
  const surface  = theme?.surface  || '#ffffff'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const cartCount= (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal= money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)

  // Filtrado por búsqueda
  const searchResults = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return sections.flatMap(s => s.products.filter(p =>
      `${p.name} ${p.description || ''}`.toLowerCase().includes(q)
    ))
  }, [search, sections])

  // Scroll a sección
  function scrollToSection(id) {
    setActiveSection(id)
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // IntersectionObserver para resaltar tab activo
  React.useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
    }, { threshold: 0.3, rootMargin: '-60px 0px -60% 0px' })
    Object.values(sectionRefs.current).forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [sections])

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        padding: '28px 20px 20px', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        {/* Pattern decoration */}
        <div style={{ position:'absolute', top:-20, right:-20, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.05)', pointerEvents:'none' }} />

        <div style={{ position:'relative', maxWidth:720, margin:'0 auto' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>{store?.emoji || '🍕'}</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>{store?.name}</h1>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
            {(activeBranch || branch) && (
              <span style={{ fontSize: 13, opacity: 0.9 }}>
                📍 {(activeBranch || branch).address || (activeBranch || branch).city}
              </span>
            )}
            <HoursBar branch={activeBranch || branch} />
          </div>
        </div>
      </div>

      {/* Selector de sede */}
      <BranchSelector branches={branches} activeBranch={activeBranch || branch} onSelect={setActiveBranch} color={primary} />

      {/* ── NAVBAR STICKY ──────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}>
        {/* Barra de búsqueda */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'#aaa' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Buscar en ${store?.name || 'el menú'}…`}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                  border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
                  background: '#f9f9f9', boxSizing: 'border-box',
                }} />
            </div>
            {cartCount > 0 && (
              <button onClick={onOpenCart} style={{
                background: primary, color: '#fff', border: 'none', borderRadius: 10,
                padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              }}>
                🛒
                <span style={{ background:'rgba(255,255,255,.25)', borderRadius:99, padding:'1px 7px', fontSize:12 }}>
                  {cartCount}
                </span>
              </button>
            )}
          </div>
        </div>
        {/* Tabs de categoría */}
        {!searchResults && (
          <div style={{
            display: 'flex', gap: 4, padding: '8px 16px',
            overflowX: 'auto', scrollbarWidth: 'none',
            maxWidth: 720, margin: '0 auto',
          }}>
            {sections.map(s => (
              <button key={s.id} onClick={() => scrollToSection(s.id)} style={{
                flexShrink: 0, padding: '6px 16px', borderRadius: 20,
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeSection === s.id ? primary : '#f3f4f6',
                color: activeSection === s.id ? '#fff' : '#555',
                transition: '.15s', fontFamily: 'inherit',
              }}>{s.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── CONTENIDO ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px 100px' }}>

        {/* Resultados de búsqueda */}
        {searchResults && (
          <div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{search}"
            </div>
            <ProductGrid products={searchResults} primary={primary} currency={currency}
              cart={cart} onAddToCart={onAddToCart} onSelect={setSelected} />
          </div>
        )}

        {/* Secciones normales */}
        {!searchResults && sections.map(section => (
          <div key={section.id} id={section.id} ref={el => sectionRefs.current[section.id] = el}
            style={{ marginBottom: 28, scrollMarginTop: 110 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{section.name}</h2>
              <span style={{ fontSize: 13, color: '#aaa' }}>{section.products.length} productos</span>
            </div>
            <ProductGrid products={section.products} primary={primary} currency={currency}
              cart={cart} onAddToCart={onAddToCart} onSelect={setSelected} />
          </div>
        ))}

        {!sections.length && !searchResults && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#aaa' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🍽️</div>
            <div style={{ fontSize: 16 }}>Sin productos disponibles</div>
          </div>
        )}
      </div>

      {/* Carrito flotante */}
      {cartCount > 0 && <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart} color={primary} />}

      {/* Modal de producto */}
      <ProductModal product={selected} onClose={() => setSelected(null)}
        onAddToCart={onAddToCart} currency={currency} primaryColor={primary} />
    </div>
  )
}

function ProductGrid({ products, primary, currency, cart, onAddToCart, onSelect }) {
  const cartQty = (productId) => (cart || []).find(i => i.id === productId)?.qty || 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {products.map(prod => {
        const qty = cartQty(prod.id)
        return (
          <article key={prod.id} onClick={() => onSelect(prod)} style={{
            background: '#fff', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 1px 6px rgba(0,0,0,.06)', cursor: 'pointer',
            border: qty > 0 ? `2px solid ${primary}` : '1px solid #f0f0f0',
            transition: '.2s', position: 'relative',
          }}>
            {qty > 0 && (
              <div style={{
                position: 'absolute', top: 10, right: 10, zIndex: 2,
                background: primary, color: '#fff', borderRadius: 99,
                width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>{qty}</div>
            )}
            {/* Imagen */}
            <div style={{
              height: 140, background: `${primary}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {prod.image_url
                ? <img src={prod.image_url} alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 56 }}>{prod.emoji || '🍽️'}</span>
              }
            </div>

            {/* Info */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                <FeaturedBadge product={prod} />
                <StockBadge product={prod} />
                <DiscountBadge original={prod.compare_price} current={prod.price} />
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                {prod.name}
              </h3>
              {prod.description && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#777', lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {prod.description}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 16, color: primary }}>
                    {money(prod.price, currency)}
                  </span>
                  {prod.compare_price > prod.price && (
                    <span style={{ fontSize: 12, color: '#aaa', textDecoration: 'line-through', marginLeft: 6 }}>
                      {money(prod.compare_price, currency)}
                    </span>
                  )}
                </div>
                <button
                  disabled={prod.out_of_stock}
                  onClick={e => { e.stopPropagation(); onAddToCart({ ...prod, qty: 1 }) }}
                  style={{
                    background: prod.out_of_stock ? '#e5e7eb' : primary, color: '#fff',
                    border: 'none', borderRadius: 9, padding: '8px 16px',
                    cursor: prod.out_of_stock ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                  }}>
                  {prod.out_of_stock ? 'Agotado' : '+ Añadir'}
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
