/**
 * MenuStyleBoutique — Editorial / Boutique de moda
 * Layout minimalista de revista, producto a pantalla completa, sin ruido visual.
 */
import React from 'react'

function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

export function MenuStyleBoutique({ store, menu, branch, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [selected, setSelected]           = React.useState(null)

  const primary  = theme?.primary  || '#111111'
  const accent   = theme?.accent   || '#d2b48c'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id

  const products = sections.find(s => s.id === activeSec)?.products || []
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: "'Georgia', serif", color: primary }}>
      {/* Header minimalista */}
      <header style={{
        borderBottom: `1px solid ${primary}20`, padding: '20px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: '#faf9f7', zIndex: 50,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 400, letterSpacing: '0.1em' }}>
            {store?.name?.toUpperCase() || 'BOUTIQUE'}
          </div>
          {branch && <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.05em', marginTop: 2 }}>
            {branch.city}
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, letterSpacing: '0.08em', fontFamily: 'inherit',
              color: activeSec === s.id ? primary : '#aaa',
              borderBottom: activeSec === s.id ? `1px solid ${primary}` : '1px solid transparent',
              paddingBottom: 2,
            }}>{s.name.toUpperCase()}</button>
          ))}
          <button onClick={onOpenCart} style={{
            background: 'none', border: `1px solid ${primary}`, cursor: 'pointer',
            padding: '6px 16px', fontSize: 12, letterSpacing: '0.08em', fontFamily: 'inherit',
          }}>
            BAG {cartCount > 0 && `(${cartCount})`}
          </button>
        </div>
      </header>

      {/* Grid editorial: 2 col, imagen grande */}
      <main style={{ padding: '32px', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
        {products.map(prod => (
          <article key={prod.id}
            onClick={() => setSelected(prod)}
            style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden',
              aspectRatio: '3/4', background: `${accent}20` }}>
            {prod.image_url
              ? <img src={prod.image_url} alt={prod.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 72, color: '#ccc' }}>
                  {prod.emoji || '👗'}
                </div>}
            {/* Overlay al hover */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 100%)',
              padding: '24px 16px 16px', color: '#fff',
            }}>
              <div style={{ fontSize: 14, fontWeight: 400 }}>{prod.name}</div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                {money(prod.price, currency)}
              </div>
            </div>
          </article>
        ))}
      </main>

      {/* Modal de producto */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', maxWidth: 560, width: '100%',
            display: 'flex', gap: 0, borderRadius: 2, overflow: 'hidden', maxHeight: '90vh',
          }}>
            <div style={{ flex: 1, background: `${accent}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>
              {selected.image_url
                ? <img src={selected.image_url} alt={selected.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (selected.emoji || '👗')}
            </div>
            <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
              <h2 style={{ margin: 0, fontWeight: 400, fontSize: 22 }}>{selected.name}</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.7 }}>
                {selected.description || 'Producto seleccionado de nuestra colección.'}
              </p>
              <div style={{ fontSize: 20, fontWeight: 400 }}>{money(selected.price, currency)}</div>
              <button onClick={() => { onAddToCart({ ...selected, qty: 1 }); setSelected(null) }} style={{
                marginTop: 'auto', padding: '12px', border: `1px solid ${primary}`,
                background: primary, color: '#fff', cursor: 'pointer',
                fontSize: 13, letterSpacing: '0.08em', fontFamily: 'inherit',
              }}>AÑADIR AL CARRITO</button>
              <button onClick={() => setSelected(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#aaa', fontFamily: 'inherit', letterSpacing: '0.05em',
              }}>CERRAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
