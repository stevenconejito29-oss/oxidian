import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const DEFAULT_RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=300, s-maxage=300',
  vary: 'Host',
}

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
}

async function loadDomainMapping(client, host) {
  const candidates = host.startsWith('www.')
    ? [host, host.slice(4)]
    : [host, `www.${host}`]

  for (const candidate of candidates) {
    const response = await client
      .from('domain_mappings')
      .select('store_id')
      .eq('domain', candidate)
      .maybeSingle()

    if (response.error) return response
    if (response.data?.store_id) return response
  }

  return { data: null, error: null }
}

function jsonResponse(payload, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...DEFAULT_RESPONSE_HEADERS,
      ...extraHeaders,
    },
  })
}

function createSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Metodo no permitido' }, { allow: 'GET' }, 405)
  }

  const host = normalizeHost(
    request.headers.get('x-forwarded-host')
      || request.headers.get('host')
      || request.headers.get('x-original-host'),
  )

  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return jsonResponse({ storeId: null, niche: null })
  }

  try {
    const client = createSupabaseAdminClient()
    const mappingResponse = await loadDomainMapping(client, host)

    if (mappingResponse.error) {
      const message = String(mappingResponse.error.message || '')
      if (/does not exist|schema cache|relation|Could not find the table/i.test(message)) {
        return jsonResponse({ storeId: null, niche: null })
      }
      throw mappingResponse.error
    }

    const storeId = String(mappingResponse.data?.store_id || '').trim()
    if (!storeId) {
      return jsonResponse({ storeId: null, niche: null })
    }

    const storeResponse = await client
      .from('stores')
      .select('niche,business_type')
      .eq('id', storeId)
      .maybeSingle()

    if (storeResponse.error) {
      const message = String(storeResponse.error.message || '')
      if (!/does not exist|schema cache|relation|Could not find the table/i.test(message)) {
        throw storeResponse.error
      }
    }

    const niche = String(
      storeResponse.data?.niche || storeResponse.data?.business_type || '',
    ).trim() || null

    // Cargar emoji del store_settings para el PageLoader neutro
    let emoji = null
    try {
      const settingsRes = await client
        .from('store_settings')
        .select('value')
        .eq('store_id', storeId)
        .eq('key', 'store_emoji')
        .maybeSingle()
      emoji = settingsRes.data?.value || null
    } catch { /* opcional, no bloquea */ }

    return jsonResponse(
      { storeId, niche, emoji },
      {
        'x-store-id': storeId,
        ...(niche ? { 'x-store-niche': niche } : {}),
        ...(emoji ? { 'x-store-emoji': emoji } : {}),
      },
    )
  } catch (error) {
    return jsonResponse({ error: error.message || 'No pude resolver el tenant' }, {}, 500)
  }
}
