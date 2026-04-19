/**
 * MenuStyleDelivery — Tarjetas para restaurantes / delivery
 * Imagen grande, precio destacado, añadir al carrito rápido.
 */
import React from 'react'

function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

export function MenuStyleDelivery({ store, menu, branch, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [search, setSearch]               = React.useState('')

  const primary  = theme?.primary  || '#ef4444'
  const surface  = theme?.surface  || '#ffffff'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id

  const visibleProducts = React.useMemo(() => {
    const sec  = sections.find(s => s.id === activeSec)
    const list = sec?.products || []
    const q    = search.trim().toLowerCase()
    return q ? list.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(q)) : list
  }, [activeSec, sections, search])

  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', fontFamily: 'inherit' }}>
      {/* Header fijo */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#fff', borderBottom: '1px solid #eee',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{store?.name || 'Menú'}</div>
          {branch && <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{branch.city}</div>}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar…"
          style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid #e0e0e0',
            fontSize: 13, width: 130, outline: 'none', background: '#f5f5f5' }} />
        <button onClick={onOpenCart} style={{
          background: primary, color: '#fff', border: 'none',
          borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🛒{cartCount > 0 && <span style={{
            background: '#fff', color: primary, borderRadius: 20,
            padding: '1px 7px', fontSize: 11, fontWeight: 800,
          }}>{cartCount}</span>}
        </button>
      </header>

      {/* Tabs de categoría */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', overflowX: 'auto',
        display: 'flex', gap: 4, padding: '8px 12px', scrollbarWidth: 'none' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: '.15s',
            background: activeSec === s.id ? primary : '#f0f0f0',
            color: activeSec === s.id ? '#fff' : '#555',
          }}>{s.name}</button>
        ))}
      </div>

      {/* Grid de productos */}
      <div style={{ padding: 16, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {visibleProducts.map(prod => (
          <article key={prod.id} style={{
            background: '#fff', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 1px 8px rgba(0,0,0,.07)', border: '1px solid #f0f0f0',
          }}>
            <div style={{ height: 150, background: `${primary}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
              {prod.image_url
                ? <img src={prod.image_url} alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (prod.emoji || '🍽️')}
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{prod.name}</h3>
                  {prod.description && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777',
                      lineHeight: 1.4, display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {prod.description}
                    </p>
                  )}
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, color: primary, flexShrink: 0 }}>
                  {money(prod.price, currency)}
                </span>
              </div>
              <button onClick={() => onAddToCart({ ...prod, qty: 1 })} style={{
                marginTop: 12, width: '100%', padding: 9, border: 'none',
                borderRadius: 9, background: primary, color: '#fff',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>+ Añadir</button>
            </div>
          </article>
        ))}
        {!visibleProducts.length && (
          <p style={{ color: '#bbb', fontSize: 14, gridColumn: '1/-1', textAlign: 'center', padding: '2rem 0' }}>
            Sin productos aquí
          </p>
        )}
      </div>
    </div>
  )
}
