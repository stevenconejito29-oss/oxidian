import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ── Plugin: garantiza UTF-8 BOM-less en todos los .jsx/.js del src ──────────
function globSync(dir, exts, results = []) {
  try {
    readdirSync(dir).forEach(file => {
      const full = join(dir, file)
      try {
        if (statSync(full).isDirectory()) globSync(full, exts, results)
        else if (exts.some(e => full.endsWith(e))) results.push(full)
      } catch {}
    })
  } catch {}
  return results
}
function enforceUtf8Plugin() {
  return {
    name: 'enforce-utf8',
    buildStart() {
      const files = globSync('src', ['.jsx', '.js', '.ts', '.tsx'])
      files.forEach(f => {
        try {
          const buf = readFileSync(f)
          if (buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF) {
            writeFileSync(f, buf.slice(3))
            console.log('[utf8-plugin] BOM removed:', f)
          }
        } catch {}
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localChatbotUrl = env.VITE_LOCAL_CHATBOT_URL?.trim()

  return {
  css: {
    postcss: './postcss.config.js',
  },
  plugins: [react(), enforceUtf8Plugin()],

  // ── Proxy local → Chatbot Local (evita CORS en desarrollo) ─────────
  server: {
    proxy: localChatbotUrl ? {
      '/chatbot-proxy': {
        target: localChatbotUrl,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/chatbot-proxy/, ''),
      },
    } : undefined,
  },

  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase'))   return 'vendor-supabase'
          if (id.includes('node_modules/react-dom'))   return 'vendor-react'
          if (id.includes('node_modules/react/'))      return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-react'
          if (id.includes('node_modules/react-hot-toast')) return 'vendor-toast'
          if (id.includes('src/pages/Admin') || id.includes('src/legacy/pages/Admin')) return 'page-admin'
          if (id.includes('src/pages/Pedidos') ||
              id.includes('src/pages/Repartidor') ||
              id.includes('src/legacy/pages/Pedidos') ||
              id.includes('src/legacy/pages/Repartidor')) return 'page-staff'
        },
      },
    },
  },
  }
})
