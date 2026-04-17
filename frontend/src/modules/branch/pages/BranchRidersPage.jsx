import React from 'react'
import { supabase } from '../../../legacy/lib/supabase'
import { useRealtimeOrders } from '../../../legacy/lib/useRealtimeOrders'
import { useResolvedStoreId } from '../../../legacy/lib/currentStore'
import { buildOrderStatusUpdate } from '../../../legacy/lib/orderStatusUpdate'
import { STATUS_LABELS, timeAgo } from '../../../legacy/lib/orderUtils'
import { Hero, Notice, Panel, Shell, Stats } from '../../../shared/ui/ControlDeck'
import styles from './OperationsPage.module.css'

function formatTotal(value) {
  return `${Number(value || 0).toFixed(2)} EUR`
}

async function updateOrder(order, nextStatus) {
  const patch = buildOrderStatusUpdate(order, nextStatus)
  const { error } = await supabase.from('orders').update(patch).eq('id', order.id).eq('store_id', order.store_id)
  if (error) throw error
}

export default function BranchRidersPage() {
  const storeId = useResolvedStoreId()
  const { orders, loading, refresh } = useRealtimeOrders({
    statusFilter: ['ready', 'delivering'],
    storeId,
  })
  const [busyId, setBusyId] = React.useState(null)
  const [error, setError] = React.useState('')

  const ready = orders.filter(order => order.status === 'ready')
  const delivering = orders.filter(order => order.status === 'delivering')

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
        eyebrow="Branch Ops · Rider board"
        title="Despacho y entregas en un panel más limpio."
        description="Esta capa nueva da foco a salidas, entregas y dirección del pedido sin arrastrar toda la interfaz antigua."
        signals={[
          { label: 'Store', value: storeId },
          { label: 'Rutas activas', value: String(orders.length) },
        ]}
      />

      <Panel title="Resumen de reparto" text="Visibilidad rápida del tramo final de la operación.">
        <Stats
          items={[
            { label: 'Listos', value: String(ready.length), hint: 'Pedidos esperando recogida.' },
            { label: 'En camino', value: String(delivering.length), hint: 'Pedidos ya despachados.' },
            { label: 'Store', value: storeId, hint: 'Scope resuelto para la vista actual.' },
            { label: 'Legacy', value: 'disponible', hint: 'Ruta antigua separada para funciones avanzadas.' },
          ]}
        />
      </Panel>

      {loading ? <Notice>Cargando reparto...</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className={styles.board}>
        {[{ label: 'Listos', orders: ready, accent: styles.ready }, { label: 'En camino', orders: delivering, accent: styles.delivering }].map(column => (
          <section className={styles.column} key={column.label}>
            <div className={`${styles.columnHeader} ${column.accent}`}>
              <h2>{column.label}</h2>
              <span>{column.orders.length}</span>
            </div>
            <div className={styles.ticketList}>
              {column.orders.map(order => (
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
                  <div className={styles.addressBlock}>
                    <strong>{order.address || order.delivery_address || 'Sin dirección'}</strong>
                    <span>{order.customer_phone || 'Sin teléfono'}</span>
                  </div>
                  <div className={styles.ticketFooter}>
                    <span className={styles.statusPill}>{STATUS_LABELS[order.status]}</span>
                    <div className={styles.ticketActions}>
                      {order.status === 'ready' ? (
                        <button disabled={busyId === order.id} onClick={() => handleAdvance(order, 'delivering')}>Recoger</button>
                      ) : null}
                      {order.status === 'delivering' ? (
                        <button disabled={busyId === order.id} onClick={() => handleAdvance(order, 'delivered')}>Entregado</button>
                      ) : null}
                      <a href={`/legacy/repartidor?store=${encodeURIComponent(storeId)}`}>legacy</a>
                    </div>
                  </div>
                </article>
              ))}
              {!column.orders.length ? <Notice>No hay pedidos en esta columna.</Notice> : null}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  )
}
