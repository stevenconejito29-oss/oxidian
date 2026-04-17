export const MENU_STYLE_PRESETS = [
  {
    id: 'delivery',
    label: 'Brutalist',
    badge: 'Impacto',
    icon: '◆',
    description: 'Portada frontal, contrastada y agresiva para negocios que venden desde el primer impacto visual.',
    bestFor: 'Smash burgers, street food, drops rapidos, marcas con energia directa y ventas por impulso.',
    flowLabel: 'Impacto > scroll corto > accion > checkout',
    nicheLabel: 'Ideal para conversion rapida e Instagram browser',
    preview: {
      surface: 'linear-gradient(135deg,#f7f0e7,#f4d85b)',
      accent: '#151515',
      text: '#151515',
      chip: 'rgba(21,21,21,0.12)',
    },
    settings: {
      menu_layout: 'delivery',
      theme_primary_color: '#151515',
      theme_secondary_color: '#F4D85B',
      theme_accent_color: '#E55B2D',
      theme_surface_color: '#F7F0E7',
      theme_text_color: '#151515',
      theme_font_display: 'Syne',
      theme_font_body: 'Space Grotesk',
      theme_button_radius: '0px',
      theme_daisy_theme: 'retro',
      storefront_badge_text: 'DROP DEL DIA',
      storefront_announcement: 'Pedidos activos y cocina en ritmo de servicio.',
      storefront_search_placeholder: 'Busca tu antojo o combo estrella',
      storefront_intro_eyebrow: 'Template 01 · Brutalist commerce',
      storefront_intro_title: 'Oferta corta, lectura rapida y decision inmediata.',
      storefront_intro_text: 'Pensado para vender con energia alta, poco texto muerto y CTA directo al carrito.',
      storefront_story_quote: 'La marca entra primero por el golpe visual y el pedido se cierra sin friccion.',
      storefront_story_author: 'Equipo CarmoCream',
      storefront_primary_cta_label: 'Pedir ahora',
      storefront_secondary_cta_label: 'Ver categorias',
    },
  },
  {
    id: 'vitrina',
    label: 'Luxury',
    badge: 'Prestige',
    icon: '✦',
    description: 'Escaparate premium con foco en percepcion, lujo silencioso y fichas curadas.',
    bestFor: 'Pasteleria de autor, gifting premium, belleza, retail selecto y marcas de ticket medio-alto.',
    flowLabel: 'Prestigio > seleccion curada > bolsa > cierre',
    nicheLabel: 'Ideal para catalogo premium y marca nacional',
    preview: {
      surface: 'linear-gradient(135deg,#0e0e0e,#1f1b17)',
      accent: '#D2B48C',
      text: '#F4EDE1',
      chip: 'rgba(210,180,140,0.16)',
    },
    settings: {
      menu_layout: 'vitrina',
      theme_primary_color: '#111111',
      theme_secondary_color: '#1F1B17',
      theme_accent_color: '#D2B48C',
      theme_surface_color: '#F5EEE4',
      theme_text_color: '#161616',
      theme_font_display: 'Fraunces',
      theme_font_body: 'DM Sans',
      theme_button_radius: '8px',
      theme_daisy_theme: 'winter',
      storefront_badge_text: 'MAISON SELECTA',
      storefront_announcement: 'Coleccion activa con despacho priorizado para clientes premium.',
      storefront_search_placeholder: 'Busca una pieza, coleccion o pack premium',
      storefront_intro_eyebrow: 'Template 02 · Luxury storefront',
      storefront_intro_title: 'Un menu que se siente mas boutique que catalogo.',
      storefront_intro_text: 'Jerarquia elegante, ritmo pausado y narrativa visual para productos que venden estatus.',
      storefront_story_quote: 'Cuando el producto necesita percepcion, el layout debe sostener confianza y deseo.',
      storefront_story_author: 'Direccion de marca',
      storefront_primary_cta_label: 'Explorar coleccion',
      storefront_secondary_cta_label: 'Hablar por WhatsApp',
    },
  },
  {
    id: 'portfolio',
    label: 'Retro Neon',
    badge: 'Pulse',
    icon: '✷',
    description: 'Composicion vibrante con energia nocturna y una presencia mas experimental sin perder conversion.',
    bestFor: 'Ghost kitchens, cocktails, snacks nocturnos, productos jovenes y marcas con identidad fuerte.',
    flowLabel: 'Impacto > prueba social > carta > accion',
    nicheLabel: 'Ideal para marca audaz y comunidad recurrente',
    preview: {
      surface: 'linear-gradient(135deg,#150b2e,#2b0b45)',
      accent: '#FF4FD8',
      text: '#F7F3FF',
      chip: 'rgba(255,79,216,0.18)',
    },
    settings: {
      menu_layout: 'portfolio',
      theme_primary_color: '#9B2CFF',
      theme_secondary_color: '#1A1038',
      theme_accent_color: '#FF4FD8',
      theme_surface_color: '#130B2B',
      theme_text_color: '#F7F3FF',
      theme_font_display: 'Syne',
      theme_font_body: 'IBM Plex Sans',
      theme_button_radius: '18px',
      theme_daisy_theme: 'luxury',
      storefront_badge_text: 'AFTER DARK MENU',
      storefront_announcement: 'Produccion en vivo y promos activas para la comunidad.',
      storefront_search_placeholder: 'Busca sabores, especiales o combos neon',
      storefront_intro_eyebrow: 'Template 03 · Retro neon',
      storefront_intro_title: 'Un frente con memoria visual y timing de compra corto.',
      storefront_intro_text: 'Pensado para negocios que necesitan identidad fuerte, resenas visibles y recorridos memorables.',
      storefront_story_quote: 'Lo recordable convierte mejor cuando la compra sucede desde redes y en pocos toques.',
      storefront_story_author: 'Growth lab',
      storefront_primary_cta_label: 'Entrar al menu',
      storefront_secondary_cta_label: 'Ver resenas',
    },
  },
  {
    id: 'minimal',
    label: 'Zen',
    badge: 'Clarity',
    icon: '◌',
    description: 'Interfaz limpia, silenciosa y estable para tiendas donde la confianza entra por orden y claridad.',
    bestFor: 'Skincare, wellness, tea bars, menus saludables y catalogos donde menos ruido vende mas.',
    flowLabel: 'Calma > busqueda > seleccion > checkout',
    nicheLabel: 'Ideal para recompra y decisiones serenas',
    preview: {
      surface: 'linear-gradient(135deg,#f3f0e8,#e4dccd)',
      accent: '#5C6B5E',
      text: '#273127',
      chip: 'rgba(92,107,94,0.12)',
    },
    settings: {
      menu_layout: 'minimal',
      theme_primary_color: '#5C6B5E',
      theme_secondary_color: '#DCCEB8',
      theme_accent_color: '#9C7B5B',
      theme_surface_color: '#F3F0E8',
      theme_text_color: '#273127',
      theme_font_display: 'Libre Baskerville',
      theme_font_body: 'Outfit',
      theme_button_radius: '999px',
      theme_daisy_theme: 'garden',
      storefront_badge_text: 'SLOW SHOP',
      storefront_announcement: 'Atencion estable, catalogo claro y compra asistida desde admin.',
      storefront_search_placeholder: 'Busca por necesidad, categoria o ingrediente',
      storefront_intro_eyebrow: 'Template 04 · Zen commerce',
      storefront_intro_title: 'Claridad visual para comprar sin saturacion.',
      storefront_intro_text: 'Ideal para tiendas modelo donde el orden y la tranquilidad mejoran la confianza y la recompra.',
      storefront_story_quote: 'La sensacion de control reduce friccion y hace que el cliente vuelva.',
      storefront_story_author: 'Operacion CarmoCream',
      storefront_primary_cta_label: 'Comprar con calma',
      storefront_secondary_cta_label: 'Ver secciones',
    },
  },
]

export const STORE_VIEW_FLOW_STEPS = [
  {
    id: 'capture',
    title: 'Captacion',
    description: 'Hero, branding, link de Instagram y promesa comercial visibles desde el primer scroll.',
  },
  {
    id: 'conversion',
    title: 'Conversion',
    description: 'Categorias claras, CTA tactiles y estructura orientada a anadir al carrito sin friccion.',
  },
  {
    id: 'trust',
    title: 'Confianza',
    description: 'Resenas, horarios, ubicacion y canales de soporte para reducir abandono.',
  },
  {
    id: 'operation',
    title: 'Operacion',
    description: 'Links de admin, cocina, reparto y afiliados listos para cada sede sin mezclar identidades.',
  },
]

export const STORE_OPTION_GROUPS = [
  {
    id: 'identity',
    title: 'Identidad',
    description: 'Nombre, slug, owner, ubicacion, logo y promesa comercial.',
  },
  {
    id: 'experience',
    title: 'Experiencia',
    description: 'Estilo de menu, tema visual y estructura de vistas comerciales.',
  },
  {
    id: 'operation',
    title: 'Operacion',
    description: 'Flujo de pedido, modulos, delivery, pickup y runtime local.',
  },
  {
    id: 'growth',
    title: 'Crecimiento',
    description: 'Afiliados, reviews, fidelidad, cupones y enlaces de activacion.',
  },
]

const EXPERIENCE_CONTENT_KEYS = [
  'storefront_badge_text',
  'storefront_announcement',
  'storefront_search_placeholder',
  'storefront_intro_eyebrow',
  'storefront_intro_title',
  'storefront_intro_text',
  'storefront_story_quote',
  'storefront_story_author',
  'storefront_primary_cta_label',
  'storefront_secondary_cta_label',
]

export function getMenuStylePreset(styleId = 'delivery') {
  return MENU_STYLE_PRESETS.find(preset => preset.id === styleId) || MENU_STYLE_PRESETS[0]
}

export function buildExperienceSettingsPatch(styleId = 'delivery', options = {}) {
  const preset = getMenuStylePreset(styleId)
  const patch = {
    ...preset.settings,
  }

  if (options.includeContent === false) {
    EXPERIENCE_CONTENT_KEYS.forEach(key => {
      delete patch[key]
    })
  }

  return patch
}

export function recommendMenuStyleForBusinessType(businessType = 'food') {
  const normalized = String(businessType || '').trim().toLowerCase()
  if (normalized === 'retail' || normalized === 'beauty') return 'vitrina'
  if (normalized === 'service') return 'minimal'
  if (normalized === 'other') return 'portfolio'
  return 'delivery'
}
