function normalizeBaseUrl(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

function normalizePort(rawValue) {
  const parsed = Number.parseInt(String(rawValue || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '3001'
}

function getDesktopRuntimeConfig() {
  if (typeof window === 'undefined') return null
  return window.carmocreamDesktopAdmin?.runtimeConfig || null
}

function buildLoopbackUrl() {
  const desktopUrl = normalizeBaseUrl(getDesktopRuntimeConfig()?.chatbotUrl)
  if (desktopUrl) return desktopUrl

  const explicitUrl = normalizeBaseUrl(import.meta.env.VITE_LOCAL_CHATBOT_URL)
  if (explicitUrl) return explicitUrl

  const port = normalizePort(import.meta.env.VITE_LOCAL_CHATBOT_PORT)
  return `http://127.0.0.1:${port}`
}

function resolveSecret() {
  const desktopSecret = String(getDesktopRuntimeConfig()?.chatbotSecret || '').trim()
  if (desktopSecret) return desktopSecret
  return String(import.meta.env.VITE_LOCAL_CHATBOT_SECRET || '').trim()
}

const chatbotApiUrl = buildLoopbackUrl()
const chatbotApiSecret = resolveSecret()

export const CHATBOT_API_URL = chatbotApiUrl
export const CHATBOT_API_SECRET = chatbotApiSecret

export function isChatbotConfigured() {
  return Boolean(CHATBOT_API_URL)
}

export function getChatbotConfigError() {
  if (!CHATBOT_API_URL) {
    return 'Configura la URL local del chatbot o deja el puerto por defecto para usar 127.0.0.1:3001.'
  }
  return null
}

export function buildChatbotHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders }
  if (CHATBOT_API_SECRET) headers['x-secret'] = CHATBOT_API_SECRET
  return headers
}
