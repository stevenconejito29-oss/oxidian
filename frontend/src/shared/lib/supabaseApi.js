/**
 * supabaseApi.js — Frontend habla directo con Supabase (RLS protege los datos).
 *
 * Usa el cliente `supabaseAuth` que lleva el JWT del usuario logueado.
 * Las políticas RLS en Supabase garantizan que:
 *   - super_admin ve TODO
 *   - tenant_owner/admin ve solo su tenant
 *   - store_admin ve solo su tienda
 *   - etc.
 *
 * Para operaciones que requieren service_role (crear usuarios Auth),
 * usa `backofficeApi.js` que llama al endpoint Flask en Vercel.
 */
import { supabaseAuth } from '../../legacy/lib/supabase'
import { readCurrentSupabaseAccessToken } from '../../legacy/lib/appSession'

const BACKEND = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''

// ── Helper para llamadas al Flask backend (solo creación de usuarios) ──
async function _backendFetch(method, path, body) {
  const token = readCurrentSupabaseAccessToken()
  const url   = `${BACKEND}/api/backend${path}`
  const res   = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new Error(`Backend no disponible en ${path}. Configura VITE_BACKEND_URL.`)
  }
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || data?.message || res.statusText || 'Error del servidor')
  }
  return data?.data ?? data
}

// ══════════════════════════════════════════════════════════════════════
// TENANTS
// ══════════════════════════════════════════════════════════════════════

export async function listTenants() {
  const { data, error } = await supabaseAuth
    .from('tenants')
    .select('*, stores(count)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createTenant(payload) {
  const { name, slug, owner_name, owner_email, owner_phone, notes, status = 'active', monthly_fee = 0 } = payload
  if (!name || !slug) throw new Error('name y slug son requeridos')
  const { data, error } = await supabaseAuth
    .from('tenants')
    .insert({ name, slug: slug.toLowerCase(), owner_name, owner_email, owner_phone, notes, status, monthly_fee })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTenant(tenantId, patch) {
  const allowed = ['name', 'owner_name', 'owner_email', 'owner_phone', 'status', 'monthly_fee', 'notes']
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabaseAuth
    .from('tenants')
    .update(safe)
    .eq('id', tenantId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteTenant(tenantId) {
  const { error } = await supabaseAuth.from('tenants').delete().eq('id', tenantId)
  if (error) throw new Error(error.message)
}

// ══════════════════════════════════════════════════════════════════════
// STORES
// ══════════════════════════════════════════════════════════════════════

export async function listStores(tenantId = null) {
  let q = supabaseAuth
    .from('stores')
    .select('*, store_templates(id, name, react_module_key), branches(count)')
    .order('created_at', { ascending: false })
  if (tenantId) q = q.eq('tenant_id', tenantId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function createStore(payload) {
  const { data, error } = await supabaseAuth
    .from('stores')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateStore(storeId, patch) {
  const allowed = ['name', 'slug', 'status', 'template_id', 'theme_tokens',
    'public_visible', 'business_type', 'niche', 'city', 'notes']
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabaseAuth
    .from('stores')
    .update(safe)
    .eq('id', storeId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteStore(storeId) {
  const { error } = await supabaseAuth.from('stores').delete().eq('id', storeId)
  if (error) throw new Error(error.message)
}

export async function listStoreTemplates() {
  const { data, error } = await supabaseAuth
    .from('store_templates')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}

// ══════════════════════════════════════════════════════════════════════
// BRANCHES
// ══════════════════════════════════════════════════════════════════════

export async function listBranches(tenantId = null, storeId = null) {
  let q = supabaseAuth
    .from('branches')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  if (tenantId) q = q.eq('tenant_id', tenantId)
  if (storeId)  q = q.eq('store_id', storeId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function createBranch(payload) {
  const { data, error } = await supabaseAuth
    .from('branches')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateBranch(branchId, patch) {
  const allowed = ['name', 'address', 'city', 'phone', 'status', 'is_primary',
    'public_visible', 'open_hour', 'close_hour', 'open_days', 'theme_override']
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabaseAuth
    .from('branches')
    .update(safe)
    .eq('id', branchId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteBranch(branchId) {
  const { error } = await supabaseAuth.from('branches').delete().eq('id', branchId)
  if (error) throw new Error(error.message)
}

// ══════════════════════════════════════════════════════════════════════
// MEMBERSHIPS / STAFF
// ══════════════════════════════════════════════════════════════════════

export async function listMemberships(filters = {}) {
  let q = supabaseAuth
    .from('user_memberships')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.tenant_id)  q = q.eq('tenant_id', filters.tenant_id)
  if (filters.store_id)   q = q.eq('store_id', filters.store_id)
  if (filters.branch_id)  q = q.eq('branch_id', filters.branch_id)
  if (filters.roles?.length) q = q.in('role', filters.roles)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function updateMembership(membershipId, patch) {
  const { data, error } = await supabaseAuth
    .from('user_memberships')
    .update({ is_active: patch.is_active })
    .eq('id', membershipId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteMembership(membershipId) {
  const { error } = await supabaseAuth.from('user_memberships').delete().eq('id', membershipId)
  if (error) throw new Error(error.message)
}

// ── Cuentas que requieren service_role → van al backend Flask ─────────
export async function createOwnerAccount(payload) {
  return _backendFetch('POST', '/admin/accounts/owners', payload)
}

export async function updateOwnerAccount(membershipId, patch) {
  return _backendFetch('PATCH', `/admin/accounts/owners/${membershipId}`, patch)
}

export async function listOwnerAccounts() {
  // Consulta directa a Supabase — no necesita Flask backend
  // super_admin ve todo por RLS; incluye nombre del tenant
  const { data, error } = await supabaseAuth
    .from('user_memberships')
    .select('id, user_id, role, tenant_id, is_active, metadata, created_at, tenants(name)')
    .in('role', ['tenant_owner', 'tenant_admin'])
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(m => ({
    ...m,
    membership_id:  m.id,
    full_name:      m.metadata?.full_name || '',
    email:          m.metadata?.email     || '',
    tenant_name:    m.tenants?.name       || 'Sin tenant',
    last_sign_in_at: null,
  }))
}

export async function createStaffAccount(payload) {
  return _backendFetch('POST', '/tenant/accounts/staff', payload)
}

export async function updateStaffAccount(membershipId, patch) {
  return _backendFetch('PATCH', `/tenant/accounts/staff/${membershipId}`, patch)
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════════

export async function getSuperAdminStats() {
  const [tenants, stores, branches, members] = await Promise.all([
    supabaseAuth.from('tenants').select('id', { count: 'exact', head: true }),
    supabaseAuth.from('stores').select('id', { count: 'exact', head: true }),
    supabaseAuth.from('branches').select('id', { count: 'exact', head: true }),
    supabaseAuth.from('user_memberships').select('id', { count: 'exact', head: true }),
  ])
  return {
    tenants:  tenants.count  || 0,
    stores:   stores.count   || 0,
    branches: branches.count || 0,
    members:  members.count  || 0,
  }
}

export async function getTenantDashboard(tenantId) {
  const since = new Date(Date.now() - 86400000).toISOString()
  const [storesRes, branchesRes, ordersRes] = await Promise.all([
    supabaseAuth.from('stores').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAuth.from('branches').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAuth.from('orders').select('id,total').eq('tenant_id', tenantId).gte('created_at', since),
  ])
  const orders = ordersRes.data || []
  return {
    stores:       storesRes.count   || 0,
    branches:     branchesRes.count || 0,
    orders_today: orders.length,
    revenue_today: orders.reduce((s, o) => s + Number(o.total || 0), 0),
  }
}

// ══════════════════════════════════════════════════════════════════════
// LANDING PIPELINE
// ══════════════════════════════════════════════════════════════════════

export async function listLandingRequests() {
  const { data, error } = await supabaseAuth
    .from('landing_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function updateLandingRequest(id, patch) {
  const { data, error } = await supabaseAuth
    .from('landing_requests')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function inviteLandingRequest(id, redirectTo) {
  return _backendFetch('POST', `/admin/pipeline/${id}/invite`, { redirectTo })
}

// ══════════════════════════════════════════════════════════════════════
// PLAN / SUSCRIPCION
// ══════════════════════════════════════════════════════════════════════

export async function getTenantPlan(tenantId) {
  const { data } = await supabaseAuth
    .from('tenant_subscriptions')
    .select('plan_id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data?.plan_id || 'growth'
}

// ══════════════════════════════════════════════════════════════════════
// CHATBOT PORTABLE — Descarga del ZIP
// ══════════════════════════════════════════════════════════════════════

export function getChatbotDownloadUrl(branchId) {
  const token = readCurrentSupabaseAccessToken()
  return `${BACKEND}/api/backend/admin/chatbot/download/${branchId}?token=${encodeURIComponent(token || '')}`
}
