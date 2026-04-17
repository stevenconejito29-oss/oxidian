import React from 'react'
import { supabase } from '../../legacy/lib/supabase'
import { applyThemeTokens, clearThemeTokens } from '../../modules/theming/engine/themeEngine'

/**
 * ThemeProvider — Lee theme_tokens de la store activa y branch activa,
 * los fusiona y aplica como CSS vars al :root.
 */
export function ThemeProvider({ storeId, branchId, children }) {
  React.useEffect(() => {
    if (!storeId) { clearThemeTokens(); return }

    let cancelled = false

    async function loadAndApply() {
      try {
        const storeRes = await supabase
          .from('stores')
          .select('theme_tokens,template_id,store_templates(default_theme)')
          .eq('id', storeId)
          .maybeSingle()

        if (cancelled) return

        const storeData = storeRes.data || {}
        const templateDefaults = storeData.store_templates?.default_theme || {}
        const storeTokens = storeData.theme_tokens || {}
        const merged = { ...templateDefaults, ...storeTokens }

        let branchOverride = {}
        if (branchId) {
          const branchRes = await supabase
            .from('branches')
            .select('theme_override')
            .eq('id', branchId)
            .maybeSingle()
          if (!cancelled) branchOverride = branchRes.data?.theme_override || {}
        }

        if (!cancelled) applyThemeTokens(merged, branchOverride)
      } catch (err) {
        console.warn('[ThemeProvider] Error cargando tema:', err)
        if (!cancelled) clearThemeTokens()
      }
    }

    loadAndApply()
    return () => { cancelled = true }
  }, [storeId, branchId])

  return children
}

/**
 * Hook autónomo para aplicar tema desde Supabase.
 */
export function useTheme(storeId, branchId) {
  React.useEffect(() => {
    if (!storeId) { clearThemeTokens(); return }

    let cancelled = false

    async function load() {
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('theme_tokens,store_templates(default_theme)')
          .eq('id', storeId)
          .maybeSingle()

        if (cancelled) return

        const base = store?.store_templates?.default_theme || {}
        const tokens = store?.theme_tokens || {}
        let override = {}

        if (branchId) {
          const { data: branch } = await supabase
            .from('branches')
            .select('theme_override')
            .eq('id', branchId)
            .maybeSingle()
          if (!cancelled) override = branch?.theme_override || {}
        }

        if (!cancelled) applyThemeTokens({ ...base, ...tokens }, override)
      } catch {
        if (!cancelled) clearThemeTokens()
      }
    }

    load()
    return () => { cancelled = true }
  }, [storeId, branchId])
}
