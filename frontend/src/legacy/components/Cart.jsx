// Cart.jsx — CarmoCream
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { buildOrderItem } from '../lib/orderUtils'
import { buildSurpriseGiftOrderItem, resolveSurpriseGift } from '../lib/clubGift'
import toast from 'react-hot-toast'
import styles from './Cart.module.css'

function normalizeToppings(toppings) {
  if (!toppings) return []
  if (Array.isArray(toppings))
    return toppings.filter(Boolean).map(t => typeof t === 'string' ? t : `${t.emoji || ''} ${t.name}`.trim()).filter(Boolean)
  // Object: valores pueden ser string (single) o array (multi-select)
  return Object.values(toppings)
    .filter(Boolean)
    .flatMap(v => Array.isArray(v) ? v.filter(Boolean) : [String(v)])
    .filter(s => s && s !== 'null' && s !== 'undefined')
}

const SIZE_LABEL = { small: 'Pequeña', medium: 'Mediana', large: 'Grande' }

function getItemEmoji(item) {
  if (item.emoji && item.emoji.trim()) return item.emoji
  if (item.isCombo || item.is_combo) return '🎁'
  return '🍨'
}

// ══ MinOrderBar ══════════════════════════════════════════════════
function MinOrderBar({ subtotal, minOrder }) {
  if (!minOrder || minOrder <= 0) return null
  const progress = Math.min(100, (subtotal / minOrder) * 100)
  const remaining = Math.max(0, minOrder - subtotal)
  const done = subtotal >= minOrder
  const msgs = [
    { at: 0,   text: `Añade €${remaining.toFixed(2)} más para pedir 🛒` },
    { at: 50,  text: `¡Ya casi! Solo €${remaining.toFixed(2)} más 💚` },
    { at: 80,  text: `¡Casi listo! €${remaining.toFixed(2)} para confirmar ⚡` },
    { at: 100, text: `¡Pedido mínimo alcanzado! ✔️` },
  ]
  const msg = done ? msgs[3].text : progress >= 80 ? msgs[2].text : progress >= 50 ? msgs[1].text : msgs[0].text
  return (
    <div style={{
      padding: '10px 15px',
      background: done ? '#F0FDF4' : '#FFFBF5',
      borderBottom: `1.5px solid ${done ? '#86EFAC' : '#FFD9B3'}`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:'0.72rem', fontWeight:800, color: done ? '#166534' : '#D97706', fontFamily:"'Nunito',sans-serif" }}>
          {msg}
        </span>
        <span style={{ fontSize:'0.68rem', fontWeight:700, color: done ? '#166534' : '#D97706', opacity:0.75, fontFamily:"'Nunito',sans-serif" }}>
          €{subtotal.toFixed(2)}/€{minOrder.toFixed(2)}
        </span>
      </div>
      <div style={{ height:6, borderRadius:50, background:'rgba(0,0,0,0.07)', overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:50, transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)',
          width:`${progress}%`,
          background: done
            ? 'linear-gradient(90deg,#2D6A4F,#52B788)'
            : progress >= 80
              ? 'linear-gradient(90deg,#D97706,#FCD34D)'
              : 'linear-gradient(90deg,#E8607A,#F4A261)',
        }} />
      </div>
    </div>
  )
}

// ══ UpsellBar ═════════════════════════════════════════════════
function UpsellBar({ items, products, combos, onQuickAdd }) {
  if (!products?.length && !combos?.length) return null

  // Excluir lo que ya está en el carrito
  const cartIds = new Set(items.map(i => i.id))
  const cartComboIds = new Set(items.filter(i => i.isCombo).map(i => i.comboId))

  // Sugerir: primero combos no en carrito, luego productos no en carrito con descuento, luego el resto
  const suggestions = [
    ...combos.filter(c => c.available && !cartComboIds.has(c.id) && !c.out_of_stock).slice(0, 2),
    ...products.filter(p => p.available && !cartIds.has(p.id) && p.discount_percent > 0 && !p.out_of_stock).slice(0, 2),
    ...products.filter(p => p.available && !cartIds.has(p.id) && !p.out_of_stock).slice(0, 3),
  ].slice(0, 4)

  if (suggestions.length === 0) return null

  return (
    <div style={{
      padding:'14px 14px 12px',
      background:'#FFF8F0',
      borderBottom:'1.5px solid rgba(232,96,122,0.14)',
    }}>
      <p style={{ margin:'0 0 10px', fontSize:'0.72rem', fontWeight:800, color:'#2D6A4F', fontFamily:"'Nunito',sans-serif" }}>
        🍓 ¿Añades algo más?
      </p>
      <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
        {suggestions.map((item, i) => {
          const isCombo = Array.isArray(item.combo_slots)
          const price = isCombo ? item.price : item.discount_percent
            ? Number(item.price) * (1 - item.discount_percent/100)
            : Number(item.price)
          return (
            <button key={i} onClick={() => onQuickAdd(item, isCombo)} style={{
              flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5,
              padding:'10px 11px', minWidth:80, borderRadius:14,
              background: isCombo ? '#1C3829' : 'white',
              border: isCombo ? '1.5px solid rgba(212,175,55,0.35)' : '1.5px solid rgba(232,96,122,0.18)',
              cursor:'pointer', fontFamily:"'Nunito',sans-serif",
              boxShadow:'0 2px 8px rgba(28,56,41,0.08)',
              transition:'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onTouchStart={e=>e.currentTarget.style.transform='scale(0.94)'}
            onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
            >
              <div style={{
                width:46, height:46, borderRadius:10, overflow:'hidden',
                background: isCombo ? 'rgba(255,255,255,0.12)' : '#FFF3E4',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'1.6rem', flexShrink:0,
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  : item.emoji || (isCombo ? '🎁' : '🍨')}
              </div>
              <span style={{ fontSize:'0.60rem', fontWeight:800, color: isCombo ? 'rgba(255,253,245,0.90)' : '#1C3829', textAlign:'center',
                lineHeight:1.25, maxWidth:72, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {item.name}
              </span>
              <span style={{ fontSize:'0.74rem', fontWeight:900, color: isCombo ? '#D8F3DC' : '#2D6A4F' }}>
                €{price ? Number(price).toFixed(2) : '—'}
              </span>
              {item.discount_percent > 0 && !isCombo && (
                <span style={{ fontSize:'0.54rem', fontWeight:900, color:'white',
                  background:'#E8607A', padding:'2px 7px', borderRadius:50 }}>
                  −{item.discount_percent}%
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Cart({
  items, onUpdateQty, onRemove, onClear,
  isOpen, onConfirmed, onEditItem,
  savedCustomer, onCustomerSaved,
  storeId = 'default',
  minOrder = 0,
  deliveryFee = 0,
  products = [],
  combos = [],
  catalogProducts = [],
  catalogCombos = [],
  onRequestProduct,
  loyaltyDiscount = 0,   // % de descuento por nivel del Club
  loyaltyLevel = null,   // objeto del nivel actual
  loyaltyOrderCount = 0,
}) {
  const urlParams   = new URLSearchParams(window.location.search)
  const refFromUrl  = urlParams.get('ref') || ''
  const utmSource   = urlParams.get('utm_source')   || urlParams.get('source')   || ''
  const utmMedium   = urlParams.get('utm_medium')   || ''
  const utmCampaign = urlParams.get('utm_campaign') || ''

  const [checkoutStep, setCheckoutStep] = useState(1) // 1 Gourmet · 2 Personalización · 3 Logística
  const [form, setForm] = useState({
    name:           savedCustomer?.name    || '',
    phone:          savedCustomer?.phone   || '',
    address:        savedCustomer?.address || '',
    notes:          '',
    coupon:         '',
    affiliate_code: refFromUrl,
  })
  const [saving,         setSaving]         = useState(false)
  const [couponInfo,     setCouponInfo]     = useState(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  // null = sin código | { name, discount } = válido | false = inválido
  const [affInfo,        setAffInfo]        = useState(null)
  const [checkingAff,    setCheckingAff]    = useState(false)

  useEffect(() => {
    if (!refFromUrl) return
    setCheckingAff(true)
    supabase
      .from('affiliates')
      .select('name, discount_percent')
      .eq('store_id', storeId)
      .eq('code', refFromUrl.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        setCheckingAff(false)
        if (data) setAffInfo({ name: data.name, discount: data.discount_percent })
        // Si no existe en BD, dejamos el campo editable sin badge
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = couponInfo
    ? couponInfo.discount_type === 'percent'
      ? subtotal * Number(couponInfo.discount_value) / 100
      : Math.min(Number(couponInfo.discount_value), subtotal)
    : 0
  // Descuento de afiliado
  const affDiscount = (affInfo?.name && affInfo.discount > 0)
    ? subtotal * Number(affInfo.discount) / 100
    : 0
  // Descuento Club CarmoCream (nivel plata/oro/diamante) — se aplica sobre el subtotal
  // Solo si no hay ya un cupón que dé más descuento
  const clubDiscountPct = loyaltyDiscount || 0
  const clubDiscount = clubDiscountPct > 0 && discount === 0
    ? subtotal * clubDiscountPct / 100
    : 0
  const hasFreeDelivery = loyaltyLevel?.free_delivery === true
  const appliedDeliveryFee = hasFreeDelivery ? 0 : deliveryFee
  const totalSinEnvio = Math.max(0, subtotal - discount - affDiscount - clubDiscount)
  const total = totalSinEnvio + (appliedDeliveryFee > 0 ? appliedDeliveryFee : 0)
  const surpriseGiftState = resolveSurpriseGift({
    level: loyaltyLevel,
    orderCount: loyaltyOrderCount,
    products: catalogProducts,
    combos: catalogCombos,
  })
  const clubSurpriseGift = surpriseGiftState.eligible ? surpriseGiftState.gift : null

  // Pedido mínimo
  const belowMin  = minOrder > 0 && subtotal < minOrder
  const remaining = minOrder > 0 ? Math.max(0, minOrder - subtotal) : 0

  // ── Cupón ──────────────────────────────────────────────────
  async function checkCoupon() {
    const code = form.coupon.trim().toUpperCase()
    if (!code) return
    setCheckingCoupon(true)
    const { data, error } = await supabase
      .from('coupons').select('*').eq('store_id', storeId).eq('code', code).eq('active', true).maybeSingle()
    setCheckingCoupon(false)
    if (error || !data)                                            { toast.error('Cupón no válido');  setCouponInfo(null); return }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error('Cupón expirado');  setCouponInfo(null); return }
    if (data.max_uses   && data.used_count >= data.max_uses)       { toast.error('Cupón agotado');   setCouponInfo(null); return }
    setCouponInfo(data)
    const label = data.discount_type === 'percent'
      ? `-${data.discount_value}%`
      : `-€${Number(data.discount_value).toFixed(2)}`
    toast.success(`¡Cupón aplicado! ${label}`)
  }

  function removeCoupon() {
    setCouponInfo(null)
    setForm(f => ({ ...f, coupon: '' }))
  }

  // ── Afiliado ────────────────────────────────────────────────
  async function checkAffiliate() {
    const code = form.affiliate_code.trim().toUpperCase()
    if (!code) return
    setCheckingAff(true)
    const { data } = await supabase
      .from('affiliates').select('name, discount_percent').eq('store_id', storeId).eq('code', code).eq('active', true).maybeSingle()
    setCheckingAff(false)
    if (!data) { toast.error('Código de afiliado no válido'); setAffInfo(false); return }
    setAffInfo({ name: data.name, discount: data.discount_percent })
    toast.success(`Código de ${data.name} aplicado 🎉`)
  }

  function removeAffiliate() {
    setAffInfo(null)
    setForm(f => ({ ...f, affiliate_code: '' }))
  }

  // ── Confirmar pedido ────────────────────────────────────────
  async function confirm() {
    if (!form.name.trim())    { toast.error('Nombre requerido');    return }
    if (!form.phone.trim())   { toast.error('Teléfono requerido');  return }
    if (!form.address.trim()) { toast.error('Dirección requerida'); return }
    if (!isOpen)              { toast.error('La tienda está cerrada ahora'); return }
    if (belowMin)             { toast.error(`Pedido mínimo: €${minOrder.toFixed(2)} · Faltan €${remaining.toFixed(2)}`); return }
    setSaving(true)

    onCustomerSaved?.({ name: form.name, phone: form.phone, address: form.address })

    const { data: lastOrder } = await supabase
      .from('orders').select('order_number').eq('store_id', storeId).order('order_number', { ascending: false }).limit(1).maybeSingle()
    const nextNum = (lastOrder?.order_number || 0) + 1

    const orderItems = items.map(buildOrderItem)
    if (clubSurpriseGift) {
      const giftOrderItem = buildSurpriseGiftOrderItem(clubSurpriseGift)
      if (giftOrderItem) orderItems.push(giftOrderItem)
    }

    const payload = {
      store_id:         storeId,
      order_number:     nextNum,
      customer_name:    form.name.trim(),
      customer_phone:   form.phone.trim(),
      delivery_address: form.address.trim(),
      notes:            form.notes.trim() || null,
      items:            orderItems,
      subtotal,
      discount: discount + affDiscount + clubDiscount,
      club_discount:    clubDiscount > 0 ? clubDiscount : null,
      club_level:       loyaltyLevel?.id || null,
      club_surprise_gift: clubSurpriseGift || null,
      delivery_fee:     appliedDeliveryFee > 0 ? appliedDeliveryFee : null,
      total,
      coupon_code:      couponInfo ? form.coupon.trim().toUpperCase() : null,
      affiliate_code:   form.affiliate_code.trim().toUpperCase() || null,
      affiliate_discount: affDiscount > 0 ? affDiscount : null,
      utm_source:       utmSource   || null,
      utm_medium:       utmMedium   || null,
      utm_campaign:     utmCampaign || null,
      status:           'pending',
    }

    const { data: newOrder, error } = await supabase.from('orders').insert(payload).select().single()

    if (error) {
      console.error('Error inserting order:', error)
      toast.error(`Error al enviar: ${error.message || 'Inténtalo de nuevo'}`)
      setSaving(false)
      return
    }

    // Incrementar used_count SOLO tras inserción exitosa
    if (couponInfo) {
      await supabase.from('coupons')
        .update({ used_count: (couponInfo.used_count || 0) + 1 })
        .eq('id', couponInfo.id)
    }

    onConfirmed?.({ num: nextNum, total, items: orderItems, order: newOrder, clubSurpriseGift })
    setSaving(false)
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🛒</span>
        <p>Tu pedido está vacío</p>
        <span>Añade algún producto 🍓</span>
      </div>
    )
  }

  // affApplied solo si affInfo tiene .name (fue validado correctamente en BD)
  const affApplied = !!(affInfo && affInfo.name && form.affiliate_code.trim())

  // Botón siempre con estado "normal" — sin timer
  const btnUrgent = false

  const STEP_LABELS = [
    { num: 1, short: 'Tu pedido',    full: 'Tu pedido' },
    { num: 2, short: 'Tus datos',    full: 'Tus datos' },
    { num: 3, short: 'Confirmación', full: 'Confirmar' },
  ]

  return (
    <div className={styles.cart}>
      {/* Barra de pasos */}
      <div className={styles.workflowSteps}>
        {STEP_LABELS.map((s, i) => (
          <React.Fragment key={s.num}>
            <button
              type="button"
              className={`${styles.workflowStep} ${checkoutStep === s.num ? styles.workflowStepActive : ''} ${checkoutStep > s.num ? styles.workflowStepDone : ''}`}
              onClick={() => checkoutStep > s.num && setCheckoutStep(s.num)}
              aria-current={checkoutStep === s.num ? 'step' : undefined}
            >
              <span className={styles.workflowStepNum}>
                {checkoutStep > s.num ? '✓' : s.num}
              </span>
              <span className={styles.workflowStepShort}>{s.short}</span>
            </button>
            {i < STEP_LABELS.length - 1 && <span className={styles.workflowStepConnector} />}
          </React.Fragment>
        ))}
      </div>

      {checkoutStep === 1 && (
        <>
          <div className={styles.cartBody}>
            <div className={styles.stepIntro}>
              <div>
                <p className={styles.stepEyebrow}>Tu selección</p>
                <p className={styles.stepLead}>
                  {items.reduce((s,i) => s + i.qty, 0)} {items.reduce((s,i) => s + i.qty, 0) === 1 ? 'postre' : 'postres'} listos para seguir
                </p>
              </div>
              <span className={`${styles.stepStatusPill} ${isOpen ? styles.stepStatusOpen : styles.stepStatusClosed}`}>
                {isOpen ? '🟢 Abierto' : '🔴 Cerrado'}
              </span>
            </div>

            <MinOrderBar subtotal={subtotal} minOrder={minOrder} />

            <div className={styles.itemsList}>
              {items.map((item, idx) => (
                <CartItem key={idx} item={item} index={idx}
                  onQty={onUpdateQty} onRemove={onRemove} onEdit={onEditItem} />
              ))}
            </div>

            <UpsellBar items={items} products={products} combos={combos}
              onQuickAdd={(item, isCombo) => onRequestProduct?.(item, isCombo)} />

            <div style={{
              padding: '12px 15px', background: '#FFFFFF',
              borderTop: '1.5px solid rgba(244,167,185,0.20)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(28,56,41,0.55)', fontFamily: "'Nunito',sans-serif" }}>
                Subtotal
              </span>
              <span style={{ fontFamily: "'Pacifico',cursive", fontSize: '1.25rem', color: '#2D6A4F' }}>
                €{subtotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className={styles.stepActions}>
            <button type="button" className={styles.stepNextBtn}
              onClick={() => setCheckoutStep(2)}>
              Continuar con el pedido →
            </button>
          </div>
        </>
      )}

      {checkoutStep === 2 && (
        <>
          <div className={styles.cartBody}>
          {/* ── Cupón de descuento y código afiliado ── */}
          <div className={styles.discountsBlock}>
            <p className={styles.discountsTitle}>🎟️ ¿Tienes un cupón o código de amigo?</p>
            {!couponInfo ? (
              <div className={styles.codeRow}>
                <span className={styles.codeRowIcon}>🎟️</span>
                <input
                  className={styles.codeInput}
                  placeholder="Código de descuento"
                  value={form.coupon}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  onChange={e => setForm(f => ({ ...f, coupon: e.target.value.toUpperCase() }))}
                  onKeyDown={e => e.key === 'Enter' && checkCoupon()}
                />
                <button className={styles.codeBtn} onClick={checkCoupon}
                  disabled={checkingCoupon || !form.coupon.trim()}>
                  {checkingCoupon ? '…' : 'Aplicar'}
                </button>
              </div>
            ) : (
              <div className={styles.codeApplied}>
                <span className={styles.codeAppliedBadge}>🎟️</span>
                <div className={styles.codeAppliedText}>
                  <strong>{form.coupon.toUpperCase()}</strong>
                  <span>
                    {couponInfo.discount_type === 'percent'
                      ? `−${couponInfo.discount_value}% · ahorras €${discount.toFixed(2)}`
                      : `−€${Number(couponInfo.discount_value).toFixed(2)} de descuento`}
                  </span>
                </div>
                <button className={styles.codeRemoveBtn} onClick={removeCoupon}>✕</button>
              </div>
            )}
            {!affApplied ? (
              <div className={styles.codeRow}>
                <span className={styles.codeRowIcon}>🏷️</span>
                <input
                  className={styles.codeInput}
                  placeholder="Código de amigo o afiliado"
                  value={form.affiliate_code}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  onChange={e => {
                    setForm(f => ({ ...f, affiliate_code: e.target.value.toUpperCase() }))
                    setAffInfo(null)
                  }}
                  onKeyDown={e => e.key === 'Enter' && checkAffiliate()}
                />
                <button className={styles.codeBtn} onClick={checkAffiliate}
                  disabled={checkingAff || !form.affiliate_code.trim()}>
                  {checkingAff ? '…' : 'Aplicar'}
                </button>
              </div>
            ) : (
              <div className={styles.codeApplied} style={{ background: '#D8F3DC', borderColor: '#74C69D' }}>
                <span className={styles.codeAppliedBadge}>🏷️</span>
                <div className={styles.codeAppliedText}>
                  <strong>{form.affiliate_code.toUpperCase()}</strong>
                  <span style={{ color: '#1A4733' }}>
                    Código de {affInfo.name}{affInfo.discount > 0 ? ` · −${affInfo.discount}%` : ''}
                  </span>
                </div>
                <button className={styles.codeRemoveBtn} onClick={removeAffiliate}>✕</button>
              </div>
            )}
          </div>

          {/* ── Datos de entrega ── */}
          <div className={styles.form}>
            <p className={styles.formTitle}>📍 ¿Dónde te llevamos tu pedido?</p>
            <input className={styles.input} placeholder="Tu nombre *"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className={styles.input} placeholder="Teléfono (WhatsApp) *"
              type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className={styles.input} placeholder="Dirección de entrega *"
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <textarea className={styles.textarea} placeholder="Notas especiales, alergia, referencia… (opcional)"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          </div>{/* fin cartBody */}

          <div className={styles.stepActions}>
            <button type="button" className={styles.stepBackBtn} onClick={() => setCheckoutStep(1)}>← Atrás</button>
            <button type="button" className={styles.stepNextBtn} onClick={() => setCheckoutStep(3)}>Revisar pedido →</button>
          </div>
        </>
      )}

      {checkoutStep === 3 && (
        <>
          <div className={styles.cartBody}>
          <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Subtotal</span><span>€{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className={`${styles.totalRow} ${styles.totalDiscount}`}>
            <span>Cupón</span><span>−€{discount.toFixed(2)}</span>
          </div>
        )}
        {affDiscount > 0 && (
          <div className={`${styles.totalRow} ${styles.totalDiscount}`}>
            <span>Afiliado {affInfo.discount}%</span><span>−€{affDiscount.toFixed(2)}</span>
          </div>
        )}
        {clubDiscount > 0 && (
          <div className={`${styles.totalRow} ${styles.totalDiscount}`}>
            <span>
              {loyaltyLevel?.emoji || '⭐'} Club {loyaltyLevel?.label} · {clubDiscountPct}%
            </span>
            <span>−€{clubDiscount.toFixed(2)}</span>
          </div>
        )}
        {clubSurpriseGift && (
          <div style={{
            margin: '10px 0',
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FFF1F2',
            border: '1.5px solid #FBCFE8',
            color: '#9F1239',
            display: 'grid',
            gap: 4,
          }}>
            <span style={{ fontSize: '.66rem', fontWeight: 900, letterSpacing: '.1em' }}>
              {clubSurpriseGift.level_emoji || '⭐'} REGALO SORPRESA DEL CLUB
            </span>
            <span style={{ fontSize: '.84rem', fontWeight: 900 }}>
              {clubSurpriseGift.item.emoji || '🎁'} {clubSurpriseGift.item.name}
            </span>
            <span style={{ fontSize: '.72rem', fontWeight: 700, opacity: 0.82 }}>
              Se añade gratis en este pedido por tu nivel {clubSurpriseGift.level_label}.
            </span>
            {clubSurpriseGift.note && (
              <span style={{ fontSize: '.70rem', fontWeight: 700, opacity: 0.75 }}>
                Nota: {clubSurpriseGift.note}
              </span>
            )}
          </div>
        )}
        {deliveryFee > 0 && (
          <div className={styles.totalRow} style={{color:'#6B7280'}}>
            <span>🛵 Envío</span><span>{hasFreeDelivery ? 'Gratis Club' : `+€${deliveryFee.toFixed(2)}`}</span>
          </div>
        )}
        {belowMin && (
          <div style={{
            background:'#FDE8EF', border:'2px solid #F4A7B9',
            borderRadius:10, padding:'10px 13px', margin:'6px 0',
            fontSize:'.82rem', fontWeight:800, color:'#8B1A35', lineHeight:1.5,
            fontFamily:"'Nunito',sans-serif",
          }}>
            ⚠️ Pedido mínimo: €{minOrder.toFixed(2)} · Te faltan €{remaining.toFixed(2)}
          </div>
        )}
        <div className={`${styles.totalRow} ${styles.totalBig}`}>
          <span>Total</span><span>€{total.toFixed(2)}</span>
        </div>
          </div>
          <div className={styles.payNote}>💵 Pago en efectivo al repartidor</div>
          {!isOpen && <div className={styles.closedNote}>🕐 La tienda está cerrada ahora mismo</div>}
          </div>{/* fin cartBody */}
          <div className={styles.stepActions}>
            <button type="button" className={styles.stepBackBtn} onClick={() => setCheckoutStep(2)}>← Atrás</button>
            <button
              className={`${styles.orderBtn} ${btnUrgent && !belowMin && isOpen ? styles.orderBtnUrgent : ''}`}
              onClick={confirm}
              disabled={saving || !isOpen || belowMin}
              style={belowMin ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              {saving ? 'Enviando…' : belowMin ? `Mín. €${minOrder.toFixed(2)} · faltan €${remaining.toFixed(2)}` : `Confirmar pedido · €${total.toFixed(2)}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── CartItem ──────────────────────────────────────────────────
function CartItem({ item, index, onQty, onRemove, onEdit }) {
  const emoji    = getItemEmoji(item)
  const topsText = normalizeToppings(item.toppings).join(', ')

  return (
    <div className={styles.item}>
      <div className={styles.itemMain}>
        <div className={styles.itemEmoji}>
          {item.image_url
            ? <img src={item.image_url} alt={item.product_name} className={styles.itemThumbImg} />
            : emoji}
        </div>
      <div data-testid={`cart-item-${item.id}`} className={styles.itemInfo}>
        <span className={styles.itemName}>{item.product_name}</span>
          {item.size && <span className={styles.itemSize}>{SIZE_LABEL[item.size] || item.size}</span>}
          {topsText && <span className={styles.itemTops}>{topsText}</span>}
          {(item.isCombo || item.is_combo) && item.combo_items?.length > 0 && (
            <div className={styles.comboSubItems}>
              {item.combo_items.map((ci, i) => {
                const ciTops = normalizeToppings(ci.toppings)
                const sizeLbl = ci.size && ci.size !== 'small' ? ` · ${SIZE_LABEL[ci.size] || ci.size}` : ''
                const topsLbl = ciTops.length > 0 ? ` + ${ciTops.slice(0,2).join(', ')}${ciTops.length > 2 ? ` +${ciTops.length - 2}` : ''}` : ''
                return (
                  <span key={i} className={styles.comboSubItem}>
                    {ci.emoji || '🍨'} {ci.productName || ci.product_name}{sizeLbl}{topsLbl}
                  </span>
                )
              })}
            </div>
          )}
          <div className={styles.itemFoot}>
            <span className={styles.itemPrice}>€{(item.price * item.qty).toFixed(2)}</span>
            <div className={styles.qtyRow}>
              <button className={styles.qtyBtn} onClick={() => onQty(index, item.qty - 1)}>−</button>
              <span className={styles.qty}>{item.qty}</span>
              <button className={styles.qtyBtn} onClick={() => onQty(index, item.qty + 1)}>+</button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.itemActions}>
        <button className={styles.editBtn} onClick={() => onEdit(index, item)}>✏️ Editar</button>
        <button className={styles.removeBtn} onClick={() => onRemove(index)}>✕</button>
      </div>
    </div>
  )
}
