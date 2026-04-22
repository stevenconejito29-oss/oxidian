import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { normalizeSurpriseGiftLevel } from './clubGift'
import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'
import {
  normalizeLevelRecord,
  normalizeVisitorLevel,
  isMissingLoyaltySlug,
  isMissingStoreScope,
} from './loyaltyScope'

function detectSource() {
  try {
    const ua = navigator.userAgent || ''
    const ref = document.referrer || ''
    const url = new URLSearchParams(window.location.search)
    const utm = url.get('utm_source') || ''
    if (/instagram/i.test(ua) || /instagram\.com/i.test(ref) || /instagram/i.test(utm)) return 'instagram'
    if (/facebook|fb/i.test(ua)) return 'facebook'
    if (/whatsapp/i.test(ua)) return 'whatsapp'
    if (/tiktok/i.test(ua)) return 'tiktok'
    if (ref && !ref.includes(location.hostname)) return 'referral'
    return 'direct'
  } catch {
    return 'direct'
  }
}

function getVisitorId(storeId = DEFAULT_STORE_ID) {
  try {
    const storageKey = `oxidian_vid_${normalizeStoreId(storeId)}`
    let visitorId = localStorage.getItem(storageKey)
    if (!visitorId) {
      visitorId = crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2)
      localStorage.setItem(storageKey, visitorId)
    }
    return visitorId
  } catch {
    return 'anon_' + Date.now()
  }
}

export const DEFAULT_LEVELS = [
  {
    id: 'hierro', label: 'Hierro', emoji: '⚙️', color: '#6B7280', min_orders: 0,
    reward_text: 'Bienvenido al club', discount_percent: 0,
    badge_text: 'Base', benefits: ['Acceso al club', 'Seguimiento de progreso'], free_delivery: false, priority_delivery: false,
    free_topping: false, exclusive_menu: false, surprise_gift: false, surprise_gift_type: '', surprise_gift_item_id: '', surprise_gift_every_orders: 0, surprise_gift_note: '', birthday_reward_text: '', unlock_message: 'Empieza a sumar pedidos para desbloquear recompensas.',
  },
  {
    id: 'bronce', label: 'Bronce', emoji: '🥉', color: '#CD7F32', min_orders: 1,
    reward_text: 'Primer pedido y sabores exclusivos', discount_percent: 0,
    badge_text: 'Nuevo', benefits: ['Sabores exclusivos', 'Promos antes que nadie'], free_delivery: false, priority_delivery: false,
    free_topping: false, exclusive_menu: true, surprise_gift: false, surprise_gift_type: '', surprise_gift_item_id: '', surprise_gift_every_orders: 0, surprise_gift_note: '', birthday_reward_text: 'Detalle especial en tu cumpleanos', unlock_message: 'Ya entras en la rueda de promos del club.',
  },
  {
    id: 'plata', label: 'Plata', emoji: '🥈', color: '#A8A9AD', min_orders: 3,
    reward_text: '5% de descuento en todos tus pedidos', discount_percent: 5,
    badge_text: 'Ahorro', benefits: ['5% automatico', 'Mejores recompensas'], free_delivery: false, priority_delivery: false,
    free_topping: true, exclusive_menu: true, surprise_gift: false, surprise_gift_type: '', surprise_gift_item_id: '', surprise_gift_every_orders: 0, surprise_gift_note: '', birthday_reward_text: 'Topping premium gratis en tu cumpleanos', unlock_message: 'Desbloqueaste ahorro fijo y topping gratis.',
  },
  {
    id: 'oro', label: 'Oro', emoji: '🥇', color: '#D4AF37', min_orders: 7,
    reward_text: '10% de descuento y prioridad de entrega', discount_percent: 10,
    badge_text: 'VIP', benefits: ['10% automatico', 'Prioridad de entrega'], free_delivery: false, priority_delivery: true,
    free_topping: true, exclusive_menu: true, surprise_gift: false, surprise_gift_type: '', surprise_gift_item_id: '', surprise_gift_every_orders: 0, surprise_gift_note: '', birthday_reward_text: 'Postre mini gratis por cumpleanos', unlock_message: 'Ahora tus pedidos suben de prioridad.',
  },
  {
    id: 'diamante', label: 'Diamante', emoji: '💎', color: '#7DD3FC', min_orders: 15,
    reward_text: '15% descuento y delivery gratis siempre', discount_percent: 15,
    badge_text: 'Elite', benefits: ['15% automatico', 'Delivery gratis', 'Prioridad total'], free_delivery: true, priority_delivery: true,
    free_topping: true, exclusive_menu: true, surprise_gift: false, surprise_gift_type: '', surprise_gift_item_id: '', surprise_gift_every_orders: 0, surprise_gift_note: '', birthday_reward_text: 'Regalo premium de cumpleanos', unlock_message: 'Nivel elite activo. Tienes el pack completo del club.',
  },
]

function computeLevel(orders, levels) {
  const sorted = [...levels].sort((a, b) => Number(b.min_orders || 0) - Number(a.min_orders || 0))
  return sorted.find(level => orders >= Number(level.min_orders || 0)) || levels[0] || DEFAULT_LEVELS[0]
}

function getLocalState(storeId = DEFAULT_STORE_ID) {
  try {
    const state = localStorage.getItem(`oxidian_loyalty_local_${normalizeStoreId(storeId)}`)
    return state ? JSON.parse(state) : { order_count: 0, total_spent: 0, level: 'hierro' }
  } catch {
    return { order_count: 0, total_spent: 0, level: 'hierro' }
  }
}

function saveLocalState(storeId, state) {
  try {
    localStorage.setItem(`oxidian_loyalty_local_${normalizeStoreId(storeId)}`, JSON.stringify(state))
  } catch {}
}

async function loadStoreLevels(storeId) {
  const selectVariants = [
    { columns: 'id,slug,store_id,label,emoji,color,min_orders,reward_text,discount_percent,active,sort_order,badge_text,benefits,free_delivery,priority_delivery,free_topping,exclusive_menu,surprise_gift,surprise_gift_type,surprise_gift_item_id,surprise_gift_every_orders,surprise_gift_note,birthday_reward_text,unlock_message', scoped: true },
    { columns: 'id,store_id,label,emoji,color,min_orders,reward_text,discount_percent,active,sort_order,badge_text,benefits,free_delivery,priority_delivery,free_topping,exclusive_menu,surprise_gift,surprise_gift_type,surprise_gift_item_id,surprise_gift_every_orders,surprise_gift_note,birthday_reward_text,unlock_message', scoped: true },
    { columns: 'id,label,emoji,color,min_orders,reward_text,discount_percent,active,sort_order,badge_text,benefits,free_delivery,priority_delivery,free_topping,exclusive_menu,surprise_gift,surprise_gift_type,surprise_gift_item_id,surprise_gift_every_orders,surprise_gift_note,birthday_reward_text,unlock_message', scoped: false },
  ]

  for (const variant of selectVariants) {
    let query = supabase
      .from('loyalty_rewards')
      .select(variant.columns)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('min_orders', { ascending: true })

    if (variant.scoped) query = query.eq('store_id', storeId)

    const { data, error } = await query
    if (error) {
      if (isMissingStoreScope(error) || isMissingLoyaltySlug(error)) continue
      return []
    }

    const normalizedLevels = (Array.isArray(data) ? data : [])
      .map(level => normalizeLevelRecord(level, storeId))
      .filter(Boolean)
      .map(level => normalizeSurpriseGiftLevel({
        ...level,
        benefits: Array.isArray(level.benefits) ? level.benefits.filter(Boolean) : [],
        free_delivery: level.free_delivery === true,
        priority_delivery: level.priority_delivery === true,
        free_topping: level.free_topping === true,
        exclusive_menu: level.exclusive_menu === true,
        surprise_gift: level.surprise_gift === true,
        birthday_reward_text: level.birthday_reward_text || '',
        unlock_message: level.unlock_message || '',
      }))

    if (normalizedLevels.length > 0) return normalizedLevels
  }

  return []
}

async function fetchVisitorRecord(visitorId, storeId) {
  const scoped = await supabase
    .from('visitors')
    .select('*')
    .eq('visitor_id', visitorId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!scoped.error) return scoped.data
  if (!isMissingStoreScope(scoped.error)) throw scoped.error

  const legacy = await supabase
    .from('visitors')
    .select('*')
    .eq('visitor_id', visitorId)
    .maybeSingle()

  if (legacy.error) throw legacy.error
  return legacy.data
}

async function updateVisitorRecord(visitorId, storeId, updates) {
  let query = supabase
    .from('visitors')
    .update(updates)
    .eq('visitor_id', visitorId)
    .eq('store_id', storeId)
    .select()
    .single()

  let response = await query
  if (!response.error) return response.data
  if (!isMissingStoreScope(response.error)) throw response.error

  response = await supabase
    .from('visitors')
    .update(updates)
    .eq('visitor_id', visitorId)
    .select()
    .single()

  if (response.error) throw response.error
  return response.data
}

async function insertVisitorRecord(storeId, payload) {
  const scopedPayload = { ...payload, store_id: storeId }
  let response = await supabase.from('visitors').insert(scopedPayload).select().single()
  if (!response.error) return response.data
  if (!isMissingStoreScope(response.error)) throw response.error

  const { store_id: _omitStoreId, ...legacyPayload } = scopedPayload
  response = await supabase.from('visitors').insert(legacyPayload).select().single()
  if (response.error) throw response.error
  return response.data
}

export function useLoyalty({ phone, storeId = DEFAULT_STORE_ID } = {}) {
  const activeStoreId = normalizeStoreId(storeId)
  const [visitorId] = useState(() => getVisitorId(activeStoreId))
  const [source] = useState(detectSource)
  const [visitor, setVisitor] = useState(null)
  const [levels, setLevels] = useState(DEFAULT_LEVELS)
  const [loading, setLoading] = useState(true)
  const [useLocal, setUseLocal] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadStoreLevels(activeStoreId)
      .then(data => {
        if (!cancelled && data.length > 0) setLevels(data)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [activeStoreId])

  useEffect(() => {
    let cancelled = false

    async function trackVisit() {
      try {
        const existing = await fetchVisitorRecord(visitorId, activeStoreId)
        if (existing) {
          const updates = {
            last_seen: new Date().toISOString(),
            visit_count: Number(existing.visit_count || 0) + 1,
            level: normalizeVisitorLevel(existing.level) || 'hierro',
          }
          if (phone && !existing.phone) updates.phone = phone

          const updated = await updateVisitorRecord(visitorId, activeStoreId, updates)
          if (!cancelled && updated) {
            setVisitor({ ...updated, level: normalizeVisitorLevel(updated.level) || 'hierro' })
          }
        } else {
          const created = await insertVisitorRecord(activeStoreId, {
            visitor_id: visitorId,
            source,
            phone: phone || null,
            visit_count: 1,
            order_count: 0,
            total_spent: 0,
            level: 'hierro',
          })

          if (!cancelled && created) {
            setVisitor({ ...created, level: normalizeVisitorLevel(created.level) || 'hierro' })
          }
        }
      } catch {
        if (!cancelled) {
          setUseLocal(true)
          const local = getLocalState(activeStoreId)
          setVisitor({ ...local, level: normalizeVisitorLevel(local.level) || 'hierro', visitor_id: visitorId, source })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    trackVisit()
    return () => { cancelled = true }
  }, [activeStoreId, phone, source, visitorId])

  const linkPhone = useCallback(async (phoneNumber) => {
    if (!phoneNumber) return
    try {
      await updateVisitorRecord(visitorId, activeStoreId, { phone: phoneNumber })
    } catch {}
    setVisitor(current => (current ? { ...current, phone: current.phone || phoneNumber } : current))
  }, [activeStoreId, visitorId])

  const trackOrder = useCallback(async (orderTotal = 0, phoneNumber = null) => {
    const normalizedPhone = phoneNumber || null

    if (useLocal) {
      const local = getLocalState(activeStoreId)
      const updated = {
        ...local,
        order_count: Number(local.order_count || 0) + 1,
        total_spent: parseFloat(local.total_spent || 0) + parseFloat(orderTotal || 0),
        level: computeLevel(Number(local.order_count || 0) + 1, levels).id,
      }
      saveLocalState(activeStoreId, updated)
      setVisitor(current => ({ ...current, ...updated }))
      return
    }

    try {
      const current = await fetchVisitorRecord(visitorId, activeStoreId)

      if (current) {
        const newCount = Number(current.order_count || 0) + 1
        const newSpent = parseFloat(current.total_spent || 0) + parseFloat(orderTotal || 0)
        const newLevel = computeLevel(newCount, levels)
        const updates = {
          order_count: newCount,
          total_spent: newSpent,
          level: newLevel.id,
          last_order: new Date().toISOString(),
        }
        if (normalizedPhone && !current.phone) updates.phone = normalizedPhone

        const updated = await updateVisitorRecord(visitorId, activeStoreId, updates)
        if (updated) setVisitor({ ...updated, level: normalizeVisitorLevel(updated.level) || newLevel.id })
        return
      }

      const newLevel = computeLevel(1, levels)
      const created = await insertVisitorRecord(activeStoreId, {
        visitor_id: visitorId,
        source,
        phone: normalizedPhone,
        visit_count: 1,
        order_count: 1,
        total_spent: parseFloat(orderTotal || 0),
        level: newLevel.id,
        last_order: new Date().toISOString(),
      })

      if (created) setVisitor({ ...created, level: normalizeVisitorLevel(created.level) || newLevel.id })
    } catch {
      const local = getLocalState(activeStoreId)
      const updated = {
        ...local,
        order_count: Number(local.order_count || 0) + 1,
        total_spent: parseFloat(local.total_spent || 0) + parseFloat(orderTotal || 0),
        level: computeLevel(Number(local.order_count || 0) + 1, levels).id,
      }
      saveLocalState(activeStoreId, updated)
      setVisitor(current => ({ ...current, ...updated }))
    }
  }, [activeStoreId, levels, source, useLocal, visitorId])

  const orderCount = Number(visitor?.order_count || 0)
  const totalSpent = parseFloat(visitor?.total_spent || 0)
  const currentLevel = computeLevel(orderCount, levels)
  const nextLevel = levels.find(level => Number(level.min_orders || 0) > orderCount) || null
  const progress = nextLevel
    ? Math.min(100, ((orderCount - Number(currentLevel.min_orders || 0)) / (Number(nextLevel.min_orders || 0) - Number(currentLevel.min_orders || 0))) * 100)
    : 100

  return {
    visitorId,
    source,
    visitor,
    loading,
    levels,
    currentLevel,
    nextLevel,
    orderCount,
    totalSpent,
    progress,
    isFromInstagram: source === 'instagram',
    discountPercent: Number(currentLevel.discount_percent || 0),
    trackOrder,
    linkPhone,
  }
}
