/**
 * MenuStyleCatalog — Lista de catálogo / tienda de barrio / farmacia
 * Lista densa, precio, stock, descripción corta. Sin imágenes obligatorias.
 */
import React from 'react'

function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

export function MenuStyleCatalog({ store, menu, branch, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [search, setSearch]               = React.useState('')

  const primary  = theme?.primary  || '#0ea5e9'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id

  const visibleProducts = React.useMemo(() => {
    const list = sections.find(s => s.id === activeSec)?.products || []
    const q    = search.trim().toLowerCase()
    return q ? list.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(q)) : list
  }, [activeSec, sections, search])

  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'inherit', color: '#1a1a1a' }}>
      {/* Header */}
      <header style={{
        background: primary, color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{store?.name || 'Catálogo'}</div>
          {branch && <div style={{ fontSize: 11, opacity: 0.8 }}>{branch.city} · {branch.address}</div>}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar…"
          style={{ padding: '6px 12px', borderRadius: 6, border: 'none',
            fontSize: 13, width: 140, outline: 'none' }} />
        <button onClick={onOpenCart} style={{
          background: '#fff', color: primary, border: 'none',
          borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
        }}>
          🧺 {cartCount > 0 ? `(${cartCount})` : ''}
        </button>
      </header>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #f0f0f0', display: 'flex', overflowX: 'auto',
        scrollbarWidth: 'none', background: '#fff' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            flexShrink: 0, padding: '10px 18px', border: 'none', background: 'none',
            borderBottom: activeSec === s.id ? `2px solid ${primary}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: activeSec === s.id ? 600 : 400,
            color: activeSec === s.id ? primary : '#666', marginBottom: -2,
          }}>{s.name}</button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 16px' }}>
        {visibleProducts.map((prod, idx) => (
          <div key={prod.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 0', borderBottom: '1px solid #f0f0f0',
          }}>
            {/* Emoji / imagen pequeña */}
            <div style={{ width: 52, height: 52, borderRadius: 8, background: `${primary}12`,
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, overflow: 'hidden' }}>
              {prod.image_url
                ? <img src={prod.image_url} alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (prod.emoji || '📦')}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{prod.name}</div>
              {prod.description && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {prod.description}
                </div>
              )}
              {prod.track_stock && (
                <div style={{ fontSize: 11, color: prod.stock_quantity <= 5 ? '#f59e0b' : '#22c55e', marginTop: 2 }}>
                  {prod.stock_quantity <= 0 ? 'Sin stock' : prod.stock_quantity <= 5
                    ? `Quedan ${prod.stock_quantity}` : 'Disponible'}
                </div>
              )}
            </div>
            {/* Precio + botón */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: primary }}>
                {money(prod.price, currency)}
              </div>
              {prod.compare_price > prod.price && (
                <div style={{ fontSize: 11, color: '#aaa', textDecoration: 'line-through' }}>
                  {money(prod.compare_price, currency)}
                </div>
              )}
              <button onClick={() => onAddToCart({ ...prod, qty: 1 })} style={{
                marginTop: 6, padding: '5px 12px', border: `1px solid ${primary}`,
                borderRadius: 6, background: primary, color: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Añadir</button>
            </div>
          </div>
        ))}
        {!visibleProducts.length && (
          <p style={{ textAlign: 'center', color: '#ccc', padding: '2rem 0', fontSize: 14 }}>
            Sin productos
          </p>
        )}
      </div>
    </div>
  )
}
