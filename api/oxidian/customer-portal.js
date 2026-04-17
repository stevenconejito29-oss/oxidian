/**
 * /api/oxidian/customer-portal.js
 * Genera una sesión del Stripe Billing Portal para que el owner de una tienda
 * pueda gestionar su suscripción (cancelar, cambiar plan, ver facturas)
 * sin pasar por el super admin.
 *
 * POST /api/oxidian/customer-portal
 * Body: { storeId: string }
 * Response: { url: string }
 */
import { createSupabaseAdminClient, createStripeClient, json, readJsonBody, resolvePublicBaseUrl } from '../_lib/oxidianSaas.js'
import { checkRateLimit } from '../_lib/rateLimiter.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  const rl = checkRateLimit(req, { max: 10, windowMs: 60_000 })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60))
    return json(res, 429, { error: rl.error })
  }

  try {
    const body    = await readJsonBody(req)
    const storeId = String(body.storeId || '').trim()
    if (!storeId) throw new Error('Falta el storeId')

    const client  = createSupabaseAdminClient()
    const stripe  = createStripeClient()

    // Buscar el stripe_customer_id para este store en los checkouts
    const { data: checkout, error: checkoutErr } = await client
      .from('oxidian_checkout_sessions')
      .select('stripe_customer_id,customer_email')
      .eq('store_id', storeId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkoutErr) throw checkoutErr
    if (!checkout?.stripe_customer_id) {
      throw new Error('No se encontró una suscripción activa para esta tienda')
    }

    const returnUrl = `${resolvePublicBaseUrl(req)}/s/${storeId}/admin`

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkout.stripe_customer_id,
      return_url: returnUrl,
    })

    return json(res, 200, { url: portalSession.url })
  } catch (error) {
    return json(res, 400, { error: error.message || 'No pude crear la sesión del portal' })
  }
}
