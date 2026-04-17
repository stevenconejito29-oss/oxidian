import { supabase } from './supabase'
import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'
import { loadPublicMergedSettingsMap } from './storeSettings'
import { isMissingStoreScope } from './loyaltyScope'

const DEFAULT_REVIEW_BASE_URL = (
  import.meta.env.VITE_PUBLIC_WEB_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
)

const REVIEW_SETTING_KEYS = ['review_request_message', 'review_reward_percent', 'review_public_limit']

export const DEFAULT_REVIEW_SETTINGS = {
  review_request_message:
    '*Que tal tu pedido?*\n\nHola {{nombre}}. Esperamos que hayas disfrutado tu pedido *#{{numero}}*.\n\nSi tienes un momento, dejanos tu resena:\n{{url}}\n\nAl enviarla recibiras un cupon del {{descuento}}% para tu proximo pedido.',
  review_reward_percent: '10',
  review_public_limit: '3',
}

export const REVIEW_SELECT_COLUMNS =
  'id,store_id,order_id,order_number,review_token,customer_name,author_name,customer_phone,text,approved,created_at,published_at,rating,source'

function randomCode(length = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function toStoreId(storeId) {
  return normalizeStoreId(storeId || DEFAULT_STORE_ID)
}

function toOrderNumber(value) {
  if (value == null) return null
  const parsed = parseInt(String(value).trim(), 10)
  return Number.isNaN(parsed) ? null : parsed
}

const isDuplicate = error => /23505|duplicate key/i.test(String(error?.message || error?.details || ''))
const isRls = error => /row-level security|permission denied|violates row-level security/i.test(String(error?.message || error?.details || ''))
const isMissingCol = error => /column .* does not exist|schema cache|Could not find the '.*' column/i.test(String(error?.message || error?.details || ''))

export function buildReviewUrl(orderNumber, reviewToken = '', baseUrl = DEFAULT_REVIEW_BASE_URL, storeId = DEFAULT_STORE_ID) {
  const base = String(baseUrl || DEFAULT_REVIEW_BASE_URL).replace(/\/$/, '')
  const params = new URLSearchParams({ review: String(orderNumber || '') })
  const normalizedToken = String(reviewToken || '').trim()
  const normalizedStoreId = toStoreId(storeId)
  if (normalizedToken) params.set('token', normalizedToken)
  if (normalizedStoreId !== DEFAULT_STORE_ID) params.set('store', normalizedStoreId)
  return `${base}/menu?${params.toString()}`
}

export async function fetchReviewSettings(storeId = DEFAULT_STORE_ID) {
  const settingsMap = await loadPublicMergedSettingsMap(toStoreId(storeId), supabase).catch(() => ({}))
  const scoped = Object.fromEntries(REVIEW_SETTING_KEYS.map(key => [key, String(settingsMap[key] || '')]).filter(([, value]) => value !== ''))
  return {
    ...DEFAULT_REVIEW_SETTINGS,
    ...scoped,
  }
}

export function applyReviewTemplate(template, values) {
  return String(template || '')
    .replace(/\{\{nombre\}\}/g, values.nombre)
    .replace(/\{\{numero\}\}/g, values.numero)
    .replace(/\{\{url\}\}/g, values.url)
    .replace(/\{\{descuento\}\}/g, values.descuento)
}

export function normalizeReviewRow(row) {
  if (!row) return null
  const rating = Math.max(1, Math.min(5, Number(row.rating) || 5))
  const customerName = String(row.customer_name || row.author_name || 'Cliente').trim() || 'Cliente'
  return {
    ...row,
    store_id: toStoreId(row.store_id),
    customer_name: customerName,
    author_name: String(row.author_name || customerName).trim() || customerName,
    rating,
    approved: row.approved === true,
    published_at: row.published_at || null,
    source: String(row.source || 'menu').trim() || 'menu',
  }
}

export async function fetchReviews({ approved, limit = 200, storeId = DEFAULT_STORE_ID } = {}) {
  const normalizedStoreId = toStoreId(storeId)
  const selectVariants = [
    { columns: REVIEW_SELECT_COLUMNS, includePublishedSort: true, scoped: true },
    { columns: 'id,order_id,order_number,review_token,customer_name,author_name,customer_phone,text,approved,created_at,published_at,rating,source', includePublishedSort: true, scoped: false },
    { columns: 'id,order_number,customer_name,author_name,customer_phone,text,approved,created_at,rating', includePublishedSort: false, scoped: false },
  ]

  let lastError = null
  for (const variant of selectVariants) {
    let query = supabase
      .from('reviews')
      .select(variant.columns)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (variant.scoped) query = query.eq('store_id', normalizedStoreId)
    if (variant.includePublishedSort) {
      query = query.order('published_at', { ascending: false, nullsFirst: false })
    }
    if (typeof approved === 'boolean') query = query.eq('approved', approved)

    const { data, error } = await query
    if (!error) {
      return Array.isArray(data) ? data.map(normalizeReviewRow).filter(Boolean) : []
    }

    lastError = error
    if (!(isMissingCol(error) || isMissingStoreScope(error))) break
  }

  throw lastError
}

export async function setReviewApproved(id, approved, storeId = DEFAULT_STORE_ID) {
  const normalizedStoreId = toStoreId(storeId)
  const updateVariants = [
    {
      payload: { approved, published_at: approved ? new Date().toISOString() : null },
      columns: REVIEW_SELECT_COLUMNS,
      scoped: true,
    },
    {
      payload: { approved, published_at: approved ? new Date().toISOString() : null },
      columns: 'id,order_id,order_number,review_token,customer_name,author_name,customer_phone,text,approved,created_at,published_at,rating,source',
      scoped: false,
    },
    {
      payload: { approved },
      columns: 'id,order_number,customer_name,author_name,customer_phone,text,approved,created_at,rating',
      scoped: false,
    },
  ]

  let lastError = null
  for (const variant of updateVariants) {
    let query = supabase
      .from('reviews')
      .update(variant.payload)
      .eq('id', id)

    if (variant.scoped) query = query.eq('store_id', normalizedStoreId)

    const { data, error } = await query.select(variant.columns).maybeSingle()
    if (!error) return normalizeReviewRow(data)
    lastError = error
    if (!(isMissingCol(error) || isMissingStoreScope(error))) break
  }

  throw lastError
}

export async function deleteReview(id, storeId = DEFAULT_STORE_ID) {
  const normalizedStoreId = toStoreId(storeId)
  let response = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)
    .eq('store_id', normalizedStoreId)

  if (response.error && isMissingStoreScope(response.error)) {
    response = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
  }

  if (response.error) throw response.error
}

async function validateReviewOrder({ orderNumber, reviewToken, storeId = DEFAULT_STORE_ID }) {
  const parsedNum = toOrderNumber(orderNumber)
  if (!parsedNum) throw new Error('Falta el numero de pedido para guardar la resena.')

  const normalizedStoreId = toStoreId(storeId)
  const normalizedToken = String(reviewToken || '').trim()
  const selectVariants = [
    { columns: 'id,store_id,order_number,customer_name,customer_phone,status,delivered_at,review_requested_at,review_token', scoped: true },
    { columns: 'id,order_number,customer_name,customer_phone,status,delivered_at,review_requested_at,review_token', scoped: false },
    { columns: 'id,order_number,customer_name,customer_phone,status,delivered_at,review_requested_at', scoped: false },
    { columns: 'id,order_number,customer_name,customer_phone,status', scoped: false },
  ]

  let data = null
  let lastError = null

  for (const variant of selectVariants) {
    let query = supabase
      .from('orders')
      .select(variant.columns)
      .eq('order_number', parsedNum)
      .limit(1)

    if (variant.scoped) query = query.eq('store_id', normalizedStoreId)
    if (normalizedToken && /review_token/.test(variant.columns)) query = query.eq('review_token', normalizedToken)

    const response = await query.maybeSingle()
    if (!response.error) {
      data = response.data
      lastError = null
      break
    }

    lastError = response.error
    if (!(isMissingCol(response.error) || isMissingStoreScope(response.error))) break
  }

  if (lastError) throw lastError
  if (!data) throw new Error('No pude validar ese enlace de resena. Solicita uno nuevo al equipo.')
  if (!data.delivered_at && !data.review_requested_at && String(data.status || '') !== 'delivered') {
    throw new Error('La resena solo se habilita cuando el pedido ya fue entregado.')
  }

  return { ...data, store_id: toStoreId(data.store_id || normalizedStoreId) }
}

export async function saveReviewFromOrderLink({
  orderNumber,
  reviewToken,
  rating,
  text,
  customerName,
  customerPhone,
  storeId = DEFAULT_STORE_ID,
}) {
  const parsedNum = toOrderNumber(orderNumber)
  if (!parsedNum) throw new Error('Falta el numero de pedido para guardar la resena.')

  const normalizedStoreId = toStoreId(storeId)
  const order = await validateReviewOrder({ orderNumber: parsedNum, reviewToken, storeId: normalizedStoreId })
  const normalizedRating = Math.max(1, Math.min(5, Number(rating) || 5))
  const name = String(customerName || order.customer_name || '').trim() || 'Cliente'
  const phone = String(customerPhone || order.customer_phone || '').trim() || null
  const normalizedText = String(text || '').trim() || `Valoracion de ${normalizedRating} estrellas`

  const fullPayload = {
    store_id: normalizedStoreId,
    order_id: order.id,
    order_number: parsedNum,
    review_token: String(order.review_token || reviewToken || '').trim() || null,
    customer_name: name,
    author_name: name,
    customer_phone: phone,
    rating: normalizedRating,
    text: normalizedText,
    approved: false,
    published_at: null,
    source: 'menu',
  }

  const minimalPayload = {
    order_id: order.id,
    order_number: parsedNum,
    review_token: String(order.review_token || reviewToken || '').trim() || null,
    customer_name: name,
    author_name: name,
    rating: normalizedRating,
    text: normalizedText,
    approved: false,
    published_at: null,
    source: 'menu',
  }

  async function updateExistingReview(payload, scoped = true) {
    const safeUpdate = {
      order_id: order.id,
      review_token: String(order.review_token || reviewToken || '').trim() || null,
      rating: payload.rating,
      text: payload.text,
      customer_name: payload.customer_name,
      author_name: payload.author_name,
      approved: false,
      published_at: null,
      source: 'menu',
      ...(payload.customer_phone ? { customer_phone: payload.customer_phone } : {}),
      ...(scoped ? { store_id: normalizedStoreId } : {}),
    }

    let query = supabase
      .from('reviews')
      .update(safeUpdate)
      .eq('order_number', parsedNum)

    if (scoped) query = query.eq('store_id', normalizedStoreId)

    const { data, error } = await query.select(REVIEW_SELECT_COLUMNS).maybeSingle()
    if (error) throw error
    return { orderNumber: parsedNum, review: normalizeReviewRow(data), isNew: false }
  }

  let insertResponse = await supabase
    .from('reviews')
    .insert([fullPayload])
    .select(REVIEW_SELECT_COLUMNS)
    .maybeSingle()

  if (!insertResponse.error) {
    return { orderNumber: parsedNum, review: normalizeReviewRow(insertResponse.data), isNew: true }
  }

  if (isRls(insertResponse.error)) {
    throw new Error('La base de datos esta bloqueando las resenas por permisos RLS.')
  }

  if (isDuplicate(insertResponse.error)) {
    return updateExistingReview(fullPayload, true)
  }

  if (isMissingCol(insertResponse.error) || isMissingStoreScope(insertResponse.error)) {
    const { store_id: _omitStoreId, ...legacyPayload } = fullPayload
    insertResponse = await supabase
      .from('reviews')
      .insert([legacyPayload])
      .select(REVIEW_SELECT_COLUMNS)
      .maybeSingle()

    if (!insertResponse.error) {
      return { orderNumber: parsedNum, review: normalizeReviewRow(insertResponse.data), isNew: true }
    }
    if (isRls(insertResponse.error)) throw new Error('La base de datos esta bloqueando las resenas por permisos RLS.')
    if (isDuplicate(insertResponse.error)) return updateExistingReview(legacyPayload, false)

    const minimalInsert = await supabase
      .from('reviews')
      .insert([minimalPayload])
      .select(REVIEW_SELECT_COLUMNS)
      .maybeSingle()

    if (!minimalInsert.error) {
      return { orderNumber: parsedNum, review: normalizeReviewRow(minimalInsert.data), isNew: true }
    }
    if (isRls(minimalInsert.error)) throw new Error('La base de datos esta bloqueando las resenas por permisos RLS.')
    if (isDuplicate(minimalInsert.error)) return updateExistingReview(minimalPayload, false)
    throw minimalInsert.error
  }

  let upsertResponse = await supabase
    .from('reviews')
    .upsert([fullPayload], { onConflict: 'store_id,order_number' })
    .select(REVIEW_SELECT_COLUMNS)
    .maybeSingle()

  if (!upsertResponse.error) {
    return { orderNumber: parsedNum, review: normalizeReviewRow(upsertResponse.data), isNew: false }
  }

  if (isMissingStoreScope(upsertResponse.error)) {
    const { store_id: _omitStoreId, ...legacyPayload } = fullPayload
    upsertResponse = await supabase
      .from('reviews')
      .upsert([legacyPayload], { onConflict: 'order_number' })
      .select(REVIEW_SELECT_COLUMNS)
      .maybeSingle()
    if (!upsertResponse.error) {
      return { orderNumber: parsedNum, review: normalizeReviewRow(upsertResponse.data), isNew: false }
    }
  }

  if (isDuplicate(upsertResponse.error)) {
    return updateExistingReview(fullPayload, !isMissingStoreScope(upsertResponse.error))
  }

  throw upsertResponse.error || insertResponse.error
}

export async function createReviewRewardCoupon(orderNumber, storeId = DEFAULT_STORE_ID) {
  const normalizedStoreId = toStoreId(storeId)
  const description = `Review reward #${orderNumber}`
  const reviewSettings = await fetchReviewSettings(normalizedStoreId).catch(() => DEFAULT_REVIEW_SETTINGS)
  const discountValue = Math.max(0, Number(reviewSettings.review_reward_percent) || Number(DEFAULT_REVIEW_SETTINGS.review_reward_percent))

  try {
    let existingQuery = supabase.from('coupons').select('code').eq('description', description).eq('store_id', normalizedStoreId)
    let existingResponse = await existingQuery.maybeSingle()
    if (existingResponse.error && isMissingStoreScope(existingResponse.error)) {
      existingResponse = await supabase.from('coupons').select('code').eq('description', description).maybeSingle()
    }
    if (existingResponse.data?.code) return existingResponse.data.code
  } catch {}

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const code = `REVIEW-${randomCode()}`
  const payload = {
    code,
    store_id: normalizedStoreId,
    discount_type: 'percent',
    discount_value: discountValue,
    max_uses: 1,
    used_count: 0,
    active: true,
    expires_at: expiresAt.toISOString(),
    description,
  }

  let insertResponse = await supabase.from('coupons').insert([payload]).select('code').single()
  if (!insertResponse.error) return insertResponse.data?.code || code

  if (isMissingStoreScope(insertResponse.error)) {
    const { store_id: _omitStoreId, ...legacyPayload } = payload
    insertResponse = await supabase.from('coupons').insert([legacyPayload]).select('code').single()
    if (!insertResponse.error) return insertResponse.data?.code || code
  }

  if (isDuplicate(insertResponse.error)) {
    let duplicateQuery = supabase.from('coupons').select('code').eq('description', description).eq('store_id', normalizedStoreId)
    let duplicateResponse = await duplicateQuery.maybeSingle()
    if (duplicateResponse.error && isMissingStoreScope(duplicateResponse.error)) {
      duplicateResponse = await supabase.from('coupons').select('code').eq('description', description).maybeSingle()
    }
    return duplicateResponse.data?.code || code
  }

  throw insertResponse.error
}
