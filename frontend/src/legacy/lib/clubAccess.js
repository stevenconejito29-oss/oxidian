export const CLUB_LEVEL_META = {
  hierro: { id: 'hierro', label: 'Hierro', shortLabel: 'Hierro+', accent: '#6B7280', bg: '#F3F4F6', text: '#374151', emoji: '⚙️' },
  bronce: { id: 'bronce', label: 'Bronce', shortLabel: 'Bronce+', accent: '#CD7F32', bg: '#FFF7ED', text: '#9A3412', emoji: '🥉' },
  plata: { id: 'plata', label: 'Plata', shortLabel: 'Plata+', accent: '#94A3B8', bg: '#F8FAFC', text: '#475569', emoji: '🥈' },
  oro: { id: 'oro', label: 'Oro', shortLabel: 'Oro+', accent: '#D4AF37', bg: '#FFFBEB', text: '#A16207', emoji: '🥇' },
  diamante: { id: 'diamante', label: 'Diamante', shortLabel: 'Diamante+', accent: '#38BDF8', bg: '#F0F9FF', text: '#0369A1', emoji: '💎' },
}

const ANY_CLUB_META = {
  id: '',
  label: 'Club CarmoCream',
  shortLabel: 'Club',
  accent: '#1C3829',
  bg: '#ECFDF5',
  text: '#166534',
  emoji: '⭐',
}

export function getClubLevelMeta(levelId) {
  if (!levelId) return ANY_CLUB_META
  return CLUB_LEVEL_META[levelId] || ANY_CLUB_META
}

export function buildClubAccessMeta(item, currentLevel, levels) {
  if (!item?.club_only) return null

  const requiredLevel = item.club_only_level
    ? (levels || []).find(level => level.id === item.club_only_level) || getClubLevelMeta(item.club_only_level)
    : ANY_CLUB_META

  const currentLevelMeta = currentLevel
    ? (levels || []).find(level => level.id === currentLevel.id) || getClubLevelMeta(currentLevel.id)
    : null

  const requirementLabel = item.club_only_level
    ? `${requiredLevel.label}+`
    : 'Miembros Club'

  const unlockedLabel = currentLevelMeta
    ? item.club_only_level
      ? `Desbloqueado por tu nivel ${currentLevelMeta.label}`
      : 'Incluido por tu acceso al Club'
    : 'Exclusivo del Club'

  return {
    requirementLabel,
    badgeLabel: item.club_only_level ? requiredLevel.shortLabel : 'Club',
    unlockedLabel,
    accent: requiredLevel.accent || ANY_CLUB_META.accent,
    bg: requiredLevel.bg || ANY_CLUB_META.bg,
    text: requiredLevel.text || ANY_CLUB_META.text,
    emoji: requiredLevel.emoji || ANY_CLUB_META.emoji,
  }
}

export function canLevelAccessClubItem(item, level, levels) {
  if (!item?.club_only) return true
  if (!level) return false

  const levelList = Array.isArray(levels) ? levels : []
  if (item.club_only_level) {
    const requiredLevel = levelList.find(entry => entry.id === item.club_only_level)
    if (!requiredLevel) return level.exclusive_menu === true
    return Number(level.min_orders || 0) >= Number(requiredLevel.min_orders || 0)
  }

  return level.exclusive_menu === true
}

export function buildClubUnlocks({ currentLevel, levels, products, combos, maxItems = 6 }) {
  if (!currentLevel) {
    return { items: [], total: 0, productCount: 0, comboCount: 0 }
  }

  const levelList = Array.isArray(levels) ? [...levels] : []
  const sortedLevels = levelList.sort((a, b) => Number(a.min_orders || 0) - Number(b.min_orders || 0))
  const currentIndex = sortedLevels.findIndex(level => level.id === currentLevel.id)
  const previousLevel = currentIndex > 0 ? sortedLevels[currentIndex - 1] : null

  const allItems = [
    ...(Array.isArray(products) ? products : []).map(item => ({ ...item, _clubType: 'product' })),
    ...(Array.isArray(combos) ? combos : []).map(item => ({ ...item, _clubType: 'combo' })),
  ]

  const unlockedItems = allItems.filter(item => {
    if (!item?.club_only) return false
    if (item.available === false) return false
    if (item.out_of_stock === true) return false

    const canAccessNow = canLevelAccessClubItem(item, currentLevel, sortedLevels)
    const couldAccessBefore = previousLevel
      ? canLevelAccessClubItem(item, previousLevel, sortedLevels)
      : false

    return canAccessNow && !couldAccessBefore
  })

  return {
    items: unlockedItems.slice(0, maxItems).map(item => ({
      id: item.id,
      name: item.name,
      type: item._clubType,
      emoji: item.emoji || (item._clubType === 'combo' ? '🎁' : '🍓'),
      clubOnlyLevel: item.club_only_level || '',
    })),
    total: unlockedItems.length,
    productCount: unlockedItems.filter(item => item._clubType === 'product').length,
    comboCount: unlockedItems.filter(item => item._clubType === 'combo').length,
  }
}
