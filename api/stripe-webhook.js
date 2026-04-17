import {
  createStripeClient,
  json,
  provisionStoreFromCheckoutSession,
  readRawBody,
} from './_lib/oxidianSaas.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  try {
    const stripe = createStripeClient()
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('Falta STRIPE_WEBHOOK_SECRET')

    const signature = req.headers['stripe-signature']
    if (!signature) throw new Error('Falta la firma Stripe-Signature')

    const rawBody = await readRawBody(req)
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret)

    if (event.type === 'checkout.session.completed') {
      await provisionStoreFromCheckoutSession(event.data.object, req)
    }

    return json(res, 200, { received: true })
  } catch (error) {
    return json(res, 400, { error: error.message || 'Webhook Stripe invalida' })
  }
}
