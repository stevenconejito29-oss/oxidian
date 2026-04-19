/**
 * planFeatures.js — Sistema de planes y feature gating para Oxidian SaaS
 *
 * Arquitectura inspirada en:
 * - Notion / Linear / Vercel (plan tiers)
 * - Feature flag best practices 2025
 *
 * El Super Admin puede:
 *   1. Asignar un plan a cada tenant
 *   2. Hacer override manual de features específicas por tenant
 *   3. Ver qué usa cada tenant y escalar según el plan
 *
 * El frontend usa `usePlan()` para decidir qué mostrar/bloquear.
 */

// ─── Definición de features disponibles ──────────────────────────
export const FEATURES = {
  // Límites estructurales
  MAX_STORES:        'max_stores',         // Cuántas tiendas puede crear
  MAX_BRANCHES:      'max_branches',       // Sedes por tienda
  MAX_STAFF:         'max_staff',          // Cuentas de staff totales
  MAX_PRODUCTS:      'max_products',       // Productos por tienda

  // Módulos del menú y pedidos
  MENU_PUBLIC:       'menu_public',        // Menú público visible
  MENU_CUSTOM_STYLE: 'menu_custom_style',  // Elegir template/estilo
  MENU_CUSTOM_THEME: 'menu_custom_theme',  // Colores personalizados
  ORDERS:            'orders',             // Sistema de pedidos
  ORDERS_REALTIME:   'orders_realtime',    // Notificaciones en tiempo real

  // Marketing
  COUPONS:           'coupons',            // Cupones de descuento
  LOYALTY:           'loyalty',            // Programa de fidelidad
  AFFILIATES:        'affiliates',         // Afiliados con comisiones
  REVIEWS:           'reviews',            // Reseñas de clientes

  // Operaciones
  KITCHEN_PANEL:     'kitchen_panel',      // Panel de cocina
  RIDERS_PANEL:      'riders_panel',       // Panel de repartidores
  STOCK:             'stock',              // Control de inventario
  FINANCE:           'finance',            // Panel financiero / caja

  // Chatbot
  CHATBOT_BASIC:     'chatbot_basic',      // Chatbot WhatsApp sin IA
  CHATBOT_AI:        'chatbot_ai',         // Chatbot con IA (Groq/OpenAI)
  CHATBOT_PORTABLE:  'chatbot_portable',   // Descarga ZIP portable

  // Analytics
  ANALYTICS_BASIC:   'analytics_basic',   // Métricas básicas
  ANALYTICS_FULL:    'analytics_full',    // Analytics completo
}

// ─── Planes con sus límites y features ───────────────────────────
export const PLANS = {
  starter: {
    id:          'starter',
    name:        'Starter',
    emoji:       '🌱',
    price:       0,
    currency:    'EUR',
    period:      'mes',
    description: 'Perfecto para empezar. Una tienda, todo lo esencial.',
    color:       '#64748b',
    highlight:   false,
    limits: {
      [FEATURES.MAX_STORES]:   1,
      [FEATURES.MAX_BRANCHES]: 1,
      [FEATURES.MAX_STAFF]:    3,
      [FEATURES.MAX_PRODUCTS]: 30,
    },
    features: [
      FEATURES.MENU_PUBLIC,
      FEATURES.ORDERS,
      FEATURES.KITCHEN_PANEL,
    ],
    description_items: [
      '1 tienda · 1 sede',
      'Hasta 30 productos',
      'Menú público visible',
      'Panel de cocina básico',
      '3 cuentas de staff',
    ],
  },

  growth: {
    id:          'growth',
    name:        'Growth',
    emoji:       '🚀',
    price:       49,
    currency:    'EUR',
    period:      'mes',
    description: 'Para negocios que crecen. Chatbot, marketing y más sedes.',
    color:       '#6366f1',
    highlight:   true,
    limits: {
      [FEATURES.MAX_STORES]:   3,
      [FEATURES.MAX_BRANCHES]: 3,
      [FEATURES.MAX_STAFF]:    10,
      [FEATURES.MAX_PRODUCTS]: 200,
    },
    features: [
      FEATURES.MENU_PUBLIC,
      FEATURES.MENU_CUSTOM_STYLE,
      FEATURES.ORDERS,
      FEATURES.ORDERS_REALTIME,
      FEATURES.KITCHEN_PANEL,
      FEATURES.RIDERS_PANEL,
      FEATURES.COUPONS,
      FEATURES.REVIEWS,
      FEATURES.CHATBOT_BASIC,
      FEATURES.CHATBOT_PORTABLE,
      FEATURES.ANALYTICS_BASIC,
    ],
    description_items: [
      'Hasta 3 tiendas · 3 sedes por tienda',
      'Hasta 200 productos',
      'Chatbot WhatsApp portable',
      'Cupones y reseñas',
      'Panel repartidores',
      '10 cuentas de staff',
    ],
  },

  pro: {
    id:          'pro',
    name:        'Pro',
    emoji:       '⚡',
    price:       99,
    currency:    'EUR',
    period:      'mes',
    description: 'El kit completo. Afiliados, IA, analytics y personalización total.',
    color:       '#f59e0b',
    highlight:   false,
    limits: {
      [FEATURES.MAX_STORES]:   10,
      [FEATURES.MAX_BRANCHES]: 10,
      [FEATURES.MAX_STAFF]:    50,
      [FEATURES.MAX_PRODUCTS]: 1000,
    },
    features: [
      FEATURES.MENU_PUBLIC,
      FEATURES.MENU_CUSTOM_STYLE,
      FEATURES.MENU_CUSTOM_THEME,
      FEATURES.ORDERS,
      FEATURES.ORDERS_REALTIME,
      FEATURES.KITCHEN_PANEL,
      FEATURES.RIDERS_PANEL,
      FEATURES.COUPONS,
      FEATURES.LOYALTY,
      FEATURES.AFFILIATES,
      FEATURES.REVIEWS,
      FEATURES.CHATBOT_BASIC,
      FEATURES.CHATBOT_AI,
      FEATURES.CHATBOT_PORTABLE,
      FEATURES.ANALYTICS_BASIC,
      FEATURES.ANALYTICS_FULL,
      FEATURES.STOCK,
      FEATURES.FINANCE,
    ],
    description_items: [
      'Hasta 10 tiendas · 10 sedes por tienda',
      'Productos ilimitados',
      'Chatbot con IA (Groq/OpenAI)',
      'Afiliados + Fidelidad + Stock',
      'Analytics completo',
      '50 cuentas de staff',
    ],
  },

  enterprise: {
    id:          'enterprise',
    name:        'Enterprise',
    emoji:       '🏆',
    price:       299,
    currency:    'EUR',
    period:      'mes',
    description: 'Sin límites. Para cadenas y grandes operaciones.',
    color:       '#10b981',
    highlight:   false,
    limits: {
      [FEATURES.MAX_STORES]:   Infinity,
      [FEATURES.MAX_BRANCHES]: Infinity,
      [FEATURES.MAX_STAFF]:    Infinity,
      [FEATURES.MAX_PRODUCTS]: Infinity,
    },
    features: Object.values(FEATURES), // Todo incluido
    description_items: [
      'Tiendas y sedes ilimitadas',
      'Staff y productos ilimitados',
      'Todo el stack de features',
      'Soporte prioritario',
      'Onboarding dedicado',
      'SLA garantizado',
    ],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Devuelve el objeto del plan dado su id */
export function getPlan(planId) {
  return PLANS[planId] || PLANS.starter
}

/** Comprueba si un plan tiene acceso a un feature */
export function planHasFeature(planId, feature) {
  const plan = getPlan(planId)
  return plan.features.includes(feature)
}

/** Devuelve el límite numérico de un plan para un feature */
export function planLimit(planId, limitKey) {
  const plan = getPlan(planId)
  return plan.limits[limitKey] ?? 0
}

/** Nombre legible del límite */
export const LIMIT_LABELS = {
  [FEATURES.MAX_STORES]:   'tiendas',
  [FEATURES.MAX_BRANCHES]: 'sedes por tienda',
  [FEATURES.MAX_STAFF]:    'cuentas de staff',
  [FEATURES.MAX_PRODUCTS]: 'productos',
}

/** Nombre legible del feature */
export const FEATURE_LABELS = {
  [FEATURES.MENU_PUBLIC]:       'Menú público',
  [FEATURES.MENU_CUSTOM_STYLE]: 'Estilo de menú personalizado',
  [FEATURES.MENU_CUSTOM_THEME]: 'Colores y temas propios',
  [FEATURES.ORDERS]:            'Pedidos online',
  [FEATURES.ORDERS_REALTIME]:   'Pedidos en tiempo real',
  [FEATURES.COUPONS]:           'Cupones de descuento',
  [FEATURES.LOYALTY]:           'Programa de fidelidad',
  [FEATURES.AFFILIATES]:        'Red de afiliados',
  [FEATURES.REVIEWS]:           'Reseñas de clientes',
  [FEATURES.KITCHEN_PANEL]:     'Panel de cocina',
  [FEATURES.RIDERS_PANEL]:      'Panel de repartidores',
  [FEATURES.STOCK]:             'Control de inventario',
  [FEATURES.FINANCE]:           'Panel financiero',
  [FEATURES.CHATBOT_BASIC]:     'Chatbot WhatsApp',
  [FEATURES.CHATBOT_AI]:        'Chatbot con Inteligencia Artificial',
  [FEATURES.CHATBOT_PORTABLE]:  'Chatbot portable descargable',
  [FEATURES.ANALYTICS_BASIC]:   'Analytics básico',
  [FEATURES.ANALYTICS_FULL]:    'Analytics completo',
}

/** Qué plan mínimo necesita un feature */
export function minPlanForFeature(feature) {
  const order = ['starter', 'growth', 'pro', 'enterprise']
  for (const planId of order) {
    if (PLANS[planId].features.includes(feature)) return planId
  }
  return 'enterprise'
}
