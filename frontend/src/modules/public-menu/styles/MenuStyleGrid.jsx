/**
 * MenuStyleGrid — Cuadrícula estilo supermercado / tienda de barrio
 * Productos pequeños en grid denso, stock visible, filtro por categoría lateral.
 */
import React from 'react'

function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

export function MenuStyleGrid({ store, menu, branch, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [search, setSearch]               = React.useState('')

  const primary  = theme?.primary  || '#22c55e'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id

  const visibleProducts = React.useMemo(() => {
    const allProds = activeSec
      ? (sections.find(s => s.id === activeSec)?.products || [])
      : sections.flatMap(s => s.products || [])
    const q = search.trim().toLowerCase()
    return q ? allProds.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(q)) : allProds
  }, [activeSec, sections, search])

  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: 'inherit' }}>
      {/* Header */}
      <header style={{
        background: primary, color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50,
      }}>
        <span style={{ fontSize: 22 }}>🛒</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{store?.name || 'Tienda'}</div>
          {branch && <div style={{ fontSize: 11, opacity: 0.85 }}>{branch.city}</div>}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none',
            fontSize: 13, width: 140, outline: 'none' }} />
        <button onClick={onOpenCart} style={{
          background: '#fff', color: primary, border: 'none',
          borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
        }}>
          Carrito {cartCount > 0 && `(${cartCount})`}
        </button>
      </header>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Sidebar de categorías */}
        <aside style={{
          width: 140, flexShrink: 0, background: '#fff',
          borderRight: '1px solid #e0e0e0', minHeight: 'calc(100vh - 52px)',
          padding: '8px 0',
        }}>
          <button onClick={() => setActiveSection(null)} style={{
            display: 'block', width: '100%', padding: '10px 14px', border: 'none',
            background: !activeSec ? `${primary}18` : 'transparent',
            borderLeft: !activeSec ? `3px solid ${primary}` : '3px solid transparent',
            textAlign: 'left', fontSize: 13, fontWeight: !activeSec ? 600 : 400,
            color: !activeSec ? primary : '#444', cursor: 'pointer',
          }}>Todo</button>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: 'block', width: '100%', padding: '10px 14px', border: 'none',
              background: activeSec === s.id ? `${primary}18` : 'transparent',
              borderLeft: activeSec === s.id ? `3px solid ${primary}` : '3px solid transparent',
              textAlign: 'left', fontSize: 13,
              fontWeight: activeSec === s.id ? 600 : 400,
              color: activeSec === s.id ? primary : '#444', cursor: 'pointer',
            }}>{s.name}</button>
          ))}
        </aside>

        {/* Grid de productos */}
        <main style={{ flex: 1, padding: 12,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 10, alignContent: 'start' }}>
          {visibleProducts.map(prod => (
            <div key={prod.id} style={{
              background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8',
              padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ textAlign: 'center', fontSize: 36, lineHeight: 1 }}>
                {prod.image_url
                  ? <img src={prod.image_url} alt={prod.name}
                      style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                  : (prod.emoji || '📦')}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{prod.name}</div>
              {prod.track_stock && prod.stock_quantity <= 5 && (
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                  ¡Últimas {prod.stock_quantity}!
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontWeight: 700, color: primary, fontSize: 14 }}>
                  {money(prod.price, currency)}
                </span>
                <button onClick={() => onAddToCart({ ...prod, qty: 1 })} style={{
                  background: primary, color: '#fff', border: 'none',
                  borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
                  fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>
              </div>
            </div>
          ))}
          {!visibleProducts.length && (
            <p style={{ color: '#bbb', fontSize: 14, gridColumn: '1/-1', textAlign: 'center', padding: '2rem 0' }}>
              Sin productos
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
