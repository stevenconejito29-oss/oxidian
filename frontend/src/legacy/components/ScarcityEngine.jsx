/**
 * ScarcityEngine.jsx — CarmoCream v3
 * ─────────────────────────────────────────────────────────────
 * Módulo de psicología de escasez conectado a datos REALES.
 * - StockBadge: usa out_of_stock de BD + "Próxima Disponibilidad"
 * - SocialProofBadge: espectadores en tiempo real (simulado fijo)
 * - RecentOrderToast: desactivado por solicitud
 * ─────────────────────────────────────────────────────────────
 */
import React from 'react'

// ── StockBadge ────────────────────────────────────────────────
// Muestra estado real del producto: Agotado · Próxima Disponibilidad
// o escasez visual cuando queda poco stock.
export function StockBadge({ productName, outOfStock, lowStock, remainingToday }) {
  // AGOTADO — fuente de verdad: campo out_of_stock de Supabase
  if (outOfStock) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:4,
        padding:'3px 9px', borderRadius:50,
        background:'rgba(239,68,68,0.11)',
        border:'1px solid rgba(239,68,68,0.26)',
        fontSize:'0.60rem', fontWeight:900, color:'#DC2626',
        letterSpacing:'0.06em', fontFamily:"'Nunito',sans-serif",
      }}>
        ⛔ AGOTADO · Próxima Disponibilidad
      </span>
    )
  }

  // LOW STOCK — cuando el Admin marca low_stock o el stock_items quantity es bajo
  if (lowStock) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:4,
        padding:'3px 9px', borderRadius:50,
        background:'rgba(245,158,11,0.10)',
        border:'1px solid rgba(245,158,11,0.26)',
        fontSize:'0.58rem', fontWeight:900, color:'#D97706',
        letterSpacing:'0.05em', fontFamily:"'Nunito',sans-serif",
      }}>
        ⚡ Últimas unidades
      </span>
    )
  }

  if (Number.isFinite(Number(remainingToday)) && Number(remainingToday) > 0 && Number(remainingToday) <= 5) {
    const urgent = Number(remainingToday) <= 2
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:4,
        padding:'3px 9px', borderRadius:50,
        background:urgent ? 'rgba(255,77,109,0.11)' : 'rgba(245,158,11,0.10)',
        border:`1px solid ${urgent ? 'rgba(255,77,109,0.30)' : 'rgba(245,158,11,0.26)'}`,
        fontSize:'0.58rem', fontWeight:900,
        color:urgent ? '#FF4D6D' : '#D97706',
        letterSpacing:'0.05em', fontFamily:"'Nunito',sans-serif",
      }}>
        {urgent ? '🔥' : '⚡'} {Number(remainingToday) === 1 ? 'Última unidad del día' : `Quedan ${Number(remainingToday)} hoy`}
      </span>
    )
  }

  return null
}

// RecentOrderToast desactivado
export function RecentOrderToast() { return null }

// ── SocialProofBadge ──────────────────────────────────────────
export function SocialProofBadge({ productId }) {
  function seededRand(id, offset = 0) {
    let h = 0
    const str = String(id) + String(offset)
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0
    }
    return Math.abs(h) / 2147483647
  }
  const [viewers, setViewers] = React.useState(() => {
    const r = seededRand(productId, 99)
    const isPeak = new Date().getHours() >= 16 && new Date().getHours() <= 20
    return Math.floor(r * 5) + (isPeak ? 3 : 2)
  })

  React.useEffect(() => {
    const tick = () => setViewers(v => Math.max(2, Math.min(11, v + (Math.random() < 0.5 ? 1 : -1))))
    const id = setInterval(tick, 20000)
    return () => clearInterval(id)
  }, [productId])

  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6,
      background:'rgba(212,175,55,0.08)',
      border:'1px solid rgba(212,175,55,0.20)',
      borderRadius:50, padding:'4px 11px',
      fontSize:'0.67rem', fontWeight:800,
      color:'rgba(212,175,55,0.82)',
      fontFamily:"'Nunito',sans-serif",
    }}>
      <span style={{
        width:6, height:6, borderRadius:'50%',
        background:'#D4AF37', flexShrink:0,
        animation:'spbPulse 2.2s ease-in-out infinite',
      }}/>
      {viewers} {viewers === 1 ? 'persona mirando' : 'personas mirando'}
      <style>{`@keyframes spbPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(0.75)}}`}</style>
    </div>
  )
}
