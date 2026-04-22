import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { useLoyalty } from '../lib/useLoyalty'
import { hasOperationalSurpriseGift } from '../lib/clubGift'

const SOURCE_LABELS = {
  instagram: { icon: '\u{1F4F8}', text: 'Llegaste via Instagram', color: '#C13584' },
  facebook: { icon: '\u{1F44D}', text: 'Llegaste via Facebook', color: '#1877F2' },
  whatsapp: { icon: '\u{1F4AC}', text: 'Llegaste via WhatsApp', color: '#25D366' },
  tiktok: { icon: '\u{1F3B5}', text: 'Llegaste via TikTok', color: '#EE1D52' },
  direct: { icon: '\u{1F517}', text: 'Acceso directo', color: '#2D6A4F' },
  referral: { icon: '\u{1F310}', text: 'Referido', color: '#2D6A4F' },
}

const cc = {
  bg: '#F2EEE8',
  white: '#FFFFFF',
  green: '#1A4733',
  greenMid: '#2D6A4F',
  greenLt: '#D8F3DC',
  greenBd: '#74C69D',
  rose: '#E8607A',
  text: '#1C3829',
  text2: 'rgba(28,56,41,0.62)',
  text3: 'rgba(28,56,41,0.40)',
  muted: 'rgba(28,56,41,0.45)',
}

export default function LoyaltyWidget({ phone, open: controlledOpen, onClose: onControlledClose, loyalty: externalLoyalty, clubUnlocks, storeId }) {
  const [open, setOpen] = useState(false)
  const isOpen = controlledOpen !== undefined ? controlledOpen : open
  const setOpenState = value => {
    if (controlledOpen === undefined) setOpen(value)
    else if (!value && onControlledClose) onControlledClose()
  }

  const internalLoyalty = useLoyalty({ phone: externalLoyalty ? null : phone, storeId })
  const loyaltyData = externalLoyalty || internalLoyalty
  const { source, currentLevel, nextLevel, orderCount, progress, loading } = loyaltyData

  if (loading) return null

  const level = currentLevel
  const srcInfo = SOURCE_LABELS[source] || SOURCE_LABELS.direct
  const levels = loyaltyData.levels || []
  const benefits = Array.isArray(level?.benefits) ? level.benefits.filter(Boolean) : []
  const hasSurpriseGift = hasOperationalSurpriseGift(level)
  const premiumFlags = [
    level?.free_delivery ? 'Delivery gratis' : null,
    level?.priority_delivery ? 'Prioridad' : null,
    level?.free_topping ? 'Topping gratis' : null,
    level?.exclusive_menu ? 'Menu exclusivo' : null,
    hasSurpriseGift ? 'Regalo sorpresa' : null,
  ].filter(Boolean)
  const unlocks = clubUnlocks || { items: [], total: 0, productCount: 0, comboCount: 0 }

  return (
    <>
      <button
        onClick={() => setOpenState(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px 8px 12px',
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.32)',
          borderRadius: 50,
          cursor: 'pointer',
          fontFamily: "'Nunito', sans-serif",
          transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          WebkitTapHighlightColor: 'transparent',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{level.emoji}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'white', letterSpacing: '0.08em', lineHeight: 1, textTransform: 'uppercase' }}>
            Club: {level.label}
          </span>
          <div style={{ width: 52, height: 3, borderRadius: 50, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 50, width: `${progress}%`, background: '#D8F3DC', transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>
        <span style={{ fontSize: '0.60rem', color: 'rgba(255,255,255,0.70)', fontWeight: 700 }}>{'>'}</span>
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          onClick={e => e.target === e.currentTarget && setOpenState(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9200,
            background: 'rgba(28,56,41,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'lwFade 0.20s ease',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: cc.bg,
              borderRadius: '24px 24px 0 0',
              borderTop: `3px solid ${cc.rose}`,
              padding: '0 0 calc(28px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -12px 50px rgba(0,0,0,0.20)',
              animation: 'lwUp 0.30s cubic-bezier(0.16,1,0.3,1)',
              maxHeight: '90dvh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 50, background: '#F4A7B9', margin: '10px auto 0' }} />

            <div style={{ background: `linear-gradient(135deg, ${cc.green}, ${cc.greenMid})`, padding: '20px 18px 18px', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '0.56rem', fontWeight: 900, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.65)', margin: '0 0 5px', textTransform: 'uppercase' }}>
                    Club Oxidian
                  </p>
                  <h2 style={{ fontFamily: "'Pacifico', cursive", fontSize: '1.4rem', color: 'white', margin: '0 0 4px', lineHeight: 1.1 }}>
                    {level.emoji} {level.label}
                  </h2>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', margin: 0, fontWeight: 600 }}>
                    {level.reward_text}
                  </p>
                </div>
                <button
                  onClick={() => setOpenState(false)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.80)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  X
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                    {orderCount} pedido{orderCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.60)' }}>
                    {nextLevel ? `${nextLevel.min_orders - orderCount} para ${nextLevel.emoji} ${nextLevel.label}` : 'Nivel maximo'}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 50, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 50, width: `${progress}%`, background: 'linear-gradient(90deg, #D8F3DC, #74C69D)', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {level.discount_percent > 0 && <Chip bg="#D8F3DC" color="#1A4733">{`${level.discount_percent}% activo`}</Chip>}
                  {level.badge_text && <Chip bg="#FDE8EF" color="#8B1A35">{level.badge_text}</Chip>}
                  {level.free_delivery && <Chip bg="#DBEAFE" color="#1D4ED8">Delivery gratis</Chip>}
                  {level.priority_delivery && <Chip bg="#FEF3C7" color="#92400E">Prioridad</Chip>}
                  {level.free_topping && <Chip bg="#F3E8FF" color="#7C3AED">Topping gratis</Chip>}
                  {level.exclusive_menu && <Chip bg="#CCFBF1" color="#0F766E">Menu exclusivo</Chip>}
                  {hasSurpriseGift && <Chip bg="#FFE4E6" color="#BE123C">Regalo sorpresa</Chip>}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 16px 0' }}>
              {(level.unlock_message || level.birthday_reward_text) && (
                <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                  {level.unlock_message && (
                    <div style={{ padding: '11px 12px', borderRadius: 14, background: cc.white, border: '1.5px solid rgba(232,96,122,0.22)' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '0.56rem', fontWeight: 900, color: cc.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        Mensaje del nivel
                      </p>
                      <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 700, color: cc.text, lineHeight: 1.45 }}>
                        {level.unlock_message}
                      </p>
                    </div>
                  )}
                  {level.birthday_reward_text && (
                    <div style={{ padding: '11px 12px', borderRadius: 14, background: '#FFFBEB', border: '1.5px solid #FDE68A' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '0.56rem', fontWeight: 900, color: '#92400E', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        Premio de cumpleanos
                      </p>
                      <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 700, color: '#92400E', lineHeight: 1.45 }}>
                        {level.birthday_reward_text}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {benefits.length > 0 && (
                <>
                  <p style={{ fontSize: '0.56rem', fontWeight: 900, color: cc.muted, letterSpacing: '0.16em', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    Beneficios activos
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {benefits.map(benefit => (
                      <span key={benefit} style={{ fontSize: '0.68rem', fontWeight: 800, color: cc.green, background: cc.white, border: `1.5px solid ${cc.greenBd}`, padding: '8px 10px', borderRadius: 12 }}>
                        {benefit}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {premiumFlags.length > 0 && (
                <>
                  <p style={{ fontSize: '0.56rem', fontWeight: 900, color: cc.muted, letterSpacing: '0.16em', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    Extras de este nivel
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
                    {premiumFlags.map(flag => (
                      <div key={flag} style={{ background: cc.white, border: '1.5px solid rgba(28,56,41,0.10)', borderRadius: 12, padding: '10px 12px', fontSize: '0.70rem', fontWeight: 800, color: cc.text }}>
                        {flag}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {unlocks.total > 0 && (
                <>
                  <p style={{ fontSize: '0.56rem', fontWeight: 900, color: cc.muted, letterSpacing: '0.16em', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    Desbloqueos de este nivel
                  </p>
                  <div style={{ background: cc.white, border: `1.5px solid ${cc.greenBd}`, borderRadius: 16, padding: '12px 12px 10px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: cc.text }}>
                        {unlocks.total === 1
                          ? `Tu nivel ${level.label} acaba de abrir 1 opcion nueva`
                          : `Tu nivel ${level.label} acaba de abrir ${unlocks.total} opciones nuevas`}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {unlocks.productCount > 0 && <Chip bg="#FDE8EF" color="#8B1A35">{`${unlocks.productCount} producto${unlocks.productCount !== 1 ? 's' : ''}`}</Chip>}
                        {unlocks.comboCount > 0 && <Chip bg="#DBEAFE" color="#1D4ED8">{`${unlocks.comboCount} combo${unlocks.comboCount !== 1 ? 's' : ''}`}</Chip>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {unlocks.items.map(item => (
                        <div
                          key={`${item.type}-${item.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            minHeight: 36,
                            maxWidth: '100%',
                            padding: '8px 10px',
                            borderRadius: 12,
                            background: item.type === 'combo' ? '#EFF6FF' : '#FFF7ED',
                            border: `1px solid ${item.type === 'combo' ? '#BFDBFE' : '#FED7AA'}`,
                            color: cc.text,
                            fontSize: '0.68rem',
                            fontWeight: 800,
                          }}
                        >
                          <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    {unlocks.total > unlocks.items.length && (
                      <p style={{ margin: '10px 0 0', fontSize: '0.66rem', fontWeight: 700, color: cc.text2 }}>
                        Y {unlocks.total - unlocks.items.length} mas ya visibles en el menu.
                      </p>
                    )}
                  </div>
                </>
              )}

              <p style={{ fontSize: '0.56rem', fontWeight: 900, color: cc.muted, letterSpacing: '0.16em', margin: '0 0 10px', textTransform: 'uppercase' }}>
                Mapa de niveles
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                {levels.map(item => {
                  const isCurrent = item.id === level.id
                  const isUnlocked = orderCount >= item.min_orders
                  const itemBenefits = Array.isArray(item.benefits) ? item.benefits.filter(Boolean) : []

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: isCurrent ? cc.greenLt : cc.white,
                        border: `2px solid ${isCurrent ? cc.greenBd : isUnlocked ? 'rgba(45,106,79,0.20)' : 'rgba(28,56,41,0.08)'}`,
                        opacity: isUnlocked ? 1 : 0.55,
                      }}
                    >
                      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{item.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: cc.text }}>{item.label}</span>
                          {isCurrent && <Chip bg={cc.greenMid} color="white">Tu nivel</Chip>}
                          {!isCurrent && isUnlocked && <span style={{ fontSize: '0.65rem', color: cc.greenMid, fontWeight: 900 }}>OK</span>}
                          {item.badge_text && <Chip bg="#FDE8EF" color="#8B1A35">{item.badge_text}</Chip>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: cc.text2, fontWeight: 600, lineHeight: 1.4 }}>
                          {item.reward_text}
                        </p>
                        {itemBenefits.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {itemBenefits.slice(0, 3).map(benefit => (
                              <Chip key={benefit} bg="rgba(28,56,41,0.06)" color={cc.text2}>{benefit}</Chip>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {item.discount_percent > 0 ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, color: isUnlocked ? '#1A4733' : cc.text3, background: isUnlocked ? cc.greenLt : 'rgba(28,56,41,0.06)', padding: '3px 9px', borderRadius: 50, border: isUnlocked ? `1px solid ${cc.greenBd}` : 'none' }}>
                            -{item.discount_percent}%
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.66rem', color: cc.text3, fontWeight: 600 }}>
                            {item.min_orders === 0 ? 'Base' : `${item.min_orders} pedidos`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, background: cc.white, border: '1.5px solid rgba(28,56,41,0.10)', marginBottom: 14 }}>
                <span style={{ fontSize: '1rem' }}>{srcInfo.icon}</span>
                <span style={{ fontSize: '0.70rem', fontWeight: 700, color: cc.text2 }}>{srcInfo.text}</span>
                {source === 'instagram' && <Chip bg="#FDF2F8" color="#C13584">VIP IG</Chip>}
              </div>

              <p style={{ fontSize: '0.62rem', fontWeight: 600, color: cc.text3, textAlign: 'center', margin: 0 }}>
                Tu nivel se actualiza con cada pedido
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes lwFade { from{opacity:0} to{opacity:1} }
        @keyframes lwUp   { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>
    </>
  )
}

function Chip({ bg, color, children }) {
  return (
    <span style={{ fontSize: '0.56rem', fontWeight: 900, color, background: bg, padding: '3px 8px', borderRadius: 999 }}>
      {children}
    </span>
  )
}
