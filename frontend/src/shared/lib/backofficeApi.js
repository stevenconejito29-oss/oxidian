/**
 * backofficeApi.js — Cliente HTTP para el backend Flask.
 *
 * IMPORTANTE: En Vercel (SPA pura), las rutas /admin/* y /tenant/* no existen
 * como endpoints — Vercel devuelve index.html (200, text/html).
 * Esta versión detecta respuestas no-JSON y lanza un error explícito
 * en lugar de devolver el HTML, evitando crashes de tipo "s.map is not a function".
 */
import { readCurrentSupabaseAccessToken } from '../../legacy/lib/appSession'

// URL base del backend Flask. Configura VITE_BACKEND_URL en Vercel si tienes
// el backend desplegado en otro dominio (ej. Railway, Render, etc.).
// Si está vacío, usa rutas relativas (solo funciona con backend local).
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''

async function request(prefix, method, path, body) {
  const token = readCurrentSupabaseAccessToken()
  const url   = `${BACKEND_BASE}${prefix}${path}`

  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkError) {
    throw new Error(`No se pudo conectar con el servidor (${url}): ${networkError.message}`)
  }

  // ── Verificar Content-Type ANTES de leer el body ─────────────────
  // Si Vercel devuelve index.html, el Content-Type es text/html, no application/json.
  // Devolver HTML como dato causa crashes (string.map is not a function).
  const contentType = response.headers.get('content-type') || ''
  const isJson      = contentType.includes('application/json') || contentType.includes('application/javascript')

  if (!isJson) {
    // 404/500 con HTML → backend no disponible o ruta incorrecta
    if (!response.ok) {
      throw new Error(`Error del servidor ${response.status}: ${response.statusText}`)
    }
    // 200 pero HTML → Vercel catch-all sirvió index.html en lugar del backend
    throw new Error(
      `El backend de administración no está disponible en "${prefix}${path}". ` +
      `Configura VITE_BACKEND_URL o asegúrate de que el servidor Flask esté corriendo.`
    )
  }

  // ── Parsear JSON ──────────────────────────────────────────────────
  const text = await response.text()
  let data = null
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('El servidor devolvió una respuesta JSON inválida.')
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.message || data?.error || response.statusText || 'Error del servidor'
    throw new Error(message)
  }

  return data
}

export function adminApi(method, path, body) {
  return request('/admin', method, path, body)
}

export function tenantApi(method, path, body) {
  return request('/tenant', method, path, body)
}
