import React from 'react'
import { supabase } from '../../../legacy/lib/supabase'
import { useRealtimeOrders } from '../../../legacy/lib/useRealtimeOrders'
import { useResolvedStoreId } from '../../../legacy/lib/currentStore'
import { buildOrderStatusUpdate } from '../../../legacy/lib/orderStatusUpdate'
import { STATUS_LABELS, timeAgo } from '../../../legacy/lib/orderUtils'
import { Hero, Notice, Panel, Shell, Stats } from '../../../shared/ui/ControlDeck'
import styles from './OperationsPage.module.css'

function parseItems(rawItems) {
  try {
    return typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || [])
  } catch {
    return []
  }
}

function formatTotal(value) {
  return `${Number(value || 0).toFixed(2)} EUR`
}

async function updateOrder(order, nextStatus) {
  const patch = buildOrderStatusUpdate(order, nextStatus)
  const { error } = await supabase.from('orders').update(patch).eq('id', order.id).eq('store_id', order.store_id)
  if (error) throw error
}

export default function BranchKitchenPage() {
  const storeId = useResolvedStoreId()
  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['pending', 'preparing', 'ready'],
    storeId,
  })
  const [busyId, setBusyId] = React.useState(null)
  const [error, setError] = React.useState('')

  const pending = orders.filter(order => order.status === 'pending')
  const preparing = orders.filter(order => order.status === 'preparing')
  const ready = orders.filter(order => order.status === 'ready')

  async function handleAdvance(order, nextStatus) {
    setBusyId(order.id)
    setError('')
    try {
      await updateOrder(order, nextStatus)
      await refresh()
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo actualizar el pedido.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Shell>
      <Hero
        eyebrow="Branch Ops · Kitchen board"
        title="Cola de preparación con lectura en tiempo real."
        description="UI nueva para cocina basada en visibilidad rápida, avance claro de estados y lectura compacta de tickets."
        signals={[
          { label: 'Store', value: storeId },
          { label: 'Activos', value: String(orders.length) },
        ]}
      />

      <Panel title="Resumen" text="Lectura de cola antes de entrar en detalle por ticket.">
        <Stats
          items={[
            { label: 'Pendientes', value: String(pending.length), hint: 'Pedidos recién entrados.' },
            { label: 'Preparando', value: String(preparing.length), hint: 'Tickets ya en producción.' },
            { label: 'Listos', value: String(ready.length), hint: 'A la espera de rider o entrega.' },
            { label: 'Store', value: storeId, hint: 'Scope resuelto para esta vista.' },
          ]}
        />
      </Panel>

      {loading ? <Notice>Cargando pedidos...</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className={styles.board}>
        {[{ label: 'Pendientes', orders: pending, accent: styles.pending }, { label: 'Preparando', orders: preparing, accent: styles.preparing }, { label: 'Listos', orders: ready, accent: styles.ready }].map(column => (
          <section className={styles.column} key={column.label}>
            <div className={`${styles.columnHeader} ${column.accent}`}>
              <h2>{column.label}</h2>
              <span>{column.orders.length}</span>
            </div>
            <div className={styles.ticketList}>
              {column.orders.map(order => {
                const items = parseItems(order.items)
                return (
                  <article className={styles.ticket} key={order.id}>
                    <div className={styles.ticketTop}>
                      <div>
                        <strong>#{order.order_number}</strong>
                        <span>{order.customer_name || 'Cliente'}</span>
                      </div>
                      <div className={styles.ticketMeta}>
                        <strong>{formatTotal(order.total)}</strong>
                        <span>{timeAgo(order.created_at)}</span>
                      </div>
                    </div>
                    <div className={styles.ticketItems}>
                      {items.slice(0, 4).map((item, index) => (
                        <div className={styles.ticketItem} key={`${order.id}-${index}`}>
                          <span>{item.qty || 1}× {item.product_name || item.name || 'Producto'}</span>
                          {item.size ? <span>{item.size}</span> : null}
                        </div>
                      ))}
                    </div>
                    <div className={styles.ticketFooter}>
                      <span className={styles.statusPill}>{STATUS_LABELS[order.status]}</span>
                      <div className={styles.ticketActions}>
                        {order.status === 'pending' ? (
                          <button disabled={busyId === order.id} onClick={() => handleAdvance(order, 'preparing')}>Iniciar</button>
                        ) : null}
                        {order.status === 'preparing' ? (
                          <button disabled={busyId === order.id} onClick={() => handleAdvance(order, 'ready')}>Marcar listo</button>
                        ) : null}
                        <a href={`/legacy/pedidos?store=${encodeURIComponent(storeId)}`}>legacy</a>
                      </div>
                    </div>
                  </article>
                )
              })}
              {!column.orders.length ? <Notice>No hay pedidos en esta columna.</Notice> : null}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  )
}
