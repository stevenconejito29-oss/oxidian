export function buildOrderStatusUpdate(order, nextStatus) {
  const now = new Date().toISOString()
  const currentStatus = String(order?.status || '')

  if (nextStatus === currentStatus) {
    return { status: nextStatus }
  }

  if (nextStatus === 'cancelled' || nextStatus === 'pending' || nextStatus === 'preparing') {
    return {
      status: nextStatus,
      ready_at: null,
      picked_at: null,
      arrived_at: null,
      delivered_at: null,
      review_requested_at: null,
      delivery_code: null,
    }
  }

  if (nextStatus === 'ready') {
    return {
      status: nextStatus,
      ready_at: order?.ready_at || now,
      picked_at: null,
      arrived_at: null,
      delivered_at: null,
      review_requested_at: null,
      delivery_code: null,
    }
  }

  if (nextStatus === 'delivering') {
    return {
      status: nextStatus,
      ready_at: order?.ready_at || now,
      picked_at: order?.picked_at || now,
      arrived_at: null,
      delivered_at: null,
      review_requested_at: null,
      delivery_code: null,
    }
  }

  if (nextStatus === 'delivered') {
    return {
      status: nextStatus,
      ready_at: order?.ready_at || now,
      picked_at: order?.picked_at || now,
      delivered_at: now,
      review_requested_at: currentStatus === 'delivered' ? (order?.review_requested_at || null) : null,
    }
  }

  return { status: nextStatus }
}
