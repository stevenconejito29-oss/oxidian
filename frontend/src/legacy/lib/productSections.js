export const NICHE_PRODUCT_SECTIONS = {
  mascotas: [
    { id: 'alimentacion',  label: '🥩 Alimentación',   icon: '🥩', sort_order: 10 },
    { id: 'accesorios',    label: '🦮 Accesorios',      icon: '🦮', sort_order: 20 },
    { id: 'salud',         label: '💊 Salud y cuidado', icon: '💊', sort_order: 30 },
    { id: 'juguetes',      label: '🎾 Juguetes',        icon: '🎾', sort_order: 40 },
    { id: 'higiene',       label: '🛁 Higiene',         icon: '🛁', sort_order: 50 },
    { id: 'ropa-mascotas', label: '👕 Ropa y camas',    icon: '👕', sort_order: 60 },
  ],
  moda: [
    { id: 'mujer',       label: '👩 Mujer',        icon: '👩', sort_order: 10 },
    { id: 'hombre',      label: '👨 Hombre',       icon: '👨', sort_order: 20 },
    { id: 'ninos',       label: '👶 Niños',        icon: '👶', sort_order: 30 },
    { id: 'calzado',     label: '👟 Calzado',      icon: '👟', sort_order: 40 },
    { id: 'accesorios',  label: '👜 Accesorios',   icon: '👜', sort_order: 50 },
    { id: 'temporada',   label: '✨ Temporada',    icon: '✨', sort_order: 60 },
  ],
  regalos: [
    { id: 'para-el',        label: '🎩 Para él',        icon: '🎩', sort_order: 10 },
    { id: 'para-ella',      label: '👛 Para ella',       icon: '👛', sort_order: 20 },
    { id: 'ninos',          label: '🧸 Para niños',      icon: '🧸', sort_order: 30 },
    { id: 'cumpleanos',     label: '🎂 Cumpleaños',      icon: '🎂', sort_order: 40 },
    { id: 'aniversario',    label: '💑 Aniversario',     icon: '💑', sort_order: 50 },
    { id: 'personalizados', label: '✍️ Personalizados', icon: '✍️', sort_order: 60 },
  ],
  despensa: [
    { id: 'frutas-verduras', label: '🥬 Frutas y verduras', icon: '🥬', sort_order: 10 },
    { id: 'lacteos',         label: '🥛 Lácteos',           icon: '🥛', sort_order: 20 },
    { id: 'carnes',          label: '🥩 Carnes',            icon: '🥩', sort_order: 30 },
    { id: 'panaderia',       label: '🍞 Panadería',         icon: '🍞', sort_order: 40 },
    { id: 'bebidas',         label: '🥤 Bebidas',           icon: '🥤', sort_order: 50 },
    { id: 'limpieza',        label: '🧹 Limpieza',          icon: '🧹', sort_order: 60 },
    { id: 'congelados',      label: '❄️ Congelados',       icon: '❄️', sort_order: 70 },
  ],
}

const DEFAULT_PRODUCT_SECTIONS = [
  { id: 'clasicos', label: '🍓 Clásicos', icon: '🍓', sort_order: 10 },
  { id: 'tropicales', label: '🌴 Tropicales', icon: '🌴', sort_order: 20 },
  { id: 'temporada', label: '☀️ Temporada', icon: '☀️', sort_order: 30 },
  { id: 'bebidas', label: '🥤 Bebidas', icon: '🥤', sort_order: 40 },
  { id: 'especiales', label: '🏆 Especiales', icon: '🏆', sort_order: 50 },
  { id: 'postres', label: '🍨 Postres', icon: '🍨', sort_order: 60 },
  { id: 'helados', label: '🍦 Helados', icon: '🍦', sort_order: 70 },
  { id: 'smoothies', label: '🥤 Smoothies', icon: '🥤', sort_order: 80 },
  { id: 'ensaladas', label: '🥗 Ensaladas de Fruta', icon: '🥗', sort_order: 90 },
]

function slugifySectionId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeSection(section, index = 0) {
  if (!section || typeof section !== 'object') return null
  const id = slugifySectionId(section.id || section.label)
  const label = String(section.label || '').trim()
  if (!id || !label) return null
  return {
    id,
    label,
    icon: String(section.icon || '').trim() || '🍰',
    sort_order: Number.isFinite(Number(section.sort_order)) ? Number(section.sort_order) : (index + 1) * 10,
  }
}

export function parseProductSections(raw) {
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw.map((section, index) => normalizeSection(section, index)).filter(Boolean)
  }

  if (typeof raw === 'string') {
    try {
      return parseProductSections(JSON.parse(raw))
    } catch {
      return []
    }
  }

  return []
}

export function getProductSections(raw) {
  const parsed = parseProductSections(raw)
  return parsed.length > 0 ? parsed.sort((a, b) => a.sort_order - b.sort_order) : DEFAULT_PRODUCT_SECTIONS
}

export function getProductSectionMap(raw) {
  return Object.fromEntries(getProductSections(raw).map(section => [section.id, section]))
}

export function resolveProductSection(raw, id) {
  const safeId = slugifySectionId(id) || 'postres'
  return getProductSectionMap(raw)[safeId] || {
    id: safeId,
    label: safeId.replace(/-/g, ' ').toUpperCase(),
    icon: '🍰',
    sort_order: 999,
  }
}

export function getProductSectionSortOrder(raw) {
  return getProductSections(raw).map(section => section.id)
}

export function createEmptyProductSection() {
  return {
    id: '',
    label: '',
    icon: '🍰',
    sort_order: DEFAULT_PRODUCT_SECTIONS.length * 10 + 10,
  }
}

export { DEFAULT_PRODUCT_SECTIONS, slugifySectionId }
