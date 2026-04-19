/**
 * MenuShared.jsx — Componentes compartidos entre todos los estilos de menú público.
 * CartButton, SearchBar, BranchInfo, ProductModal, CartBadge, etc.
 */
import React from 'react'

export function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

export function duration(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? (m ? `${h}h ${m}min` : `${h}h`) : `${mins} min`
}

// ─── Cart floating button ─────────────────────────────────────────
export function CartFab({ count, total, onClick, color }) {
  if (!onClick) return null
  return (
    <button onClick={onClick} style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: color || '#111', color: '#fff', border: 'none',
      borderRadius: 99, padding: '14px 28px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 100,
      boxShadow: '0 8px 32px rgba(0,0,0,.25)', fontSize: 15, fontWeight: 700,
      transition: '.2s', minWidth: 200,
    }}>
      <span style={{
        background: 'rgba(255,255,255,.25)', borderRadius: 99,
        padding: '2px 9px', fontSize: 13, fontWeight: 800,
      }}>{count}</span>
      <span style={{ flex: 1, textAlign: 'center' }}>Ver carrito</span>
      <span>{total}</span>
    </button>
  )
}

// ─── Barra de horario ─────────────────────────────────────────────
export function HoursBar({ branch, color }) {
  if (!branch) return null
  const now  = new Date()
  const hour = now.getHours()
  const open = Number(branch.open_hour || 10)
  const close= Number(branch.close_hour || 22)
  const isOpen = hour >= open && hour < close
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, padding: '3px 10px', borderRadius: 20,
      background: isOpen ? '#dcfce7' : '#fee2e2',
      color: isOpen ? '#15803d' : '#b91c1c',
    }}>
      <span style={{ fontSize: 8 }}>●</span>
      {isOpen ? `Abierto · Cierra a las ${close}:00` : `Cerrado · Abre a las ${open}:00`}
    </div>
  )
}

// ─── Badge de descuento ───────────────────────────────────────────
export function DiscountBadge({ original, current }) {
  if (!original || original <= current) return null
  const pct = Math.round(100 - (current / original) * 100)
  return (
    <span style={{
      background: '#dc2626', color: '#fff',
      fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
    }}>-{pct}%</span>
  )
}

// ─── Stock badge ──────────────────────────────────────────────────
export function StockBadge({ product }) {
  if (!product.track_stock) return null
  const qty = product.stock_quantity || 0
  if (qty <= 0) return (
    <span style={{ fontSize: 10, background: '#f3f4f6', color: '#9ca3af', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
      Sin stock
    </span>
  )
  if (qty <= 5) return (
    <span style={{ fontSize: 10, background: '#fef9c3', color: '#713f12', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
      ¡Últimas {qty}!
    </span>
  )
  return null
}

// ─── Featured badge ───────────────────────────────────────────────
export function FeaturedBadge({ product }) {
  if (!product.is_featured) return null
  return (
    <span style={{
      fontSize: 10, background: '#fef08a', color: '#713f12',
      padding: '2px 7px', borderRadius: 6, fontWeight: 700,
    }}>⭐ Destacado</span>
  )
}

// ─── Modal de producto genérico ───────────────────────────────────
export function ProductModal({ product, onClose, onAddToCart, currency, primaryColor }) {
  if (!product) return null
  const primary = primaryColor || '#111'
  let variants = []
  try { variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []) } catch {}
  const [selectedVariant, setSelectedVariant] = React.useState(null)
  const price = selectedVariant?.price_modifier
    ? product.price + selectedVariant.price_modifier
    : product.price

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
        animation: 'slideUp .25s ease',
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        {/* Imagen o emoji */}
        <div style={{
          height: 240, background: `${primary}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name}
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'20px 20px 0 0' }} />
            : <span style={{ fontSize: 80 }}>{product.emoji || '🍽️'}</span>
          }
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,.4)', color: '#fff', border: 'none',
            borderRadius: 99, width: 32, height: 32, cursor: 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ padding: '20px 20px 32px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{product.name}</h2>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: primary }}>{money(price, currency)}</div>
              {product.compare_price > product.price && (
                <div style={{ fontSize: 13, textDecoration: 'line-through', color: '#aaa' }}>
                  {money(product.compare_price, currency)}
                </div>
              )}
            </div>
          </div>

          {/* Duración para servicios */}
          {product.service_duration_minutes && (
            <div style={{ fontSize:13, color:'#888', marginBottom:8 }}>
              ⏱ {duration(product.service_duration_minutes)}
            </div>
          )}

          {product.description && (
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              {product.description}
            </p>
          )}

          {/* Variantes */}
          {variants.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Opciones:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {variants.map((v, i) => (
                  <button key={i} onClick={() => setSelectedVariant(v === selectedVariant ? null : v)} style={{
                    padding: '7px 16px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
                    border: `2px solid ${selectedVariant === v ? primary : '#e5e7eb'}`,
                    background: selectedVariant === v ? `${primary}12` : '#fff',
                    color: selectedVariant === v ? primary : '#374151', fontWeight: selectedVariant === v ? 600 : 400,
                    fontFamily: 'inherit',
                  }}>
                    {v.label || v.name} {v.price_modifier > 0 && `+${money(v.price_modifier, currency)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            disabled={product.out_of_stock}
            onClick={() => { onAddToCart({ ...product, qty: 1, selectedVariant }); onClose() }}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: product.out_of_stock ? '#e5e7eb' : primary,
              color: product.out_of_stock ? '#9ca3af' : '#fff',
              fontSize: 16, fontWeight: 700, cursor: product.out_of_stock ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            {product.out_of_stock ? 'Sin stock' : '+ Añadir al carrito'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Banner de información de la sede ────────────────────────────
export function BranchSelector({ branches, activeBranch, onSelect, color }) {
  if (!branches || branches.length <= 1) return null
  return (
    <div style={{ padding: '8px 16px', background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {branches.map(b => (
          <button key={b.id} onClick={() => onSelect(b)} style={{
            flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 12,
            border: `1px solid ${activeBranch?.id === b.id ? color : '#e5e7eb'}`,
            background: activeBranch?.id === b.id ? `${color}15` : '#fff',
            color: activeBranch?.id === b.id ? color : '#666',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: activeBranch?.id === b.id ? 600 : 400,
          }}>📍 {b.name}</button>
        ))}
      </div>
    </div>
  )
}
