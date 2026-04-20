export function getPendingLandingRequests(landingRequests, limit = 4) {
  if (!Array.isArray(landingRequests)) return []
  return landingRequests.filter((lead) => lead && lead.status === 'pending').slice(0, limit)
}

export function countLandingRequestsByStatus(landingRequests) {
  return (Array.isArray(landingRequests) ? landingRequests : []).reduce((acc, lead) => {
    if (!lead?.status) return acc
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {})
}
