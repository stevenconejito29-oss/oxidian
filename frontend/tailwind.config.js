import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Tailwind genera solo las clases usadas en producción.
  // DaisyUI añade componentes y temas de alto nivel.
  plugins: [
    daisyui,
  ],
  daisyui: {
    // Temas disponibles para cada tienda (el dueño elige desde el admin)
    themes: [
      // Tema personalizado: se genera dinámicamente en runtime con CSS vars
      // Los temas nativos de DaisyUI son fallback si el custom falla
      "light",
      "dark",
      "cupcake",
      "retro",
      "synthwave",
      "cyberpunk",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "aqua",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
      "dim",
      "nord",
      "sunset",
      // Tema OXIDIAN personalizado (sobrescrito en runtime por store CSS vars)
      {
        oxidian: {
          "primary":          "#2D6A4F",
          "secondary":        "#40916C",
          "accent":           "#E8607A",
          "neutral":          "#2D1F1A",
          "base-100":         "#FFF5EE",
          "base-200":         "#F3EDE6",
          "base-300":         "#E8DFDA",
          "info":             "#0EA5E9",
          "success":          "#22C55E",
          "warning":          "#F59E0B",
          "error":            "#EF4444",
          "--rounded-btn":    "14px",
          "--rounded-box":    "18px",
          "--rounded-badge":  "999px",
        },
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
  // Las CSS vars de la tienda siempre ganan sobre Tailwind/DaisyUI
  // gracias a la especificidad del selector :root en applyStoreTheme()
}
