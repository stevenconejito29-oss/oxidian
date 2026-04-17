import { supabase } from './supabase'
import { fetchPriorityLevelIds, sortOrdersByClubPriority } from './orderPriority'
import { DEFAULT_STORE_ID, normalizeStoreId } from './currentStore'

export async function runAutoAssign({ role = 'all', storeId = DEFAULT_STORE_ID } = {}) {
  const activeStoreId = normalizeStoreId(storeId)
  const { data: staffData } = await supabase
    .from('staff_users')
    .select('id, name, role, is_online, active')
    .eq('store_id', activeStoreId)
    .eq('active', true)
    .eq('is_online', true)

  if (!Array.isArray(staffData) || staffData.length === 0) return 0

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, club_level, assigned_cook_id, assigned_rider_id')
    .eq('store_id', activeStoreId)
    .in('status', ['pending', 'preparing', 'ready', 'delivering'])
    .order('created_at', { ascending: true })

  if (!Array.isArray(ordersData) || ordersData.length === 0) return 0

  const priorityLevelIds = await fetchPriorityLevelIds({ storeId: activeStoreId })
  const onlineCooks = staffData.filter(user => user.role === 'cocina')
  const onlineRiders = staffData.filter(user => user.role === 'repartidor')

  const needCook = sortOrdersByClubPriority(
    ordersData.filter(order => !order.assigned_cook_id && ['pending', 'preparing'].includes(order.status)),
    priorityLevelIds
  )
  const needRider = sortOrdersByClubPriority(
    ordersData.filter(order => !order.assigned_rider_id && order.status === 'ready'),
    priorityLevelIds
  )

  const updates = []

  if ((role === 'all' || role === 'cocina') && onlineCooks.length > 0) {
    const cookLoad = {}
    onlineCooks.forEach(user => {
      cookLoad[user.id] = ordersData.filter(order =>
        order.assigned_cook_id === user.id && ['pending', 'preparing', 'ready'].includes(order.status)
      ).length
    })

    for (const order of needCook) {
      const bestCook = onlineCooks.reduce((best, user) =>
        (cookLoad[user.id] ?? 0) < (cookLoad[best.id] ?? 0) ? user : best
      , onlineCooks[0])

      updates.push({
        role: 'cocina',
        orderId: order.id,
        fields: { assigned_cook_id: bestCook.id, assigned_cook_name: bestCook.name },
      })
      cookLoad[bestCook.id] = (cookLoad[bestCook.id] ?? 0) + 1
    }
  }

  if ((role === 'all' || role === 'repartidor') && onlineRiders.length > 0) {
    const riderLoad = {}
    onlineRiders.forEach(user => {
      riderLoad[user.id] = ordersData.filter(order =>
        order.assigned_rider_id === user.id && ['ready', 'delivering'].includes(order.status)
      ).length
    })

    for (const order of needRider) {
      const bestRider = onlineRiders.reduce((best, user) =>
        (riderLoad[user.id] ?? 0) < (riderLoad[best.id] ?? 0) ? user : best
      , onlineRiders[0])

      updates.push({
        role: 'repartidor',
        orderId: order.id,
        fields: { assigned_rider_id: bestRider.id, assigned_rider_name: bestRider.name },
      })
      riderLoad[bestRider.id] = (riderLoad[bestRider.id] ?? 0) + 1
    }
  }

  if (updates.length === 0) return 0

  let assignedCount = 0

  for (const update of updates) {
    let query = supabase.from('orders').update(update.fields).eq('id', update.orderId).eq('store_id', activeStoreId)

    if (update.role === 'cocina') query = query.is('assigned_cook_id', null)
    if (update.role === 'repartidor') query = query.is('assigned_rider_id', null)

    const { data } = await query.select('id').maybeSingle()
    if (data?.id) assignedCount += 1
  }

  return assignedCount
}
