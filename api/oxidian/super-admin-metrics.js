import { createSupabaseAdminClient, json, readJsonBody } from '../_lib/oxidianSaas.js'
import { checkRateLimit } from '../_lib/rateLimiter.js'
import crypto from 'node:crypto'

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  const rl = checkRateLimit(req, { max: 20, windowMs: 60_000 })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60))
    return json(res, 429, { error: rl.error })
  }

  try {
    const body = await readJsonBody(req)
    const password = String(body.password || '').trim()
    if (!password) return json(res, 401, { error: 'Acceso no autorizado' })

    const client = createSupabaseAdminClient()

    // Verificar contraseña contra Supabase (igual que login.js)
    const { data: settingsData, error: settingsError } = await client
      .from('settings')
      .select('key,value')
      .in('key', ['oxidian_admin_password_hash', 'admin_password_hash'])

    if (settingsError) return json(res, 500, { error: settingsError.message })

    const map = Object.fromEntries((settingsData || []).map(r => [r.key, r.value]))
    const storedHash = map.oxidian_admin_password_hash || map.admin_password_hash || ''

    if (!storedHash || sha256(password) !== storedHash) {
      return json(res, 401, { error: 'Acceso no autorizado' })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [storesRes, checkoutsRes, ordersRes] = await Promise.all([
      client.from('stores').select('id,status,plan_id,created_at'),
      client.from('oxidian_checkout_sessions')
        .select('id,store_id,plan_id,onboarding_status,payment_status,created_at,customer_email,business_name,access_email_status')
        .order('created_at', { ascending: false })
        .limit(200),
      client.from('orders')
        .select('store_id,total,created_at')
        .gte('created_at', thirtyDaysAgo),
    ])

    const stores    = storesRes.data    || []
    const checkouts = checkoutsRes.data || []
    const orders    = ordersRes.data    || []

    const active  = stores.filter(s => s.status === 'active').length
    const draft   = stores.filter(s => s.status === 'draft').length

    const paid           = checkouts.filter(c => c.payment_status === 'paid')
    const pendingOnboard = paid.filter(c => c.onboarding_status !== 'completed').length
    const completed      = paid.filter(c => c.onboarding_status === 'completed').length

    const totalGmv = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)

    return json(res, 200, {
      total: stores.length,
      active,
      draft,
      paid: paid.length,
      pendingOnboard,
      completed,
      totalGmv,
      recentPaid: paid.slice(0, 10),
    })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Error interno' })
  }
}
