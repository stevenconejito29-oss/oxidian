import {
  CHATBOT_API_URL,
  buildChatbotHeaders,
  getChatbotConfigError,
  isChatbotConfigured,
} from './chatbotConfig'

const STATUS_ENDPOINTS = ['/chatbot/status', '/status', '/']
const SEND_ENDPOINTS = ['/chatbot/send', '/send']

function normalizePhone(raw) {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('34') && digits.length === 11) return digits
  if (digits.length === 9) return `34${digits}`
  if (digits.length >= 10) return digits
  return digits || null
}

export async function checkAgentStatus() {
  if (!isChatbotConfigured()) {
    return { ready: false, error: getChatbotConfigError() }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    let lastError = null

    for (const endpoint of STATUS_ENDPOINTS) {
      const res = await fetch(`${CHATBOT_API_URL}${endpoint}`, {
        method: 'GET',
        headers: buildChatbotHeaders(),
        signal: controller.signal,
      })

      let data = {}
      try { data = await res.json() } catch {}

      if (res.ok) {
        clearTimeout(timeoutId)
        const ready = data.ready === true || data.connected === true
        return { ready, raw: data }
      }

      if (res.status !== 404) {
        lastError = data.error || `HTTP ${res.status}`
        break
      }
    }

    clearTimeout(timeoutId)
    return { ready: false, error: lastError || 'No se pudo obtener estado del chatbot local' }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ready: false, error: 'Timeout conectando con el servidor local del chatbot' }
    }
    return { ready: false, error: err.message }
  }
}

async function requestChatbotJson(paths, init) {
  if (!isChatbotConfigured()) {
    return { ok: false, error: getChatbotConfigError() }
  }

  let lastError = null

  for (const path of paths) {
    try {
      const res = await fetch(`${CHATBOT_API_URL}${path}`, {
        ...init,
        headers: buildChatbotHeaders(init?.headers || {}),
      })

      let data = {}
      try { data = await res.json() } catch {}

      if (res.ok) {
        const success = data.success === true || data.ok === true || data.connected === true || data.ready === true
        return { ok: success || res.ok, data, status: res.status }
      }

      lastError = data.error || `HTTP ${res.status}`
      if (res.status !== 404) {
        return { ok: false, error: lastError, data, status: res.status }
      }
    } catch (error) {
      lastError = error.message
    }
  }

  return { ok: false, error: lastError || 'No se pudo contactar con el chatbot local' }
}

export async function sendWhatsAppRaw(phone, message) {
  const normalized = normalizePhone(phone)
  if (!normalized || !String(message || '').trim()) {
    return { sent: false, reason: 'datos_incompletos' }
  }

  const response = await requestChatbotJson(SEND_ENDPOINTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, message }),
  })

  return response.ok ? { sent: true } : { sent: false, error: response.error }
}
