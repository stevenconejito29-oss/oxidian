import { supabase } from './supabase'
import { hasCurrentRouteSession } from './appSession'
import { isLocalPreviewMode } from './currentStore'
import {
  BUSINESS_TYPES,
  CATALOG_MODES,
  ORDER_FLOW_TYPES,
  buildStoreOperationalProfile,
} from './storeConfig'

export const STORE_STATUSES = ['draft', 'active', 'paused', 'archived']

export const DEFAULT_STORE_PLAN = {
  id: 'growth',
  name: 'Growth',
  description: '',
  color: '#2D6A4F',
  monthly_price: 0,
  sort_order: 0,
  feature_bundle: {},
}

export const DEFAULT_STORE_RECORD = {
  id: '',
  slug: '',
  code: '',
  name: '',
  status: 'draft',
  plan_id: 'growth',
  business_type: 'food',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  city: '',
  country: '',
  portable_folder_name: '',
  public_url: '',
  notes: '',
}

export const DEFAULT_STORE_RUNTIME = {
  store_id: '',
  portable_root_hint: '',
  chatbot_url: 'http://127.0.0.1:3001',
  chatbot_port: 3001,
  chatbot_autostart: true,
  admin_desktop_enabled: true,
  qr_mode: 'embedded',
  ai_provider: 'gemini',
  ai_model: 'gemini-2.5-flash',
  ai_key_label: '',
  ai_key_last4: '',
  runtime_notes: 'El API key real debe guardarse en el runtime local de la tienda.',
}

const DEFAULT_PROCESS_NOTES = ''

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = normalizeText(value).toLowerCase()
  if (['true', '1', 'yes', 'si', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function sanitizeInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sanitizeDecimal(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function slugifyStoreToken(value, fallback = 'store') {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || fallback
}

export function sanitizeStorePlan(raw = {}) {
  return {
    ...DEFAULT_STORE_PLAN,
    ...raw,
    id: slugifyStoreToken(raw.id || raw.name || DEFAULT_STORE_PLAN.id, DEFAULT_STORE_PLAN.id),
    name: normalizeText(raw.name, DEFAULT_STORE_PLAN.name),
    description: normalizeText(raw.description),
    color: normalizeText(raw.color || DEFAULT_STORE_PLAN.color),
    monthly_price: sanitizeDecimal(raw.monthly_price, DEFAULT_STORE_PLAN.monthly_price),
    sort_order: sanitizeInt(raw.sort_order, DEFAULT_STORE_PLAN.sort_order),
    feature_bundle: raw?.feature_bundle && typeof raw.feature_bundle === 'object' ? raw.feature_bundle : {},
  }
}

export function sanitizeStoreRecord(raw = {}) {
  const name = normalizeText(raw.name, DEFAULT_STORE_RECORD.name)
  const slug = slugifyStoreToken(raw.slug || raw.code || name || raw.id || 'store', 'store')
  const code = slugifyStoreToken(raw.code || slug, slug)
  return {
    id: normalizeText(raw.id || slug, slug),
    slug,
    code,
    name,
    status: STORE_STATUSES.includes(raw.status) ? raw.status : DEFAULT_STORE_RECORD.status,
    plan_id: slugifyStoreToken(raw.plan_id || DEFAULT_STORE_RECORD.plan_id, DEFAULT_STORE_RECORD.plan_id),
    business_type: BUSINESS_TYPES.includes(raw.business_type) ? raw.business_type : DEFAULT_STORE_RECORD.business_type,
    owner_name: normalizeText(raw.owner_name),
    owner_phone: normalizeText(raw.owner_phone),
    owner_email: normalizeText(raw.owner_email),
    city: normalizeText(raw.city),
    country: normalizeText(raw.country),
    portable_folder_name: normalizeText(raw.portable_folder_name || `store-${code}`),
    public_url: normalizeText(raw.public_url),
    notes: normalizeText(raw.notes),
  }
}

export function sanitizeStoreRuntime(raw = {}, storeId = '') {
  return {
    store_id: normalizeText(raw.store_id || storeId, storeId),
    portable_root_hint: normalizeText(raw.portable_root_hint, DEFAULT_STORE_RUNTIME.portable_root_hint),
    chatbot_url: normalizeText(raw.chatbot_url, DEFAULT_STORE_RUNTIME.chatbot_url),
    chatbot_port: sanitizeInt(raw.chatbot_port, DEFAULT_STORE_RUNTIME.chatbot_port),
    chatbot_autostart: sanitizeBoolean(raw.chatbot_autostart, DEFAULT_STORE_RUNTIME.chatbot_autostart),
    admin_desktop_enabled: sanitizeBoolean(raw.admin_desktop_enabled, DEFAULT_STORE_RUNTIME.admin_desktop_enabled),
    qr_mode: ['local', 'embedded', 'external'].includes(raw.qr_mode) ? raw.qr_mode : DEFAULT_STORE_RUNTIME.qr_mode,
    ai_provider: normalizeText(raw.ai_provider, DEFAULT_STORE_RUNTIME.ai_provider),
    ai_model: normalizeText(raw.ai_model, DEFAULT_STORE_RUNTIME.ai_model),
    ai_key_label: normalizeText(raw.ai_key_label, DEFAULT_STORE_RUNTIME.ai_key_label),
    ai_key_last4: normalizeText(raw.ai_key_last4, DEFAULT_STORE_RUNTIME.ai_key_last4),
    runtime_notes: normalizeText(raw.runtime_notes, DEFAULT_STORE_RUNTIME.runtime_notes),
  }
}

export function sanitizeStoreProcess(raw = {}, storeId = '') {
  const profile = buildStoreOperationalProfile(raw)
  return {
    store_id: normalizeText(raw.store_id || storeId, storeId),
    order_flow_type: ORDER_FLOW_TYPES.includes(profile.order_flow_type) ? profile.order_flow_type : 'standard',
    catalog_mode: CATALOG_MODES.includes(profile.catalog_mode) ? profile.catalog_mode : 'food',
    requires_preparation: profile.requires_preparation,
    requires_dispatch: profile.requires_dispatch,
    enable_delivery: profile.enable_delivery,
    enable_pickup: profile.enable_pickup,
    module_products_enabled: profile.module_products_enabled,
    module_combos_enabled: profile.module_combos_enabled,
    module_toppings_enabled: profile.module_toppings_enabled,
    module_stock_enabled: profile.module_stock_enabled,
    module_coupons_enabled: profile.module_coupons_enabled,
    module_loyalty_enabled: profile.module_loyalty_enabled,
    module_reviews_enabled: profile.module_reviews_enabled,
    module_affiliates_enabled: profile.module_affiliates_enabled,
    module_chatbot_enabled: profile.module_chatbot_enabled,
    module_staff_enabled: profile.module_staff_enabled,
    module_finance_enabled: profile.module_finance_enabled,
    operational_notes: normalizeText(raw.operational_notes, DEFAULT_PROCESS_NOTES),
  }
}

export function buildStoreDraft(seed = {}) {
  const base = sanitizeStoreRecord(seed)
  return {
    store: base,
    process: sanitizeStoreProcess(seed.process || seed, base.id),
    runtime: sanitizeStoreRuntime(seed.runtime || seed, base.id),
  }
}

function isMissingRelation(error) {
  const message = String(error?.message || '')
  return /does not exist|schema cache|relation/i.test(message)
}

function canUseCatalogCloneFallback(error) {
  const message = String(error?.message || '')
  return isMissingRelation(error) || /column .* does not exist|function .* does not exist|42703|42883/i.test(message)
}

function remapIds(value, idMap) {
  if (!Array.isArray(value)) return []
  return value.map(item => idMap.get(item)).filter(Boolean)
}

function normalizeComboSlotsForClone(value, productMap, categoryMap) {
  const slots = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value)
          } catch {
            return []
          }
        })()
      : []

  return slots.map(slot => ({
    ...slot,
    allowed_product_ids: remapIds(slot?.allowed_product_ids, productMap),
    allowed_topping_category_ids: remapIds(slot?.allowed_topping_category_ids, categoryMap),
  }))
}

function buildClonedRow(row, overrides = {}) {
  const nextRow = { ...row, ...overrides }
  delete nextRow.created_at
  delete nextRow.updated_at
  return nextRow
}

async function cloneStoreCatalogFallback(sourceStoreId, targetStoreId, client = supabase) {
  const { count: existingProducts, error: existingError } = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', targetStoreId)

  if (existingError) throw existingError

  if ((existingProducts || 0) > 0) {
    return {
      success: false,
      skipped: true,
      reason: `La tienda destino ya tiene ${existingProducts} productos. No se clona para evitar duplicados.`,
      existing_products: existingProducts,
    }
  }

  const [categoriesRes, toppingsRes, productsRes, combosRes] = await Promise.all([
    client.from('topping_categories').select('*').eq('store_id', sourceStoreId).order('sort_order', { ascending: true }),
    client.from('toppings').select('*').eq('store_id', sourceStoreId).order('sort_order', { ascending: true }),
    client.from('products').select('*').eq('store_id', sourceStoreId).order('sort_order', { ascending: true }),
    client.from('combos').select('*').eq('store_id', sourceStoreId).order('sort_order', { ascending: true }),
  ])

  if (categoriesRes.error) throw categoriesRes.error
  if (toppingsRes.error) throw toppingsRes.error
  if (productsRes.error) throw productsRes.error
  if (combosRes.error) throw combosRes.error

  const sourceCategories = categoriesRes.data || []
  const sourceToppings = toppingsRes.data || []
  const sourceProducts = productsRes.data || []
  const sourceCombos = combosRes.data || []
  const categoryMap = new Map()
  const toppingMap = new Map()
  const productMap = new Map()

  const categoryRows = sourceCategories.map(row => {
    const nextId = crypto.randomUUID()
    categoryMap.set(row.id, nextId)
    return buildClonedRow(row, {
      id: nextId,
      store_id: targetStoreId,
    })
  })

  if (categoryRows.length > 0) {
    const { error } = await client.from('topping_categories').insert(categoryRows)
    if (error) throw error
  }

  const toppingRows = sourceToppings.map(row => {
    const nextId = crypto.randomUUID()
    toppingMap.set(row.id, nextId)
    return buildClonedRow(row, {
      id: nextId,
      store_id: targetStoreId,
      category_id: row.category_id ? (categoryMap.get(row.category_id) || null) : null,
    })
  })

  if (toppingRows.length > 0) {
    const { error } = await client.from('toppings').insert(toppingRows)
    if (error) throw error
  }

  const productRows = sourceProducts.map(row => {
    const nextId = crypto.randomUUID()
    productMap.set(row.id, nextId)
    return buildClonedRow(row, {
      id: nextId,
      store_id: targetStoreId,
      topping_category_ids: remapIds(row.topping_category_ids, categoryMap),
      allowed_topping_ids: remapIds(row.allowed_topping_ids, toppingMap),
    })
  })

  if (productRows.length > 0) {
    const { error } = await client.from('products').insert(productRows)
    if (error) throw error
  }

  const comboRows = sourceCombos.map(row => buildClonedRow(row, {
    id: crypto.randomUUID(),
    store_id: targetStoreId,
    combo_slots: normalizeComboSlotsForClone(row.combo_slots, productMap, categoryMap),
  }))

  if (comboRows.length > 0) {
    const { error } = await client.from('combos').insert(comboRows)
    if (error) throw error
  }

  return {
    success: true,
    source_store_id: sourceStoreId,
    target_store_id: targetStoreId,
    products: productRows.length,
    topping_categories: categoryRows.length,
    toppings: toppingRows.length,
    combos: comboRows.length,
    fallback: true,
  }
}

export async function loadStorePlans(client = supabase) {
  const { data, error } = await client
    .from('store_plans')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }

  return (data || []).map(sanitizeStorePlan)
}

export async function loadStoreCatalog(client = supabase) {
  if (isLocalPreviewMode() && !hasCurrentRouteSession()) {
    return { stores: [], plans: [], missingSchema: true }
  }

  const [storesRes, processRes, runtimeRes, plans] = await Promise.all([
    client.from('stores').select('*').order('created_at', { ascending: true }),
    client.from('store_process_profiles').select('*'),
    client.from('store_runtime_profiles').select('*'),
    loadStorePlans(client),
  ])

  if (storesRes.error) {
    if (isMissingRelation(storesRes.error)) {
      return { stores: [], plans, missingSchema: true }
    }
    throw storesRes.error
  }
  if (processRes.error) {
    if (!isMissingRelation(processRes.error)) throw processRes.error
  }
  if (runtimeRes.error) {
    if (!isMissingRelation(runtimeRes.error)) throw runtimeRes.error
  }

  const processMap = new Map((processRes.data || []).map(row => [row.store_id, sanitizeStoreProcess(row, row.store_id)]))
  const runtimeMap = new Map((runtimeRes.data || []).map(row => [row.store_id, sanitizeStoreRuntime(row, row.store_id)]))
  const planMap = new Map(plans.map(plan => [plan.id, plan]))

  const stores = (storesRes.data || []).map(row => {
    const store = sanitizeStoreRecord(row)
    const process = processMap.get(store.id) || sanitizeStoreProcess({}, store.id)
    const runtime = runtimeMap.get(store.id) || sanitizeStoreRuntime({}, store.id)
    return {
      store,
      process,
      runtime,
      plan: planMap.get(store.plan_id) || null,
    }
  })

  return { stores, plans, missingSchema: false }
}

export async function saveStoreBundle(bundle, client = supabase) {
  const store = sanitizeStoreRecord(bundle.store || bundle)
  const process = sanitizeStoreProcess(bundle.process || bundle, store.id)
  const runtime = sanitizeStoreRuntime(bundle.runtime || bundle, store.id)

  const storePayload = { ...store }
  const processPayload = { ...process }
  const runtimePayload = { ...runtime }

  const { error: storeError } = await client
    .from('stores')
    .upsert(storePayload, { onConflict: 'id' })

  if (storeError) throw storeError

  const { error: processError } = await client
    .from('store_process_profiles')
    .upsert(processPayload, { onConflict: 'store_id' })

  if (processError) throw processError

  const { error: runtimeError } = await client
    .from('store_runtime_profiles')
    .upsert(runtimePayload, { onConflict: 'store_id' })

  if (runtimeError) throw runtimeError

  return {
    store,
    process,
    runtime,
  }
}

export function summarizePlanFeature(plan, key, fallback = false) {
  return Boolean(plan?.feature_bundle?.[key] ?? fallback)
}

// ── Clonar catálogo desde tienda fuente a tienda destino ──────────────────────
// Llama a la función RPC clone_store_catalog() en Supabase.
// Solo clona si el destino no tiene productos. Devuelve el resultado.
export async function cloneStoreCatalog(
  sourceStoreId = 'default',
  targetStoreId,
  client = supabase,
) {
  if (!targetStoreId || targetStoreId === sourceStoreId) {
    throw new Error('El storeId destino es requerido y debe ser diferente al origen')
  }

  const { data, error } = await client.rpc('clone_store_catalog', {
    source_store_id: String(sourceStoreId),
    target_store_id: String(targetStoreId),
  })

  if (error) {
    if (isMissingRelation(error)) {
      return {
        skipped: true,
        reason: 'La función clone_store_catalog no está disponible. Aplica la migración 20260407.',
      }
    }
    throw error
  }

  return data || { success: false, reason: 'Sin respuesta del servidor' }
}

export async function cloneStoreCatalogSafe(
  sourceStoreId = 'default',
  targetStoreId,
  client = supabase,
) {
  try {
    const result = await cloneStoreCatalog(sourceStoreId, targetStoreId, client)
    if (result?.skipped && /clone_store_catalog/i.test(String(result.reason || ''))) {
      return cloneStoreCatalogFallback(String(sourceStoreId), String(targetStoreId), client)
    }
    return result
  } catch (error) {
    if (canUseCatalogCloneFallback(error)) {
      return cloneStoreCatalogFallback(String(sourceStoreId), String(targetStoreId), client)
    }
    throw error
  }
}
