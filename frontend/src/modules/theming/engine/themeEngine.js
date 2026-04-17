/**
 * themeEngine.js — Aplica theme_tokens de Supabase como CSS vars al :root.
 * 
 * theme_tokens estructura (jsonb en stores):
 * {
 *   theme_primary_color: '#151515',
 *   theme_secondary_color: '#F4D85B',
 *   theme_accent_color: '#E55B2D',
 *   theme_surface_color: '#F7F0E7',
 *   theme_text_color: '#151515',
 *   theme_font_display: 'Syne',
 *   theme_font_body: 'Space Grotesk',
 *   theme_button_radius: '0px',
 * }
 *
 * branch.theme_override sobreescribe con los mismos keys.
 */

export const TOKEN_MAP = {
  theme_primary_color:    '--brand-primary',
  theme_secondary_color:  '--brand-secondary',
  theme_accent_color:     '--brand-accent',
  theme_surface_color:    '--brand-surface',
  theme_text_color:       '--brand-text',
  theme_font_display:     '--brand-font-display',
  theme_font_body:        '--brand-font-body',
  theme_button_radius:    '--brand-radius',
}

/**
 * Aplica un conjunto de tokens al :root del documento.
 * Llama con el objeto theme_tokens de la store + theme_override del branch.
 */
export function applyThemeTokens(tokens = {}, override = {}) {
  const merged = { ...tokens, ...override }
  const root = document.documentElement

  for (const [key, cssVar] of Object.entries(TOKEN_MAP)) {
    const value = merged[key]
    if (value) {
      root.style.setProperty(cssVar, value)
    }
  }

  // Cargar fuentes de Google Fonts si no están ya
  const fontDisplay = merged.theme_font_display
  const fontBody = merged.theme_font_body
  loadGoogleFont(fontDisplay)
  loadGoogleFont(fontBody)
}

/**
 * Limpia los tokens de tema del :root (para cuando no hay store activa).
 */
export function clearThemeTokens() {
  const root = document.documentElement
  for (const cssVar of Object.values(TOKEN_MAP)) {
    root.style.removeProperty(cssVar)
  }
}

const loadedFonts = new Set()

function loadGoogleFont(fontName) {
  if (!fontName || loadedFonts.has(fontName)) return
  const existing = document.querySelector(`link[data-font="${fontName}"]`)
  if (existing) { loadedFonts.add(fontName); return }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.setAttribute('data-font', fontName)
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(link)
  loadedFonts.add(fontName)
}
