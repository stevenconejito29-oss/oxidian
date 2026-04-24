const MENU_STYLE_PRESETS = [
  { id: 'delivery', label: 'Tarjetas Delivery' },
  { id: 'vitrina', label: 'Cuadricula Market' },
  { id: 'portfolio', label: 'Editorial Boutique' },
  { id: 'minimal', label: 'Lista Catalogo' },
  { id: 'booking', label: 'Citas y Reservas' },
  { id: 'express', label: 'Carta Express QR' },
]

const NICHE_DEFINITIONS = [
  { id: 'restaurant', label: 'Restaurante / Delivery', icon: '🍕', color: '#ef4444', businessType: 'food', templateId: 'delivery' },
  { id: 'supermarket', label: 'Supermercado / Tienda online', icon: '🛒', color: '#22c55e', businessType: 'retail', templateId: 'vitrina' },
  { id: 'boutique_fashion', label: 'Boutique / Moda', icon: '👗', color: '#ec4899', businessType: 'retail', templateId: 'portfolio' },
  { id: 'pharmacy', label: 'Farmacia / Parafarmacia', icon: '💊', color: '#0ea5e9', businessType: 'retail', templateId: 'minimal' },
  { id: 'neighborhood_store', label: 'Tienda de Barrio / Colmado', icon: '🏪', color: '#f97316', businessType: 'retail', templateId: 'minimal' },
  { id: 'barbershop', label: 'Barberia', icon: '✂️', color: '#1e40af', businessType: 'beauty', templateId: 'booking' },
  { id: 'beauty_salon', label: 'Salon de Belleza', icon: '💆', color: '#a855f7', businessType: 'beauty', templateId: 'booking' },
  { id: 'nail_salon', label: 'Salon de Unas', icon: '💅', color: '#f43f5e', businessType: 'beauty', templateId: 'booking' },
  { id: 'services', label: 'Servicios Profesionales', icon: '🛠️', color: '#6366f1', businessType: 'services', templateId: 'booking' },
  { id: 'fastfood', label: 'Comida rapida', icon: '🍔', color: '#dc2626', businessType: 'food', templateId: 'delivery' },
  { id: 'minimarket', label: 'Minimarket', icon: '🏪', color: '#15803d', businessType: 'retail', templateId: 'minimal' },
  { id: 'clothing', label: 'Ropa y moda', icon: '👕', color: '#be185d', businessType: 'retail', templateId: 'portfolio' },
  { id: 'universal', label: 'Universal / Otro', icon: '⭐', color: '#475569', businessType: 'other', templateId: 'delivery' },
]

export const TENANT_NICHES = NICHE_DEFINITIONS.map((niche) => ({
  ...niche,
  recommendedMenuStyleId: niche.templateId,
}))

export function getNicheDefinition(nicheId = 'universal') {
  return TENANT_NICHES.find((niche) => niche.id === nicheId) || TENANT_NICHES[TENANT_NICHES.length - 1]
}

export function getAvailableMenuStyles() {
  return MENU_STYLE_PRESETS.map((preset) => ({ ...preset }))
}

export function getMenuStyleDefinition(styleId = 'delivery') {
  return getAvailableMenuStyles().find((preset) => preset.id === styleId) || getAvailableMenuStyles()[0]
}

export function createStorePayload({
  name,
  slug,
  nicheId,
  city = '',
  initialBranchName = '',
  initialBranchSlug = '',
  initialBranchCity = '',
  initialBranchAddress = '',
}) {
  const niche = getNicheDefinition(nicheId)

  return {
    name,
    slug,
    id: slug,
    niche: niche.id,
    business_type: niche.businessType,
    template_id: niche.templateId,
    city,
    initial_branch_name: initialBranchName,
    initial_branch_slug: initialBranchSlug,
    initial_branch_city: initialBranchCity,
    initial_branch_address: initialBranchAddress,
  }
}
