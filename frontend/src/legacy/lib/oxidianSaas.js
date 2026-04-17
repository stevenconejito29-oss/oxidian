import { loadStorePlans } from './storeManagement'

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

export async function loadOxidianPublicPlans() {
  const plans = await loadStorePlans()
  return plans
    .filter(plan => Number(plan.monthly_price || 0) > 0)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || 'No pude completar la solicitud')
  }
  return payload
}

export async function createOxidianCheckoutSession(payload) {
  const response = await fetch('/api/oxidian/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planId: normalizeText(payload.planId),
      businessName: normalizeText(payload.businessName),
      ownerName: normalizeText(payload.ownerName),
      ownerEmail: normalizeText(payload.ownerEmail),
      ownerPhone: normalizeText(payload.ownerPhone),
      niche: normalizeText(payload.niche, 'food').toLowerCase(),
    }),
  })

  return readJson(response)
}

export async function loadOxidianCheckoutSession(sessionId) {
  const response = await fetch(`/api/oxidian/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
  return readJson(response)
}

export async function loadOxidianOnboarding(token) {
  const response = await fetch(`/api/oxidian/onboarding?token=${encodeURIComponent(token)}`)
  return readJson(response)
}

export async function loadOxidianPublicStatus() {
  const response = await fetch('/api/oxidian/public-status')
  return readJson(response)
}

export async function completeOxidianOnboarding(payload) {
  const response = await fetch('/api/oxidian/onboarding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readJson(response)
}
