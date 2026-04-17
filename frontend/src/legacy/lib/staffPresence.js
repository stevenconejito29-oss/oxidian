import { supabase, supabaseKey, supabaseUrl } from './supabase'

// ── Heartbeat ────────────────────────────────────────────────────────────────
// Envía last_seen cada HEARTBEAT_MS ms mientras el staff está activo.
// Si la pestaña desaparece sin pasar por logout, la DB detecta inactividad
// cuando last_seen supere el umbral (usa una función de Supabase o cron).
const HEARTBEAT_MS = 60_000 // 60 segundos
const _heartbeatTimers = new Map()

async function _sendHeartbeat(staffId, storeId) {
  if (!staffId) return
  const now = new Date().toISOString()
  let query = supabase
    .from('staff_users')
    .update({ last_seen: now, is_online: true })
    .eq('id', staffId)
  if (storeId) query = query.eq('store_id', storeId)
  await query.catch(() => {})
}

/**
 * Inicia el heartbeat para un miembro de staff.
 * Llama inmediatamente y luego cada 60 s.
 * Retorna una función stop() para detenerlo.
 */
export function startStaffHeartbeat(staffId, storeId = null) {
  if (!staffId) return () => {}
  stopStaffHeartbeat(staffId) // evitar timers duplicados
  _sendHeartbeat(staffId, storeId) // primer latido inmediato
  const timer = setInterval(() => _sendHeartbeat(staffId, storeId), HEARTBEAT_MS)
  _heartbeatTimers.set(staffId, timer)
  return () => stopStaffHeartbeat(staffId)
}

/**
 * Detiene el heartbeat de un miembro de staff.
 */
export function stopStaffHeartbeat(staffId) {
  const timer = _heartbeatTimers.get(staffId)
  if (timer != null) {
    clearInterval(timer)
    _heartbeatTimers.delete(staffId)
  }
}

// ── Estado online / offline ──────────────────────────────────────────────────
export async function setStaffOnlineState(staffId, isOnline, storeId = null) {
  if (!staffId) return
  const patch = isOnline
    ? { is_online: true,  last_seen: new Date().toISOString() }
    : { is_online: false, last_seen: new Date().toISOString() }
  let query = supabase.from('staff_users').update(patch).eq('id', staffId)
  if (storeId) query = query.eq('store_id', storeId)
  await query
}

export function sendStaffOfflineBeacon(staffId, storeId = null) {
  if (!staffId || !supabaseUrl || !supabaseKey) return
  stopStaffHeartbeat(staffId)

  const filters = [`id=eq.${encodeURIComponent(staffId)}`]
  if (storeId) filters.push(`store_id=eq.${encodeURIComponent(storeId)}`)

  fetch(`${supabaseUrl}/rest/v1/staff_users?${filters.join('&')}`, {
    method: 'PATCH',
    keepalive: true,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() }),
  }).catch(() => {})
}
