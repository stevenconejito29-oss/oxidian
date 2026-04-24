/**
 * MenuStyleExpress — Carta ultracompacta tipo QR de mesa.
 * Sin imágenes, precio visible de inmediato, decisiones rápidas.
 * Ideal para tiendas de barrio, bares y servicios simples.
 */
import React from 'react'
import { money, CartFab, HoursBar, BranchSelector } from './MenuShared'

export function MenuStyleExpress({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [activeBranch,  setActiveBranch]  = React.useState(branch)
  const [search,        setSearch]        = React.useState('')

  const primary  = theme?.primary   || '#111'
  const currency = store?.currency  || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const active   = activeSection || sections[0]?.id
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal = money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)

  const currentSection = sections.find(s => s.id === active)
  const filtered = (currentSection?.products || []).filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', maxWidth: 640, margin: '0 auto' }}>

      {/* Header compacto */}
      <div style={{ background: primary, color: '#fff', padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{store?.name}</div>
          {cartCount > 0 && (
            <button onClick={onOpenCart} style={{
              background: '#fff', color: primary, border: 'none', borderRadius: 20,
              padding: '4px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🛒 {cartCount} · {cartTotal}
            </button>
          )}
        </div>
        {activeBranch && (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            📍 {activeBranch.name}
            {activeBranch.address ? ` · ${activeBranch.address}` : ''}
            {activeBranch.phone ? <a href={`tel:${activeBranch.phone}`} style={{ color: '#fff', marginLeft: 8 }}>📞 {activeBranch.phone}</a> : null}
          </div>
        )}
      </div>

      {/* Selector de sede */}
      {branches?.length > 1 && (
        <BranchSelector branches={branches} activeBranch={activeBranch} onSelect={setActiveBranch} color={primary} />
      )}

      {/* Horario */}
      {activeBranch && <HoursBar branch={activeBranch} color={primary} />}

      {/* Buscador */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box',
            background: '#fafafa', outline: 'none',
          }}
        />
      </div>

      {/* Tabs de sección — horizontal scroll */}
      {!search && sections.length > 1 && (
        <div style={{
          display: 'flex', gap: 4, padding: '8px 12px', overflowX: 'auto',
          borderBottom: '1px solid #f0f0f0',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: active === s.id ? primary : '#f3f4f6',
              color: active === s.id ? '#fff' : '#374151',
              flexShrink: 0,
            }}>{s.name}</button>
          ))}
        </div>
      )}

      {/* Lista de productos — ultracompacta */}
      <div style={{ padding: '8px 0' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: 14 }}>
            {search ? `Sin resultados para "${search}"` : 'Sin productos disponibles'}
          </div>
        )}
        {filtered.map((p, idx) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}>
            {p.emoji && <span style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: 'center' }}>{p.emoji}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111', lineHeight: 1.3 }}>{p.name}</div>
              {p.description && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: primary }}>
                {money(p.price, currency)}
              </span>
              <button
                onClick={() => onAddToCart({ ...p, qty: 1, product_name: p.name })}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: primary, color: '#fff', fontSize: 20, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, lineHeight: 1,
                }}
              >+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Carrito flotante */}
      {cartCount > 0 && (
        <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart} color={primary} />
      )}
    </div>
  )
}
