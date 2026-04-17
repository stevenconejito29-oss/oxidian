import { DEFAULT_PRODUCT_SECTIONS } from './productSections'

export const PRODUCT_CATEGORIES = DEFAULT_PRODUCT_SECTIONS.map(section => ({
  id: section.id,
  label: section.label,
}))

export const CLUB_LEVEL_OPTIONS = [
  { id: '', label: 'Cualquier nivel Club' },
  { id: 'hierro', label: 'Hierro' },
  { id: 'bronce', label: 'Bronce' },
  { id: 'plata', label: 'Plata' },
  { id: 'oro', label: 'Oro' },
  { id: 'diamante', label: 'Diamante' },
]
