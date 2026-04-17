import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { usePWAInstall } from '../lib/usePWAInstall'
import { notify, useNotifPermission } from '../lib/useNotifications'
import styles from './Admin.module.css'
import AdminAccountingTab from './AdminAccountingTab'
import AdminFinanceTab    from './AdminFinanceTab'
import AdminStaffTab      from './AdminStaffTab'
import AdminChatbotTab    from './AdminChatbotTab'
import AdminRolesTab      from './AdminRolesTab'
import AdminStockTab      from './AdminStockTab'
import AdminDashboardTab  from './AdminDashboardTab'
import AdminLoyaltyTab   from './AdminLoyaltyTab'
import AdminReviewsTab   from './AdminReviewsTab'
import AdminAffiliatesTab from './AdminAffiliatesTab'
import AdminProductsTab from './AdminProductsTab'
import AdminToppingsTab from './AdminToppingsTab'
import AdminCombosTab from './AdminCombosTab'
import AdminCouponsTab from './AdminCouponsTab'
import AdminStoreCustomizationPanel from './AdminStoreCustomizationPanel'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'
import { CHATBOT_API_URL, buildChatbotHeaders, getChatbotConfigError } from '../lib/chatbotConfig'
import { canOpenAdminPanel, getDesktopAdminMeta } from '../lib/desktopAdminAccess'
import { buildOrderStatusUpdate } from '../lib/orderStatusUpdate'
import { buildStoreOperationalProfile, loadStoreConfig } from '../lib/storeConfig'
import { DEFAULT_STORE_ID, getStoredActiveStoreId, normalizeStoreId, resolveConfiguredStoreId, setStoredActiveStoreId } from '../lib/currentStore'
import { loadMergedSettingsEntries, upsertScopedSetting } from '../lib/storeSettings'
import { buildAffiliateMenuLink } from '../lib/affiliateAuth'
import { buildStoreBrandingSnapshot, SUPER_ADMIN_BRAND } from '../lib/adminBranding'
import { buildAdminTicket } from '../lib/adminOrderUtils'
import { requestAppLogin } from '../lib/appAuthApi'
import { STORAGE_KEYS, clearStoredSession, loadStoredSession, persistStoredSession } from '../lib/appSession'
import { OXIDIAN_ENTRY_PATH } from '../lib/oxidianAccess'

const OWNER_SESSION = {
  role: 'owner',
  permissions: [],
}

const WA_URL = CHATBOT_API_URL
// NOTA: scopedSettingsStoreId se eliminó como global mutable.
// El storeId ahora fluye correctamente via props/state desde el componente Admin.

const UI_ICONS = {
  owner: '\u{1F451}',
  admin: '\u{1F464}',
  lock: '\u{1F512}',
  pwa: '\u{1F4F2}',
  home: '\u{1F3E0}',
  close: '\u2715',
  operations: '\u26A1',
  orders: '\u{1F4CB}',
  stats: '\u{1F4CA}',
  insights: '\u{1F9E0}',
  finance: '\u{1F6A6}',
  money: '\u{1F4B5}',
  products: '\u{1F353}',
  toppings: '\u{1F36B}',
  combos: '\u{1F381}',
  stock: '\u{1F4E6}',
  loyalty: '\u2B50',
  reviews: '\u{1F4AC}',
  affiliates: '\u{1F3F7}',
  coupons: '\u{1F39F}',
  chatbot: '\u{1F916}',
  stores: '\u{1F3EC}',
  staff: '\u{1F465}',
  settings: '\u2699\uFE0F',
  hourglass: '\u23F3',
  rider: '\u{1F6F5}',
  shop: '\u{1F6CD}',
}

// parseSlots: normaliza combo_slots desde cualquier formato Supabase
function parseSlots(raw) {
  try {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    if (typeof raw === 'object') return Object.values(raw)
    return []
  } catch { return [] }
}

function buildWAMessage(order, status, brand = {}) {
  const name  = order.customer_name || 'Cliente'
  const num   = order.order_number  || order.id?.slice(0, 6).toUpperCase()
  const total = Number(order.total || 0).toFixed(2)
  const businessName = brand.businessName || 'La tienda'
  const instagramHandle = brand.instagramHandle || ''
  const locationLabel = brand.locationLabel || ''
  const footer = [businessName, locationLabel].filter(Boolean).join(' \u00b7 ')

  switch (status) {
    case 'pending':
      return `\u23f3 *\u00a1Pedido confirmado, ${name}!*\n\nHemos recibido tu pedido *#${num}* por *\u20ac${total}*. En breve empezamos a prepararlo.\n\n_${footer}_`
    case 'preparing':
      return `\U0001f373\U0001f525 *\u00a1Ya estamos preparando tu pedido!*\n\nHola ${name}, tu pedido *#${num}* est\u00e1 en preparaci\u00f3n. En unos minutos saldr\u00e1 hacia tu direcci\u00f3n \U0001f6b5\n\n_${footer}_`
    case 'delivering':
      return `\U0001f6b5 *\u00a1Tu pedido est\u00e1 en camino!*\n\nHola ${name}, tu pedido *#${num}* acaba de salir. El repartidor llegar\u00e1 en breve. Prepara *\u20ac${total}* en efectivo \U0001f4b5\n\n_${footer}_`
    case 'delivered':
      return `\U0001f64f *\u00a1Pedido entregado!*\n\n${name}, esperamos que disfrutes tu pedido *#${num}*. \u00a1Gracias por elegir ${businessName}!${instagramHandle ? ` S\u00edguenos en Instagram *${instagramHandle}* \U0001f4f8` : ''}\n\n_${footer}_`
    default:
      return null
  }
}

function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('34') && digits.length === 11) return digits
  if (digits.length === 9) return '34' + digits
  if (digits.length >= 10) return digits
  return digits
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function sendWhatsAppAuto(order, status, storeId = null) {
  if (!WA_URL) return { sent: false, error: getChatbotConfigError() }
  const phone = normalizePhone(order.customer_phone)
  if (!phone) return { sent: false, reason: 'sin_telefono' }

  let message = null
  let brand = { businessName: 'La tienda', instagramHandle: '', locationLabel: '' }
  const STATUS_KEY_MAP = {
    pending:   'wa_confirm_msg',
    preparing: 'wa_preparing_msg',
    delivering:'wa_delivering_msg',
    delivered: 'wa_delivered_msg',
  }
  try {
    const keys = [STATUS_KEY_MAP[status], 'business_name', 'instagram_handle', 'address'].filter(Boolean)
    const scopedId = normalizeStoreId(storeId || order.store_id || DEFAULT_STORE_ID)

    // Cargar settings con prioridad: store_settings scoped > settings global
    let settingsMap = {}
    if (scopedId !== DEFAULT_STORE_ID) {
      const [globalRes, scopedRes] = await Promise.all([
        supabase.from('settings').select('key, value').in('key', keys),
        supabase.from('store_settings').select('key, value').eq('store_id', scopedId).in('key', keys),
      ])
      const globalMap = Object.fromEntries((globalRes.data || []).map(row => [row.key, row.value]))
      const scopedMap = Object.fromEntries((scopedRes.data || []).map(row => [row.key, row.value]))
      settingsMap = { ...globalMap, ...scopedMap }
    } else {
      const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', keys)
      settingsMap = Object.fromEntries((settingsData || []).map(row => [row.key, row.value]))
    }
    brand = {
      businessName: settingsMap.business_name || brand.businessName,
      instagramHandle: settingsMap.instagram_handle || brand.instagramHandle,
      locationLabel: settingsMap.address || brand.locationLabel,
    }
    const key = STATUS_KEY_MAP[status]
    if (key && settingsMap[key]) {
      const name  = order.customer_name || 'Cliente'
      const num   = order.order_number  || order.id?.slice(0, 6).toUpperCase()
      const total = Number(order.total || 0).toFixed(2)
      const addr  = order.delivery_address || order.address || '\u2014'
      message = settingsMap[key]
        .replace(/\{\{nombre\}\}/g, name)
        .replace(/\{\{numero\}\}/g, num)
        .replace(/\{\{total\}\}/g, total)
        .replace(/\{\{direccion\}\}/g, addr)
    }
  } catch { /* fallback */ }

  if (!message) message = buildWAMessage(order, status, brand)
  if (!message) return { sent: false, reason: 'sin_plantilla' }

  console.log(`[WA Admin] Enviando a ${phone} \u2192 status: ${status}`)

  try {
    const res = await fetch(`${WA_URL}/chatbot/send`, {
      method: 'POST',
      headers: buildChatbotHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ phone, message }),
    })
    let data = {}
    try { data = await res.json() } catch { data = { success: false, error: `HTTP ${res.status}` } }
    if (data.success || data.ok) return { sent: true }
    return { sent: false, error: data.error || 'error_servidor' }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

function AdminAccountingHubTab({ storeId = DEFAULT_STORE_ID }) {
  return (
    <div style={{ display:'grid', gap:18 }}>
      <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:16, padding:'14px 16px' }}>
        <div style={{ fontSize:'.72rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#6B7280' }}>
          Contabilidad simplificada
        </div>
        <div style={{ fontSize:'.9rem', fontWeight:800, color:'#1C3829', marginTop:4 }}>
          Caja, cierres y control econ\u00f3mico operativo en una sola zona.
        </div>
      </div>
      <AdminAccountingTab storeId={storeId} />
    </div>
  )
}

function BusinessTab({ orders, products, storeId, onOpenOrders, onOpenStock, onOpenProducts }) {
  const [stockPulse, setStockPulse] = useState({ totalItems:0, urgentItems:0, expiredItems:0, nonPerishableItems:0, inventoryValue:0 })

  useEffect(() => {
    let cancelled = false
    async function loadStockPulse() {
      const scopedId = normalizeStoreId(storeId || DEFAULT_STORE_ID)
      const { data, error } = await supabase.from('stock_items').select('quantity, cost_per_unit, expiry_date, alert_days, deleted_at').eq('store_id', scopedId)
      if (error || cancelled) return
      const today = new Date(); today.setHours(0,0,0,0)
      const activeItems = (data || []).filter(item => !item.deleted_at)
      const nextPulse = activeItems.reduce((acc, item) => {
        const quantity = Number(item.quantity || 0)
        const costPerUnit = Number(item.cost_per_unit || 0)
        const alertDays = Math.max(0, parseInt(item.alert_days || 0, 10))
        const expiryDate = item.expiry_date ? new Date(`${item.expiry_date}T00:00:00`) : null
        acc.totalItems += 1; acc.inventoryValue += quantity * costPerUnit
        if (!expiryDate || Number.isNaN(expiryDate.getTime())) { acc.nonPerishableItems += 1; return acc }
        const daysLeft = Math.round((expiryDate - today) / 86400000)
        if (daysLeft < 0) acc.expiredItems += 1
        else if (daysLeft <= alertDays) acc.urgentItems += 1
        return acc
      }, { totalItems:0, urgentItems:0, expiredItems:0, nonPerishableItems:0, inventoryValue:0 })
      setStockPulse(nextPulse)
    }
    loadStockPulse()
    return () => { cancelled = true }
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)
  const since30 = new Date(today); since30.setDate(since30.getDate() - 30)
  const deliveredOrders = orders.filter(order => order.status === 'delivered')
  const todayOrders = deliveredOrders.filter(order => new Date(order.created_at) >= today)
  const monthOrders = deliveredOrders.filter(order => new Date(order.created_at) >= since30)
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const activeOrders = orders.filter(order => ['pending','preparing','ready','delivering'].includes(order.status)).length
  const outOfStockProducts = products.filter(product => product.out_of_stock).length

  return (
    <div style={{ display:'grid', gap:20 }}>
      <div style={{ display:'grid', gap:14 }}>
        <div style={{ background:'linear-gradient(135deg,#1C3829,#2D6A4F)', borderRadius:20, padding:'18px 20px', color:'white' }}>
          <div style={{ fontSize:'.72rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.66)' }}>Centro de negocio</div>
          <div style={{ fontSize:'1.15rem', fontWeight:900, marginTop:4 }}>Estad\u00edsticas, caja, rentabilidad y pulso de stock en una sola vista.</div>
          <div style={{ fontSize:'.78rem', color:'rgba(255,255,255,.78)', marginTop:6, lineHeight:1.6 }}>Esta pantalla deja el arranque simple: dinero real, pedidos activos, stock \u00fatil y margen del cat\u00e1logo sin saltar entre m\u00f3dulos.</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
          {[
            { label:'Hoy', value:`EUR ${todayRevenue.toFixed(2)}`, sub:`${todayOrders.length} entregados`, bg:'#DCFCE7', color:'#166534' },
            { label:'30 d\u00edas', value:`EUR ${monthRevenue.toFixed(2)}`, sub:`${monthOrders.length} entregados`, bg:'#DBEAFE', color:'#1D4ED8' },
            { label:'Pedidos en curso', value:activeOrders, sub:'cocina y reparto', bg:'#FEF3C7', color:'#92400E' },
            { label:'Productos agotados', value:outOfStockProducts, sub:'afectan venta directa', bg:'#FEE2E2', color:'#B91C1C' },
            { label:'Valor inventario', value:`EUR ${stockPulse.inventoryValue.toFixed(2)}`, sub:`${stockPulse.totalItems} art\u00edculos`, bg:'#F3E8FF', color:'#7C3AED' },
            { label:'Sin caducidad', value:stockPulse.nonPerishableItems, sub:'controlados por coste', bg:'#F3F4F6', color:'#374151' },
          ].map(card => (
            <div key={card.label} style={{ background:card.bg, borderRadius:14, padding:'12px 14px', border:`1px solid ${card.color}22` }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', color:card.color, opacity:.72 }}>{card.label}</div>
              <div style={{ fontSize:'1.38rem', fontWeight:900, color:card.color, lineHeight:1.05, marginTop:4 }}>{card.value}</div>
              <div style={{ fontSize:'.72rem', color:card.color, opacity:.74, marginTop:4 }}>{card.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
          <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:16, padding:'14px 16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#C2410C' }}>Stock conectado a caja</div>
            <div style={{ fontSize:'.9rem', fontWeight:800, color:'#7C2D12', marginTop:4 }}>{stockPulse.expiredItems} caducados y {stockPulse.urgentItems} pr\u00f3ximos a mover.</div>
            <div style={{ fontSize:'.74rem', color:'#9A3412', lineHeight:1.6, marginTop:6 }}>El stock ya no depende solo de caducidad. Tambi\u00e9n resume valor inmovilizado y ayuda a revisar costes reales.</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
              <button onClick={onOpenStock} style={{ padding:'8px 12px', borderRadius:10, border:'none', background:'#C2410C', color:'white', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Abrir stock</button>
              <button onClick={onOpenProducts} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid #FDBA74', background:'white', color:'#9A3412', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Revisar productos</button>
            </div>
          </div>
          <div style={{ background:'#F0FDF4', border:'1.5px solid #A7F3D0', borderRadius:16, padding:'14px 16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#166534' }}>Operaci\u00f3n lista para abrir</div>
            <div style={{ fontSize:'.9rem', fontWeight:800, color:'#14532D', marginTop:4 }}>Controla pedidos, caja y margen sin romper m\u00f3dulos profundos.</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
              <button onClick={onOpenOrders} style={{ padding:'8px 12px', borderRadius:10, border:'none', background:'#166534', color:'white', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Ir a pedidos</button>
              <button onClick={onOpenStock} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid #BBF7D0', background:'white', color:'#166534', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Ver alertas de stock</button>
            </div>
          </div>
        </div>
      </div>
      <section style={{ display:'grid', gap:16 }}>
        <div style={{ fontSize:'.74rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#6B7280' }}>Lectura r\u00e1pida del negocio</div>
        <StatsTab orders={orders} products={products} />
      </section>
      <section style={{ display:'grid', gap:16 }}>
        <div style={{ fontSize:'.74rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#6B7280' }}>Caja y cierres</div>
        <AdminAccountingHubTab storeId={storeId} />
      </section>
      <section style={{ display:'grid', gap:16 }}>
        <div style={{ fontSize:'.74rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#6B7280' }}>Rentabilidad y costes</div>
        <AdminFinanceTab storeId={storeId} />
      </section>
    </div>
  )
}

export default function Admin() {
  const { isPhone, isCompact } = useResponsiveAdminLayout()
  const desktopAllowed = canOpenAdminPanel()
  const desktopMeta = getDesktopAdminMeta()
  const [auth, setAuth] = useState(() => {
    const session = loadStoredSession(STORAGE_KEYS.admin)
    if (session?.role === 'admin' || session?.role === 'owner') return session
    const legacy = sessionStorage.getItem('cc_admin')
    if (legacy === '1') return OWNER_SESSION
    return false
  })
  const [loginMode,     setLoginMode]     = useState('super')
  const [username,      setUsername]      = useState('')
  const [password,      setPassword]      = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lockUntil,     setLockUntil]     = useState(0)
  const { showButton, showIOSHint, setShowIOSHint, install, getButtonLabel } = usePWAInstall({ enabled: false })
  const [tab,           setTab]           = useState('dashboard')
  const [orders,        setOrders]        = useState([])
  const [products,      setProducts]      = useState([])
  const [toppings,      setToppings]      = useState([])
  const [categories,    setCategories]    = useState([])
  const [affiliates,    setAffiliates]    = useState([])
  const [affiliateApplications, setAffiliateApplications] = useState([])
  const [coupons,       setCoupons]       = useState([])
  const [settings,      setSettings]      = useState([])
  const [storeConfig,   setStoreConfig]   = useState(null)
  const [availableStores, setAvailableStores] = useState([])
  const [activeStoreId, setActiveStoreId] = useState(() => getStoredActiveStoreId())
  const [combos,        setCombos]        = useState([])
  const [pendingEscalations, setPendingEscalations] = useState(0)
  const [loading,       setLoading]       = useState(false)
  const [navQuery,      setNavQuery]      = useState('')

  const isSuperAdmin = auth === 'super'
  const hasFullStoreAccess = isSuperAdmin || auth?.role === 'owner'
  const adminPerms   = hasFullStoreAccess ? null : auth?.permissions || []
  const can = (key) => {
    if (hasFullStoreAccess) return true
    if (!adminPerms) return false
    if (key === 'business') return adminPerms.includes('business') || ['finance','caja','stats','insights','products'].some(perm => adminPerms.includes(perm))
    if (key === 'finance') return adminPerms.includes('finance') || adminPerms.includes('caja')
    if (key === 'caja') return adminPerms.includes('caja') || adminPerms.includes('finance')
    if (key === 'wasettings') return adminPerms.includes('wasettings') || adminPerms.includes('settings')
    return adminPerms.includes(key)
  }

  useNotifPermission()

  useEffect(() => {
    let active = true

    resolveConfiguredStoreId(supabase)
      .then(nextStoreId => {
        if (!active) return
        setActiveStoreId(currentStoreId => {
          const normalizedCurrent = normalizeStoreId(currentStoreId || DEFAULT_STORE_ID)
          if (normalizedCurrent !== DEFAULT_STORE_ID) return normalizedCurrent
          return normalizeStoreId(nextStoreId || DEFAULT_STORE_ID)
        })
      })
      .catch(() => {})

    return () => { active = false }
  }, [])

  useEffect(() => { if (auth) fetchAll() }, [auth, activeStoreId])

  useEffect(() => {
    setStoredActiveStoreId(activeStoreId)
  }, [activeStoreId])

  useEffect(() => {
    if (auth) return
    let alive = true
    const scopedStoreId = normalizeStoreId(activeStoreId || DEFAULT_STORE_ID)

    Promise.all([
      loadMergedSettingsEntries(scopedStoreId, supabase).catch(() => []),
      loadStoreConfig(scopedStoreId, supabase).catch(() => null),
    ]).then(([nextSettings, nextStoreConfig]) => {
      if (!alive) return
      if (Array.isArray(nextSettings)) setSettings(nextSettings)
      setStoreConfig(nextStoreConfig)
    })

    return () => { alive = false }
  }, [auth, activeStoreId])

  useEffect(() => {
    if (!auth) return
    let alive = true
    async function refreshEscalationCount() {
      const { count, error } = await supabase.from('chatbot_conversations').select('phone', { count:'exact', head:true }).eq('resolved', false)
      if (!alive) return
      if (error) { if (!/does not exist|schema cache/i.test(String(error.message||''))) console.error('Error escalaciones chatbot:', error.message); return }
      setPendingEscalations(count || 0)
    }
    const escalationChannel = supabase.channel('chatbot-escalations-admin')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chatbot_conversations' }, payload => {
        const row = payload.new || {}
        if (row.resolved !== true) {
          const reason = row.escalation_reason || 'Cliente necesita ayuda'
          const phone = normalizePhone(row.phone || '') || row.phone || 'chat'
          notify.urgent(`Escalacion WhatsApp abierta: ${reason} \u00b7 ${phone}`)
        }
        refreshEscalationCount()
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'chatbot_conversations' }, payload => {
        const nextRow = payload.new || {}
        const prevRow = payload.old || {}
        if (nextRow.resolved !== true && prevRow.resolved === true) {
          const reason = nextRow.escalation_reason || 'Incidencia reabierta'
          const phone = normalizePhone(nextRow.phone || '') || nextRow.phone || 'chat'
          notify.urgent(`Escalacion WhatsApp reabierta: ${reason} \u00b7 ${phone}`)
        }
        refreshEscalationCount()
      })
      .subscribe()
    refreshEscalationCount()
    return () => { alive = false; supabase.removeChannel(escalationChannel) }
  }, [auth])

  useEffect(() => {
    const handler = () => setTab('products')
    window.addEventListener('nav-to-products', handler)
    return () => window.removeEventListener('nav-to-products', handler)
  }, [])

  useEffect(() => {
    if (!auth) return
    const scopedStoreId = normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)
    const seenIds = new Set(orders.map(o => o.id))
    const channel = supabase.channel('orders-realtime-admin')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'orders' }, (payload) => {
        const o = payload.new
        if (normalizeStoreId(o?.store_id || DEFAULT_STORE_ID) !== scopedStoreId) return
        if (o && !seenIds.has(o.id)) { seenIds.add(o.id); notify.newOrder(o.order_number, o.customer_name) }
        supabase.from('orders').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }).limit(100)
          .then(({ data }) => { if (data) setOrders(data) })
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders' }, payload => {
        if (normalizeStoreId(payload?.new?.store_id || payload?.old?.store_id || DEFAULT_STORE_ID) !== scopedStoreId) return
        supabase.from('orders').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }).limit(100)
          .then(({ data }) => { if (data) setOrders(data) })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [auth, activeStoreId, storeConfig?.store_code])

  async function fetchAll() {
    setLoading(true)
    const scopedStoreId = normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)
    const { data: o } = await supabase.from('orders').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }).limit(100)
    if (o) setOrders(o)
    setLoading(false)

    const [p, t, c, a, aa, s, cb, cp, storesRes] = await Promise.all([
      supabase.from('products').select('*').eq('store_id', scopedStoreId).order('sort_order'),
      supabase.from('toppings').select('*').eq('store_id', scopedStoreId).order('sort_order'),
      supabase.from('topping_categories').select('*').eq('store_id', scopedStoreId).order('sort_order'),
      supabase.from('affiliates').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }),
      supabase.from('affiliate_applications').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }),
      loadMergedSettingsEntries(scopedStoreId, supabase),
      supabase.from('combos').select('*').eq('store_id', scopedStoreId).order('sort_order'),
      supabase.from('coupons').select('*').eq('store_id', scopedStoreId).order('created_at', { ascending:false }),
      supabase.from('stores').select('id,name,code,status').order('name'),
    ])
    if (p.data)  setProducts(p.data)
    if (t.data)  setToppings(t.data)
    if (c.data)  setCategories(c.data)
    if (a.data)  setAffiliates(a.data)
    if (aa.data) setAffiliateApplications(aa.data)
    if (Array.isArray(s))  setSettings(s)
    if (cb.data) setCombos(cb.data)
    if (cp.data) setCoupons(cp.data)
    if (storesRes.data) setAvailableStores(storesRes.data)

    try {
      const nextStoreConfig = await loadStoreConfig(scopedStoreId, supabase)
      setStoreConfig(nextStoreConfig)
      if (!isSuperAdmin) {
        const localStoreId = normalizeStoreId(nextStoreConfig?.store_code || scopedStoreId)
        if (localStoreId !== activeStoreId) setActiveStoreId(localStoreId)
      }
    } catch (error) {
      const message = String(error?.message || '')
      if (!/does not exist|schema cache|relation/i.test(message)) console.error('Error cargando config_tienda:', message)
      setStoreConfig(null)
    }
  }

  async function secureLogin() {
    if (!password) return
    if (Date.now() < lockUntil) {
      const secs = Math.ceil((lockUntil - Date.now()) / 1000)
      toast.error(`Demasiados intentos. Espera ${secs}s`)
      return
    }

    setLoginLoading(true)
    try {
      if (loginMode === 'super') {
        const session = await requestAppLogin({
          scope: 'store-owner',
          storeId: normalizeStoreId(activeStoreId || DEFAULT_STORE_ID),
          password,
        })
        persistStoredSession(STORAGE_KEYS.admin, session)
        setLoginAttempts(0)
        setAuth(session)
      } else {
        const u = username.trim().toLowerCase()
        if (!u) {
          toast.error('Introduce usuario')
          setLoginLoading(false)
          return
        }
        const session = await requestAppLogin({
          scope: 'store-admin',
          storeId: normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID),
          username: u,
          password,
        })
        persistStoredSession(STORAGE_KEYS.admin, session)
        setLoginAttempts(0)
        setAuth(session)
      }
    } catch (err) {
      const next = loginAttempts + 1
      setLoginAttempts(next)
      if (next >= 5) {
        setLockUntil(Date.now() + 5*60*1000)
        toast.error('Bloqueado 5 min.')
      } else {
        toast.error(err.message || `Credenciales incorrectas (${next}/5)`)
      }
      setPassword('')
    }
    setLoginLoading(false)
  }

  function secureLogout() {
    clearStoredSession(STORAGE_KEYS.admin)
    sessionStorage.removeItem('cc_admin')
    setAuth(false)
    setPassword('')
    setUsername('')
  }

  async function login() {
    if (!password) return
    if (Date.now() < lockUntil) {
      const secs = Math.ceil((lockUntil - Date.now()) / 1000)
      toast.error(`Demasiados intentos. Espera ${secs}s`)
      return
    }
    setLoginLoading(true)
    try {
      const encoder = new TextEncoder()
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('')

      if (loginMode === 'super') {
        // Para tiendas no-default, buscar primero la contraseña en store_settings (owner password)
        const scopedForLogin = normalizeStoreId(activeStoreId || DEFAULT_STORE_ID)
        let storedHash = ''
        const { data: sd } = await supabase.from('store_settings').select('value')
          .eq('store_id', scopedForLogin).eq('key','admin_password_hash').maybeSingle()
        storedHash = sd?.value || ''
        if (!storedHash) {
          const { data: gd } = await supabase.from('settings').select('value').eq('key','admin_password_hash').maybeSingle()
          storedHash = gd?.value || ''
        }
        if (storedHash && storedHash === hashHex) {
          sessionStorage.setItem('cc_admin', JSON.stringify(OWNER_SESSION))
          setLoginAttempts(0)
          setAuth(OWNER_SESSION)
        } else {
          const next = loginAttempts + 1; setLoginAttempts(next)
          if (next >= 5) { setLockUntil(Date.now() + 5*60*1000); toast.error('Bloqueado 5 min.') }
          else toast.error(`Contrase\u00f1a incorrecta (${next}/5)`)
          setPassword('')
        }
      } else {
        const u = username.trim().toLowerCase()
        if (!u) { toast.error('Introduce usuario'); setLoginLoading(false); return }
        const { data } = await supabase.from('staff_users')
          .select('id,name,username,avatar_emoji,permissions,password_hash,active')
          .eq('store_id', normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID))
          .eq('username', u).eq('role','admin').eq('active',true).maybeSingle()
        if (!data) { toast.error('Credenciales incorrectas'); setLoginLoading(false); return }
        const match = data.password_hash?.length === 64
          ? hashHex === data.password_hash
          : data.password_hash === password
        if (!match) {
          const next = loginAttempts + 1; setLoginAttempts(next)
          if (next >= 5) { setLockUntil(Date.now() + 5*60*1000); toast.error('Bloqueado 5 min.') }
          else toast.error(`Credenciales incorrectas (${next}/5)`)
          setPassword(''); setLoginLoading(false); return
        }
        let perms = []
        if (Array.isArray(data.permissions)) perms = data.permissions
        else try { perms = JSON.parse(data.permissions||'[]') } catch {}
        const session = { id:data.id, name:data.name, username:data.username, role:'admin', avatar:data.avatar_emoji, permissions:perms }
        sessionStorage.setItem('cc_admin', JSON.stringify(session))
        setLoginAttempts(0)
        setAuth(session)
      }
    } catch (err) { toast.error('Error de conexi\u00f3n') }
    setLoginLoading(false)
  }

  function logout() {
    sessionStorage.removeItem('cc_admin')
    setAuth(false); setPassword(''); setUsername('')
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const settingsMap  = Object.fromEntries(settings.map(s => [s.key, s.value]))
  const storeProfile = buildStoreOperationalProfile(storeConfig || settingsMap)
  const activeBrand  = buildStoreBrandingSnapshot(settingsMap, storeConfig, activeStoreId)
  const navNeedle    = normalizeSearchText(navQuery)

  const isFeatureVisible = (tabId) => {
    switch (tabId) {
      case 'products':   return storeProfile.module_products_enabled
      case 'toppings':   return storeProfile.module_toppings_enabled
      case 'combos':     return storeProfile.module_combos_enabled
      case 'stock':      return storeProfile.module_stock_enabled
      case 'loyalty':    return storeProfile.module_loyalty_enabled
      case 'coupons':    return storeProfile.module_coupons_enabled
      case 'reviews':    return storeProfile.module_reviews_enabled
      case 'affiliates': return storeProfile.module_affiliates_enabled
      case 'chatbot':    return storeProfile.module_chatbot_enabled
      case 'staff':      return storeProfile.module_staff_enabled
      case 'business':   return storeProfile.module_finance_enabled
      default:           return true
    }
  }

  const NAV_HUBS = [
    { id:'operations', label:'Operaciones', icon:UI_ICONS.operations, items:[
      { id:'orders',    icon:UI_ICONS.orders,    label:'Pedidos',               badge:pendingCount, perm:'orders' },
      { id:'dashboard', icon:UI_ICONS.operations,label:'Dashboard',                                perm:'orders' },
      { id:'staff',     icon:UI_ICONS.staff,     label:'Preparaci\u00f3n y reparto',               perm:'staff' },
      { id:'business',  icon:UI_ICONS.finance,   label:'Negocio',                                  perm:'business' },
    ]},
    { id:'catalog', label:'Cat\u00e1logo', icon:UI_ICONS.products, items:[
      { id:'products',  icon:UI_ICONS.products,  label:'Productos',                                perm:'products' },
      { id:'toppings',  icon:UI_ICONS.toppings,  label:'Toppings',                                 perm:'toppings' },
      { id:'combos',    icon:UI_ICONS.combos,    label:'Combos',                                   perm:'combos' },
      { id:'stock',     icon:UI_ICONS.stock,     label:'Stock y costes',                           perm:'products' },
    ]},
    { id:'growth', label:'Crecimiento', icon:UI_ICONS.loyalty, items:[
      { id:'chatbot',   icon:UI_ICONS.chatbot,   label:'Centro WhatsApp y AI', badge:pendingEscalations, perm:'wasettings' },
      { id:'loyalty',   icon:UI_ICONS.loyalty,   label:'Club y fidelidad',                         perm:'coupons' },
      { id:'coupons',   icon:UI_ICONS.coupons,   label:'Cupones',                                  perm:'coupons' },
      { id:'reviews',   icon:UI_ICONS.reviews,   label:'Rese\u00f1as',                             perm:'coupons' },
      { id:'affiliates',icon:UI_ICONS.affiliates,label:'Afiliados',                                perm:'coupons' },
    ]},
    { id:'system', label:'Sistema', icon:UI_ICONS.settings, items:[
      { id:'settings',  icon:UI_ICONS.settings,  label:'Ajustes',                                  perm:'settings' },
    ]},
  ].map(g => ({
    ...g,
    items: g.items
      .filter(t => isFeatureVisible(t.id))
      .filter(t => can(t.perm))
      .filter(t => !navNeedle || normalizeSearchText(`${g.label} ${t.label} ${t.id}`).includes(navNeedle)),
  })).filter(g => g.items.length > 0)

  const visibleHubs = NAV_HUBS

  useEffect(() => {
    const legacyTabMap = { finance:'business', caja:'business', stats:'business', insights:'business', pwa:'chatbot', wasettings:'chatbot' }
    const nextTab = legacyTabMap[tab]
    if (nextTab) { setTab(nextTab); return }
    const isVisible = visibleHubs.some(hub => hub.items.some(item => item.id === tab))
    if (!isVisible && visibleHubs[0]?.items[0]?.id) setTab(visibleHubs[0].items[0].id)
  }, [tab, visibleHubs])

  if (!auth) return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <img src="/logo.png" alt={activeBrand.businessName} className={styles.loginLogo} />
        <h1 className={styles.loginTitle}>{activeBrand.businessName}</h1>
        <p className={styles.loginSub}>
          {activeBrand.tagline || activeBrand.locationLabel || 'Panel administrativo independiente de esta tienda.'}
        </p>
        <div style={{ marginBottom: 14, fontSize: '.68rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B7280' }}>
          {normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)}
        </div>
        {desktopMeta?.shell && (
          <div style={{ marginBottom:12, background:'#F3F4F6', border:'1.5px solid #E5E7EB', borderRadius:12, padding:'9px 12px', fontSize:'.76rem', color:'#4B5563', fontWeight:700 }}>
            Ejecut\u00e1ndose en app desktop {desktopMeta.version ? `v${desktopMeta.version}` : ''} \u00b7 {desktopMeta.shell}
          </div>
        )}
        <div style={{ display:'flex', gap:6, marginBottom:18, background:'#F3F4F6', borderRadius:10, padding:4 }}>
          {[['super',`${UI_ICONS.owner} Propietaria`],['staff',`${UI_ICONS.admin} Admin`]].map(([m,l]) => (
            <button key={m} onClick={()=>{setLoginMode(m);setPassword('');setUsername('')}}
              style={{ flex:1, padding:'7px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                background:loginMode===m?'#1C3829':'transparent',
                color:loginMode===m?'white':'#6B7280', fontWeight:800, fontSize:'.82rem' }}>{l}</button>
          ))}
        </div>
        {Date.now() < lockUntil && (
          <div style={{ background:'#FEE2E2', color:'#991B1B', borderRadius:10, padding:'10px 14px', fontSize:'.82rem', fontWeight:700, marginBottom:12 }}>
            {UI_ICONS.lock} Bloqueado por intentos fallidos. Espera unos minutos.
          </div>
        )}
        {loginMode === 'staff' && (
          <input className={styles.loginInput} placeholder="Usuario"
            value={username} onChange={e=>setUsername(e.target.value)}
            autoCapitalize="none" autoCorrect="off" autoComplete="username"
            onKeyDown={e=>e.key==='Enter'&&!loginLoading&&secureLogin()} />
        )}
        <input type="password" className={styles.loginInput} placeholder="Contrase\u00f1a"
          value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!loginLoading&&secureLogin()}
          autoFocus={loginMode==='super'} disabled={loginLoading||Date.now()<lockUntil}
          autoComplete="current-password"
          data-testid="store-admin-password" />
        <button className={styles.loginBtn} onClick={secureLogin} disabled={loginLoading||Date.now()<lockUntil}
          data-testid="store-admin-login-button">
          {loginLoading ? `${UI_ICONS.hourglass} Verificando...` : 'Entrar'}
        </button>
        {showButton && (
          <button onClick={install}
            style={{ width:'100%', padding:'11px', marginTop:10, background:'transparent',
              border:'2px dashed #40916C', borderRadius:12, color:'#2D6A4F',
              fontFamily:'inherit', fontSize:'.88rem', fontWeight:700, cursor:'pointer' }}>
            {UI_ICONS.pwa} {getButtonLabel()}
          </button>
        )}
      </div>
    </div>
  )

  const activeHubId = visibleHubs.find(hub => hub.items.some(item => item.id === tab))?.id || visibleHubs[0]?.id
  const activeHub = visibleHubs.find(hub => hub.id === activeHubId) || null
  const TAB_META = {
    dashboard:  { title:'Dashboard operativo', desc:'Controla el d\u00eda en vivo y act\u00faa r\u00e1pido sobre pedidos urgentes.' },
    orders:     { title:'Pedidos', desc:'Gestiona pedidos, estados, tickets y comunicaci\u00f3n con cocina o reparto.' },
    business:   { title:'Negocio', desc:'Fusiona estad\u00edsticas, contabilidad y rentabilidad en una sola lectura operativa.' },
    products:   { title:'Productos', desc:'Edita cat\u00e1logo, precios y disponibilidad.' },
    toppings:   { title:'Toppings', desc:'Crea categor\u00edas y toppings para personalizaci\u00f3n.' },
    combos:     { title:'Combos', desc:'Configura combos y sus reglas.' },
    stock:      { title:'Stock y costes', desc:'Controla ingredientes, caducidad y valor de inventario.' },
    loyalty:    { title:'Club y fidelidad', desc:'Gestiona niveles y miembros del club.' },
    reviews:    { title:'Rese\u00f1as', desc:'Valida y organiza rese\u00f1as para reforzar confianza.' },
    affiliates: { title:'Afiliados', desc:'Controla accesos, solicitudes y seguimiento del canal afiliado.' },
    coupons:    { title:'Cupones', desc:'Gestiona descuentos y promociones activas.' },
    chatbot:    { title:'Centro WhatsApp y AI', desc:'Gestiona conexi\u00f3n, plantillas, reglas, IA y escalaciones.' },
    staff:      { title:'Preparaci\u00f3n y reparto', desc:'Revisa el equipo, disponibilidad y estructura operativa.' },
    settings:   { title:'Ajustes generales', desc:'Configura par\u00e1metros globales del negocio.' },
  }
  const activeTabMeta = TAB_META[tab] || { title: activeHub?.label || 'M\u00f3dulo', desc:'Gestiona este m\u00f3dulo con una vista m\u00e1s clara y contextual.' }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/logo.png" alt={isSuperAdmin ? SUPER_ADMIN_BRAND.name : activeBrand.businessName} className={styles.headerLogo} />
        <div>
          <h1 className={styles.headerTitle}>{isSuperAdmin ? `${SUPER_ADMIN_BRAND.name} Control` : 'Panel de tienda'}</h1>
          <p className={styles.headerSub}>{activeBrand.businessName}</p>
        </div>
        <div className={styles.headerSpacer} />
        {isSuperAdmin && availableStores.length > 0 && (
          <select value={activeStoreId} onChange={event => setActiveStoreId(event.target.value)}
            style={{ flexShrink:0, minWidth:220, padding:'8px 12px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.1)', color:'white', fontWeight:800, fontFamily:'inherit' }}>
            {availableStores.map(store => (
              <option key={store.id} value={store.id} style={{ color:'#1C3829' }}>{store.name} \u00b7 {store.code}</option>
            ))}
          </select>
        )}
        {!isSuperAdmin && (
          <div style={{ fontSize:'.75rem', color:'rgba(255,255,255,.7)', fontWeight:700, flexShrink:0 }}>
            {auth.avatar || UI_ICONS.admin} {auth.name}
          </div>
        )}
        <EmergencyButton settingsMap={settingsMap} storeId={normalizeStoreId(activeStoreId || DEFAULT_STORE_ID)} onRefresh={fetchAll} />
        {pendingCount > 0 && (
          <button onClick={() => setTab('dashboard')} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:10, background:'rgba(220,38,38,0.18)', border:'1.5px solid rgba(220,38,38,0.45)', color:'#FCA5A5', fontWeight:900, fontSize:'.76rem', fontFamily:'inherit', cursor:'pointer', animation:'pendingAlertPulse 2s ease infinite' }}>
            {UI_ICONS.hourglass} {pendingCount} pendiente{pendingCount>1?'s':''}
          </button>
        )}
        <style>{`@keyframes pendingAlertPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}50%{box-shadow:0 0 0 5px rgba(220,38,38,0.2)}}`}</style>
        {isSuperAdmin && (
          <a href={OXIDIAN_ENTRY_PATH} className={styles.viewSiteBtn} style={{ background:'rgba(99,102,241,0.15)', borderColor:'rgba(99,102,241,0.35)' }}>\u29e1 OXIDIAN</a>
        )}
        <a href={activeStoreId && activeStoreId !== DEFAULT_STORE_ID ? `/pedidos?store=${encodeURIComponent(activeStoreId)}` : '/pedidos'}    className={styles.viewSiteBtn} style={{ background:'rgba(74,124,98,0.2)', borderColor:'rgba(74,124,98,0.4)' }}>{UI_ICONS.orders} Cocina</a>
        <a href={activeStoreId && activeStoreId !== DEFAULT_STORE_ID ? `/repartidor?store=${encodeURIComponent(activeStoreId)}` : '/repartidor'} className={styles.viewSiteBtn} style={{ background:'rgba(184,149,90,0.15)', borderColor:'rgba(184,149,90,0.3)' }}>{UI_ICONS.rider} Repartidor</a>
        <a href={activeStoreId && activeStoreId !== DEFAULT_STORE_ID ? `/menu?store=${encodeURIComponent(activeStoreId)}` : '/menu'}       className={styles.viewSiteBtn}>{UI_ICONS.shop} Tienda</a>
        <button onClick={secureLogout} style={{ flexShrink:0, padding:'6px 10px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:9, fontSize:'.68rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Salir
        </button>
        <span style={{ fontSize:'.6rem', color:'rgba(255,255,255,0.3)', flexShrink:0 }}>v4.1</span>
      </header>

      <div className={styles.adminTopbar}>
        <input value={navQuery} onChange={e => setNavQuery(e.target.value)}
          placeholder="Buscar apartado: pedidos, productos, chatbot..."
          style={{ flex:'1 1 260px', minWidth:isPhone?0:180, padding:'10px 14px', borderRadius:12, border:'1.5px solid #E5E7EB', background:'#F9FAFB', fontFamily:'inherit', fontSize:'.84rem', fontWeight:700, color:'#1C3829' }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', width:isPhone?'100%':'auto' }}>
          {[
            { id:'dashboard', label:`${UI_ICONS.operations} Dashboard` },
            { id:'orders',    label:`${UI_ICONS.orders} Pedidos` },
            { id:'business',  label:`${UI_ICONS.finance} Negocio` },
            { id:'products',  label:`${UI_ICONS.products} Productos` },
            { id:'chatbot',   label:`${UI_ICONS.chatbot} Chatbot` },
          ].filter(t => visibleHubs.some(g => g.items.some(i => i.id === t.id))).map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{ padding:'7px 12px', borderRadius:999, border:'1.5px solid #E5E7EB', background:tab===t.id?'#1C3829':'white', color:tab===t.id?'white':'#374151', fontSize:'.75rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <nav className={styles.tabs}>
        {visibleHubs.map(hub => (
          <button key={hub.id}
            className={`${styles.tab} ${activeHubId===hub.id?styles.tabActive:''}`}
            onClick={() => hub.items[0] && setTab(hub.items[0].id)}>
            {hub.icon} {hub.label}
          </button>
        ))}
      </nav>

      <div className={styles.adminBody}>
        <aside className={styles.sidebar}>
          {navQuery && visibleHubs.length === 0 && (
            <div style={{ padding:'12px 10px', fontSize:'.78rem', color:'#9CA3AF', fontWeight:700 }}>Sin resultados para "{navQuery}"</div>
          )}
          {visibleHubs.map(hub => (
            <div key={hub.id}>
              <div className={styles.sidebarGroup}>{hub.label}</div>
              <button
                data-testid={`admin-sidebar-hub-${hub.id}`}
                className={`${styles.sidebarTab} ${activeHubId===hub.id?styles.sidebarTabActive:''}`}
                onClick={() => hub.items[0] && setTab(hub.items[0].id)}>
                <span>{hub.icon}</span>
                <span>{hub.label}</span>
                {hub.items.some(item => item.badge > 0) && (
                  <span className={styles.sidebarBadge}>{hub.items.reduce((total, item) => total + (item.badge||0), 0)}</span>
                )}
              </button>
              {activeHubId === hub.id && (
                <div style={{ display:'grid', gap:6, margin:'6px 0 14px', paddingLeft:10 }}>
                  {hub.items.map(t => (
                    <button key={t.id}
                      data-testid={`admin-tab-${t.id}`}
                      className={`${styles.sidebarTab} ${tab===t.id?styles.sidebarTabActive:''}`}
                      onClick={() => setTab(t.id)}
                      style={{ minHeight:38, padding:'8px 12px', fontSize:'.78rem' }}>
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                      {t.badge > 0 && <span className={styles.sidebarBadge}>{t.badge}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        <main className={styles.content}>
          {activeHub && (
            <section className={styles.moduleHero}>
              <div className={styles.moduleHeroMain}>
                <div className={styles.moduleEyebrow}>{activeHub.icon} {activeHub.label}</div>
                <div className={styles.moduleTitle}>{activeTabMeta.title}</div>
                <p className={styles.moduleDesc}>{activeTabMeta.desc}</p>
              </div>
            </section>
          )}

          {tab === 'dashboard'  && <AdminDashboardTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} orders={orders} products={products} settings={settingsMap} onStatusChange={async (orderId, newStatus) => {
            const order = orders.find(o => o.id === orderId)
            if (!order) return
            const { error } = await supabase.from('orders').update(buildOrderStatusUpdate(order, newStatus)).eq('id', orderId)
            if (error) { toast.error('Error al actualizar estado'); return }
            toast.success(`Pedido → ${newStatus}`)
            const result = await sendWhatsAppAuto(order, newStatus)
            if (result.sent) toast.success('WhatsApp enviado ✓', { id: `wa-${orderId}` })
            fetchAll()
          }} />}

          {tab === 'orders' && (
            <div style={{ display:'grid', gap:18 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10 }}>
                {['pending','preparing','delivering','delivered'].map(status => {
                  const statusOrders = orders.filter(o => o.status === status)
                  const colors = { pending:'#D97706', preparing:'#7C3AED', delivering:'#0369A1', delivered:'#166534' }
                  const labels = { pending:'⏳ Pendientes', preparing:'👨‍🍳 Preparando', delivering:'🛵 En camino', delivered:'✅ Entregados hoy' }
                  const todayOrders = status === 'delivered' ? statusOrders.filter(o => new Date(o.created_at) >= (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()) : statusOrders
                  return (
                    <div key={status} style={{ background:'white', border:`1.5px solid ${colors[status]}33`, borderRadius:16, padding:'14px 16px' }}>
                      <div style={{ fontSize:'.72rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.08em', color:colors[status], marginBottom:8 }}>{labels[status]} · {todayOrders.length}</div>
                      <div style={{ display:'grid', gap:8, maxHeight:320, overflowY:'auto' }}>
                        {todayOrders.length === 0 && <div style={{ fontSize:'.8rem', color:'#9CA3AF', fontWeight:700 }}>Sin pedidos</div>}
                        {todayOrders.slice(0,10).map(order => {
                          const ticket = buildAdminTicket(order)
                          return (
                            <div key={order.id} style={{ background:'#F9FAFB', borderRadius:12, padding:'10px 12px', border:'1px solid #E5E7EB' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                <span style={{ fontWeight:900, fontSize:'.82rem', color:'#1C3829' }}>#{order.order_number || order.id?.slice(0,6).toUpperCase()}</span>
                                <span style={{ fontSize:'.72rem', color:'#6B7280', fontWeight:700 }}>{new Date(order.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</span>
                              </div>
                              <div style={{ fontSize:'.78rem', color:'#374151', fontWeight:700, marginTop:4 }}>{order.customer_name || 'Cliente'}</div>
                              <div style={{ fontSize:'.76rem', color:'#6B7280', marginTop:2 }}>{order.delivery_address || order.address || '—'}</div>
                              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                                {status === 'pending' && <button onClick={async () => { const { error } = await supabase.from('orders').update(buildOrderStatusUpdate(order,'preparing')).eq('id',order.id); if (!error) { toast.success('En preparación'); sendWhatsAppAuto(order,'preparing'); fetchAll() } else toast.error('Error') }} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#7C3AED', color:'white', fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:'.72rem' }}>▶ Preparar</button>}
                                {status === 'preparing' && <button onClick={async () => { const { error } = await supabase.from('orders').update(buildOrderStatusUpdate(order,'delivering')).eq('id',order.id); if (!error) { toast.success('En camino'); sendWhatsAppAuto(order,'delivering'); fetchAll() } else toast.error('Error') }} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#0369A1', color:'white', fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:'.72rem' }}>🛵 En camino</button>}
                                {status === 'delivering' && <button onClick={async () => { const { error } = await supabase.from('orders').update(buildOrderStatusUpdate(order,'delivered')).eq('id',order.id); if (!error) { toast.success('Entregado ✓'); sendWhatsAppAuto(order,'delivered'); fetchAll() } else toast.error('Error') }} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#166534', color:'white', fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:'.72rem' }}>✅ Entregado</button>}
                                <span style={{ marginLeft:'auto', fontWeight:900, color:colors[status], fontSize:'.82rem' }}>€{Number(order.total||0).toFixed(2)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'business'   && <BusinessTab orders={orders} products={products} storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} onOpenOrders={() => setTab('orders')} onOpenStock={() => setTab('stock')} onOpenProducts={() => setTab('products')} />}
          {tab === 'products'   && <AdminProductsTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} products={products} toppings={toppings} toppingCategories={categories} settings={settings} onRefresh={fetchAll} />}
          {tab === 'toppings'   && <AdminToppingsTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} toppings={toppings} categories={categories} onRefresh={fetchAll} />}
          {tab === 'combos'     && <AdminCombosTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} combos={combos} products={products} toppings={toppings} toppingCategories={categories} onRefresh={fetchAll} parseSlots={parseSlots} />}
          {tab === 'stock'      && <AdminStockTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} />}
          {tab === 'loyalty'    && <AdminLoyaltyTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} />}
          {tab === 'reviews'    && <AdminReviewsTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} />}
          {tab === 'affiliates' && <AdminAffiliatesTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} affiliates={affiliates} applications={affiliateApplications} coupons={coupons} menuLink={buildAffiliateMenuLink(settingsMap)} onRefresh={fetchAll} />}
          {tab === 'coupons'    && <AdminCouponsTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} coupons={coupons} onRefresh={fetchAll} />}
          {tab === 'chatbot'    && <AdminChatbotTab
            storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)}
            settings={settingsMap}
            onRefresh={fetchAll}
            capabilityScope={isSuperAdmin ? 'oxidian' : 'store'}
          />}
          {tab === 'staff'      && <AdminStaffTab storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)} onRefresh={fetchAll} />}
          {tab === 'settings'   && (
            <AdminStoreCustomizationPanel
              storeId={normalizeStoreId(activeStoreId || storeConfig?.store_code || DEFAULT_STORE_ID)}
              onSaved={fetchAll}
              capabilityScope={isSuperAdmin ? 'oxidian' : 'store'}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatsTab({ orders, products }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const since7  = new Date(today); since7.setDate(since7.getDate() - 7)
  const since30 = new Date(today); since30.setDate(since30.getDate() - 30)

  const delivered = orders.filter(o => o.status === 'delivered')
  const todayDelivered  = delivered.filter(o => new Date(o.created_at) >= today)
  const week7Delivered  = delivered.filter(o => new Date(o.created_at) >= since7)
  const month30Delivered= delivered.filter(o => new Date(o.created_at) >= since30)

  const revenue7  = week7Delivered.reduce((s, o) => s + Number(o.total || 0), 0)
  const revenue30 = month30Delivered.reduce((s, o) => s + Number(o.total || 0), 0)
  const avgTicket = week7Delivered.length ? revenue7 / week7Delivered.length : 0

  const productFreq = {}
  delivered.forEach(o => {
    try {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])
      items.forEach(item => {
        const name = item.product_name || item.name || 'Producto'
        productFreq[name] = (productFreq[name] || 0) + (item.quantity || 1)
      })
    } catch {}
  })
  const topProducts = Object.entries(productFreq).sort((a,b) => b[1]-a[1]).slice(0,5)

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
        {[
          { label:'Hoy entregados', value:todayDelivered.length, color:'#166534', bg:'#DCFCE7' },
          { label:'7 días pedidos', value:week7Delivered.length, color:'#1D4ED8', bg:'#DBEAFE' },
          { label:'7 días ingresos', value:`€${revenue7.toFixed(2)}`, color:'#166534', bg:'#F0FDF4' },
          { label:'30 días ingresos', value:`€${revenue30.toFixed(2)}`, color:'#7C3AED', bg:'#F3E8FF' },
          { label:'Ticket medio (7d)', value:`€${avgTicket.toFixed(2)}`, color:'#92400E', bg:'#FEF3C7' },
          { label:'Productos catálogo', value:products.length, color:'#374151', bg:'#F3F4F6' },
        ].map(card => (
          <div key={card.label} style={{ background:card.bg, borderRadius:14, padding:'12px 14px', border:`1px solid ${card.color}22` }}>
            <div style={{ fontSize:'.68rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', color:card.color, opacity:.7 }}>{card.label}</div>
            <div style={{ fontSize:'1.32rem', fontWeight:900, color:card.color, marginTop:4 }}>{card.value}</div>
          </div>
        ))}
      </div>
      {topProducts.length > 0 && (
        <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:16, padding:'14px 16px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.08em', color:'#6B7280', marginBottom:10 }}>Productos más pedidos (histórico)</div>
          <div style={{ display:'grid', gap:8 }}>
            {topProducts.map(([name, count], i) => (
              <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:22, height:22, borderRadius:8, background:'#1C382911', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'.72rem', color:'#1C3829' }}>{i+1}</span>
                  <span style={{ fontWeight:800, fontSize:'.84rem', color:'#1C3829' }}>{name}</span>
                </div>
                <span style={{ fontWeight:900, fontSize:'.82rem', color:'#40916C' }}>{count} uds</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmergencyButton({ settingsMap, storeId, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const isEmergency = Boolean(settingsMap?.emergency_msg)
  const scopedId = storeId || DEFAULT_STORE_ID

  async function toggle() {
    setLoading(true)
    try {
      if (isEmergency) {
        await upsertScopedSetting('emergency_msg', '', scopedId, supabase)
        toast.success('Emergencia desactivada')
      } else {
        const msg = window.prompt('Mensaje de emergencia (visible en el menú):')
        if (!msg) { setLoading(false); return }
        await upsertScopedSetting('emergency_msg', msg, scopedId, supabase)
        toast.success('Emergencia activada ⚠️')
      }
      onRefresh()
    } catch (err) {
      toast.error('Error al cambiar estado de emergencia')
    }
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}
      style={{ flexShrink:0, padding:'6px 12px', borderRadius:10, border:`1.5px solid ${isEmergency ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.15)'}`, background: isEmergency ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.08)', color: isEmergency ? '#FCA5A5' : 'rgba(255,255,255,0.6)', fontWeight:800, fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit' }}>
      {loading ? '...' : isEmergency ? '🚨 Emergencia ON' : '⚠️ Emergencia'}
    </button>
  )
}
