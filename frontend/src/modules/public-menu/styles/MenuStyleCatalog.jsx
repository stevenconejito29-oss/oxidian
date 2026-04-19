/**
 * MenuStyleCatalog — Plantilla para farmacias, catálogos técnicos y tiendas de barrio.
 * Lista limpia, búsqueda potente, categorías en accordion, información nutricional/técnica.
 */
import React from 'react'
import { money, CartFab, HoursBar, StockBadge, DiscountBadge, FeaturedBadge, ProductModal, BranchSelector } from './MenuShared'

export function MenuStyleCatalog({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [search,       setSearch]       = React.useState('')
  const [selected,     setSelected]     = React.useState(null)
  const [activeBranch, setActiveBranch] = React.useState(branch)
  const [expanded,     setExpanded]     = React.useState({})

  const primary  = theme?.primary  || '#2563eb'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const cartCount= (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal= money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)

  const searchResults = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return sections.flatMap(s => s.products.filter(p =>
      `${p.name} ${p.description || ''}`.toLowerCase().includes(q)
    ))
  }, [search, sections])

  function toggleSection(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  const cartQty = (id) => (cart || []).find(i => i.id === id)?.qty || 0

  // Inicializar primera sección expandida
  React.useEffect(() => {
    if (sections.length > 0) setExpanded({ [sections[0].id]: true })
  }, [menu])

  return (
    <div style={{ minHeight: '100vh', background: '#f8faff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 6px rgba(0,0,0,.06)',
      }}>
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: primary }}>{store?.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                {(activeBranch || branch) && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    📍 {(activeBranch || branch).address || (activeBranch || branch).city}
                  </span>
                )}
                <HoursBar branch={activeBranch || branch} color={primary} />
              </div>
            </div>
            <button onClick={onOpenCart} style={{
              background: cartCount > 0 ? primary : '#f3f4f6',
              color: cartCount > 0 ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 10, padding: '8px 16px',
              cursor: 'pointer', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}>
              🛒 {cartCount > 0 && <span>{cartCount}</span>}
            </button>
          </div>

          {/* Búsqueda */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 16 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar productos de ${store?.name || 'la tienda'}…`}
              style={{
                width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10,
                border: `2px solid ${search ? primary : '#e5e7eb'}`, fontSize: 14, outline: 'none',
                boxSizing: 'border-box', transition: '.2s', background: '#f9fafb',
              }} />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: '#e5e7eb', border: 'none', borderRadius: 99, width: 22, height: 22,
                cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            )}
          </div>
        </div>
      </header>

      <BranchSelector branches={branches} activeBranch={activeBranch || branch} onSelect={setActiveBranch} color={primary} />

      {/* Contenido */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '12px 16px 100px' }}>

        {/* Resultados de búsqueda */}
        {searchResults && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "<strong>{search}</strong>"
            </div>
            {searchResults.map(prod => (
              <CatalogRow key={prod.id} prod={prod} primary={primary} currency={currency}
                qty={cartQty(prod.id)} onAdd={() => onAddToCart({ ...prod, qty: 1 })}
                onSelect={() => setSelected(prod)} />
            ))}
            {!searchResults.length && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div>Sin resultados. Prueba con otro término.</div>
              </div>
            )}
          </div>
        )}

        {/* Secciones con accordion */}
        {!searchResults && sections.map(section => (
          <div key={section.id} style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff' }}>
            {/* Header de sección */}
            <button onClick={() => toggleSection(section.id)} style={{
              width: '100%', padding: '14px 16px', background: 'none', border: 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>{section.image_url ? '📂' : '🏷️'}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{section.name}</span>
                <span style={{
                  fontSize: 11, background: `${primary}15`, color: primary,
                  padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                }}>{section.products.length}</span>
              </div>
              <span style={{ color: '#aaa', fontSize: 18, transition: '.2s',
                transform: expanded[section.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </button>

            {/* Productos */}
            {expanded[section.id] && (
              <div style={{ borderTop: '1px solid #f3f4f6' }}>
                {section.products.map((prod, i) => (
                  <React.Fragment key={prod.id}>
                    <CatalogRow prod={prod} primary={primary} currency={currency}
                      qty={cartQty(prod.id)} onAdd={() => onAddToCart({ ...prod, qty: 1 })}
                      onSelect={() => setSelected(prod)} />
                    {i < section.products.length - 1 && (
                      <div style={{ borderBottom: '1px solid #f3f4f6', margin: '0 16px' }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {cartCount > 0 && <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart} color={primary} />}
      <ProductModal product={selected} onClose={() => setSelected(null)}
        onAddToCart={onAddToCart} currency={currency} primaryColor={primary} />
    </div>
  )
}

function CatalogRow({ prod, primary, currency, qty, onAdd, onSelect }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
      alignItems: 'center', background: qty > 0 ? `${primary}04` : 'transparent',
      transition: '.15s',
    }}>
      {/* Imagen/emoji */}
      <div style={{
        width: 56, height: 56, borderRadius: 10, background: `${primary}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, flexShrink: 0, overflow: 'hidden',
      }}>
        {prod.image_url
          ? <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : (prod.emoji || '💊')
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <FeaturedBadge product={prod} />
          <StockBadge product={prod} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{prod.name}</div>
        {prod.description && (
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prod.description}
          </div>
        )}
        {prod.service_duration_minutes && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            ⏱ {Math.floor(prod.service_duration_minutes / 60) || ''}
            {prod.service_duration_minutes < 60 ? `${prod.service_duration_minutes} min` : `${Math.floor(prod.service_duration_minutes/60)}h`}
          </div>
        )}
      </div>

      {/* Precio + acción */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary }}>
          {money(prod.price, currency)}
        </div>
        {prod.compare_price > prod.price && (
          <div style={{ fontSize: 11, textDecoration: 'line-through', color: '#aaa' }}>
            {money(prod.compare_price, currency)}
          </div>
        )}
        <button
          disabled={prod.out_of_stock}
          onClick={e => { e.stopPropagation(); onAdd() }}
          style={{
            background: prod.out_of_stock ? '#f3f4f6' : primary,
            color: prod.out_of_stock ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 8, padding: '6px 12px',
            cursor: prod.out_of_stock ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          {qty > 0 && <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '0 5px', fontSize: 11 }}>{qty}</span>}
          {prod.out_of_stock ? 'Agotado' : '+ Añadir'}
        </button>
      </div>
    </div>
  )
}
