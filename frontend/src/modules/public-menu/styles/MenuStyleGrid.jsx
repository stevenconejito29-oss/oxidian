/**
 * MenuStyleGrid — Plantilla para supermercados, farmacias y tiendas de barrio.
 * Sidebar de categorías, grid denso, stock visible, búsqueda prominente.
 */
import React from 'react'
import { money, CartFab, HoursBar, StockBadge, DiscountBadge, ProductModal, BranchSelector } from './MenuShared'

export function MenuStyleGrid({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [search,        setSearch]        = React.useState('')
  const [selected,      setSelected]      = React.useState(null)
  const [activeBranch,  setActiveBranch]  = React.useState(branch)
  const [sidebarOpen,   setSidebarOpen]   = React.useState(false)

  const primary  = theme?.primary  || '#16a34a'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal = money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)

  const visibleProducts = React.useMemo(() => {
    const allProds = activeSec === '__all__'
      ? sections.flatMap(s => s.products)
      : (sections.find(s => s.id === activeSec)?.products || [])
    const q = search.trim().toLowerCase()
    return q ? allProds.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(q)) : allProds
  }, [activeSec, sections, search])

  const cartQty = (id) => (cart || []).find(i => i.id === id)?.qty || 0

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <header style={{
        background: primary, color: '#fff',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setSidebarOpen(s => !s)} style={{
            background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
            borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>☰</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{store?.name || 'Tienda'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              {(activeBranch || branch) && (
                <span style={{ fontSize: 11, opacity: 0.9 }}>
                  📍 {(activeBranch || branch).city}
                </span>
              )}
              <HoursBar branch={activeBranch || branch} />
            </div>
          </div>
          <button onClick={onOpenCart} style={{
            background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.3)',
            borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            🛒 {cartCount > 0 && (
              <span style={{ background: '#fff', color: primary, borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Búsqueda */}
        <div style={{ padding: '0 16px 12px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="¿Qué estás buscando?"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
              background: 'rgba(255,255,255,.9)',
            }} />
        </div>
      </header>

      <BranchSelector branches={branches} activeBranch={activeBranch || branch} onSelect={setActiveBranch} color={primary} />

      {/* Overlay sidebar en móvil */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 90,
        }} />
      )}

      <div style={{ display: 'flex', position: 'relative' }}>
        {/* Sidebar de categorías */}
        <aside style={{
          width: 160, flexShrink: 0,
          background: '#fff', borderRight: '1px solid #e5e7eb',
          minHeight: 'calc(100vh - 100px)',
          position: 'sticky', top: 100, height: 'calc(100vh - 100px)',
          overflowY: 'auto', zIndex: 91,
          // En móvil, se convierte en drawer
          '@media (max-width: 640px)': {
            position: 'fixed', left: sidebarOpen ? 0 : -160,
            top: 0, height: '100vh',
          },
          transition: '.2s',
          left: 0,
        }}>
          <div style={{ padding: '12px 0' }}>
            <div style={{ padding: '6px 14px 10px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Categorías
            </div>
            {[{ id: '__all__', name: 'Todo', count: sections.reduce((s, x) => s + x.products.length, 0) }, ...sections.map(s => ({ ...s, count: s.products.length }))].map(s => (
              <button key={s.id} onClick={() => { setActiveSection(s.id); setSidebarOpen(false) }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: 13, fontFamily: 'inherit',
                background: activeSec === s.id ? `${primary}12` : 'transparent',
                borderLeft: activeSec === s.id ? `3px solid ${primary}` : '3px solid transparent',
                color: activeSec === s.id ? primary : '#444',
                fontWeight: activeSec === s.id ? 600 : 400,
              }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                <span style={{ fontSize: 11, color: '#bbb', marginLeft: 6 }}>{s.count}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Grid de productos */}
        <main style={{ flex: 1, padding: '16px 12px 100px' }}>
          {!visibleProducts.length ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div>Sin resultados</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
              gap: 10,
            }}>
              {visibleProducts.map(prod => {
                const qty = cartQty(prod.id)
                return (
                  <div key={prod.id} onClick={() => setSelected(prod)} style={{
                    background: '#fff', borderRadius: 12, padding: 10, cursor: 'pointer',
                    border: qty > 0 ? `2px solid ${primary}` : '1px solid #e8e8e8',
                    display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)', transition: '.15s',
                  }}>
                    {qty > 0 && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        background: primary, color: '#fff', borderRadius: 99,
                        width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, zIndex: 1,
                      }}>{qty}</div>
                    )}

                    {/* Imagen */}
                    <div style={{ textAlign: 'center', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {prod.image_url
                        ? <img src={prod.image_url} alt={prod.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
                        : <span style={{ fontSize: 44 }}>{prod.emoji || '📦'}</span>
                      }
                    </div>

                    {/* Nombre */}
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, minHeight: 32,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {prod.name}
                    </div>

                    <StockBadge product={prod} />
                    <DiscountBadge original={prod.compare_price} current={prod.price} />

                    {/* Precio + botón */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: primary }}>
                        {money(prod.price, currency)}
                      </span>
                      <button
                        disabled={prod.out_of_stock}
                        onClick={e => { e.stopPropagation(); onAddToCart({ ...prod, qty: 1 }) }}
                        style={{
                          background: prod.out_of_stock ? '#e5e7eb' : primary,
                          color: '#fff', border: 'none', borderRadius: 8,
                          width: 30, height: 30, cursor: prod.out_of_stock ? 'not-allowed' : 'pointer',
                          fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, fontFamily: 'inherit',
                        }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {cartCount > 0 && <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart} color={primary} />}
      <ProductModal product={selected} onClose={() => setSelected(null)}
        onAddToCart={onAddToCart} currency={currency} primaryColor={primary} />
    </div>
  )
}
