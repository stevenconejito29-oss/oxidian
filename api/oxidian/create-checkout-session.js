import {
  assertSaasCheckoutReady,
  createStripeClient,
  json,
  readJsonBody,
  resolvePublicBaseUrl,
  slugifyStoreToken,
} from '../_lib/oxidianSaas.js'
import { createCheckoutSessionSchema, parseSchema } from '../_lib/requestSchemas.js'
import { checkRateLimit } from '../_lib/rateLimiter.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  // Max 5 sesiones por IP en 5 minutos
  const rl = checkRateLimit(req, { max: 5, windowMs: 5 * 60_000 })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60))
    return json(res, 429, { error: rl.error })
  }

  try {
    const payload = parseSchema(createCheckoutSessionSchema, await readJsonBody(req))
    const planId = slugifyStoreToken(payload.planId, '')
    const businessName = payload.businessName
    const ownerName = payload.ownerName
    const ownerEmail = payload.ownerEmail
    const ownerPhone = payload.ownerPhone
    const niche = payload.niche

    const { priceId } = await assertSaasCheckoutReady(planId)
    const stripe = createStripeClient()
    const baseUrl = resolvePublicBaseUrl(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      customer_email: ownerEmail,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      metadata: {
        planId,
        businessName,
        ownerName,
        ownerEmail,
        ownerPhone,
        niche,
        business_type: niche,
        requestedSlug: slugifyStoreToken(businessName, 'store'),
      },
      subscription_data: {
        metadata: {
          planId,
          businessName,
          ownerEmail,
          niche,
        },
      },
    })

    return json(res, 200, { url: session.url })
  } catch (error) {
    return json(res, 400, { error: error.message || 'No pude crear la sesion de checkout' })
  }
}
