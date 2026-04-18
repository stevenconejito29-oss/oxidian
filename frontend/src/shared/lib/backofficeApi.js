import { readCurrentSupabaseAccessToken } from '../../legacy/lib/appSession'

async function request(prefix, method, path, body) {
  const token = readCurrentSupabaseAccessToken()
  const response = await fetch(`${prefix}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.message || data?.error || response.statusText || 'Request failed'
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
