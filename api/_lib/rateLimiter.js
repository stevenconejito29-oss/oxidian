/**
 * rateLimiter.js — Rate limiting en memoria para Vercel Serverless Functions.
 *
 * No persiste entre instancias (sin Redis), pero es suficiente para bloquear
 * ráfagas de un mismo IP en la misma instancia. Para producción a escala
 * considera @upstash/ratelimit + Redis.
 *
 * Uso:
 *   import { checkRateLimit } from '../_lib/rateLimiter.js'
 *   const result = checkRateLimit(req, { max: 10, windowMs: 60_000 })
 *   if (!result.ok) return json(res, 429, { error: result.error })
 */

const _store = new Map()

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown'
}

function pruneExpired(now) {
  for (const [key, entry] of _store) {
    if (now - entry.windowStart >= entry.windowMs) _store.delete(key)
  }
}

/**
 * @param {object} req  — Node.js / Vercel request
 * @param {object} opts
 * @param {number} opts.max        — máximo de llamadas permitidas en la ventana
 * @param {number} opts.windowMs   — duración de la ventana en ms (default 60 000)
 * @param {string} [opts.key]      — clave personalizada (si no, usa IP)
 * @returns {{ ok: boolean, remaining: number, error?: string }}
 */
export function checkRateLimit(req, { max = 20, windowMs = 60_000, key } = {}) {
  const now = Date.now()
  pruneExpired(now)

  const clientKey = key || getClientIp(req)
  const existing = _store.get(clientKey)

  if (!existing || now - existing.windowStart >= windowMs) {
    _store.set(clientKey, { count: 1, windowStart: now, windowMs })
    return { ok: true, remaining: max - 1 }
  }

  existing.count++
  _store.set(clientKey, existing)

  if (existing.count > max) {
    const retryAfterSec = Math.ceil((windowMs - (now - existing.windowStart)) / 1000)
    return {
      ok: false,
      remaining: 0,
      error: `Demasiadas solicitudes. Intenta en ${retryAfterSec} segundos.`,
      retryAfter: retryAfterSec,
    }
  }

  return { ok: true, remaining: max - existing.count }
}
