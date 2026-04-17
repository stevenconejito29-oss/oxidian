import { json, loadCheckoutStatus } from '../_lib/oxidianSaas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  try {
    const sessionId = String(req.query.session_id || '').trim()
    if (!sessionId) throw new Error('Falta session_id')

    const payload = await loadCheckoutStatus(sessionId, req)
    return json(res, 200, payload)
  } catch (error) {
    return json(res, 400, { error: error.message || 'No pude cargar la sesion' })
  }
}
