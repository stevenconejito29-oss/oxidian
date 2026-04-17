import { supabase } from './supabase'
import { DEFAULT_STORE_ID, shouldUseLocalPreviewDefaults } from './currentStore'
import { PUBLIC_STORE_SETTING_KEYS } from './storeConfigVisibility'

export const STORE_CONFIG_ROW_ID = 'default'

export const ORDER_FLOW_TYPES = ['standard', 'direct_dispatch', 'pickup_only', 'catalog_only']
export const CATALOG_MODES = ['food', 'retail', 'service', 'generic']
export const BUSINESS_TYPES = ['food', 'retail', 'service', 'beauty', 'other']
export const MENU_LAYOUTS = ['delivery', 'vitrina', 'portfolio', 'minimal', 'mascotas', 'moda', 'regalos', 'despensa']

export const DEFAULT_STORE_CONFIG = {
  id: STORE_CONFIG_ROW_ID,
  store_code: 'default',
  business_name: 'Mi tienda',
  tagline: 'Compra facil, entrega clara y marca configurable',
  address: '',
  logo_url: '',
  whatsapp_number: '',
  support_phone: '',
  instagram_url: '',
  instagram_handle: '',
  maps_url: '',
  open_hour: '14',
  close_hour: '21',
  open_days: '2,3,4,5,6,0',
  store_hours_text: '',
  admin_phone: '',
  system_prompt: '',
  business_values: '',
  business_type: 'food',
  plan_slug: 'growth',
  order_flow_type: 'standard',
  catalog_mode: 'food',
  requires_preparation: true,
  requires_dispatch: true,
  enable_delivery: true,
  enable_pickup: false,
  module_products_enabled: true,
  module_combos_enabled: true,
  module_toppings_enabled: true,
  module_stock_enabled: true,
  module_coupons_enabled: true,
  module_loyalty_enabled: true,
  module_reviews_enabled: true,
  module_affiliates_enabled: true,
  module_chatbot_enabled: true,
  module_staff_enabled: true,
  module_finance_enabled: true,
  theme_primary_color: '#2D6A4F',
  theme_secondary_color: '#40916C',
  theme_accent_color: '#E8607A',
  theme_surface_color: '#FFF5EE',
  theme_text_color: '#2D1F1A',
  theme_font_display: 'Pacifico',
  theme_font_body: 'Nunito',
  theme_button_radius: '14px',
  theme_daisy_theme: 'oxidian',
  menu_layout: 'delivery',
  storefront_badge_text: '',
  storefront_announcement: '',
  storefront_search_placeholder: '',
  storefront_intro_eyebrow: '',
  storefront_intro_title: '',
  storefront_intro_text: '',
  storefront_story_quote: '',
  storefront_story_author: '',
  storefront_primary_cta_label: '',
  storefront_secondary_cta_label: '',
}

const SCOPED_STORE_CONFIG_KEYS = Object.keys(DEFAULT_STORE_CONFIG).filter(key => key !== 'id')

const LEGACY_SETTING_KEYS = [
  'business_name',
  'tagline',
  'address',
  'logo_url',
  'whatsapp_number',
  'support_phone',
  'instagram_url',
  'instagram_handle',
  'maps_url',
  'open_hour',
  'close_hour',
  'open_days',
  'store_hours_text',
]

const DEFAULT_STORE_PUBLIC_MIRROR_KEYS = [
  ...LEGACY_SETTING_KEYS,
  'store_code',
  'menu_layout',
  'theme_primary_color',
  'theme_secondary_color',
  'theme_accent_color',
  'theme_surface_color',
  'theme_text_color',
  'theme_font_display',
  'theme_font_body',
  'theme_button_radius',
  'theme_daisy_theme',
  'storefront_badge_text',
  'storefront_announcement',
  'storefront_search_placeholder',
  'storefront_intro_eyebrow',
  'storefront_intro_title',
  'storefront_intro_text',
  'storefront_story_quote',
  'storefront_story_author',
  'storefront_primary_cta_label',
  'storefront_secondary_cta_label',
]

function normalizeVisibility(value) {
  return normalizeText(value, 'full').toLowerCase() === 'public' ? 'public' : 'full'
}

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function sanitizeColor(value, fallback) {
  const color = normalizeText(value, fallback)
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback
}

function sanitizeHour(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return String(fallback)
  return String(Math.min(23, Math.max(0, parsed)))
}

function sanitizeDays(value, fallback) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || fallback)
  const normalized = raw
    .split(',')
    .map(token => Number.parseInt(token, 10))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)

  return [...new Set(normalized)].join(',') || fallback
}

function sanitizeRadius(value, fallback) {
  const text = normalizeText(value, fallback)
  return /^-?\d+(\.\d+)?(px|rem|em)$/i.test(text) ? text : fallback
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = normalizeText(value).toLowerCase()
  if (['true', '1', 'yes', 'si', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function sanitizeEnum(value, allowed, fallback) {
  const normalized = normalizeText(value, fallback).toLowerCase()
  return allowed.includes(normalized) ? normalized : fallback
}

function sanitizeCode(value, fallback = 'default') {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

function isMissingRelation(error) {
  return /does not exist|schema cache|relation/i.test(String(error?.message || ''))
}

function getMissingColumnName(error) {
  const message = String(error?.message || '')
  const missingColumnMatch = message.match(/column\s+(?:[\w"]+\.)?"?([\w]+)"?\s+does not exist/i)
  if (missingColumnMatch?.[1]) return missingColumnMatch[1]

  const schemaCacheMatch = message.match(/could not find the ['"]?([\w]+)['"]?\s+column of ['"]?[\w]+['"]?\s+in the schema cache/i)
  return schemaCacheMatch?.[1] || ''
}

function mapRowsToConfig(rows = []) {
  return Object.fromEntries((rows || []).map(row => [row.key, row.value]))
}

function parseThemeValue(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (!value || typeof value !== 'object') return {}
  return value
}

function buildThemeDefaultsFromTemplate(value = {}) {
  const theme = parseThemeValue(value)
  return {
    theme_primary_color: normalizeText(theme.theme_primary_color || theme.primaryColor || theme.primary),
    theme_secondary_color: normalizeText(theme.theme_secondary_color || theme.secondaryColor || theme.secondary),
    theme_accent_color: normalizeText(theme.theme_accent_color || theme.accentColor || theme.accent),
    theme_surface_color: normalizeText(theme.theme_surface_color || theme.surfaceColor || theme.surface),
    theme_text_color: normalizeText(theme.theme_text_color || theme.textColor || theme.text),
    theme_font_display: normalizeText(theme.theme_font_display || theme.fontDisplay),
    theme_font_body: normalizeText(theme.theme_font_body || theme.fontBody),
    theme_button_radius: normalizeText(theme.theme_button_radius || theme.buttonRadius),
    theme_daisy_theme: normalizeText(theme.theme_daisy_theme || theme.daisyTheme),
  }
}

async function loadNicheTemplateTheme({ templateId = '', niche = '' } = {}, client = supabase) {
  const normalizedTemplateId = normalizeText(templateId)
  const normalizedNiche = normalizeText(niche).toLowerCase()

  let query = null
  if (normalizedTemplateId) {
    query = client
      .from('store_niche_templates')
      .select('default_theme')
      .eq('id', normalizedTemplateId)
      .maybeSingle()
  } else if (normalizedNiche) {
    query = client
      .from('store_niche_templates')
      .select('default_theme')
      .eq('niche', normalizedNiche)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
  }

  if (!query) return {}
  const { data, error } = await query
  if (error) {
    if (isMissingRelation(error)) return {}
    throw error
  }

  return buildThemeDefaultsFromTemplate(data?.default_theme)
}

export function sanitizeStoreConfig(raw = {}) {
  const normalized = {
    ...DEFAULT_STORE_CONFIG,
    ...raw,
    store_code: sanitizeCode(raw.store_code, DEFAULT_STORE_CONFIG.store_code),
    business_name: normalizeText(raw.business_name, DEFAULT_STORE_CONFIG.business_name),
    tagline: normalizeText(raw.tagline, DEFAULT_STORE_CONFIG.tagline),
    address: normalizeText(raw.address),
    logo_url: normalizeText(raw.logo_url),
    whatsapp_number: normalizeText(raw.whatsapp_number),
    support_phone: normalizeText(raw.support_phone),
    instagram_url: normalizeText(raw.instagram_url),
    instagram_handle: normalizeText(raw.instagram_handle),
    maps_url: normalizeText(raw.maps_url),
    open_hour: sanitizeHour(raw.open_hour, DEFAULT_STORE_CONFIG.open_hour),
    close_hour: sanitizeHour(raw.close_hour, DEFAULT_STORE_CONFIG.close_hour),
    open_days: sanitizeDays(raw.open_days, DEFAULT_STORE_CONFIG.open_days),
    store_hours_text: normalizeText(raw.store_hours_text),
    admin_phone: normalizeText(raw.admin_phone || raw.whatsapp_number),
    system_prompt: normalizeText(raw.system_prompt),
    business_values: normalizeText(raw.business_values),
    business_type: sanitizeEnum(raw.business_type, BUSINESS_TYPES, DEFAULT_STORE_CONFIG.business_type),
    plan_slug: sanitizeCode(raw.plan_slug, DEFAULT_STORE_CONFIG.plan_slug),
    order_flow_type: sanitizeEnum(raw.order_flow_type, ORDER_FLOW_TYPES, DEFAULT_STORE_CONFIG.order_flow_type),
    catalog_mode: sanitizeEnum(raw.catalog_mode, CATALOG_MODES, DEFAULT_STORE_CONFIG.catalog_mode),
    requires_preparation: sanitizeBoolean(raw.requires_preparation, DEFAULT_STORE_CONFIG.requires_preparation),
    requires_dispatch: sanitizeBoolean(raw.requires_dispatch, DEFAULT_STORE_CONFIG.requires_dispatch),
    enable_delivery: sanitizeBoolean(raw.enable_delivery, DEFAULT_STORE_CONFIG.enable_delivery),
    enable_pickup: sanitizeBoolean(raw.enable_pickup, DEFAULT_STORE_CONFIG.enable_pickup),
    module_products_enabled: sanitizeBoolean(raw.module_products_enabled, DEFAULT_STORE_CONFIG.module_products_enabled),
    module_combos_enabled: sanitizeBoolean(raw.module_combos_enabled, DEFAULT_STORE_CONFIG.module_combos_enabled),
    module_toppings_enabled: sanitizeBoolean(raw.module_toppings_enabled, DEFAULT_STORE_CONFIG.module_toppings_enabled),
    module_stock_enabled: sanitizeBoolean(raw.module_stock_enabled, DEFAULT_STORE_CONFIG.module_stock_enabled),
    module_coupons_enabled: sanitizeBoolean(raw.module_coupons_enabled, DEFAULT_STORE_CONFIG.module_coupons_enabled),
    module_loyalty_enabled: sanitizeBoolean(raw.module_loyalty_enabled, DEFAULT_STORE_CONFIG.module_loyalty_enabled),
    module_reviews_enabled: sanitizeBoolean(raw.module_reviews_enabled, DEFAULT_STORE_CONFIG.module_reviews_enabled),
    module_affiliates_enabled: sanitizeBoolean(raw.module_affiliates_enabled, DEFAULT_STORE_CONFIG.module_affiliates_enabled),
    module_chatbot_enabled: sanitizeBoolean(raw.module_chatbot_enabled, DEFAULT_STORE_CONFIG.module_chatbot_enabled),
    module_staff_enabled: sanitizeBoolean(raw.module_staff_enabled, DEFAULT_STORE_CONFIG.module_staff_enabled),
    module_finance_enabled: sanitizeBoolean(raw.module_finance_enabled, DEFAULT_STORE_CONFIG.module_finance_enabled),
    theme_primary_color: sanitizeColor(raw.theme_primary_color, DEFAULT_STORE_CONFIG.theme_primary_color),
    theme_secondary_color: sanitizeColor(raw.theme_secondary_color, DEFAULT_STORE_CONFIG.theme_secondary_color),
    theme_accent_color: sanitizeColor(raw.theme_accent_color, DEFAULT_STORE_CONFIG.theme_accent_color),
    theme_surface_color: sanitizeColor(raw.theme_surface_color, DEFAULT_STORE_CONFIG.theme_surface_color),
    theme_text_color: sanitizeColor(raw.theme_text_color, DEFAULT_STORE_CONFIG.theme_text_color),
    theme_font_display: normalizeText(raw.theme_font_display, DEFAULT_STORE_CONFIG.theme_font_display),
    theme_font_body: normalizeText(raw.theme_font_body, DEFAULT_STORE_CONFIG.theme_font_body),
    theme_button_radius: sanitizeRadius(raw.theme_button_radius, DEFAULT_STORE_CONFIG.theme_button_radius),
    theme_daisy_theme: normalizeText(raw.theme_daisy_theme, DEFAULT_STORE_CONFIG.theme_daisy_theme),
    menu_layout: sanitizeEnum(raw.menu_layout, MENU_LAYOUTS, DEFAULT_STORE_CONFIG.menu_layout),
    storefront_badge_text: normalizeText(raw.storefront_badge_text),
    storefront_announcement: normalizeText(raw.storefront_announcement),
    storefront_search_placeholder: normalizeText(raw.storefront_search_placeholder),
    storefront_intro_eyebrow: normalizeText(raw.storefront_intro_eyebrow),
    storefront_intro_title: normalizeText(raw.storefront_intro_title),
    storefront_intro_text: normalizeText(raw.storefront_intro_text),
    storefront_story_quote: normalizeText(raw.storefront_story_quote),
    storefront_story_author: normalizeText(raw.storefront_story_author),
    storefront_primary_cta_label: normalizeText(raw.storefront_primary_cta_label),
    storefront_secondary_cta_label: normalizeText(raw.storefront_secondary_cta_label),
  }

  return {
    ...normalized,
    ...buildStoreOperationalProfile(normalized),
  }
}

export function buildStoreOperationalProfile(config = {}) {
  const normalized = {
    ...DEFAULT_STORE_CONFIG,
    ...config,
  }

  let orderFlowType = sanitizeEnum(normalized.order_flow_type, ORDER_FLOW_TYPES, DEFAULT_STORE_CONFIG.order_flow_type)
  let catalogMode = sanitizeEnum(normalized.catalog_mode, CATALOG_MODES, DEFAULT_STORE_CONFIG.catalog_mode)
  let requiresPreparation = sanitizeBoolean(normalized.requires_preparation, DEFAULT_STORE_CONFIG.requires_preparation)
  let requiresDispatch = sanitizeBoolean(normalized.requires_dispatch, DEFAULT_STORE_CONFIG.requires_dispatch)
  let enableDelivery = sanitizeBoolean(normalized.enable_delivery, DEFAULT_STORE_CONFIG.enable_delivery)
  let enablePickup = sanitizeBoolean(normalized.enable_pickup, DEFAULT_STORE_CONFIG.enable_pickup)

  if (orderFlowType === 'direct_dispatch') {
    requiresPreparation = false
    requiresDispatch = true
    enableDelivery = true
  } else if (orderFlowType === 'pickup_only') {
    requiresDispatch = false
    enableDelivery = false
    enablePickup = true
  } else if (orderFlowType === 'catalog_only') {
    requiresPreparation = false
    requiresDispatch = false
    enableDelivery = false
    enablePickup = false
  }

  const moduleStaffEnabledFallback = requiresPreparation || requiresDispatch || enableDelivery

  return {
    order_flow_type: orderFlowType,
    catalog_mode: catalogMode,
    requires_preparation: requiresPreparation,
    requires_dispatch: requiresDispatch,
    enable_delivery: enableDelivery,
    enable_pickup: enablePickup,
    module_products_enabled: sanitizeBoolean(normalized.module_products_enabled, true),
    module_combos_enabled: sanitizeBoolean(normalized.module_combos_enabled, true),
    module_toppings_enabled: sanitizeBoolean(normalized.module_toppings_enabled, true),
    module_stock_enabled: sanitizeBoolean(normalized.module_stock_enabled, true),
    module_coupons_enabled: sanitizeBoolean(normalized.module_coupons_enabled, true),
    module_loyalty_enabled: sanitizeBoolean(normalized.module_loyalty_enabled, true),
    module_reviews_enabled: sanitizeBoolean(normalized.module_reviews_enabled, true),
    module_affiliates_enabled: sanitizeBoolean(normalized.module_affiliates_enabled, true),
    module_chatbot_enabled: sanitizeBoolean(normalized.module_chatbot_enabled, true),
    module_staff_enabled: sanitizeBoolean(normalized.module_staff_enabled, moduleStaffEnabledFallback),
    module_finance_enabled: sanitizeBoolean(normalized.module_finance_enabled, true),
  }
}

export function buildStoreTheme(config = {}) {
  const store = sanitizeStoreConfig(config)
  return {
    '--brand-primary': store.theme_primary_color,
    '--brand-secondary': store.theme_secondary_color,
    '--brand-accent': store.theme_accent_color,
    '--brand-surface': store.theme_surface_color,
    '--brand-text': store.theme_text_color,
    '--brand-font-display': `'${store.theme_font_display}', cursive`,
    '--brand-font-body': `'${store.theme_font_body}', system-ui, sans-serif`,
    '--brand-button-radius': store.theme_button_radius,
  }
}

export function applyStoreTheme(config = {}) {
  if (typeof document === 'undefined') return
  const store = sanitizeStoreConfig(config)
  const theme = buildStoreTheme(store)
  Object.entries(theme).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value)
  })
  document.documentElement.dataset.storeFlow = store.order_flow_type
  document.documentElement.dataset.storeCatalogMode = store.catalog_mode
}

export function mergeStoreConfigWithSettings(settingsMap = {}, storeConfig = null) {
  if (!storeConfig) return settingsMap

  const normalizedStore = sanitizeStoreConfig(storeConfig)
  return {
    ...settingsMap,
    ...normalizedStore,
    __storeConfig: normalizedStore,
  }
}

export function isStoreModuleEnabled(config = {}, moduleKey) {
  const profile = buildStoreOperationalProfile(config)
  return sanitizeBoolean(profile[`module_${moduleKey}_enabled`], true)
}

export async function loadStoreConfig(storeId = DEFAULT_STORE_CONFIG.store_code, client = supabase, options = {}) {
  const visibility = normalizeVisibility(options.visibility)
  const normalizedStoreId = sanitizeCode(storeId, DEFAULT_STORE_CONFIG.store_code)
  if (shouldUseLocalPreviewDefaults(normalizedStoreId)) {
    return sanitizeStoreConfig({
      ...DEFAULT_STORE_CONFIG,
      id: DEFAULT_STORE_ID,
      store_code: DEFAULT_STORE_ID,
    })
  }
  if (normalizedStoreId === DEFAULT_STORE_CONFIG.store_code) {
    if (visibility === 'public') {
      const [settingsRes, storeRes, processRes, configRes] = await Promise.all([
        client.from('settings').select('key,value').in('key', PUBLIC_STORE_SETTING_KEYS),
        client.from('stores').select('id,slug,code,name,status,plan_id,business_type,niche,template_id').eq('id', normalizedStoreId).maybeSingle(),
        client.from('store_process_profiles').select('*').eq('store_id', normalizedStoreId).maybeSingle(),
        client.from('config_tienda').select('*').eq('id', STORE_CONFIG_ROW_ID).maybeSingle(),
      ])

      if (settingsRes.error && !isMissingRelation(settingsRes.error)) throw settingsRes.error
      if (storeRes.error && !isMissingRelation(storeRes.error)) throw storeRes.error
      if (processRes.error && !isMissingRelation(processRes.error)) throw processRes.error
      if (configRes.error && !isMissingRelation(configRes.error)) throw configRes.error

      const scopedValues = mapRowsToConfig(settingsRes.data || [])
      const store = storeRes.data || {}
      const process = processRes.data || {}
      const baseConfig = configRes.data || {}
      const nicheThemeDefaults = await loadNicheTemplateTheme({
        templateId: scopedValues.template_id || store.template_id,
        niche: scopedValues.niche || store.niche || scopedValues.business_type || store.business_type,
      }, client).catch(() => ({}))

      return sanitizeStoreConfig({
        ...DEFAULT_STORE_CONFIG,
        ...baseConfig,
        ...Object.fromEntries(
          Object.entries(nicheThemeDefaults).filter(([, value]) => normalizeText(value) !== ''),
        ),
        ...scopedValues,
        id: STORE_CONFIG_ROW_ID,
        store_code: scopedValues.store_code || store.code || normalizedStoreId,
        business_name: scopedValues.business_name || store.name || DEFAULT_STORE_CONFIG.business_name,
        business_type: scopedValues.business_type || store.business_type || DEFAULT_STORE_CONFIG.business_type,
        plan_slug: scopedValues.plan_slug || store.plan_id || DEFAULT_STORE_CONFIG.plan_slug,
        order_flow_type: scopedValues.order_flow_type || process.order_flow_type || DEFAULT_STORE_CONFIG.order_flow_type,
        catalog_mode: scopedValues.catalog_mode || process.catalog_mode || DEFAULT_STORE_CONFIG.catalog_mode,
        requires_preparation: process.requires_preparation ?? scopedValues.requires_preparation ?? DEFAULT_STORE_CONFIG.requires_preparation,
        requires_dispatch: process.requires_dispatch ?? scopedValues.requires_dispatch ?? DEFAULT_STORE_CONFIG.requires_dispatch,
        enable_delivery: process.enable_delivery ?? scopedValues.enable_delivery ?? DEFAULT_STORE_CONFIG.enable_delivery,
        enable_pickup: process.enable_pickup ?? scopedValues.enable_pickup ?? DEFAULT_STORE_CONFIG.enable_pickup,
        module_products_enabled: process.module_products_enabled ?? scopedValues.module_products_enabled ?? DEFAULT_STORE_CONFIG.module_products_enabled,
        module_combos_enabled: process.module_combos_enabled ?? scopedValues.module_combos_enabled ?? DEFAULT_STORE_CONFIG.module_combos_enabled,
        module_toppings_enabled: process.module_toppings_enabled ?? scopedValues.module_toppings_enabled ?? DEFAULT_STORE_CONFIG.module_toppings_enabled,
        module_stock_enabled: process.module_stock_enabled ?? scopedValues.module_stock_enabled ?? DEFAULT_STORE_CONFIG.module_stock_enabled,
        module_coupons_enabled: process.module_coupons_enabled ?? scopedValues.module_coupons_enabled ?? DEFAULT_STORE_CONFIG.module_coupons_enabled,
        module_loyalty_enabled: process.module_loyalty_enabled ?? scopedValues.module_loyalty_enabled ?? DEFAULT_STORE_CONFIG.module_loyalty_enabled,
        module_reviews_enabled: process.module_reviews_enabled ?? scopedValues.module_reviews_enabled ?? DEFAULT_STORE_CONFIG.module_reviews_enabled,
        module_affiliates_enabled: process.module_affiliates_enabled ?? scopedValues.module_affiliates_enabled ?? DEFAULT_STORE_CONFIG.module_affiliates_enabled,
        module_chatbot_enabled: process.module_chatbot_enabled ?? scopedValues.module_chatbot_enabled ?? DEFAULT_STORE_CONFIG.module_chatbot_enabled,
        module_staff_enabled: process.module_staff_enabled ?? scopedValues.module_staff_enabled ?? DEFAULT_STORE_CONFIG.module_staff_enabled,
        module_finance_enabled: process.module_finance_enabled ?? scopedValues.module_finance_enabled ?? DEFAULT_STORE_CONFIG.module_finance_enabled,
      })
    }

    const [configRes, settingsRes] = await Promise.all([
      client
        .from('config_tienda')
        .select('*')
        .eq('id', STORE_CONFIG_ROW_ID)
        .maybeSingle(),
      client
        .from('settings')
        .select('key,value')
        .in('key', PUBLIC_STORE_SETTING_KEYS),
    ])

    if (configRes.error) {
      const message = String(configRes.error.message || '')
      if (/does not exist|schema cache|relation/i.test(message)) {
        return null
      }
      throw configRes.error
    }

    if (settingsRes.error && !isMissingRelation(settingsRes.error)) {
      throw settingsRes.error
    }

    const mirroredSettings = mapRowsToConfig(settingsRes.data || [])
    return configRes.data
      ? sanitizeStoreConfig({ ...configRes.data, ...mirroredSettings })
      : sanitizeStoreConfig({ ...DEFAULT_STORE_CONFIG, ...mirroredSettings })
  }

  let scopedQuery = client.from('store_settings').select('key,value').eq('store_id', normalizedStoreId)
  if (visibility === 'public') {
    scopedQuery = scopedQuery.in('key', PUBLIC_STORE_SETTING_KEYS)
  }

  const [scopedRes, storeRes, processRes] = await Promise.all([
    scopedQuery,
    client.from('stores').select('id,slug,code,name,status,plan_id,business_type,niche,template_id').eq('id', normalizedStoreId).maybeSingle(),
    client.from('store_process_profiles').select('*').eq('store_id', normalizedStoreId).maybeSingle(),
  ])

  if (scopedRes.error && !isMissingRelation(scopedRes.error)) throw scopedRes.error
  if (storeRes.error && !isMissingRelation(storeRes.error)) throw storeRes.error
  if (processRes.error && !isMissingRelation(processRes.error)) throw processRes.error

  const scopedValues = mapRowsToConfig(scopedRes.data || [])
  const store = storeRes.data || {}
  const process = processRes.data || {}
  const nicheThemeDefaults = await loadNicheTemplateTheme({
    templateId: scopedValues.template_id || store.template_id,
    niche: scopedValues.niche || store.niche || scopedValues.business_type || store.business_type,
  }, client).catch(() => ({}))

  return sanitizeStoreConfig({
    ...DEFAULT_STORE_CONFIG,
    ...Object.fromEntries(
      Object.entries(nicheThemeDefaults).filter(([, value]) => normalizeText(value) !== ''),
    ),
    ...scopedValues,
    id: STORE_CONFIG_ROW_ID,
    store_code: scopedValues.store_code || store.code || store.id || normalizedStoreId,
    business_name: scopedValues.business_name || store.name || DEFAULT_STORE_CONFIG.business_name,
    business_type: scopedValues.business_type || store.business_type || DEFAULT_STORE_CONFIG.business_type,
    plan_slug: scopedValues.plan_slug || store.plan_id || DEFAULT_STORE_CONFIG.plan_slug,
    order_flow_type: scopedValues.order_flow_type || process.order_flow_type || DEFAULT_STORE_CONFIG.order_flow_type,
    catalog_mode: scopedValues.catalog_mode || process.catalog_mode || DEFAULT_STORE_CONFIG.catalog_mode,
    requires_preparation: process.requires_preparation ?? scopedValues.requires_preparation ?? DEFAULT_STORE_CONFIG.requires_preparation,
    requires_dispatch: process.requires_dispatch ?? scopedValues.requires_dispatch ?? DEFAULT_STORE_CONFIG.requires_dispatch,
    enable_delivery: process.enable_delivery ?? scopedValues.enable_delivery ?? DEFAULT_STORE_CONFIG.enable_delivery,
    enable_pickup: process.enable_pickup ?? scopedValues.enable_pickup ?? DEFAULT_STORE_CONFIG.enable_pickup,
    module_products_enabled: process.module_products_enabled ?? scopedValues.module_products_enabled ?? DEFAULT_STORE_CONFIG.module_products_enabled,
    module_combos_enabled: process.module_combos_enabled ?? scopedValues.module_combos_enabled ?? DEFAULT_STORE_CONFIG.module_combos_enabled,
    module_toppings_enabled: process.module_toppings_enabled ?? scopedValues.module_toppings_enabled ?? DEFAULT_STORE_CONFIG.module_toppings_enabled,
    module_stock_enabled: process.module_stock_enabled ?? scopedValues.module_stock_enabled ?? DEFAULT_STORE_CONFIG.module_stock_enabled,
    module_coupons_enabled: process.module_coupons_enabled ?? scopedValues.module_coupons_enabled ?? DEFAULT_STORE_CONFIG.module_coupons_enabled,
    module_loyalty_enabled: process.module_loyalty_enabled ?? scopedValues.module_loyalty_enabled ?? DEFAULT_STORE_CONFIG.module_loyalty_enabled,
    module_reviews_enabled: process.module_reviews_enabled ?? scopedValues.module_reviews_enabled ?? DEFAULT_STORE_CONFIG.module_reviews_enabled,
    module_affiliates_enabled: process.module_affiliates_enabled ?? scopedValues.module_affiliates_enabled ?? DEFAULT_STORE_CONFIG.module_affiliates_enabled,
    module_chatbot_enabled: process.module_chatbot_enabled ?? scopedValues.module_chatbot_enabled ?? DEFAULT_STORE_CONFIG.module_chatbot_enabled,
    module_staff_enabled: process.module_staff_enabled ?? scopedValues.module_staff_enabled ?? DEFAULT_STORE_CONFIG.module_staff_enabled,
    module_finance_enabled: process.module_finance_enabled ?? scopedValues.module_finance_enabled ?? DEFAULT_STORE_CONFIG.module_finance_enabled,
  })
}

export async function saveStoreConfig(nextConfig, storeId = DEFAULT_STORE_CONFIG.store_code, client = supabase) {
  const config = sanitizeStoreConfig(nextConfig)
  const normalizedStoreId = sanitizeCode(storeId || config.store_code, config.store_code)
  if (normalizedStoreId !== DEFAULT_STORE_CONFIG.store_code) {
    const scopedRows = SCOPED_STORE_CONFIG_KEYS.map(key => ({
      store_id: normalizedStoreId,
      key,
      value: String(config[key] ?? ''),
    }))

    const { error: scopedError } = await client
      .from('store_settings')
      .upsert(scopedRows, { onConflict: 'store_id,key' })

    if (scopedError && !isMissingRelation(scopedError)) throw scopedError

    const { error: storeError } = await client
      .from('stores')
      .upsert({
        id: normalizedStoreId,
        slug: config.store_code,
        code: config.store_code,
        name: config.business_name,
        business_type: config.business_type,
        plan_id: config.plan_slug,
      }, { onConflict: 'id' })

    if (storeError && !isMissingRelation(storeError)) throw storeError

    const processPayload = {
      store_id: normalizedStoreId,
      order_flow_type: config.order_flow_type,
      catalog_mode: config.catalog_mode,
      requires_preparation: config.requires_preparation,
      requires_dispatch: config.requires_dispatch,
      enable_delivery: config.enable_delivery,
      enable_pickup: config.enable_pickup,
      module_products_enabled: config.module_products_enabled,
      module_combos_enabled: config.module_combos_enabled,
      module_toppings_enabled: config.module_toppings_enabled,
      module_stock_enabled: config.module_stock_enabled,
      module_coupons_enabled: config.module_coupons_enabled,
      module_loyalty_enabled: config.module_loyalty_enabled,
      module_reviews_enabled: config.module_reviews_enabled,
      module_affiliates_enabled: config.module_affiliates_enabled,
      module_chatbot_enabled: config.module_chatbot_enabled,
      module_staff_enabled: config.module_staff_enabled,
      module_finance_enabled: config.module_finance_enabled,
    }
    const { error: processError } = await client
      .from('store_process_profiles')
      .upsert(processPayload, { onConflict: 'store_id' })
    if (processError && !isMissingRelation(processError)) throw processError
    return config
  }

  let payload = { ...config }
  const existingConfigRes = await client
    .from('config_tienda')
    .select('*')
    .eq('id', STORE_CONFIG_ROW_ID)
    .maybeSingle()

  if (existingConfigRes.error && !isMissingRelation(existingConfigRes.error)) {
    throw existingConfigRes.error
  }

  if (existingConfigRes.data) {
    const allowedColumns = new Set(Object.keys(existingConfigRes.data))
    payload = Object.fromEntries(
      Object.entries(payload).filter(([key]) => allowedColumns.has(key))
    )
  }

  while (true) {
    const { error } = await client
      .from('config_tienda')
      .upsert(payload, { onConflict: 'id' })

    if (!error) break

    const missingColumn = getMissingColumnName(error)
    if (!missingColumn || !(missingColumn in payload)) throw error
    delete payload[missingColumn]
  }

  const mirroredRows = DEFAULT_STORE_PUBLIC_MIRROR_KEYS
    .map(key => ({ key, value: String(config[key] ?? '') }))
    .concat({ key: 'support_hours', value: String(config.store_hours_text ?? '') })

  const { error: mirrorError } = await client
    .from('settings')
    .upsert(mirroredRows, { onConflict: 'key' })

  if (mirrorError && !isMissingRelation(mirrorError)) throw mirrorError

  return config
}

export async function syncLegacySettingsFromStoreConfig(nextConfig, storeId = DEFAULT_STORE_CONFIG.store_code, client = supabase) {
  const config = sanitizeStoreConfig(nextConfig)
  const payload = DEFAULT_STORE_PUBLIC_MIRROR_KEYS
    .map(key => ({ key, value: String(config[key] ?? '') }))
    .concat({ key: 'support_hours', value: String(config.store_hours_text ?? '') })

  const normalizedStoreId = sanitizeCode(storeId || config.store_code, config.store_code)
  if (normalizedStoreId !== DEFAULT_STORE_CONFIG.store_code) {
    const scopedPayload = payload.map(entry => ({ ...entry, store_id: normalizedStoreId }))
    const { error: scopedError } = await client
      .from('store_settings')
      .upsert(scopedPayload, { onConflict: 'store_id,key' })

    if (scopedError && !isMissingRelation(scopedError)) throw scopedError
    return
  }

  const { error } = await client
    .from('settings')
    .upsert(payload, { onConflict: 'key' })

  if (error) throw error
}
