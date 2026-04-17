import {
  completeOnboarding,
  json,
  loadOnboardingByToken,
  readJsonBody,
} from '../_lib/oxidianSaas.js'
import { onboardingCompletionSchema, parseSchema } from '../_lib/requestSchemas.js'
import { checkRateLimit } from '../_lib/rateLimiter.js'

export default async function handler(req, res) {
  // Max 10 intentos por IP en 10 minutos (previene fuerza bruta de tokens)
  const rl = checkRateLimit(req, { max: 10, windowMs: 10 * 60_000 })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60))
    return json(res, 429, { error: rl.error })
  }

  try {
    if (req.method === 'GET') {
      const token = String(req.query.token || '').trim()
      if (!token) throw new Error('Falta el token de onboarding')
      const payload = await loadOnboardingByToken(token)
      return json(res, 200, payload)
    }

    if (req.method === 'POST') {
      const payload = parseSchema(onboardingCompletionSchema, await readJsonBody(req))
      const result = await completeOnboarding(payload, req)
      return json(res, 200, result)
    }

    res.setHeader('Allow', 'GET, POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  } catch (error) {
    return json(res, 400, { error: error.message || 'No pude procesar el onboarding' })
  }
}
