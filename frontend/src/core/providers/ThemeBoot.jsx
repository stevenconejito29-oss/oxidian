import React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { applyStoreDesign, loadGoogleFont } from '../../legacy/lib/style_generator'
import { resolveConfiguredStoreContext } from '../../legacy/lib/currentStore'
import { OXIDIAN_THEME_CONFIG } from '../config/brand'
import { resolveRouteThemeConfig } from '../../modules/theming/resolvers/storeTheme'
import { useTheme } from './ThemeProvider'

const GOOGLE_FONTS = ['Pacifico', 'Nunito', 'Space Grotesk', 'Manrope', 'Fraunces', 'DM Sans', 'Syne', 'Outfit']

/**
 * ThemeBoot — Arranque del sistema de tematización.
 * 1. Carga fuentes base de Google Fonts.
 * 2. Si hay ?store= en la URL, aplica theme_tokens desde Supabase (engine nuevo).
 * 3. Fallback al sistema legacy de applyStoreDesign para rutas legacy.
 */
export default function ThemeBoot() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') || null

  // Engine nuevo: tema desde Supabase si hay storeId en URL
  useTheme(storeId, null)

  // Precargar fuentes base
  React.useEffect(() => {
    GOOGLE_FONTS.forEach(loadGoogleFont)
  }, [])

  // Sistema legacy: solo activo en rutas /legacy/* o cuando no hay storeId en URL nuevo
  React.useEffect(() => {
    if (storeId) return  // El engine nuevo ya lo maneja

    let active = true
    resolveConfiguredStoreContext()
      .then(context => resolveRouteThemeConfig(location.pathname, location.search, context))
      .then(config => {
        if (active) applyStoreDesign(config || OXIDIAN_THEME_CONFIG)
      })
      .catch(() => {
        if (active) applyStoreDesign(OXIDIAN_THEME_CONFIG)
      })

    return () => { active = false }
  }, [location.pathname, location.search, storeId])

  return null
}
