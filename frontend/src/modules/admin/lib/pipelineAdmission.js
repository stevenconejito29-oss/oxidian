export function getOwnerInviteRedirectPath(origin = '') {
  const cleanOrigin = String(origin || '').trim().replace(/\/$/, '')
  return cleanOrigin ? `${cleanOrigin}/login` : '/login'
}

export function getLeadStatusAfterActivation({ hasOwnerAccess = true } = {}) {
  return hasOwnerAccess ? 'onboarding' : 'pending'
}
