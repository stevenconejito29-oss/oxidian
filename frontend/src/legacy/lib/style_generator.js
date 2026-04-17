/**
 * OXIDIAN · style_generator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de diseño dinámico por tienda.
 *
 * Funciones:
 *   applyStoreDesign(config)         → Inyecta CSS vars + tema DaisyUI + fuentes
 *   loadAndApplyStoreDesign(storeId) → Carga config desde Supabase y aplica
 *   DAISY_THEMES                     → Lista de temas DaisyUI disponibles
 *   buildThemePreview(theme)         → Preview para el selector en el admin
 *
 * Flujo:
 *   1. Lee los campos theme_* de store_settings / config_tienda
 *   2. Inyecta variables CSS en :root → sobrescriben el tema DaisyUI base
 *   3. Cambia el atributo data-theme del <html> al tema DaisyUI elegido
 *   4. Carga las fuentes de Google Fonts de forma dinámica (solo si cambian)
 *   5. Inyecta --brand-button-radius para redondeo personalizado
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { loadStoreConfig, sanitizeStoreConfig } from './storeConfig'

// ── Temas DaisyUI disponibles ─────────────────────────────────────────────────
export const DAISY_THEMES = [
  { id: 'oxidian',   label: 'OXIDIAN (por defecto)',  emoji: '⬡' },
  { id: 'light',     label: 'Claro',                  emoji: '☀️' },
  { id: 'dark',      label: 'Oscuro',                 emoji: '🌙' },
  { id: 'cupcake',   label: 'Cupcake',                emoji: '🧁' },
  { id: 'retro',     label: 'Retro',                  emoji: '📻' },
  { id: 'synthwave', label: 'Synthwave',              emoji: '🌆' },
  { id: 'cyberpunk', label: 'Cyberpunk',              emoji: '🤖' },
  { id: 'valentine', label: 'Valentine',              emoji: '💖' },
  { id: 'halloween', label: 'Halloween',              emoji: '🎃' },
  { id: 'garden',    label: 'Garden',                 emoji: '🌻' },
  { id: 'forest',    label: 'Forest',                 emoji: '🌲' },
  { id: 'aqua',      label: 'Aqua',                   emoji: '🐠' },
  { id: 'pastel',    label: 'Pastel',                 emoji: '🎨' },
  { id: 'fantasy',   label: 'Fantasy',                emoji: '🔮' },
  { id: 'luxury',    label: 'Luxury',                 emoji: '💎' },
  { id: 'dracula',   label: 'Dracula',                emoji: '🧛' },
  { id: 'autumn',    label: 'Otoño',                  emoji: '🍂' },
  { id: 'business',  label: 'Business',               emoji: '💼' },
  { id: 'lemonade',  label: 'Lemonade',               emoji: '🍋' },
  { id: 'night',     label: 'Night',                  emoji: '🌃' },
  { id: 'coffee',    label: 'Coffee',                 emoji: '☕' },
  { id: 'winter',    label: 'Winter',                 emoji: '❄️' },
  { id: 'nord',      label: 'Nord',                   emoji: '🏔️' },
  { id: 'sunset',    label: 'Sunset',                 emoji: '🌅' },
]

// ── Fuentes Google Fonts disponibles para el admin ───────────────────────────
export const GOOGLE_FONTS_OPTIONS = [
  { id: 'Nunito',       label: 'Nunito (cuerpo por defecto)',    category: 'sans-serif' },
  { id: 'Pacifico',     label: 'Pacifico (display por defecto)', category: 'display'   },
  { id: 'Manrope',      label: 'Manrope (SaaS premium)',         category: 'sans-serif' },
  { id: 'Space Grotesk',label: 'Space Grotesk (tech bold)',      category: 'display'   },
  { id: 'Inter',        label: 'Inter (técnica/limpia)',          category: 'sans-serif' },
  { id: 'Roboto',       label: 'Roboto (neutral)',                category: 'sans-serif' },
  { id: 'Lato',         label: 'Lato (moderna)',                  category: 'sans-serif' },
  { id: 'Poppins',      label: 'Poppins (redondeada)',            category: 'sans-serif' },
  { id: 'Montserrat',   label: 'Montserrat (premium)',            category: 'sans-serif' },
  { id: 'Oswald',       label: 'Oswald (impacto)',                category: 'sans-serif' },
  { id: 'Raleway',      label: 'Raleway (elegante)',              category: 'sans-serif' },
  { id: 'Outfit',       label: 'Outfit (moderna editorial)',      category: 'sans-serif' },
  { id: 'DM Sans',      label: 'DM Sans (boutique)',              category: 'sans-serif' },
  { id: 'IBM Plex Sans',label: 'IBM Plex Sans (premium tech)',    category: 'sans-serif' },
  { id: 'Playfair Display', label: 'Playfair (editorial)',        category: 'serif'      },
  { id: 'Cormorant Garamond', label: 'Cormorant (editorial luxe)', category: 'serif'     },
  { id: 'Merriweather', label: 'Merriweather (legible)',          category: 'serif'      },
  { id: 'Lora',         label: 'Lora (artesanal)',                category: 'serif'      },
  { id: 'Fraunces',     label: 'Fraunces (boutique)',             category: 'serif'      },
  { id: 'Libre Baskerville', label: 'Libre Baskerville (tradicion)', category: 'serif'   },
  { id: 'Dancing Script',   label: 'Dancing Script (cursiva)',    category: 'handwriting'},
  { id: 'Comfortaa',    label: 'Comfortaa (amigable)',            category: 'display'    },
  { id: 'Righteous',    label: 'Righteous (retro/bold)',          category: 'display'    },
  { id: 'Lobster',      label: 'Lobster (llamativa)',             category: 'display'    },
  { id: 'Bebas Neue',   label: 'Bebas Neue (caps bold)',          category: 'display'    },
  { id: 'Syne',         label: 'Syne (editorial fuerte)',         category: 'display'    },
  { id: 'Permanent Marker', label: 'Permanent Marker (marker)',   category: 'handwriting'},
]

// ── Cache de fuentes ya cargadas (evita re-insertar el mismo link) ────────────
const _loadedFonts = new Set()

/**
 * Carga una fuente Google Fonts de forma dinámica.
 * Si ya fue cargada en esta sesión, no hace nada.
 */
export function loadGoogleFont(fontName) {
  if (!fontName || typeof document === 'undefined') return
  const normalized = fontName.trim()
  if (!normalized || _loadedFonts.has(normalized)) return

  const family = encodeURIComponent(normalized).replace(/%20/g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700;800;900&display=swap`

  // Verificar si el link ya existe en el DOM
  const existing = document.querySelector(`link[href^="https://fonts.googleapis.com/css2?family=${family}"]`)
  if (existing) {
    _loadedFonts.add(normalized)
    return
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
  _loadedFonts.add(normalized)
}

/**
 * Aplica el tema visual completo de una tienda al DOM.
 * Llama a esta función cada vez que cambia la tienda activa.
 *
 * @param {object} config - Resultado de sanitizeStoreConfig()
 */
export function applyStoreDesign(config = {}) {
  if (typeof document === 'undefined') return

  const store = sanitizeStoreConfig(config)

  // ── 1. Cargar fuentes Google Fonts ─────────────────────────────────────────
  loadGoogleFont(store.theme_font_display)
  loadGoogleFont(store.theme_font_body)

  // ── 2. Inyectar CSS variables en :root ─────────────────────────────────────
  const root = document.documentElement
  const vars = {
    // Variables de marca (usadas en CSS legacy y componentes)
    '--brand-primary':         store.theme_primary_color,
    '--brand-secondary':       store.theme_secondary_color,
    '--brand-accent':          store.theme_accent_color,
    '--brand-surface':         store.theme_surface_color,
    '--brand-text':            store.theme_text_color,
    '--brand-font-display':    `'${store.theme_font_display}', cursive`,
    '--brand-font-body':       `'${store.theme_font_body}', system-ui, sans-serif`,
    '--brand-button-radius':   store.theme_button_radius,

    // Variables DaisyUI (sobrescriben el tema elegido)
    '--p':  hexToHslComponents(store.theme_primary_color),
    '--s':  hexToHslComponents(store.theme_secondary_color),
    '--a':  hexToHslComponents(store.theme_accent_color),
    '--b1': hexToHslComponents(store.theme_surface_color),
    '--bc': hexToHslComponents(store.theme_text_color),

    // Border radius DaisyUI
    '--rounded-btn':   store.theme_button_radius,
    '--rounded-box':   `calc(${store.theme_button_radius} + 4px)`,
    '--rounded-badge': '999px',
  }

  Object.entries(vars).forEach(([token, value]) => {
    if (value) root.style.setProperty(token, value)
  })

  // ── 3. Aplicar tema DaisyUI ─────────────────────────────────────────────────
  const daisyTheme = store.theme_daisy_theme || 'oxidian'
  root.setAttribute('data-theme', daisyTheme)

  // ── 4. Metadata operacional ─────────────────────────────────────────────────
  root.dataset.storeFlow        = store.order_flow_type
  root.dataset.storeCatalogMode = store.catalog_mode
}

/**
 * Carga la config de una tienda desde Supabase y aplica el diseño.
 * Versión async para uso en ThemeBoot y cambios de tienda.
 */
export async function loadAndApplyStoreDesign(storeId = 'default') {
  try {
    const config = await loadStoreConfig(storeId)
    if (config) applyStoreDesign(config)
  } catch (err) {
    console.warn('[OXIDIAN] loadAndApplyStoreDesign error:', err?.message)
  }
}

/**
 * Construye un preview para el selector de temas en el admin.
 */
export function buildThemePreview(themeId) {
  const theme = DAISY_THEMES.find(t => t.id === themeId)
  return theme ? `${theme.emoji} ${theme.label}` : themeId
}

// ── Utilidad: convierte #hex a componentes HSL para DaisyUI ──────────────────
// DaisyUI espera las variables de color como "H S% L%" sin la función hsl()
function hexToHslComponents(hex) {
  if (!hex || typeof hex !== 'string') return null
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null

  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
