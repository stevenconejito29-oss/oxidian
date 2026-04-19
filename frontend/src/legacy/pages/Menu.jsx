import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../lib/useSettings'
import { useMenuData } from '../lib/useMenuData'
import { supabase } from '../lib/supabase'
import { useCart } from '../lib/useCart'
import { useStoreStatus } from '../lib/useStoreStatus'
import Cart from '../components/Cart'
import ProductModal from '../components/ProductModal'
import ComboModal from '../components/ComboModal'
import PostOrderScreen from '../components/PostOrderScreen'
import ProductAccessCard from '../components/menu/ProductAccessCard'
import ComboAccessCard from '../components/menu/ComboAccessCard'
import LoyaltyWidget from '../components/LoyaltyWidget'
import { useLoyalty } from '../lib/useLoyalty'
import { buildClubAccessMeta, buildClubUnlocks } from '../lib/clubAccess'
import {
  createReviewRewardCoupon,
  fetchReviews,
  saveReviewFromOrderLink,
} from '../lib/reviewUtils'
import { getProductSections } from '../lib/productSections'
import { getMenuStylePreset } from '../lib/storeExperience'
import styles from './Menu.module.css'

// Detectar el navegador interno de Instagram (WKWebView recortado)
const IS_INSTAGRAM = typeof navigator !== 'undefined' && /Instagram/i.test(navigator.userAgent)

const DEFAULT_CATEGORY_ID = 'postres'
const REVIEW_CATEGORY_ID  = 'reviews'

function normalizeCategoryId(category) {
  if (typeof category !== 'string') return DEFAULT_CATEGORY_ID
  return category.trim().toLowerCase() || DEFAULT_CATEGORY_ID
}
function resolveCategoryLabel(categoryId, sectionMap) {
  const normalizedId = normalizeCategoryId(categoryId)
  return sectionMap[normalizedId]?.label || String(normalizedId || DEFAULT_CATEGORY_ID).replace(/-/g, ' ').toUpperCase()
}
function resolveCategoryIcon(categoryId, sectionMap) {
  const normalizedId = normalizeCategoryId(categoryId)
  return sectionMap[normalizedId]?.icon || '🍰'
}
function canAccessClubItem(item, loyalty) {
  if (!item?.club_only) return true
  const levels = Array.isArray(loyalty?.levels) ? loyalty.levels : []
  const currentLevel = loyalty?.currentLevel || null
  if (!currentLevel) return false
  if (item.club_only_level) {
    const req = levels.find(l => l.id === item.club_only_level)
    if (!req) return currentLevel.exclusive_menu === true
    return Number(currentLevel.min_orders || 0) >= Number(req.min_orders || 0)
  }
  return currentLevel.exclusive_menu === true
}
function buildProjectedLoyaltySnapshot(loyaltyState) {
  const levels = Array.isArray(loyaltyState?.levels) ? [...loyaltyState.levels] : []
  const sortedLevels = levels.sort((a, b) => Number(a.min_orders||0) - Number(b.min_orders||0))
  const projectedOrderCount = Number(loyaltyState?.orderCount || 0) + 1
  const projectedCurrentLevel = [...sortedLevels].reverse()
    .find(l => projectedOrderCount >= Number(l.min_orders||0)) || loyaltyState?.currentLevel || null
  const projectedNextLevel = sortedLevels.find(l => projectedOrderCount < Number(l.min_orders||0)) || null
  return { ...loyaltyState, orderCount: projectedOrderCount, currentLevel: projectedCurrentLevel, nextLevel: projectedNextLevel }
}

const SECTION_FRUITS = {
  combos:   ['🎁','🍓','🍒','🍍','🥭','✨'],
  products: ['🍓','🍍','🥭','🍒','🍋','🥝','🍊','🍦'],
  reviews:  ['⭐','🍓','🍒','🍍','✨'],
}
function deriveHeroTheme(color) {
  const base = (color && /^#[0-9A-Fa-f]{3,6}$/.test(color)) ? color : '#E8607A'
  return { base }
}

function deriveInstagramHandle(settings) {
  const direct = String(settings.instagram_handle || '').trim()
  if (direct) return direct.startsWith('@') ? direct : `@${direct.replace(/^@/, '')}`

  const url = String(settings.instagram_url || '').trim()
  const match = url.match(/instagram\.com\/([^/?#]+)/i)
  if (!match?.[1]) return ''
  return `@${match[1].replace(/^@/, '')}`
}

function buildCatalogSearchText(item = {}) {
  return [
    item.name,
    item.description,
    item.category,
    item.emoji,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function SectionFruitRain({ type = 'products' }) {
  const fruits = SECTION_FRUITS[type] || SECTION_FRUITS.products
  const pieces = useMemo(() => (
    fruits.flatMap((fruit, index) => {
      const normalClones = type === 'products' ? 5 : 4
      const clones = IS_INSTAGRAM ? 1 : normalClones
      return Array.from({ length: clones }, (_, ci) => {
        const seed = (index + 1) * 37 + ci * 29 + type.length * 19
        return {
          id: `${type}-${fruit}-${index}-${ci}`, fruit,
          left: 2 + ((seed * 11) % 96), delay: -((seed * 0.41) % 13.5),
          duration: (IS_INSTAGRAM ? 18 : 8.8) + ((seed * 0.23) % (IS_INSTAGRAM ? 10 : 12.4)),
          size: 0.92 + ((seed % 9) * 0.19), drift: -58 + ((seed * 7) % 116),
          top: -12 - ((seed * 5) % 34), sway: -20 + ((seed * 3) % 40),
          rotate: -32 + ((seed * 9) % 64), opacity: 0.2 + (((seed * 5) % 32) / 100),
        }
      })
    })
  ), [fruits, type])
  return (
    <div className={styles.sectionFruitRain} aria-hidden="true">
      {pieces.map(p => (
        <span key={p.id} className={styles.sectionFruit} style={{
          '--section-fruit-left': `${p.left}%`, '--section-fruit-delay': `${p.delay}s`,
          '--section-fruit-duration': `${p.duration}s`, '--section-fruit-size': `${p.size}rem`,
          '--section-fruit-drift': `${p.drift}px`, '--section-fruit-top': `${p.top}%`,
          '--section-fruit-sway': `${p.sway}px`, '--section-fruit-rotate': `${p.rotate}deg`,
          '--section-fruit-opacity': p.opacity,
        }}>{p.fruit}</span>
      ))}
    </div>
  )
}

const DEFAULT_REVIEWS = [
  { id:'d1', customer_name:'Cliente', text:'Llegó rapidísimo y en perfecto estado. Muy recomendable.', rating:5 },
  { id:'d2', customer_name:'Cliente', text:'Pedí por Instagram y me lo trajeron a casa. Calidad increíble.', rating:5 },
  { id:'d3', customer_name:'Cliente', text:'Entrega rápida y producto excelente. Repetiré sin duda 👌', rating:5 },
]

export default function Menu() {
  const { settings } = useSettings()
  const activeStoreId = settings.store_code || 'default'
  const productSections = useMemo(() => getProductSections(settings.product_sections), [settings.product_sections])
  const productSectionMap = useMemo(
    () => Object.fromEntries(productSections.map(section => [section.id, section])),
    [productSections]
  )
  const categorySortOrder = useMemo(() => productSections.map(section => section.id), [productSections])
  const { products, combos, toppingCategories, loading } = useMenuData(activeStoreId)
  const { isOpen } = useStoreStatus(settings)

  const [reviews, setReviews] = useState(DEFAULT_REVIEWS)
  useEffect(() => {
    fetchReviews({ approved: true, limit: 6, storeId: activeStoreId }).then(d => { if (d.length > 0) setReviews(d) }).catch(() => {})
  }, [activeStoreId])

  const [customerPhone, setCustomerPhone] = useState(
    () => { try { return JSON.parse(localStorage.getItem('carmocream_customer') || '{}').phone || null } catch { return null } }
  )
  const loyalty = useLoyalty({ phone: customerPhone, storeId: activeStoreId })
  const { cart, cartCount, cartTotal, addToCart, updateQty, removeItem, updateItem, clearCart, comboReachedLimit, productReachedLimit } = useCart()

  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedCombo,   setSelectedCombo]   = useState(null)
  const [showCart,        setShowCart]        = useState(false)
  const [confirmedOrder,  setConfirmedOrder]  = useState(null)
  const [activeCategory,  setActiveCategory]  = useState('combos')
  const [clubPanelOpen,   setClubPanelOpen]   = useState(false)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [savedCustomer,   setSavedCustomer]   = useState(() => {
    try { const v = localStorage.getItem('carmocream_customer'); return v ? JSON.parse(v) : null } catch { return null }
  })
  const sectionRefs = useRef({})
  const searchInputRef = useRef(null)
  const manualCategoryNavigationUntilRef = useRef(0)
  const cartBackdropCloseArmedRef = useRef(false)

  // ── Estados de layouts de nicho ──────────────────────────────────────
  const [activePetFilter,  setActivePetFilter]  = useState('todos')
  const [activeGender,     setActiveGender]     = useState('todo')
  const [activeOccasion,   setActiveOccasion]   = useState(null)
  const [activeBudget,     setActiveBudget]     = useState(null)
  const [activeDespensaCat,setActiveDespensaCat]= useState(null)

  const [reviewOrderNum, setReviewOrderNum] = useState(null)
  const [reviewToken,    setReviewToken]    = useState('')
  const [reviewRating,   setReviewRating]   = useState(0)
  const [reviewText,     setReviewText]     = useState('')
  const [reviewSent,     setReviewSent]     = useState(false)
  const [reviewSending,  setReviewSending]  = useState(false)
  const [reviewCoupon,   setReviewCoupon]   = useState(null)
  const [reviewError,    setReviewError]    = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rev = params.get('review')
    const token = params.get('token') || ''
    if (rev) {
      setReviewOrderNum(rev)
      setReviewToken(token)
      const url = new URL(window.location.href)
      url.searchParams.delete('review')
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  async function submitReviewFromLink() {
    if (reviewRating === 0) return
    setReviewSending(true); setReviewError('')
    try {
      await saveReviewFromOrderLink({
        orderNumber: reviewOrderNum,
        reviewToken,
        rating: reviewRating,
        text: reviewText,
        customerName: savedCustomer?.name || '', customerPhone: savedCustomer?.phone || customerPhone || '',
        storeId: activeStoreId,
      })
      let coupon = null
      try { coupon = await createReviewRewardCoupon(reviewOrderNum, activeStoreId) } catch {}
      fetchReviews({ approved: true, limit: 6, storeId: activeStoreId }).then(data => {
        if (data.length > 0) setReviews(data)
      }).catch(() => {})
      setReviewCoupon(coupon); setReviewSent(true)
    } catch (err) {
      setReviewError(err?.message || 'No se pudo enviar la reseña.')
    } finally { setReviewSending(false) }
  }

  const clubUnlocks = useMemo(() => buildClubUnlocks(loyalty.currentLevel, products, combos), [loyalty.currentLevel, products, combos])
  const visibleProducts = useMemo(() => products.filter(p => p.available !== false && (!p.club_only || canAccessClubItem(p, loyalty))), [products, loyalty])
  const visibleCombos   = useMemo(() => combos.filter(c => c.available !== false && (!c.club_only || canAccessClubItem(c, loyalty))), [combos, loyalty])
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredProducts = useMemo(() => (
    normalizedSearchQuery
      ? visibleProducts.filter(product => buildCatalogSearchText(product).includes(normalizedSearchQuery))
      : visibleProducts
  ), [normalizedSearchQuery, visibleProducts])
  const filteredCombos = useMemo(() => (
    normalizedSearchQuery
      ? visibleCombos.filter(combo => buildCatalogSearchText(combo).includes(normalizedSearchQuery))
      : visibleCombos
  ), [normalizedSearchQuery, visibleCombos])

  const productCategories = useMemo(() => {
    const map = {}
    filteredProducts.forEach(p => { const cat = normalizeCategoryId(p.category); if (!map[cat]) map[cat] = []; map[cat].push(p) })
    return map
  }, [filteredProducts])

  const orderedProductCategoryIds = useMemo(() => {
    const present = Object.keys(productCategories)
    return [...categorySortOrder.filter(id => present.includes(id)), ...present.filter(id => !categorySortOrder.includes(id))]
  }, [categorySortOrder, productCategories])

  const navigationCategories = useMemo(() => {
    const cats = []
    if (filteredCombos.length > 0) cats.push({ id: 'combos', label: 'Combos', icon: '🎁' })
    orderedProductCategoryIds.forEach(id => cats.push({ id, label: resolveCategoryLabel(id, productSectionMap), icon: resolveCategoryIcon(id, productSectionMap) }))
    cats.push({ id: REVIEW_CATEGORY_ID, label: 'Reseñas', icon: '⭐' })
    return cats
  }, [filteredCombos.length, orderedProductCategoryIds, productSectionMap])

  useEffect(() => {
    if (!navigationCategories.find(i => i.id === activeCategory))
      setActiveCategory(navigationCategories[0]?.id || DEFAULT_CATEGORY_ID)
  }, [activeCategory, navigationCategories])

  useEffect(() => {
    const validIds = new Set(navigationCategories.map(c => c.id))
    Object.keys(sectionRefs.current).forEach(id => { if (!validIds.has(id)) delete sectionRefs.current[id] })
  }, [navigationCategories])

  useEffect(() => {
    if (!navigationCategories.length || loading) return
    const obs = new IntersectionObserver(entries => {
      if (Date.now() < manualCategoryNavigationUntilRef.current) return
      const visible = entries.filter(e => e.isIntersecting)
      if (!visible.length) return
      const activationAnchor = 180
      const eligible = visible.filter(entry => entry.boundingClientRect.top <= activationAnchor)
      if (!eligible.length) return
      const closest = eligible.reduce((left, right) => (
        Math.abs(left.boundingClientRect.top - activationAnchor) < Math.abs(right.boundingClientRect.top - activationAnchor)
          ? left
          : right
      ))
      const id = closest.target.dataset.categoryId
      if (id) setActiveCategory(id)
    }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 })
    const refs = sectionRefs.current
    Object.entries(refs).forEach(([id, el]) => { if (el) { el.dataset.categoryId = id; obs.observe(el) } })
    return () => obs.disconnect()
  }, [loading, navigationCategories])

  function scrollToCategory(categoryId) {
    const target = sectionRefs.current[categoryId]
    if (!target) return
    manualCategoryNavigationUntilRef.current = Date.now() + 1400
    setActiveCategory(categoryId)
    const targetTop = target.getBoundingClientRect().top + window.scrollY - 124
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }

  function focusSearch() {
    const input = searchInputRef.current
    if (!input) {
      scrollToCategory(navigationCategories[0]?.id)
      return
    }
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => input.focus(), 180)
  }

  function handleProductAdd(item) {
    if (selectedProduct?._editIndex !== undefined) { updateItem(selectedProduct._editIndex, item); setShowCart(true) }
    else { addToCart(item); if (selectedProduct?._fromCart) setShowCart(true) }
    setSelectedProduct(null)
  }
  function handleComboAdd(item) {
    if (selectedCombo?._editIndex !== undefined) { updateItem(selectedCombo._editIndex, item); setShowCart(true) }
    else { addToCart(item); if (selectedCombo?._fromCart) setShowCart(true) }
    setSelectedCombo(null)
  }
  function handleConfirmed(payload) {
    const loyaltySnapshot = buildProjectedLoyaltySnapshot(loyalty)
    setConfirmedOrder({ ...payload, loyaltySnapshot }); setShowCart(false); clearCart()
    loyalty.trackOrder(payload.total, savedCustomer?.phone || customerPhone)
  }
  function handleCustomerSaved(data) {
    try { localStorage.setItem('carmocream_customer', JSON.stringify(data)) } catch {}
    setSavedCustomer(data)
    if (data?.phone) { setCustomerPhone(data.phone); loyalty.linkPhone(data.phone) }
  }
  function armCartBackdropClose(e)     { cartBackdropCloseArmedRef.current = e.target === e.currentTarget }
  function maybeCloseCartFromBackdrop(e) {
    const sc = cartBackdropCloseArmedRef.current && e.target === e.currentTarget
    cartBackdropCloseArmedRef.current = false
    if (sc) setShowCart(false)
  }
  function resetCartBackdropClose() { cartBackdropCloseArmedRef.current = false }
  function handleEditCartItem(index, item) {
    setShowCart(false)
    if (item.isCombo) {
      const combo = combos.find(c => c.id === item.comboId) || { id:item.comboId, name:item.product_name, combo_slots:[], max_items:item.combo_items?.length||2, price:item.price, emoji:item.emoji, image_url:item.image_url }
      setSelectedCombo({ ...combo, _editIndex:index, _editItem:item }); return
    }
    const product = products.find(p => p.id === item.id) || { id:item.id, name:item.product_name, price:item.price, emoji:item.emoji, image_url:item.image_url, price_medium:item.price_medium??null, price_large:item.price_large??null, discount_percent:0 }
    setSelectedProduct({ ...product, _editIndex:index, _editItem:item })
  }
  useEffect(() => {
    if (!showCart) return
    const onKeyDown = e => { if (e.key === 'Escape') setShowCart(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showCart])

  const fruitItems = useMemo(() => IS_INSTAGRAM ? [
    { emoji:'🍓', left:'8%',  size:'1.6rem', duration:'18s', delay:'-3s',  drift:'-14px' },
    { emoji:'🍍', left:'36%', size:'1.8rem', duration:'22s', delay:'-11s', drift:'18px'  },
    { emoji:'🍒', left:'62%', size:'1.6rem', duration:'20s', delay:'-7s',  drift:'-12px' },
    { emoji:'🥭', left:'88%', size:'1.5rem', duration:'24s', delay:'-15s', drift:'14px'  },
  ] : [
    { emoji:'🍓', left:'3%',  size:'1.7rem', duration:'14s', delay:'-2s',  drift:'-18px' },
    { emoji:'🍍', left:'10%', size:'2rem',   duration:'18s', delay:'-9s',  drift:'22px'  },
    { emoji:'🍒', left:'18%', size:'1.5rem', duration:'15s', delay:'-5s',  drift:'-12px' },
    { emoji:'🥭', left:'27%', size:'2.2rem', duration:'20s', delay:'-11s', drift:'28px'  },
    { emoji:'🍋', left:'35%', size:'1.8rem', duration:'16s', delay:'-4s',  drift:'-20px' },
    { emoji:'🍊', left:'44%', size:'2.3rem', duration:'19s', delay:'-14s', drift:'18px'  },
    { emoji:'🍦', left:'53%', size:'1.9rem', duration:'17s', delay:'-7s',  drift:'-24px' },
    { emoji:'🌴', left:'61%', size:'1.75rem',duration:'13s', delay:'-6s',  drift:'14px'  },
    { emoji:'🥝', left:'69%', size:'2.1rem', duration:'21s', delay:'-16s', drift:'-16px' },
    { emoji:'🍒', left:'78%', size:'2.25rem',duration:'18s', delay:'-10s', drift:'24px'  },
    { emoji:'🎁', left:'86%', size:'1.85rem',duration:'15s', delay:'-12s', drift:'-10px' },
    { emoji:'✨',    left:'94%', size:'1.65rem',duration:'12s', delay:'-8s',  drift:'16px'  },
  ], [])

  const minimumOrder    = parseFloat(settings.min_order    || '0') || 0
  const deliveryFee     = parseFloat(settings.delivery_fee || '0') || 0
  const businessName    = settings.business_name || 'Mi tienda'
  const tagline         = settings.tagline || 'Catalogo personalizable para cualquier producto'
  const storeMessage    = String(settings.store_message || '').trim()
  const emergencyMessage= String(settings.emergency_msg  || '').trim()
  const reviewPublicLimit   = Math.max(1, Number(settings.review_public_limit   || '3') || 3)
  const reviewRewardPercent = Math.max(0, Number(settings.review_reward_percent || '10') || 10)
  const heroTheme  = deriveHeroTheme(loyalty.currentLevel?.color || settings.theme_primary_color || null)
  const menuLayout = settings.menu_layout || 'delivery'
  const isDelivery = menuLayout === 'delivery'
  const isVitrina = menuLayout === 'vitrina'
  const isPortfolio = menuLayout === 'portfolio'
  const isMinimal = menuLayout === 'minimal' || menuLayout === 'despensa'
  const layoutPreset = getMenuStylePreset(menuLayout)
  const layoutDefaults = layoutPreset.settings || {}
  const promoEnabled = settings.ad_enabled === 'true' && Boolean(settings.ad_text || settings.ad_cta || settings.ad_url)
  const promoImage  = settings.ad_image || null
  const promoHref   = settings.ad_url   || '/afiliado'
  const promoText   = settings.ad_text  || 'Solicita ser afiliado y convierte tu codigo en un ingreso extra.'
  const promoCta    = settings.ad_cta   || 'Quiero ser afiliado'
  const promoTag    = settings.ad_type === 'banner' ? 'Aviso rapido' : 'Novedad activa'
  const logoUrl     = settings.logo_url || '/logo.png'
  const instagramUrl = settings.instagram_url || ''
  const instagramHandle = deriveInstagramHandle(settings)
  const whatsappPublic = (settings.whatsapp_number || settings.support_phone || settings.whatsapp || '34600000000').replace(/\D/g, '')
  const locationLabel = settings.address || 'Entrega local'
  const storefrontBadgeText = String(settings.storefront_badge_text || layoutDefaults.storefront_badge_text || layoutPreset.label || '').trim()
  const storefrontAnnouncement = String(settings.storefront_announcement || layoutDefaults.storefront_announcement || storeMessage || '').trim()
  const storefrontSearchPlaceholder = String(settings.storefront_search_placeholder || layoutDefaults.storefront_search_placeholder || 'Busca productos, combos o categorias').trim()
  const storefrontIntroEyebrow = String(settings.storefront_intro_eyebrow || layoutDefaults.storefront_intro_eyebrow || '').trim()
  const storefrontIntroTitle = String(settings.storefront_intro_title || layoutDefaults.storefront_intro_title || tagline).trim()
  const storefrontIntroText = String(settings.storefront_intro_text || layoutDefaults.storefront_intro_text || '').trim()
  const storefrontStoryQuote = String(settings.storefront_story_quote || layoutDefaults.storefront_story_quote || '').trim()
  const storefrontStoryAuthor = String(settings.storefront_story_author || layoutDefaults.storefront_story_author || businessName).trim()
  const storefrontPrimaryCtaLabel = String(settings.storefront_primary_cta_label || layoutDefaults.storefront_primary_cta_label || 'Pedir ahora').trim()
  const storefrontSecondaryCtaLabel = String(settings.storefront_secondary_cta_label || layoutDefaults.storefront_secondary_cta_label || 'Ver categorias').trim()
  const footerCopy = `© ${new Date().getFullYear()} ${businessName}${locationLabel ? ` · ${locationLabel}` : ''}`
  const storeHoursLabel = String(settings.store_hours_text || '').trim() || `${settings.open_hour || '10'}:00 - ${settings.close_hour || '21'}:00`
  const supportPhoneLabel = String(settings.support_phone || settings.whatsapp_number || '').trim()
  const cartSheetTitleText = isDelivery
    ? 'Tu pedido artesanal'
    : isVitrina
      ? 'Tu bolsa boutique'
      : isMinimal
        ? 'Tu cesta del barrio'
        : isPortfolio
          ? 'Tu pedido editorial'
          : 'Tu pedido'
  const cartSheetCloseText = isPortfolio ? 'Volver' : 'Cerrar'
  const bottomCatalogLabel = isPortfolio
    ? 'Carta'
    : isMinimal
      ? 'Pasillos'
      : isVitrina
        ? 'Coleccion'
        : 'Catalogo'
  const bottomHomeIcon = isDelivery
    ? '🧁'
    : isVitrina
      ? '✦'
      : isMinimal
        ? '🏪'
        : isPortfolio
          ? 'CC'
          : menuLayout === 'mascotas'
            ? '🐾'
            : menuLayout === 'moda'
              ? '👗'
              : menuLayout === 'regalos'
                ? '🎁'
                : menuLayout === 'despensa'
                  ? '🏪'
                  : '🏠'
  const featuredCategoryId = orderedProductCategoryIds[0] || null
  const remainingCategoryIds = orderedProductCategoryIds.filter(cat => cat !== featuredCategoryId)
  const storefrontMetrics = [
    { label: 'Productos', value: visibleProducts.length || 0 },
    { label: 'Combos', value: visibleCombos.length || 0 },
    { label: 'Reseñas', value: reviews.slice(0, reviewPublicLimit).length || 0 },
  ]
  const filteredCatalogCount = filteredProducts.length + filteredCombos.length
  const featuredReview = reviews[0] || null

  function renderCategoryRail() {
    if (navigationCategories.length <= 1) return null
    return (
      <div className={styles.categoryRail} aria-label="Navegacion por secciones">
        {navigationCategories.map(category => (
          <button
            key={category.id}
            type="button"
            className={`${styles.categoryRailItem} ${activeCategory === category.id ? styles.categoryRailItemActive : ''}`}
            onClick={() => scrollToCategory(category.id)}
          >
            <span className={styles.categoryRailIcon}>{category.icon}</span>
            <span className={styles.categoryRailText}>{category.label}</span>
          </button>
        ))}
      </div>
    )
  }

  function renderSearchPanel() {
    return (
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div style={{
          display: 'grid',
          gap: 14,
          borderRadius: 24,
          padding: '18px 18px',
          border: '1px solid rgba(15,23,42,0.08)',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '.74rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brand-primary)' }}>
                Busqueda comercial
              </div>
              <div style={{ marginTop: 6, fontSize: '.88rem', color: '#475569' }}>
                {normalizedSearchQuery
                  ? `${filteredCatalogCount} resultados para "${searchQuery.trim()}".`
                  : 'Filtra el menu completo sin perder combos, categorias ni producto real.'}
              </div>
            </div>
            {normalizedSearchQuery && (
              <button type="button" className={styles.navArtisanIconBtn} onClick={() => setSearchQuery('')}>
                Limpiar
              </button>
            )}
          </div>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={storefrontSearchPlaceholder}
            aria-label="Buscar en el menu"
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 18,
              border: '1px solid rgba(15,23,42,0.12)',
              padding: '0 18px',
              fontSize: '1rem',
              background: '#FFFFFF',
              color: '#0F172A',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {orderedProductCategoryIds.slice(0, 6).map(categoryId => (
              <button
                key={categoryId}
                type="button"
                className={styles.layoutChip}
                onClick={() => {
                  setSearchQuery('')
                  scrollToCategory(categoryId)
                }}
              >
                {resolveCategoryIcon(categoryId, productSectionMap)} {resolveCategoryLabel(categoryId, productSectionMap)}
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function renderPromoPanel(compact = false) {
    if (!promoEnabled) return null
    return (
      <section className={styles.promoPanel} style={{ '--promo-color': settings.ad_color || '#E8607A' }}>
        {promoImage && !compact && <img src={promoImage} alt="" className={styles.promoImage} onError={e => { e.currentTarget.style.display='none' }} />}
        <p className={styles.promoKicker}>{promoTag}</p>
        <h2 className={styles.promoTitle}>{promoText}</h2>
        <div className={styles.promoActions}>
          <span className={styles.promoTag}>{compact ? 'CTA comercial activo' : 'Menu vivo - novedades - afiliados'}</span>
          <a href={promoHref} className={styles.promoButton} target={promoHref.startsWith('http')?'_blank':undefined} rel={promoHref.startsWith('http')?'noopener noreferrer':undefined}>{promoCta}</a>
        </div>
      </section>
    )
  }

  function renderCombosSection({ title = 'Combos', kicker = '🎁', subtitle = '', useList = false } = {}) {
    if (filteredCombos.length <= 0) return null
    return (
      <section ref={el => { sectionRefs.current.combos = el }} className={styles.sectionShell}>
        {isDelivery && <SectionFruitRain type="combos" />}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadLeft}>
              <span className={styles.sectionKicker}>{kicker}</span>
              <div>
                <h2 className={styles.sectionTitle}>{title}</h2>
                {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
              </div>
            </div>
            <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeCombo}`}>{filteredCombos.length} combos</span>
          </div>
          <div className={useList ? styles.gridList : styles.grid}>
            {filteredCombos.map(combo => (
              <ComboAccessCard key={combo.id} combo={combo} isStoreOpen={isOpen}
                clubAccess={buildClubAccessMeta(combo, loyalty.currentLevel, loyalty.levels)}
                isLimitReached={comboReachedLimit(combo) || combo.has_reached_daily_limit}
                onOpen={setSelectedCombo}
                layout={menuLayout} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  function renderProductSections({ useList = false, subtitle = '' } = {}) {
    return orderedProductCategoryIds.map(cat => {
      const prods = productCategories[cat] || []
      return (
        <section key={cat} ref={el => { sectionRefs.current[cat] = el }} className={styles.sectionShell}>
          {isDelivery && <SectionFruitRain type="products" />}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionHeadLeft}>
                <span className={styles.sectionKicker}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                <div>
                  <h2 className={styles.sectionTitle}>{resolveCategoryLabel(cat, productSectionMap)}</h2>
                  {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
                </div>
              </div>
              <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeProduct}`}>
                {prods.length} {prods.length === 1 ? 'plato' : 'platos'}
              </span>
            </div>
            <div className={useList ? styles.gridList : styles.grid}>
              {prods.map(product => (
                <ProductAccessCard key={product.id} product={{ ...product, is_cart_limit_reached: productReachedLimit(product) }}
                  clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                  isStoreOpen={isOpen} onAdd={setSelectedProduct}
                  layout={menuLayout} />
              ))}
            </div>
          </div>
        </section>
      )
    })
  }

  // ── Helpers de navegación superior ──────────────────────────────
  const navLogoImg = logoUrl
  const isNavOpen  = isOpen

  function NavArtisan() {
    return (
      <nav className={styles.navArtisan}>
        <div className={styles.navArtisanTopbar}>
          <div className={styles.navArtisanTopbarInfo}>
            <span>{locationLabel}</span>
            <span>{storeHoursLabel}</span>
            {supportPhoneLabel && <span>{supportPhoneLabel}</span>}
          </div>
          <button type="button" className={styles.navArtisanTopbarCta} onClick={() => setShowCart(true)}>
            {storefrontPrimaryCtaLabel} →
          </button>
        </div>

        <div className={styles.navArtisanHeader}>
          <button type="button" className={styles.navArtisanSearch} onClick={focusSearch}>
            {storefrontSearchPlaceholder}
          </button>

          <a href="#" className={styles.navArtisanLogo} onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img
              src={navLogoImg}
              alt={businessName}
              className={styles.navArtisanLogoImg}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
            />
            <div className={styles.navArtisanLogoFallback} style={{ display: 'none' }}>CC</div>
            <div className={styles.navArtisanLogoText}>
            <span className={styles.navArtisanLogoBadge}>{storefrontBadgeText || 'Desde hoy'}</span>
              <span className={styles.navArtisanLogoName}>{businessName}</span>
              <span className={styles.navArtisanLogoTag}>{tagline || 'Obrador & tienda'}</span>
            </div>
          </a>

          <div className={styles.navArtisanActions}>
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.navArtisanIconBtn} aria-label="Instagram">
                📸
              </a>
            )}
            <button type="button" className={styles.navArtisanIconBtn} aria-label={`Carrito ${cartCount}`} onClick={() => setShowCart(true)}>
              🛒
              {cartCount > 0 && <span className={styles.navArtisanCartBadge}>{cartCount}</span>}
            </button>
            <button type="button" className={styles.navArtisanOrderBtn} onClick={() => setShowCart(true)}>
              {storefrontPrimaryCtaLabel}
            </button>
          </div>
        </div>

        <div className={styles.navArtisanCategories}>
          {navigationCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.navArtisanCategory} ${activeCategory === cat.id ? styles.navArtisanCategoryActive : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.navArtisanTrustBar}>
          <span>Ingredientes frescos</span>
          <span>Entrega clara</span>
          <span>{isNavOpen ? 'Abierto ahora' : 'Fuera de horario'}</span>
        </div>
      </nav>
    )
  }

  function NavBoutique() {
    const [promoVisible, setPromoVisible] = React.useState(true)
    const promoCopy = storeMessage || `Envio gratis en pedidos desde ${minimumOrder > 0 ? `${minimumOrder.toFixed(0)}€` : 'hoy'}`
    return (
      <nav className={styles.navBoutique}>
        {promoVisible && (
          <div className={styles.navBoutiquePromo}>
            <div className={styles.navBoutiquePromoTrack}>
              <span>{promoCopy}</span>
              <span>•</span>
              <span>{instagramHandle || 'Nueva coleccion disponible'}</span>
              <span>•</span>
              <span>{isNavOpen ? 'Atencion activa' : 'Pedidos programados'}</span>
            </div>
            <button type="button" className={styles.navBoutiquePromoClose} onClick={() => setPromoVisible(false)}>✕</button>
          </div>
        )}

        <div className={styles.navBoutiqueUtility}>
          <div className={styles.navBoutiqueUtilityLeft}>
            <button type="button" className={styles.navBoutiqueUtilityLink} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Sobre la marca</button>
            {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.navBoutiqueUtilityLink}>Instagram</a>}
          </div>
          <div className={styles.navBoutiqueUtilityRight}>
            <span className={styles.navBoutiqueUtilityLink}>{locationLabel}</span>
            <span className={styles.navBoutiqueUtilityLink}>{storeHoursLabel}</span>
          </div>
        </div>

        <div className={styles.navBoutiqueMain}>
          <a href="#" className={styles.navBoutiqueLogo} onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <span className={styles.navBoutiqueLogoName}>{businessName}</span>
            <span className={styles.navBoutiqueLogoSub}>{tagline || 'Boutique online'}</span>
          </a>

          <div className={styles.navBoutiqueCenter}>
            {navigationCategories.slice(0, 5).map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.navBoutiqueLink} ${activeCategory === cat.id ? styles.navBoutiqueLinkActive : ''}`}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className={styles.navBoutiqueActions}>
            <button type="button" className={styles.navBoutiqueIconBtn} aria-label="Buscar" onClick={focusSearch}>⌕</button>
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.navBoutiqueIconBtn} aria-label="Instagram">♡</a>
            )}
            <button type="button" className={styles.navBoutiqueIconBtn} aria-label={`Carrito ${cartCount}`} onClick={() => setShowCart(true)}>
              🛍
              {cartCount > 0 && <span className={styles.navBoutiqueCartBadge}>{cartCount}</span>}
            </button>
          </div>
        </div>

        <div className={styles.navBoutiqueSubnav}>
          {navigationCategories.slice(5).map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.navBoutiqueSubLink} ${activeCategory === cat.id ? styles.navBoutiqueSubLinkActive : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              {cat.id === REVIEW_CATEGORY_ID ? 'Lo mas buscado' : cat.label}
            </button>
          ))}
          {navigationCategories.length <= 5 && (
            <span className={styles.navBoutiqueSubFeature}>✦ Seleccion curada para comprar rapido</span>
          )}
        </div>
      </nav>
    )
  }

  function NavBarrio() {
    return (
      <nav className={styles.navBarrio}>
        <div className={styles.navBarrioStrip}>
          <div className={styles.navBarrioStripItems}>
            <span>{locationLabel}</span>
            <span>{storeHoursLabel}</span>
            {supportPhoneLabel && <span>{supportPhoneLabel}</span>}
          </div>
          <button type="button" className={styles.navBarrioStripBadge} onClick={() => setShowCart(true)}>
            {storefrontBadgeText || 'Reparto disponible'}
          </button>
        </div>

        <div className={styles.navBarrioHeader}>
          <a href="#" className={styles.navBarrioLogo} onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <div className={styles.navBarrioLogoMark}>🏪</div>
            <div className={styles.navBarrioLogoText}>
              <span className={styles.navBarrioLogoName}>{businessName}</span>
              <span className={styles.navBarrioLogoSub}>{tagline || 'Tienda de proximidad'}</span>
            </div>
          </a>

          <button type="button" className={styles.navBarrioSearch} onClick={focusSearch}>
            {storefrontSearchPlaceholder}
          </button>

          <div className={styles.navBarrioActions}>
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.navBarrioIconBtn} aria-label="Instagram">📱</a>
            )}
            <button type="button" className={styles.navBarrioCartBtn} onClick={() => setShowCart(true)}>
              Mi cesta
              <span className={styles.navBarrioCartCount}>{cartCount}</span>
            </button>
          </div>
        </div>

        <div className={styles.navBarrioOrderBar}>
          <span>{isNavOpen ? 'Pedido en marcha · entrega hoy' : 'Aceptamos pedidos para la siguiente franja'}</span>
          <button type="button" className={styles.navBarrioOrderBarLink} onClick={() => setShowCart(true)}>
            Seguir mi pedido →
          </button>
        </div>

        <div className={styles.navBarrioCategories}>
          {navigationCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.navBarrioCategory} ${activeCategory === cat.id ? styles.navBarrioCategoryActive : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              <span className={styles.navBarrioCategoryIcon}>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </nav>
    )
  }

  function NavEditorial() {
    return (
      <nav className={styles.navEditorial}>
        <div className={styles.navEditorialTopbar}>
          <div className={styles.navEditorialTopbarLeft}>
            <span>{locationLabel}</span>
            <span>{storeHoursLabel}</span>
            {supportPhoneLabel && <span>{supportPhoneLabel}</span>}
          </div>
          <div className={styles.navEditorialTopbarRight}>
            <button type="button" className={styles.navEditorialGiftLink} onClick={() => setShowCart(true)}>{storefrontSecondaryCtaLabel}</button>
          </div>
        </div>

        <div className={styles.navEditorialHeader}>
          <a href="#" className={styles.navEditorialLogo} onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <div className={styles.navEditorialMark}>
              <img
                src={navLogoImg}
                alt={businessName}
                className={styles.navEditorialMarkImg}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <div className={styles.navEditorialMarkFallback} style={{ display: 'none' }}>CC</div>
            </div>
            <div className={styles.navEditorialLogoText}>
              <span className={styles.navEditorialLogoName}>{businessName}</span>
              <span className={styles.navEditorialLogoSub}>{tagline || 'Edicion premium'}</span>
            </div>
          </a>

          <div className={styles.navEditorialLinks}>
            {navigationCategories.slice(0, 5).map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.navEditorialLink} ${activeCategory === cat.id ? styles.navEditorialLinkActive : ''}`}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className={styles.navEditorialActions}>
            <button type="button" className={styles.navEditorialSearch} onClick={focusSearch}>
              Buscar
            </button>
            <button type="button" className={styles.navEditorialIconBtn} aria-label={`Carrito ${cartCount}`} onClick={() => setShowCart(true)}>
              🛒
              {cartCount > 0 && <span className={styles.navEditorialCartDot}>{cartCount}</span>}
            </button>
            <button type="button" className={styles.navEditorialOrderBtn} onClick={() => setShowCart(true)}>
              {storefrontPrimaryCtaLabel}
            </button>
          </div>
        </div>

        <div className={styles.navEditorialSubnav}>
          {navigationCategories.slice(5).map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.navEditorialSubLink} ${activeCategory === cat.id ? styles.navEditorialSubLinkActive : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              {cat.id === REVIEW_CATEGORY_ID ? 'Opiniones' : cat.label}
            </button>
          ))}
          {navigationCategories.length <= 5 && (
            <span className={styles.navEditorialSubBadge}>Hoy disponible</span>
          )}
        </div>
      </nav>
    )
  }

  function NavModa() {
    const [promoVisible, setPromoVisible] = React.useState(true)
    return (
      <nav className={styles.navModa}>
        {promoVisible && storeMessage && (
          <div className={styles.navModaPromo}>
            {storeMessage}
            <button type="button" className={styles.navModaPromoClose} onClick={() => setPromoVisible(false)}>✕</button>
          </div>
        )}
        {promoVisible && !storeMessage && (
          <div className={styles.navModaPromo}>
            Envío gratuito en pedidos superiores a {minimumOrder > 0 ? `${minimumOrder}€` : 'hoy'}
            <button type="button" className={styles.navModaPromoClose} onClick={() => setPromoVisible(false)}>✕</button>
          </div>
        )}
        <div className={styles.navModaMain}>
          <div className={styles.navModaLeft}>
            <button type="button" className={styles.navModaLeftLink} onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>Inicio</button>
            {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.navModaLeftLink}>Síguenos</a>}
          </div>
          <a href="#" className={styles.navModaLogo} onClick={e => { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}) }}>
            <div className={styles.navModaLogoName}>{businessName}</div>
            {tagline && <div className={styles.navModaLogoSub}>{tagline}</div>}
          </a>
          <div className={styles.navModaRight}>
            <button type="button" className={styles.navModaIconBtn} aria-label="Buscar" onClick={focusSearch}>🔍</button>
            <button type="button" className={styles.navModaIconBtn} aria-label={`Carrito ${cartCount}`} onClick={() => setShowCart(true)}>
              🛍️
              {cartCount > 0 && <span className={styles.navModaCartCount}>{cartCount}</span>}
            </button>
          </div>
        </div>
        <div className={styles.navModaCats}>
          {navigationCategories.map(cat => (
            <button key={cat.id} type="button"
              className={`${styles.navModaCatLink} ${activeCategory === cat.id ? styles.navModaCatLinkActive : ''} ${cat.id === 'reviews' ? styles.navModaCatSale : ''}`}
              onClick={() => scrollToCategory(cat.id)}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </nav>
    )
  }

  function NavTrust() {
    const nichoIcon   = menuLayout === 'mascotas' ? '🐾' : menuLayout === 'regalos' ? '🎁' : '🏪'
    const nichoColor  = menuLayout === 'mascotas' ? 'green' : menuLayout === 'regalos' ? 'rose' : 'amber'
    const ctaLabel    = menuLayout === 'mascotas' ? 'Ver productos' : menuLayout === 'regalos' ? 'Explorar' : 'Ver todo'
    const alertMsg    = emergencyMessage || (menuLayout === 'despensa' ? `${visibleProducts.length} productos disponibles · ${isNavOpen ? 'Abierto ahora' : 'Cerrado'}` : null)
    return (
      <nav className={styles.navTrust}>
        <div className={styles.navTrustMain}>
          <div className={styles.navTrustLogo}>
            <div className={`${styles.navTrustLogoIcon} ${styles[nichoColor]}`}>{nichoIcon}</div>
            <div className={styles.navTrustLogoText}>
              <span className={styles.navTrustLogoName}>{businessName}</span>
              <span className={styles.navTrustLogoSub}>{tagline || locationLabel}</span>
            </div>
          </div>
          <div className={styles.navTrustLinks}>
            {navigationCategories.slice(0, 4).map(cat => (
              <button key={cat.id} type="button"
                className={`${styles.navTrustLink} ${activeCategory === cat.id ? styles.navTrustLinkActive : ''}`}
                onClick={() => scrollToCategory(cat.id)}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
          <div className={styles.navTrustRight}>
            <button type="button" className={styles.navTrustCtaBtn} onClick={() => setShowCart(true)}>
              🛒 {cartCount > 0 ? cartCount : ''}
            </button>
          </div>
        </div>
        {alertMsg && (
          <div className={styles.navTrustAlert}>
            <span>📢</span>
            <span>{alertMsg}</span>
          </div>
        )}
        {navigationCategories.length > 4 && (
          <div className={styles.navTrustSubBar}>
            {navigationCategories.slice(4).map(cat => (
              <button key={cat.id} type="button"
                className={`${styles.navTrustSubTab} ${activeCategory === cat.id ? styles.navTrustSubTabActive : ''}`}
                onClick={() => scrollToCategory(cat.id)}>
                <span className={styles.navTrustSubIcon}>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    )
  }

  // Selector del nav correcto según nicho
  function TopNav() {
    if (isDelivery) return <NavArtisan />
    if (isVitrina) return <NavBoutique />
    if (isMinimal) return <NavBarrio />
    if (isPortfolio) return <NavEditorial />
    if (menuLayout === 'moda')     return <NavModa />
    if (menuLayout === 'mascotas' || menuLayout === 'regalos' || menuLayout === 'despensa') return <NavTrust />
    return <NavBoutique />
  }

  return (
    <div className={styles.page} data-menu-layout={menuLayout}>
      <div className={styles.fruitCanvas} aria-hidden="true">
        {isDelivery && fruitItems.map((fruit, i) => (
          <span key={`${fruit.emoji}-${i}`} className={styles.fruit} style={{
            '--fruit-left': fruit.left, '--fruit-size': fruit.size,
            '--fruit-duration': fruit.duration, '--fruit-delay': fruit.delay, '--fruit-drift': fruit.drift,
          }}>{fruit.emoji}</span>
        ))}
      </div>

      {confirmedOrder && (
        <PostOrderScreen order={confirmedOrder} savedCustomer={savedCustomer}
          loyalty={confirmedOrder.loyaltySnapshot || loyalty} onClose={() => setConfirmedOrder(null)} />
      )}

      <TopNav />

      <header className={styles.hero} style={{ '--hero-base': heroTheme.base }}>
        {(emergencyMessage || storeMessage || storefrontAnnouncement) && (
          <div className={styles.heroAlerts}>
            {emergencyMessage && <div className={`${styles.heroAlert} ${styles.heroAlertEmergency}`}>{emergencyMessage}</div>}
            {storeMessage     && <div className={`${styles.heroAlert} ${styles.heroAlertStore}`}>{storeMessage}</div>}
            {storefrontAnnouncement && <div className={`${styles.heroAlert} ${styles.heroAlertStore}`}>{storefrontAnnouncement}</div>}
          </div>
        )}
        <div className={styles.heroTop}>
          <img src={logoUrl} alt={businessName} className={styles.heroLogo}
            onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }} />
          <div className={styles.heroLogoFallback} style={{ display:'none' }}>CC</div>
          <div className={styles.heroInfo}>
            {storefrontIntroEyebrow && (
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-primary)' }}>
                {storefrontIntroEyebrow}
              </div>
            )}
            <h1 className={styles.heroBusinessName}>{businessName}</h1>
            <p className={styles.heroTagline}>{tagline}</p>
            {storefrontIntroTitle && (
              <p style={{ margin: '8px 0 0', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.35 }}>
                {storefrontIntroTitle}
              </p>
            )}
            {storefrontIntroText && (
              <p style={{ margin: '10px 0 0', maxWidth: 720, color: '#475569', lineHeight: 1.7 }}>
                {storefrontIntroText}
              </p>
            )}
          </div>
          <div className={styles.heroActionRow}>
            <span className={`${styles.heroStatusBadge} ${isOpen ? styles.heroStatusOpen : styles.heroStatusClosed}`}>
              {isOpen ? '● Abierto' : '● Cerrado'}
            </span>
            <LoyaltyWidget phone={savedCustomer?.phone || customerPhone}
              open={clubPanelOpen} onClose={() => setClubPanelOpen(false)} loyalty={loyalty}
              clubUnlocks={clubUnlocks} storeId={activeStoreId} />
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.heroSocialPill}>
                {instagramHandle ? `IG ${instagramHandle}` : 'Instagram'}
              </a>
            )}
            <button type="button" className={styles.heroSocialPill} onClick={() => setShowCart(true)}>
              {storefrontPrimaryCtaLabel}
            </button>
            <button type="button" className={styles.heroSocialPill} onClick={focusSearch}>
              {storefrontSecondaryCtaLabel}
            </button>
          </div>
        </div>

        {(settings.hero_metric_1_value || settings.hero_metric_2_value || settings.hero_metric_3_value || settings.hero_metric_4_value) ? (
          <div className={styles.heroMeta}>
            {settings.hero_metric_1_value && <div className={styles.metricBox}><strong className={styles.metricValue}>{settings.hero_metric_1_value}</strong><span className={styles.metricLabel}>{settings.hero_metric_1_label || ''}</span></div>}
            {settings.hero_metric_2_value && <div className={styles.metricBox}><strong className={styles.metricValue}>{settings.hero_metric_2_value}</strong><span className={styles.metricLabel}>{settings.hero_metric_2_label || ''}</span></div>}
            {settings.hero_metric_3_value && <div className={styles.metricBox}><strong className={styles.metricValue}>{settings.hero_metric_3_value}</strong><span className={styles.metricLabel}>{settings.hero_metric_3_label || ''}</span></div>}
            {settings.hero_metric_4_value && <div className={styles.metricBox}><strong className={styles.metricValue}>{settings.hero_metric_4_value}</strong><span className={styles.metricLabel}>{settings.hero_metric_4_label || ''}</span></div>}
          </div>
        ) : (
          <div className={styles.heroMeta}>
            <div className={styles.metricBox}><strong className={styles.metricValue}>🛵</strong><span className={styles.metricLabel}>Delivery</span></div>
            <div className={styles.metricBox}><strong className={styles.metricValue}>⚡</strong><span className={styles.metricLabel}>Al momento</span></div>
          </div>
        )}
        <div className={styles.heroRibbon}>
          <span>{storefrontBadgeText || locationLabel || 'Catalogo activo'}</span>
          <span className={styles.ribbonDot} />
          <span>{locationLabel || 'Catalogo activo'}</span>
          <span className={styles.ribbonDot} />
          <span>{settings.store_hours_text || 'Configuracion activa en tiempo real'}</span>
        </div>
      </header>

      <main className={styles.main}>
        {renderSearchPanel()}
        {normalizedSearchQuery && filteredCatalogCount === 0 && (
          <section className={styles.section}>
            <div style={{
              borderRadius: 24,
              border: '1px dashed rgba(15,23,42,0.18)',
              padding: '28px 22px',
              background: 'rgba(255,255,255,0.68)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '.8rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brand-primary)' }}>
                Sin coincidencias
              </div>
              <p style={{ margin: '10px auto 0', maxWidth: 560, color: '#475569', lineHeight: 1.7 }}>
                No encontre resultados para "{searchQuery.trim()}". Prueba otra palabra o vuelve a las categorias principales.
              </p>
            </div>
          </section>
        )}
        {isVitrina && (
          <>
            {renderPromoPanel()}
            <section className={styles.layoutFeatureBand}>
              <div className={`${styles.layoutFeatureCard} ${styles.layoutFeatureCardAccent}`}>
                <div className={styles.layoutFeatureEyebrow}>{storefrontIntroEyebrow || 'Storefront retail'}</div>
                <h2 className={styles.layoutFeatureTitle}>{storefrontIntroTitle || 'Catalogo visual para descubrir, comparar y elegir rapido'}</h2>
                <p className={styles.layoutFeatureText}>{storefrontIntroText || 'Este formato prioriza portada, comparacion y fichas para negocios donde la imagen vende.'}</p>
              </div>
              <div className={styles.layoutFeatureCard}>
                <div className={styles.layoutFeatureEyebrow}>Resumen</div>
                <div className={styles.layoutMetricGrid}>
                  {storefrontMetrics.map(metric => (
                    <div key={metric.label} className={styles.layoutMetricCard}>
                      <strong>{metric.value}</strong>
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.layoutChipRow}>
                  {orderedProductCategoryIds.slice(0, 6).map(cat => (
                    <button key={cat} type="button" className={styles.layoutChip} onClick={() => scrollToCategory(cat)}>
                      {resolveCategoryIcon(cat, productSectionMap)} {resolveCategoryLabel(cat, productSectionMap)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            {renderCombosSection({ title: 'Colecciones destacadas', kicker: '🛍️', subtitle: 'Packs y agrupaciones listas para compra visual.' })}
            {loading ? (
              <section className={styles.section}>
                <div className={styles.grid}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
              </section>
            ) : (
              <>
                {featuredCategoryId && (() => {
                  const prods = productCategories[featuredCategoryId] || []
                  return (
                    <section key={featuredCategoryId} ref={el => { sectionRefs.current[featuredCategoryId] = el }} className={styles.sectionShell}>
                      <div className={styles.section}>
                        <div className={styles.sectionHead}>
                          <div className={styles.sectionHeadLeft}>
                            <span className={styles.sectionKicker}>{resolveCategoryIcon(featuredCategoryId, productSectionMap)}</span>
                            <div>
                              <h2 className={styles.sectionTitle}>{resolveCategoryLabel(featuredCategoryId, productSectionMap)}</h2>
                              <p className={styles.sectionSubtitle}>Categoria protagonista de la vitrina.</p>
                            </div>
                          </div>
                          <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeProduct}`}>
                            {prods.length} {prods.length === 1 ? 'plato' : 'platos'}
                          </span>
                        </div>
                        <div className={styles.grid}>
                          {prods.map(product => (
                            <ProductAccessCard key={product.id} product={{ ...product, is_cart_limit_reached: productReachedLimit(product) }}
                              clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                              isStoreOpen={isOpen} onAdd={setSelectedProduct}
                              layout={menuLayout} />
                          ))}
                        </div>
                      </div>
                    </section>
                  )
                })()}
                {remainingCategoryIds.map(cat => {
                  const prods = productCategories[cat] || []
                  return (
                    <section key={cat} ref={el => { sectionRefs.current[cat] = el }} className={styles.sectionShell}>
                      <div className={styles.section}>
                        <div className={styles.sectionHead}>
                          <div className={styles.sectionHeadLeft}>
                            <span className={styles.sectionKicker}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                            <h2 className={styles.sectionTitle}>{resolveCategoryLabel(cat, productSectionMap)}</h2>
                          </div>
                          <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeProduct}`}>
                            {prods.length} {prods.length === 1 ? 'plato' : 'platos'}
                          </span>
                        </div>
                        <div className={styles.grid}>
                          {prods.map(product => (
                            <ProductAccessCard key={product.id} product={{ ...product, is_cart_limit_reached: productReachedLimit(product) }}
                              clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                              isStoreOpen={isOpen} onAdd={setSelectedProduct}
                              layout={menuLayout} />
                          ))}
                        </div>
                      </div>
                    </section>
                  )
                })}
              </>
            )}
          </>
        )}

        {isPortfolio && (
          <>
            <section className={styles.layoutStoryPanel}>
              <div className={styles.layoutStoryCopy}>
                <div className={styles.layoutFeatureEyebrow}>{storefrontIntroEyebrow || 'Presentacion editorial'}</div>
                <h2 className={styles.layoutFeatureTitle}>{storefrontIntroTitle || 'Una portada pensada para vender confianza antes que urgencia'}</h2>
                <p className={styles.layoutFeatureText}>{storefrontIntroText || 'Ideal para servicios, belleza y marcas premium donde el cliente necesita contexto y prueba social.'}</p>
              </div>
              <div className={styles.layoutStoryQuote}>
                <span className={styles.layoutStoryQuoteMark}>“</span>
                <p>{storefrontStoryQuote || featuredReview?.text || 'La experiencia se presenta como un portfolio comercial con foco en marca y conversion consultiva.'}</p>
                <strong>{storefrontStoryAuthor || featuredReview?.customer_name || businessName}</strong>
              </div>
            </section>
            <section className={styles.reviewsSection}>
              <div className={styles.reviewsHeading}>
                <p className={styles.reviewsKicker}>Prueba social</p>
                <h2 className={styles.reviewsTitle}>Experiencias reales que sostienen la marca</h2>
              </div>
              <div className={styles.reviewsGrid}>
                {reviews.slice(0, reviewPublicLimit).map(r => (
                  <div key={r.id} className={styles.reviewCard}>
                    <div className={styles.reviewCardHeader}>
                      <div className={styles.reviewAvatar}>{(r.customer_name||'C')[0].toUpperCase()}</div>
                      <div>
                        <p className={styles.reviewName}>{r.customer_name || 'Cliente'}</p>
                        <span className={styles.reviewStars}>{String.fromCharCode(9733).repeat(r.rating || 5)}</span>
                      </div>
                    </div>
                    <p className={styles.reviewText}>{r.text}</p>
                    <span className={styles.reviewMeta}>Cliente verificado</span>
                  </div>
                ))}
              </div>
            </section>
            {renderCombosSection({ title: 'Experiencias y packs', kicker: '✨', subtitle: 'Paquetes presentados como propuestas cerradas.', useList: true })}
            {loading ? (
              <section className={styles.section}>
                <div className={styles.grid}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
              </section>
            ) : renderProductSections({ useList: true, subtitle: 'Bloque editorial con lectura mas pausada y enfoque premium.' })}
            {renderPromoPanel(true)}
          </>
        )}

        {isMinimal && (
          <>
            <section className={styles.layoutQuickStrip}>
              {storefrontMetrics.map(metric => (
                <div key={metric.label} className={styles.layoutQuickMetric}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
              <div className={styles.layoutQuickMetric}>
                <strong>{isOpen ? 'Abierto' : 'Cerrado'}</strong>
                <span>Estado</span>
              </div>
            </section>
            {renderCategoryRail()}
            {renderCombosSection({ title: 'Combos rapidos', kicker: '▣', subtitle: 'Seleccion directa para clientes recurrentes.', useList: true })}
            {loading ? (
              <section className={styles.section}>
                <div className={styles.grid}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
              </section>
            ) : renderProductSections({ useList: true, subtitle: 'Listado compacto con menos distracciones y lectura rapida.' })}
            {renderPromoPanel(true)}
          </>
        )}

        {/* categoryRail delivery → integrado en NavDelivery */}

        {isDelivery && promoEnabled && (
          <section className={styles.promoPanel} style={{ '--promo-color': settings.ad_color || '#E8607A' }}>
            {promoImage && <img src={promoImage} alt="" className={styles.promoImage} onError={e => { e.currentTarget.style.display='none' }} />}
            <p className={styles.promoKicker}>{promoTag}</p>
            <h2 className={styles.promoTitle}>{promoText}</h2>
            <div className={styles.promoActions}>
              <span className={styles.promoTag}>Menu vivo - novedades - afiliados</span>
              <a href={promoHref} className={styles.promoButton} target={promoHref.startsWith('http')?'_blank':undefined} rel={promoHref.startsWith('http')?'noopener noreferrer':undefined}>{promoCta}</a>
            </div>
          </section>
        )}

        {isDelivery && filteredCombos.length > 0 && (
          <section ref={el => { sectionRefs.current.combos = el }} className={styles.sectionShell}>
            {isDelivery && <SectionFruitRain type="combos" />}
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadLeft}>
                  <span className={styles.sectionKicker}>🎁</span>
                  <h2 className={styles.sectionTitle}>Combos</h2>
                </div>
                <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeCombo}`}>{filteredCombos.length} combos</span>
              </div>
              <div className={isPortfolio || isMinimal ? styles.gridList : styles.grid}>
                {filteredCombos.map(combo => (
                  <ComboAccessCard key={combo.id} combo={combo} isStoreOpen={isOpen}
                    clubAccess={buildClubAccessMeta(combo, loyalty.currentLevel, loyalty.levels)}
                    isLimitReached={comboReachedLimit(combo) || combo.has_reached_daily_limit}
                    onOpen={setSelectedCombo}
                    layout={menuLayout} />
                ))}
              </div>
            </div>
          </section>
        )}

        {isDelivery && (loading ? (
          <section className={styles.section}>
            <div className={styles.grid}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
          </section>
        ) : (
          orderedProductCategoryIds.map(cat => {
            const prods = productCategories[cat] || []
            return (
              <section key={cat} ref={el => { sectionRefs.current[cat] = el }} className={styles.sectionShell}>
                {isDelivery && <SectionFruitRain type="products" />}
                <div className={styles.section}>
                  <div className={styles.sectionHead}>
                    <div className={styles.sectionHeadLeft}>
                      <span className={styles.sectionKicker}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                      <h2 className={styles.sectionTitle}>{resolveCategoryLabel(cat, productSectionMap)}</h2>
                    </div>
                    <span className={`${styles.sectionTypeBadge} ${styles.sectionTypeBadgeProduct}`}>
                      {prods.length} {prods.length === 1 ? 'plato' : 'platos'}
                    </span>
                  </div>
                  <div className={isPortfolio || isMinimal ? styles.gridList : styles.grid}>
                    {prods.map(product => (
                      <ProductAccessCard key={product.id} product={{ ...product, is_cart_limit_reached: productReachedLimit(product) }}
                        clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                        isStoreOpen={isOpen} onAdd={setSelectedProduct}
                        layout={menuLayout} />
                    ))}
                  </div>
                </div>
              </section>
            )
          })
        ))}

        {isDelivery && <section ref={el => { sectionRefs.current[REVIEW_CATEGORY_ID] = el }} className={styles.reviewsSection}>
          {isDelivery && <SectionFruitRain type="reviews" />}
          <div className={styles.reviewsHeading}>
            <p className={styles.reviewsKicker}>// TESTIMONIOS REALES</p>
            <h2 className={styles.reviewsTitle}>LO QUE DICEN</h2>
          </div>
          <div className={styles.reviewsGrid}>
            {reviews.slice(0, reviewPublicLimit).map(r => (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewCardHeader}>
                  <div className={styles.reviewAvatar}>{(r.customer_name||'C')[0].toUpperCase()}</div>
                  <div>
                    <p className={styles.reviewName}>{r.customer_name || 'Cliente'}</p>
                    <span className={styles.reviewStars}>{String.fromCharCode(9733).repeat(r.rating || 5)}</span>
                  </div>
                </div>
                <p className={styles.reviewText}>{r.text}</p>
                <span className={styles.reviewMeta}>Carmona - Cliente verificado</span>
              </div>
            ))}
          </div>
        </section>}

        {/* ════════════════════════════════════ NICHOS ════════════════════════════════════ */}
        {/* ─── NICHO 1 · MASCOTAS · PawMarket ─── */}
        {menuLayout === 'mascotas' && (() => {
          const PET_FILTERS = [
            { id:'todos',  label:'Todos',  icon:'🐾' },
            { id:'perro',  label:'Perro',  icon:'🐕' },
            { id:'gato',   label:'Gato',   icon:'🐈' },
            { id:'ave',    label:'Ave',    icon:'🦜' },
            { id:'pez',    label:'Pez',    icon:'🐟' },
            { id:'roedor', label:'Roedor', icon:'🐹' },
          ]
          const filteredPetProducts = activePetFilter === 'todos'
            ? visibleProducts
            : visibleProducts.filter(p => String(p.tags||p.category||p.name||'').toLowerCase().includes(activePetFilter))
          const petCats = {}
          filteredPetProducts.forEach(p => { const cat = normalizeCategoryId(p.category); if (!petCats[cat]) petCats[cat]=[]; petCats[cat].push(p) })
          const petCatIds = orderedProductCategoryIds.filter(id => petCats[id]?.length > 0)
          return (
            <>
              {/* Selector circular de especie */}
              <div className={styles.petAnimalSelector}>
                {PET_FILTERS.map(a => (
                  <button key={a.id} type="button"
                    className={`${styles.petAnimalBtn} ${activePetFilter===a.id ? styles.petAnimalActive : ''}`}
                    onClick={() => setActivePetFilter(a.id)}>
                    <span className={styles.petAnimalIcon}>{a.icon}</span>
                    <span className={styles.petAnimalLabel}>{a.label}</span>
                  </button>
                ))}
              </div>
              {/* Sub-tabs de categoría */}
              {petCatIds.length > 1 && (
                <div className={styles.petCategoryTabs}>
                  {petCatIds.map(cat => (
                    <button key={cat} type="button"
                      className={`${styles.petCategoryTab} ${activeCategory===cat ? styles.petCategoryTabActive : ''}`}
                      onClick={() => scrollToCategory(cat)}>
                      {resolveCategoryIcon(cat, productSectionMap)} {resolveCategoryLabel(cat, productSectionMap)}
                    </button>
                  ))}
                </div>
              )}
              {/* Franja de confianza */}
              <div className={styles.petTrustStrip}>
                <span>✓ Nutrición profesional</span>
                <span className={styles.petTrustDot}>·</span>
                <span>🚚 Entrega a domicilio</span>
                <span className={styles.petTrustDot}>·</span>
                <span>💚 Productos seguros</span>
              </div>
              {renderPromoPanel()}
              {visibleCombos.length > 0 && renderCombosSection({ title:'Packs y kits', kicker:'🎁', subtitle:'Combinaciones listas para regalar.' })}
              {loading
                ? <div className={styles.petGrid}>{Array.from({length:4},(_,i)=><div key={i} className={styles.skeletonCard}/>)}</div>
                : petCatIds.length > 0
                  ? petCatIds.map(cat => {
                      const prods = petCats[cat] || []
                      return (
                        <section key={cat} ref={el=>{sectionRefs.current[cat]=el}} className={styles.petSection}>
                          <div className={styles.petSectionHeader}>
                            <span className={styles.petSectionIcon}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                            <h2 className={styles.petSectionTitle}>{resolveCategoryLabel(cat, productSectionMap)}</h2>
                            <span className={styles.petSectionCount}>{prods.length}</span>
                          </div>
                          <div className={styles.petGrid}>
                            {prods.map(product => (
                              <ProductAccessCard key={product.id}
                                product={{...product, is_cart_limit_reached: productReachedLimit(product)}}
                                clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                                isStoreOpen={isOpen} onAdd={setSelectedProduct} layout={menuLayout}/>
                            ))}
                          </div>
                        </section>
                      )
                    })
                  : (
                    <div className={styles.petEmptyState}>
                      <span>🔍</span>
                      <p>No hay productos para esta especie</p>
                      <button type="button" onClick={() => setActivePetFilter('todos')}>Ver todos</button>
                    </div>
                  )
              }
              <section ref={el=>{sectionRefs.current[REVIEW_CATEGORY_ID]=el}} className={styles.petReviewsSection}>
                <div className={styles.petReviewsHeader}>
                  <span className={styles.petReviewsPaw}>🐾</span>
                  <div>
                    <p className={styles.petReviewsKicker}>Propietarios satisfechos</p>
                    <h2 className={styles.petReviewsTitle}>Mascotas felices, familias tranquilas</h2>
                  </div>
                </div>
                <div className={styles.petReviewsGrid}>
                  {reviews.slice(0, reviewPublicLimit).map(r => (
                    <div key={r.id} className={styles.petReviewCard}>
                      <div className={styles.petReviewStars}>{String.fromCharCode(9733).repeat(r.rating || 5)}</div>
                      <p className={styles.petReviewText}>{r.text}</p>
                      <span className={styles.petReviewName}>{r.customer_name || 'Propietario'}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )
        })()}

        {/* ════ NICHO 2 · MODA — Tabs género + Banner editorial + Masonry ════ */}
        {menuLayout === 'moda' && (() => {
          const GENDER_TABS = [
            {id:'todo', label:'Todo', sublabel:'colección completa'},
            {id:'mujer', label:'Mujer', sublabel:'nueva temporada'},
            {id:'hombre', label:'Hombre', sublabel:'esenciales'},
            {id:'ninos', label:'Niños', sublabel:'colores vivos'},
          ]
          const modaProds = activeGender==='todo' ? visibleProducts : visibleProducts.filter(p=>String(p.tags||p.category||p.name||'').toLowerCase().includes(activeGender==='ninos'?'ni':activeGender))
          const modaCats={}
          modaProds.forEach(p=>{const cat=normalizeCategoryId(p.category);if(!modaCats[cat])modaCats[cat]=[];modaCats[cat].push(p)})
          const modaCatIds=orderedProductCategoryIds.filter(id=>modaCats[id]?.length>0)
          return (
            <>
              {/* Selector de género — tabs anchos con sublabel */}
              <div className={styles.modaGenderSelector}>
                {GENDER_TABS.map(tab => (
                  <button key={tab.id} type="button"
                    className={`${styles.modaGenderTab} ${activeGender===tab.id ? styles.modaGenderActive : ''}`}
                    onClick={() => setActiveGender(tab.id)}>
                    <span className={styles.modaGenderMain}>{tab.label}</span>
                    <span className={styles.modaGenderSub}>{tab.sublabel}</span>
                  </button>
                ))}
              </div>
              {/* Banner editorial full-width */}
              <div className={styles.modaEditorialBanner}>
                <div className={styles.modaEditorialContent}>
                  <p className={styles.modaEditorialSeason}>Temporada {new Date().getFullYear()}</p>
                  <h2 className={styles.modaEditorialTitle}>
                    {activeGender==='mujer'?'Colección Femenina':activeGender==='hombre'?'Colección Masculina':activeGender==='ninos'?'Moda Infantil':'Nueva Colección'}
                  </h2>
                  <p className={styles.modaEditorialCount}>{modaProds.length} piezas disponibles</p>
                </div>
                <div className={styles.modaEditorialAccent} aria-hidden="true">
                  {activeGender==='mujer'?'👗':activeGender==='hombre'?'👔':activeGender==='ninos'?'🎒':'✨'}
                </div>
              </div>
              {/* Chips de categoría */}
              <div className={styles.modaCategoryStrip}>
                {modaCatIds.map(cat => (
                  <button key={cat} type="button" className={styles.modaCategoryChip}
                    onClick={() => scrollToCategory(cat)}>
                    {resolveCategoryIcon(cat, productSectionMap)} {resolveCategoryLabel(cat, productSectionMap)}
                  </button>
                ))}
              </div>
              {renderPromoPanel()}
              {visibleCombos.length>0 && renderCombosSection({title:'Outfits & looks',kicker:'✨',subtitle:'Combinaciones listas para llevar.'})}
              {loading
                ? <div className={styles.modaMasonryGrid}>{Array.from({length:6},(_,i)=><div key={i} className={styles.skeletonCard} style={{height:i%3===0?'260px':'180px'}}/>)}</div>
                : modaCatIds.map(cat => {
                    const prods=modaCats[cat]||[]
                    return (
                      <section key={cat} ref={el=>{sectionRefs.current[cat]=el}} className={styles.modaCategoryBlock}>
                        <div className={styles.modaCategoryLabel}>
                          <span>{resolveCategoryIcon(cat, productSectionMap)}</span>
                          <h2>{resolveCategoryLabel(cat, productSectionMap)}</h2>
                          <div className={styles.modaCategoryLine} aria-hidden="true"/>
                          <span className={styles.modaCategoryCount}>{prods.length} piezas</span>
                        </div>
                        <div className={styles.modaMasonryGrid}>
                          {prods.map((product, idx) => (
                            <div key={product.id} className={`${styles.modaMasonryItem} ${idx%3===0 ? styles.modaMasonryItemWide : ''}`}>
                              <ProductAccessCard
                                product={{...product, is_cart_limit_reached: productReachedLimit(product)}}
                                clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                                isStoreOpen={isOpen} onAdd={setSelectedProduct} layout={menuLayout}/>
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  })
              }
              <section ref={el=>{sectionRefs.current[REVIEW_CATEGORY_ID]=el}} className={styles.modaReviewsSection}>
                <p className={styles.modaReviewsKicker}>— Clientes que ya lo llevan —</p>
                <div className={styles.modaReviewsGrid}>
                  {reviews.slice(0, reviewPublicLimit).map(r => (
                    <div key={r.id} className={styles.modaReviewCard}>
                      <span className={styles.modaReviewStars}>{String.fromCharCode(9733).repeat(r.rating||5)}</span>
                      <p className={styles.modaReviewText}>"{r.text}"</p>
                      <strong className={styles.modaReviewName}>{r.customer_name||'Cliente'}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )
        })()}

        {/* ════ NICHO 3 · REGALOS — Tiles ocasión + Carruseles horizontales ════ */}
        {menuLayout === 'regalos' && (() => {
          const OCCASIONS = [
            {id:'cumpleanos',label:'Cumpleaños',icon:'🎂',color:'#FF6B6B'},
            {id:'aniversario',label:'Aniversario',icon:'💑',color:'#E879A0'},
            {id:'para-el',label:'Para él',icon:'🎩',color:'#4F46E5'},
            {id:'para-ella',label:'Para ella',icon:'👛',color:'#EC4899'},
            {id:'ninos',label:'Para niños',icon:'🧸',color:'#F59E0B'},
            {id:'sorpresa',label:'Sorpresa',icon:'🎁',color:'#7C3AED'},
          ]
          const BUDGETS = [
            {id:null, label:'Todos los precios'},
            {id:'eco', label:'Hasta 20€', min:0, max:20},
            {id:'mid', label:'20 – 50€', min:20, max:50},
            {id:'premium', label:'Más de 50€', min:50, max:Infinity},
          ]
          const filteredGiftProds = visibleProducts.filter(p => {
            const matchOc = !activeOccasion || String(p.tags||p.category||'').toLowerCase().includes(activeOccasion)
            const price = parseFloat(p.price||0)
            const bud = BUDGETS.find(b => b.id === activeBudget)
            const matchBud = !bud || (price >= (bud.min||0) && price <= (bud.max||Infinity))
            return matchOc && matchBud
          })
          const giftCats = {}
          filteredGiftProds.forEach(p => { const cat = normalizeCategoryId(p.category); if (!giftCats[cat]) giftCats[cat]=[]; giftCats[cat].push(p) })
          const giftCatIds = orderedProductCategoryIds.filter(id => giftCats[id]?.length > 0)
          return (
            <>
              {/* Intro */}
              <div className={styles.giftIntro}>
                <h2 className={styles.giftIntroTitle}>¿Cuál es la ocasión?</h2>
                <p className={styles.giftIntroSub}>Selecciona para encontrar el regalo perfecto</p>
              </div>
              {/* Tiles de ocasión — grid ilustrado 2×3 */}
              <div className={styles.giftOccasionGrid}>
                {OCCASIONS.map(o => (
                  <button key={o.id} type="button"
                    className={`${styles.giftOccasionTile} ${activeOccasion===o.id ? styles.giftOccasionTileActive : ''}`}
                    style={{'--occ-color': o.color}}
                    onClick={() => setActiveOccasion(activeOccasion===o.id ? null : o.id)}>
                    <span className={styles.giftOccasionTileIcon}>{o.icon}</span>
                    <span className={styles.giftOccasionTileLabel}>{o.label}</span>
                    {activeOccasion===o.id && <span className={styles.giftOccasionCheck}>✓</span>}
                  </button>
                ))}
              </div>
              {/* Filtro de presupuesto */}
              <div className={styles.giftBudgetRow}>
                {BUDGETS.map(b => (
                  <button key={String(b.id)} type="button"
                    className={`${styles.giftBudgetPill} ${activeBudget===b.id ? styles.giftBudgetActive : ''}`}
                    onClick={() => setActiveBudget(activeBudget===b.id ? null : b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
              {renderPromoPanel()}
              {/* Combos como carrusel */}
              {filteredCombos.length > 0 && (
                <section className={styles.giftCarouselSection}>
                  <div className={styles.giftCarouselHeader}>
                    <span className={styles.giftCarouselIcon}>🎀</span>
                    <h3 className={styles.giftCarouselTitle}>Packs regalo listos</h3>
                  </div>
                  <div className={styles.giftCarousel}>
                    {filteredCombos.map(combo => (
                      <div key={combo.id} className={styles.giftCarouselItem}>
                        <ComboAccessCard combo={combo} isStoreOpen={isOpen}
                          clubAccess={buildClubAccessMeta(combo, loyalty.currentLevel, loyalty.levels)}
                          isLimitReached={comboReachedLimit(combo)||combo.has_reached_daily_limit}
                          onOpen={setSelectedCombo} layout={menuLayout}/>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {/* Productos por categoría — carruseles horizontales */}
              {loading
                ? <div className={styles.giftCarousel}>{Array.from({length:4},(_,i)=><div key={i} className={styles.skeletonCard} style={{minWidth:'160px'}}/>)}</div>
                : giftCatIds.length > 0
                  ? giftCatIds.map(cat => {
                      const prods = giftCats[cat] || []
                      return (
                        <section key={cat} ref={el=>{sectionRefs.current[cat]=el}} className={styles.giftCarouselSection}>
                          <div className={styles.giftCarouselHeader}>
                            <span className={styles.giftCarouselIcon}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                            <h3 className={styles.giftCarouselTitle}>{resolveCategoryLabel(cat, productSectionMap)}</h3>
                            <span className={styles.giftCarouselCount}>{prods.length} opciones</span>
                          </div>
                          <div className={styles.giftCarousel}>
                            {prods.map(product => (
                              <div key={product.id} className={styles.giftCarouselItem}>
                                <ProductAccessCard
                                  product={{...product, is_cart_limit_reached: productReachedLimit(product)}}
                                  clubAccess={buildClubAccessMeta(product, loyalty.currentLevel, loyalty.levels)}
                                  isStoreOpen={isOpen} onAdd={setSelectedProduct} layout={menuLayout}/>
                              </div>
                            ))}
                          </div>
                        </section>
                      )
                    })
                  : (
                    <div className={styles.giftEmptyState}>
                      <span>🔍</span>
                      <p>No hay regalos con esos filtros</p>
                      <button type="button" onClick={() => { setActiveOccasion(null); setActiveBudget(null) }}>
                        Ver todos los regalos
                      </button>
                    </div>
                  )
              }
              <section ref={el=>{sectionRefs.current[REVIEW_CATEGORY_ID]=el}} className={styles.giftReviewsSection}>
                <div className={styles.giftReviewsHeader}>
                  <p className={styles.giftReviewsKicker}>💝 Experiencias reales</p>
                  <h2 className={styles.giftReviewsTitle}>Regalos que emocionan de verdad</h2>
                </div>
                <div className={styles.giftReviewsGrid}>
                  {reviews.slice(0, reviewPublicLimit).map(r => (
                    <div key={r.id} className={styles.giftReviewCard}>
                      <div className={styles.giftReviewTop}>
                        <div className={styles.giftReviewAvatar}>{(r.customer_name||'C')[0].toUpperCase()}</div>
                        <div>
                          <p className={styles.giftReviewName}>{r.customer_name||'Cliente'}</p>
                          <span className={styles.giftReviewStars}>{String.fromCharCode(9733).repeat(r.rating||5)}</span>
                        </div>
                      </div>
                      <p className={styles.giftReviewText}>{r.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )
        })()}

        {/* ════ NICHO 4 · DESPENSA — Nav de pasillos + Filas compactas inline ════ */}
        {menuLayout === 'despensa' && (() => {
          const despCatIds = activeDespensaCat ? orderedProductCategoryIds.filter(id=>id===activeDespensaCat) : orderedProductCategoryIds
          return (
            <>
              {/* Barra info rápida */}
              <div className={styles.despensaInfoBar}>
                <span className={styles.despensaInfoItem}><strong>{visibleProducts.length}</strong> productos</span>
                <span className={styles.despensaInfoDivider}/>
                <span className={styles.despensaInfoItem}><strong>{Object.keys(productCategories).length}</strong> pasillos</span>
                <span className={styles.despensaInfoDivider}/>
                <span className={`${styles.despensaInfoItem} ${isOpen ? styles.despensaInfoOpen : styles.despensaInfoClosed}`}>
                  {isOpen ? '● Abierto' : '● Cerrado'}
                </span>
              </div>
              {/* Tabs de pasillo — sticky horizontal con contador */}
              <div className={styles.despensaAisleNav}>
                <button type="button"
                  className={`${styles.despensaAisleTab} ${!activeDespensaCat ? styles.despensaAisleActive : ''}`}
                  onClick={() => setActiveDespensaCat(null)}>
                  🏪 Todo
                </button>
                {orderedProductCategoryIds.map(cat => (
                  <button key={cat} type="button"
                    className={`${styles.despensaAisleTab} ${activeDespensaCat===cat ? styles.despensaAisleActive : ''}`}
                    onClick={() => setActiveDespensaCat(activeDespensaCat===cat ? null : cat)}>
                    {resolveCategoryIcon(cat, productSectionMap)} {resolveCategoryLabel(cat, productSectionMap)}
                    <span className={styles.despensaAisleBadge}>{(productCategories[cat]||[]).length}</span>
                  </button>
                ))}
              </div>
              {renderPromoPanel(true)}
              {/* Pasillos con filas ultra-compactas */}
              {loading
                ? <div className={styles.despensaList}>{Array.from({length:6},(_,i)=><div key={i} className={styles.despensaRowSkeleton}/>)}</div>
                : despCatIds.map(cat => {
                    const prods = productCategories[cat] || []
                    if (!prods.length) return null
                    return (
                      <div key={cat} ref={el=>{sectionRefs.current[cat]=el}} className={styles.despensaAisle}>
                        <div className={styles.despensaAisleHeader}>
                          <span className={styles.despensaAisleIcon}>{resolveCategoryIcon(cat, productSectionMap)}</span>
                          <span className={styles.despensaAisleTitle}>{resolveCategoryLabel(cat, productSectionMap)}</span>
                          <span className={styles.despensaAisleCount}>{prods.length} items</span>
                        </div>
                        <div className={styles.despensaList}>
                          {prods.map(product => {
                            const limited = productReachedLimit(product)
                            return (
                              <div key={product.id}
                                className={`${styles.despensaRow} ${(!isOpen||limited) ? styles.despensaRowOff : ''}`}
                                onClick={() => isOpen && !limited && setSelectedProduct(product)}>
                                {product.image_url
                                  ? <img src={product.image_url} alt={product.name} className={styles.despensaRowImg}/>
                                  : <span className={styles.despensaRowEmoji}>{product.emoji || resolveCategoryIcon(cat, productSectionMap)}</span>
                                }
                                <div className={styles.despensaRowInfo}>
                                  <p className={styles.despensaRowName}>{product.name}</p>
                                  {product.description && <p className={styles.despensaRowDesc}>{String(product.description).slice(0,42)}{product.description?.length>42?'…':''}</p>}
                                </div>
                                <div className={styles.despensaRowRight}>
                                  <span className={styles.despensaRowPrice}>{parseFloat(product.price||0).toFixed(2)}€</span>
                                  <button type="button" className={styles.despensaRowAdd}
                                    disabled={!isOpen || limited}
                                    onClick={e => { e.stopPropagation(); if (isOpen && !limited) setSelectedProduct(product) }}
                                    aria-label={`Añadir ${product.name}`}>+</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
              }
              {visibleCombos.length > 0 && renderCombosSection({title:'Cestas y packs',kicker:'🧺',subtitle:'Combinaciones listas para llevarse.',useList:true})}
              <section ref={el=>{sectionRefs.current[REVIEW_CATEGORY_ID]=el}} className={styles.despensaReviewsSection}>
                <h2 className={styles.despensaReviewsTitle}>Lo que dicen nuestros clientes</h2>
                <div className={styles.despensaReviewsList}>
                  {reviews.slice(0, reviewPublicLimit).map(r => (
                    <div key={r.id} className={styles.despensaReviewItem}>
                      <span className={styles.despensaReviewStars}>{String.fromCharCode(9733).repeat(r.rating||5)}</span>
                      <p className={styles.despensaReviewText}>{r.text}</p>
                      <span className={styles.despensaReviewName}>— {r.customer_name||'Cliente'}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )
        })()}
      </main>

      <footer className={styles.footer}>
        <img src={logoUrl} alt={businessName} className={styles.footerLogo}
          onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }} />
        <div className={styles.footerLogoFallback} style={{ display:'none' }}>🍦</div>
        <p className={styles.footerName}>{businessName}</p>
        <div className={styles.footerLinks}>
          {instagramUrl && (
            <>
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
                📸 {instagramHandle || 'Instagram'}
              </a>
              <span className={styles.footerDivider} />
            </>
          )}
          {whatsappPublic && (
            <>
              <a href={`https://wa.me/${whatsappPublic}`} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>💬 WhatsApp</a>
              <span className={styles.footerDivider} />
            </>
          )}
          <span className={styles.footerLink}>📍 {locationLabel || 'Online'}</span>
        </div>
        <p className={styles.footerCopy}>{footerCopy}</p>
      </footer>

      <nav className={styles.bottomNav} aria-label="Navegación principal">
        <button type="button" className={styles.bottomNavItem}
          onClick={() => window.scrollTo({ top:0, behavior:'smooth' })} aria-label="Inicio">
          <span className={styles.bottomNavIcon}>{bottomHomeIcon}</span>
          <span className={styles.bottomNavLabel}>Inicio</span>
        </button>

        {navigationCategories.length > 1 && (
          <button type="button" className={styles.bottomNavItem}
            onClick={() => scrollToCategory(navigationCategories[0]?.id)} aria-label="Catálogo">
            <span className={styles.bottomNavIcon}>
              {isPortfolio ? '✺' : isMinimal ? '🧺' : isVitrina ? '✦' : '🗂️'}
            </span>
            <span className={styles.bottomNavLabel}>{bottomCatalogLabel}</span>
          </button>
        )}

        <button data-testid="menu-cart-button" type="button" className={styles.bottomNavItem}
          onClick={() => setShowCart(true)} aria-label={`Carrito ${cartCount}`}>
          <span className={styles.bottomNavIcon}>🛒</span>
          <span className={styles.bottomNavLabel}>Carrito</span>
          {cartCount > 0 && <span className={styles.bottomNavBadge}>{cartCount}</span>}
        </button>

        <button type="button" className={styles.bottomNavItem}
          onClick={() => { window.scrollTo({top:0,behavior:'smooth'}); setClubPanelOpen(true) }}
          aria-label={`Club ${businessName}`}>
          <span className={styles.bottomNavIcon}>⭐</span>
          <span className={styles.bottomNavLabel}>Club</span>
        </button>
      </nav>

      {showCart && (
        <div className={styles.cartOverlay} onPointerDown={armCartBackdropClose} onPointerUp={maybeCloseCartFromBackdrop} onPointerCancel={resetCartBackdropClose}>
          <div className={styles.cartSheet}>
            <div className={styles.cartSheetHead}>
              <h2 className={styles.cartSheetTitle}>{cartSheetTitleText}</h2>
              <button type="button" className={styles.cartSheetClose} onClick={() => setShowCart(false)} aria-label="Cerrar carrito">{cartSheetCloseText}</button>
            </div>
            <div style={{flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',display:'flex',flexDirection:'column'}}>
              <Cart items={cart} onUpdateQty={updateQty} onRemove={removeItem}
                onClear={() => { clearCart(); setShowCart(false) }}
                isOpen={isOpen} onConfirmed={handleConfirmed} onEditItem={handleEditCartItem}
                savedCustomer={savedCustomer} onCustomerSaved={handleCustomerSaved}
                storeId={activeStoreId}
                minOrder={minimumOrder} deliveryFee={deliveryFee}
                products={visibleProducts} combos={visibleCombos}
                catalogProducts={products} catalogCombos={combos}
                onRequestProduct={(item, isCombo) => {
                  setShowCart(false)
                  if (isCombo) setSelectedCombo({ ...item, _fromCart: true })
                  else setSelectedProduct({ ...item, _fromCart: true })
                }}
                loyaltyDiscount={loyalty.discountPercent}
                loyaltyLevel={loyalty.currentLevel}
                loyaltyOrderCount={loyalty.orderCount} />
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (() => {
        const catIds     = Array.isArray(selectedProduct.topping_category_ids) ? selectedProduct.topping_category_ids : []
        const allowedIds = Array.isArray(selectedProduct.allowed_topping_ids)  ? selectedProduct.allowed_topping_ids  : []
        const filteredCats = catIds.length > 0
          ? toppingCategories.filter(c => catIds.includes(c.id))
              .map(c => ({ ...c, toppings: (c.toppings||[]).filter(t => allowedIds.length===0 || allowedIds.includes(t.id)) }))
              .filter(c => c.toppings.length > 0)
          : []
        return (
          <ProductModal product={selectedProduct} categories={filteredCats} loyaltyLevel={loyalty.currentLevel}
            onAdd={handleProductAdd}
            onClose={() => { if (selectedProduct._editIndex !== undefined || selectedProduct._fromCart) setShowCart(true); setSelectedProduct(null) }}
            editMode={selectedProduct._editIndex !== undefined} initialItem={selectedProduct._editItem} />
        )
      })()}

      {selectedCombo && (
        <ComboModal combo={selectedCombo} products={visibleProducts} categories={toppingCategories} loyaltyLevel={loyalty.currentLevel}
          onAdd={handleComboAdd}
          onClose={() => { if (selectedCombo._editIndex !== undefined || selectedCombo._fromCart) setShowCart(true); setSelectedCombo(null) }}
          editMode={selectedCombo._editIndex !== undefined} initialItem={selectedCombo._editItem} hideExtraPrices={true} />
      )}

      {reviewOrderNum && !reviewSent && (
        <div style={{position:'fixed',inset:0,zIndex:9500,background:'rgba(0,0,0,0.70)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e => e.target === e.currentTarget && setReviewOrderNum(null)}>
          <div style={{width:'100%',maxWidth:480,background:'#FFFBF5',borderRadius:'24px 24px 0 0',borderTop:'3px solid #E8607A',padding:'0 0 calc(24px + env(safe-area-inset-bottom,0px))',animation:'revSlideUp .35s cubic-bezier(0.16,1,0.3,1)',fontFamily:"'Nunito',sans-serif"}}>
            <style>{`@keyframes revSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
            <div style={{width:40,height:4,borderRadius:50,background:'rgba(0,0,0,.12)',margin:'10px auto 0'}} />
            <div style={{padding:'20px 20px 0'}}>
              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:'2.8rem',marginBottom:8}}>{'⭐'}</div>
                <div style={{display:'inline-block',background:'#E8607A',color:'white',padding:'3px 14px',borderRadius:50,fontSize:'0.60rem',fontWeight:900,letterSpacing:'0.12em',marginBottom:10}}>CUPON DE DESCUENTO</div>
                <p style={{margin:0,fontSize:'1rem',fontWeight:900,color:'#1C3829',lineHeight:1.3}}>{'¿Qué te pareció tu pedido?'}</p>
                <p style={{margin:'6px 0 0',fontSize:'0.72rem',color:'#6B7280',fontWeight:600}}>Pedido #{reviewOrderNum} · Deja tu valoración y recibe un cupón de {reviewRewardPercent}% de descuento</p>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:16}}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)}
                    style={{fontSize:'2rem',background:'none',border:'none',cursor:'pointer',transform:star<=reviewRating?'scale(1.18)':'scale(1)',transition:'transform .15s',filter:star<=reviewRating?'none':'grayscale(1) opacity(.4)',WebkitTapHighlightColor:'transparent'}}>
                    {'⭐'}
                  </button>
                ))}
              </div>
              <textarea placeholder="Cuéntanos tu experiencia (opcional)" value={reviewText} onChange={e => setReviewText(e.target.value)} rows={3}
                style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:14,border:'1.5px solid #E5E7EB',background:'#F9FAFB',fontFamily:"'Nunito',sans-serif",fontSize:'0.84rem',color:'#1C3829',resize:'none',outline:'none',marginBottom:12}} />
              {reviewError && <p style={{margin:'0 0 10px',fontSize:'0.74rem',color:'#DC2626',fontWeight:700}}>{reviewError}</p>}
              <button type="button" onClick={submitReviewFromLink} disabled={reviewRating===0||reviewSending}
                style={{width:'100%',padding:'15px',borderRadius:16,border:'none',background:reviewRating>0?'linear-gradient(135deg,#E8607A,#D04060)':'#E5E7EB',color:reviewRating>0?'white':'#9CA3AF',fontFamily:"'Nunito',sans-serif",fontSize:'0.96rem',fontWeight:900,cursor:reviewRating>0?'pointer':'not-allowed',transition:'all .2s'}}>
                {reviewSending?'Enviando...':reviewRating===0?'Selecciona una puntuación':'Enviar valoración y recibir cupón'}
              </button>
              <button type="button" onClick={() => setReviewOrderNum(null)}
                style={{width:'100%',padding:'11px',marginTop:8,borderRadius:16,border:'none',background:'none',fontFamily:"'Nunito',sans-serif",fontSize:'0.82rem',fontWeight:700,color:'#9CA3AF',cursor:'pointer'}}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewOrderNum && reviewSent && (
        <div style={{position:'fixed',inset:0,zIndex:9500,background:'rgba(0,0,0,0.70)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={() => setReviewOrderNum(null)}>
          <div style={{width:'100%',maxWidth:480,background:'#FFFBF5',borderRadius:'24px 24px 0 0',borderTop:'3px solid #2D6A4F',padding:'32px 24px calc(32px + env(safe-area-inset-bottom,0px))',textAlign:'center',fontFamily:"'Nunito',sans-serif"}}>
            <div style={{fontSize:'3.5rem',marginBottom:12}}>{'🙏'}</div>
            <p style={{margin:'0 0 6px',fontSize:'1.1rem',fontWeight:900,color:'#1C3829'}}>¡Gracias por tu valoración!</p>
            <p style={{margin:'0 0 20px',fontSize:'0.78rem',color:'#6B7280',fontWeight:600}}>Tu opinión nos ayuda a mejorar cada día.</p>
            {reviewCoupon && (
              <div style={{background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',border:'2px dashed #4ADE80',borderRadius:16,padding:'16px 20px',marginBottom:20}}>
                <p style={{margin:'0 0 4px',fontSize:'0.68rem',fontWeight:900,color:'#166534',letterSpacing:'0.1em',textTransform:'uppercase'}}>Tu cupón de descuento</p>
                <p style={{margin:'0 0 8px',fontSize:'1.6rem',fontWeight:900,color:'#166534',letterSpacing:'0.08em'}}>{reviewCoupon}</p>
                <p style={{margin:0,fontSize:'0.70rem',color:'#15803D',fontWeight:700}}>{reviewRewardPercent}% de descuento en tu próximo pedido · 7 días de validez</p>
              </div>
            )}
            <button type="button" onClick={() => setReviewOrderNum(null)}
              style={{width:'100%',padding:'14px',borderRadius:16,border:'none',background:'linear-gradient(135deg,#2D6A4F,#40916C)',color:'white',fontFamily:"'Nunito',sans-serif",fontSize:'0.96rem',fontWeight:900,cursor:'pointer'}}>
              ¡Perfecto, gracias!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
