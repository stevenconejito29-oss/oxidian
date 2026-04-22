export function buildSessionFromStored(stored) {
  if (!stored?.supabase_access_token) return null
  return {
    access_token: stored.supabase_access_token,
    user: stored.user || null,
    expires_at: stored.auth_expires_at || null,
    _source: stored._source || 'appSession',
  }
}

export function buildMembershipFromStored(stored) {
  const membership = stored?.session_membership
  if (!membership?.role) return null
  return {
    role: membership.role,
    tenant_id: membership.tenant_id || null,
    store_id: membership.store_id || null,
    branch_id: membership.branch_id || null,
    is_active: membership.is_active !== false,
    metadata: membership.metadata || {},
  }
}

export function isPendingApprovalUser(user) {
  return Boolean(
    user?.user_metadata?.pending_approval
    || user?.app_metadata?.pending_approval,
  )
}
