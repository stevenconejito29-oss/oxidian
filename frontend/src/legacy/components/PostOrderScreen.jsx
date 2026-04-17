/**
 * PostOrderScreen.jsx — CarmoCream v7
 * Un solo mensaje limpio · Confetti · Club · Sin fases
 */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isGiftOrderItem } from '../lib/clubGift'

const CONFETTI = ['🍓','🎉','🍑','✨','🫐','💛','🍇','🎊','🥭','⭐']

function Confetti() {
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    id: i, emoji: CONFETTI[i % CONFETTI.length],
    left: `${5 + (i * 5.8) % 90}%`,
    delay: `${(i * 0.11).toFixed(2)}s`,
    duration: `${1.3 + (i % 5) * 0.28}s`,
    size: `${0.9 + (i % 3) * 0.3}rem`,
  }))
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1 }}>
      {pieces.map(p => (
        <span key={p.id} style={{
          position:'absolute', top:'-10%', left:p.left,
          fontSize:p.size, opacity:0,
          fontFamily:"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
          animation:`posConfetti ${p.duration} ${p.delay} ease-in forwards`,
        }}>{p.emoji}</span>
      ))}
      <style>{`@keyframes posConfetti{0%{top:-10%;opacity:0;transform:translateY(0) rotate(0deg) scale(.5)}15%{opacity:1}80%{opacity:.8}100%{top:calc(100% + 48px);opacity:0;transform:translateY(0) rotate(360deg) scale(1.2)}}`}</style>
    </div>
  )
}

export async function sendReviewLinkWhatsApp({ orderNum, reviewToken, customerPhone, waNumber, businessName }) {
  try {
    const { data: existing } = await supabase.from('reviews').select('id').eq('order_number', orderNum).maybeSingle()
    if (existing) return { ok: false, reason: 'Ya existe reseña para este pedido' }
    const reviewParams = new URLSearchParams({ review: String(orderNum || '') })
    if (reviewToken) reviewParams.set('token', String(reviewToken).trim())
    const reviewUrl = `${(import.meta.env.VITE_PUBLIC_WEB_URL || window.location.origin || '').replace(/\/$/, '')}/menu?${reviewParams.toString()}`
    const msg = encodeURIComponent(
      `¡Hola! 👋 Soy ${businessName || 'CarmoCream'}.\n\n` +
      `Esperamos que hayas disfrutado tu pedido #${orderNum} 🍓\n\n` +
      `Si tienes un momento, nos encantaría conocer tu opinión:\n👉 ${reviewUrl}\n\n¡Gracias! 💛`
    )
    const phone = (customerPhone || waNumber || '').replace(/\D/g, '')
    if (!phone) return { ok: false, reason: 'Sin número de teléfono' }
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener')
    return { ok: true }
  } catch (e) { return { ok: false, reason: e.message } }
}

export default function PostOrderScreen({ order, onClose, savedCustomer, loyalty }) {
  const [ready, setReady] = useState(false)
  const clubLevel  = loyalty?.currentLevel || null
  const clubOrders = loyalty?.orderCount   || 0
  const clubNext   = loyalty?.nextLevel    || null
  const clubSurpriseGift = order?.clubSurpriseGift || order?.order?.club_surprise_gift || null
  const name = savedCustomer?.name ? savedCustomer.name.split(' ')[0] : null

  useEffect(() => {
    // guardar stamp local
    try {
      const key = savedCustomer?.phone ? `cc_stamps_${savedCustomer.phone}` : 'cc_stamps_guest'
      const prev = parseInt(localStorage.getItem(key) || '0', 10)
      localStorage.setItem(key, prev + 1)
    } catch {}
    // mostrar contenido con pequeño delay para que la animación sea suave
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9500,
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }}>
      <div style={{
        width:'100%', maxWidth:480, position:'relative', overflow:'hidden',
        background:'#F8F3EC', borderRadius:'28px 28px 0 0',
        borderTop:'3px solid #E8607A',
        boxShadow:'0 -16px 64px rgba(0,0,0,0.22)',
        animation:'posSlideUp .40s cubic-bezier(0.16,1,0.3,1)',
        fontFamily:"'Nunito',sans-serif",
        maxHeight:'88dvh', overflowY:'auto',
      }}>
        <Confetti />
        {/* handle */}
        <div style={{ width:40, height:4, borderRadius:50, background:'rgba(0,0,0,0.12)', margin:'10px auto 0', position:'relative', zIndex:2 }} />

        <div style={{ position:'relative', zIndex:2, padding:'20px 22px calc(24px + env(safe-area-inset-bottom,0px))' }}>

          {/* ─── CABECERA ─── */}
          <div style={{ textAlign:'center', marginBottom:20, animation:'posPopIn .5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ fontSize:'3.2rem', marginBottom:8 }}>🎉</div>
            <div style={{
              display:'inline-block', background:'#E8607A', color:'white',
              padding:'3px 14px', borderRadius:999, fontSize:'0.60rem',
              fontWeight:900, letterSpacing:'0.12em', marginBottom:12,
            }}>PEDIDO #{order.num} · RECIBIDO</div>
            <h2 style={{ fontSize:'1.65rem', fontWeight:900, color:'#1C3829', margin:'0 0 6px', lineHeight:1.1 }}>
              ¡Gracias{name ? `, ${name}` : ''}! 🍓
            </h2>
            <p style={{ color:'#5F6B63', fontSize:'0.88rem', margin:0, lineHeight:1.5 }}>
              Ya estamos preparando tu pedido. Te escribiremos por WhatsApp cuando esté en camino.
            </p>
          </div>


          {/* ─── RESUMEN PEDIDO ─── */}
          <div style={{
            background:'#FFFFFF', border:'1.5px solid rgba(232,96,122,0.18)',
            borderRadius:18, padding:'13px 16px', marginBottom:14,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:'0.62rem', fontWeight:900, color:'#6B7280', letterSpacing:'.1em' }}>TU PEDIDO</span>
              <span style={{ fontSize:'0.62rem', fontWeight:900, color:'#6B7280', letterSpacing:'.1em' }}>TOTAL</span>
            </div>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between', gap:8,
                padding:'6px 0', borderBottom: i < order.items.length-1 ? '1px solid rgba(232,96,122,0.10)' : 'none',
                fontSize:'0.82rem', fontWeight:800, color:'#1C3829',
              }}>
                <span>
                  {item.emoji || '🍓'} {item.product_name} ×{item.qty}
                  {isGiftOrderItem(item) && (
                    <span style={{ marginLeft: 8, fontSize: '0.62rem', fontWeight: 900, color: '#9F1239', background: '#FFF1F2', border: '1px solid #FBCFE8', padding: '2px 7px', borderRadius: 50 }}>
                      REGALO CLUB
                    </span>
                  )}
                </span>
                <span style={{ color:'#2D6A4F', flexShrink:0 }}>{isGiftOrderItem(item) ? 'Gratis' : `€${(item.price*item.qty).toFixed(2)}`}</span>
              </div>
            ))}
            <div style={{
              display:'flex', justifyContent:'space-between',
              marginTop:10, paddingTop:10, borderTop:'2px solid rgba(232,96,122,0.18)',
              fontWeight:900, color:'#1C3829',
            }}>
              <span style={{ fontFamily:"'Pacifico',cursive" }}>Total</span>
              <span style={{ fontFamily:"'Pacifico',cursive", color:'#2D6A4F', fontSize:'1.15rem' }}>€{order.total?.toFixed(2)}</span>
            </div>
          </div>


          {/* ─── CLUB (solo si tiene nivel) ─── */}
          {clubLevel && (
            <div style={{
              background:'#D8F3DC', border:'1.5px solid #95D5B2',
              borderRadius:16, padding:'12px 14px', marginBottom:14,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontSize:'1.8rem' }}>{clubLevel.emoji || '⭐'}</span>
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:900, color:'#1A4733', letterSpacing:'.1em' }}>CLUB CARMOCREAM · {clubLevel.label?.toUpperCase()}</div>
                <div style={{ fontSize:'0.78rem', color:'rgba(26,71,51,.75)', marginTop:3 }}>
                  {clubOrders} pedido{clubOrders !== 1 ? 's' : ''} acumulados
                  {clubLevel.discount_percent > 0 && ` · ${clubLevel.discount_percent}% de descuento activo`}
                </div>
                {clubNext && (
                  <div style={{ fontSize:'0.72rem', color:'#2D6A4F', marginTop:4, fontWeight:700 }}>
                    Próximo nivel: {clubNext.label} {clubNext.reward_text ? `· ${clubNext.reward_text}` : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {clubSurpriseGift && (
            <div style={{
              background:'#FFF1F2', border:'1.5px solid #FBCFE8',
              borderRadius:16, padding:'12px 14px', marginBottom:14,
            }}>
              <div style={{ fontSize:'0.66rem', fontWeight:900, color:'#9F1239', letterSpacing:'.1em', marginBottom:6 }}>
                {clubSurpriseGift.level_emoji || '⭐'} REGALO SORPRESA ACTIVADO
              </div>
              <div style={{ fontSize:'0.92rem', fontWeight:900, color:'#1C3829' }}>
                {(clubSurpriseGift.item?.emoji || '🎁')} {clubSurpriseGift.item?.name || 'Regalo sorpresa'}
              </div>
              <div style={{ fontSize:'0.76rem', color:'#6B7280', marginTop:4, lineHeight:1.5 }}>
                Va incluido gratis en este pedido por tu nivel {clubSurpriseGift.level_label || clubLevel?.label || 'Club'}.
              </div>
              {clubSurpriseGift.note && (
                <div style={{ fontSize:'0.72rem', color:'#9F1239', fontWeight:700, marginTop:6 }}>
                  {clubSurpriseGift.note}
                </div>
              )}
            </div>
          )}



          {/* ─── BOTÓN CERRAR ─── */}
          <button onClick={onClose} style={{
            width:'100%', padding:'15px', borderRadius:16, border:'none',
            background:'linear-gradient(135deg,#1C3829,#2D6A4F)', color:'white',
            fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
            fontFamily:"'Nunito',sans-serif",
          }}>
            Volver al menú 🍓
          </button>

        </div>

        <style>{`
          @keyframes posSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          @keyframes posPopIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        `}</style>
      </div>
    </div>
  )
}
