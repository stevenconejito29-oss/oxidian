import {
  MENU_STYLE_PRESETS,
  recommendMenuStyleForBusinessType,
} from '../../../legacy/lib/storeExperience.js'

const NICHE_DEFINITIONS = [
  {
    id: 'barbershop',
    label: 'Barberia',
    icon: '✂️',
    color: '#1d4ed8',
    businessType: 'beauty',
    templateId: 'minimal',
  },
  {
    id: 'fastfood',
    label: 'Comida rapida',
    icon: '🍔',
    color: '#dc2626',
    businessType: 'food',
    templateId: 'delivery',
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    icon: '🍽️',
    color: '#ea580c',
    businessType: 'food',
    templateId: 'delivery',
  },
  {
    id: 'minimarket',
    label: 'Minimarket',
    icon: '🏪',
    color: '#15803d',
    businessType: 'retail',
    templateId: 'minimal',
  },
  {
    id: 'clothing',
    label: 'Ropa y moda',
    icon: '👕',
    color: '#be185d',
    businessType: 'retail',
    templateId: 'portfolio',
  },
  {
    id: 'universal',
    label: 'Universal',
    icon: '⭐',
    color: '#475569',
    businessType: 'other',
    templateId: 'delivery',
  },
]

export const TENANT_NICHES = NICHE_DEFINITIONS.map((niche) => ({
  ...niche,
  recommendedMenuStyleId: recommendMenuStyleForBusinessType(niche.businessType),
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
