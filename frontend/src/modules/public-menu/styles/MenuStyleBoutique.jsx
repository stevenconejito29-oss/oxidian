/**
 * MenuStyleBoutique — Plantilla editorial premium para moda y boutiques.
 * Layout magazine, imágenes a pantalla completa, animaciones suaves,
 * modal de producto con variantes (tallas, colores).
 */
import React from 'react'
import { money, CartFab, DiscountBadge, ProductModal, BranchSelector } from './MenuShared'

export function MenuStyleBoutique({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [selected,      setSelected]      = React.useState(null)
  const [activeBranch,  setActiveBranch]  = React.useState(branch)
  const [menuOpen,      setMenuOpen]      = React.useState(false)

  const primary  = theme?.primary   || '#111111'
  const accent   = theme?.accent    || '#d4a070'
  const surface  = theme?.surface   || '#faf8f4'
  const currency = store?.currency  || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id
  const products  = sections.find(s => s.id === activeSec)?.products || []
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal = money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)

  return (
    <div style={{ minHeight: '100vh', background: surface, fontFamily: '"Garamond","Georgia",serif', color: primary }}>

      {/* ── HEADER MINIMALISTA ───────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: surface, borderBottom: `1px solid ${primary}15`,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64 }}>
          {/* Logo */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 400, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {store?.name || 'BOUTIQUE'}
            </div>
            {(activeBranch || branch) && (
              <div style={{ fontSize: 11, color: '#aaa', letterSpacing: '0.05em', marginTop: 1 }}>
                {(activeBranch || branch).city}
              </div>
            )}
          </div>

          {/* Navegación de categorías — desktop */}
          <nav style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {sections.slice(0, 5).map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: activeSec === s.id ? primary : '#aaa',
                borderBottom: activeSec === s.id ? `1px solid ${primary}` : '1px solid transparent',
                paddingBottom: 2, fontFamily: 'inherit', transition: '.15s',
              }}>{s.name}</button>
            ))}
          </nav>

          {/* Carrito */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginLeft: 28 }}>
            <button onClick={onOpenCart} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: 'inherit', color: primary,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>BOLSA</span>
              {cartCount > 0 && (
                <span style={{ background: primary, color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <BranchSelector branches={branches} activeBranch={activeBranch || branch} onSelect={setActiveBranch} color={primary} />

      {/* ── HERO COLLECTION ─────────────────────────────────────── */}
      {products.length > 0 && (
        <div style={{
          position: 'relative', height: 320, overflow: 'hidden',
          background: `${accent}20`, marginBottom: 2,
        }}>
          {products[0]?.image_url ? (
            <img src={products[0].image_url} alt={products[0].name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.85)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 100 }}>
              {products[0]?.emoji || '👗'}
            </div>
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.5) 100%)',
            display: 'flex', alignItems: 'flex-end', padding: 32,
          }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
                Nueva colección
              </div>
              <h1 style={{ margin: 0, color: '#fff', fontSize: 32, fontWeight: 400, letterSpacing: '-0.5px' }}>
                {sections.find(s => s.id === activeSec)?.name || store?.name}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* ── GRID EDITORIAL ──────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
          {products.map((prod, i) => (
            <article key={prod.id} onClick={() => setSelected(prod)} style={{
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              aspectRatio: '3/4', background: `${accent}18`,
              transition: '.3s',
            }}>
              {/* Imagen */}
              {prod.image_url
                ? <img src={prod.image_url} alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 80, color: '#ccc' }}>
                    {prod.emoji || '👗'}
                  </div>
              }

              {/* Badges */}
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexDirection: 'column' }}>
                {prod.is_featured && (
                  <span style={{ background: '#fff', color: primary, fontSize: 10, fontWeight: 700,
                    padding: '3px 8px', letterSpacing: '0.05em' }}>NUEVO</span>
                )}
                {prod.compare_price > prod.price && (
                  <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px' }}>
                    OFERTA
                  </span>
                )}
              </div>

              {/* Overlay de producto */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,.65) 0%, transparent 100%)',
                padding: '32px 16px 16px', color: '#fff',
              }}>
                <div style={{ fontSize: 15, fontWeight: 400, marginBottom: 4 }}>{prod.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14 }}>
                    {money(prod.price, currency)}
                    {prod.compare_price > prod.price && (
                      <span style={{ fontSize: 12, textDecoration: 'line-through', marginLeft: 8, opacity: 0.7 }}>
                        {money(prod.compare_price, currency)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.85, textTransform: 'uppercase' }}>
                    Ver más →
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!products.length && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ccc' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👗</div>
            <div style={{ fontSize: 16, letterSpacing: '0.1em' }}>SIN PRODUCTOS EN ESTA COLECCIÓN</div>
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart}
          color={primary} />
      )}

      <ProductModal product={selected} onClose={() => setSelected(null)}
        onAddToCart={onAddToCart} currency={currency} primaryColor={primary} />
    </div>
  )
}
