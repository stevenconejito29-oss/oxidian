import { supabase } from './supabase'

export function parseComboSlots(raw) {
  try {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    if (typeof raw === 'object') return Object.values(raw)
    return []
  } catch {
    return []
  }
}

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export async function upsertSetting(key, value) {
  const normalizedValue = String(value ?? '')
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value: normalizedValue }, { onConflict: 'key' })
  if (error) throw error
}
