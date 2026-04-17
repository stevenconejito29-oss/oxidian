export const RIDER_CASH_CLOSE_PREFIX = 'rider_cash_close:'
export const RIDER_DELIVERY_PAYOUT_PREFIX = 'rider_delivery_payout:'

function buildTaggedNotes(prefix, payload) {
  return prefix + JSON.stringify(payload)
}

function parseTaggedNotes(prefix, notes) {
  const raw = String(notes || '')
  if (!raw.startsWith(prefix)) return null
  try {
    return JSON.parse(raw.slice(prefix.length))
  } catch {
    return null
  }
}

export function buildRiderCashCloseNotes(payload) {
  return buildTaggedNotes(RIDER_CASH_CLOSE_PREFIX, payload)
}

export function parseRiderCashCloseNotes(notes) {
  return parseTaggedNotes(RIDER_CASH_CLOSE_PREFIX, notes)
}

export function isRiderCashCloseEntry(entry) {
  return Boolean(parseRiderCashCloseNotes(entry?.notes))
}

export function buildRiderDeliveryPayoutNotes(payload) {
  return buildTaggedNotes(RIDER_DELIVERY_PAYOUT_PREFIX, payload)
}

export function parseRiderDeliveryPayoutNotes(notes) {
  return parseTaggedNotes(RIDER_DELIVERY_PAYOUT_PREFIX, notes)
}

export function isRiderDeliveryPayoutEntry(entry) {
  return Boolean(parseRiderDeliveryPayoutNotes(entry?.notes))
}
