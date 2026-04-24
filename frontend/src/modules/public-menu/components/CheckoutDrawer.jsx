import React from 'react'
import { buildBackendUrl } from '../../../shared/lib/backendBase'
import styles from './CheckoutDrawer.module.css'

const STORAGE_KEY = 'oxidian_public_checkout_customer'

function money(value, currency = 'EUR') {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

function loadSavedCustomer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function CheckoutDrawer({
  isOpen,
  onClose,
  storeId,
  branch,
  store,
  cart,
  cartTotal,
  deliveryFee = 0,
  minOrder = 0,
  currency = 'EUR',
  onClearCart,
  onUpdateQty,
  onRemoveItem,
}) {
  const savedCustomer = React.useMemo(() => loadSavedCustomer(), [])
  const [form, setForm] = React.useState({
    name: savedCustomer?.name || '',
    phone: savedCustomer?.phone || '',
    address: savedCustomer?.address || '',
    notes: '',
  })
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(null)

  React.useEffect(() => {
    if (!isOpen) {
      setError('')
      setSuccess(null)
    }
  }, [isOpen])

  const belowMin = minOrder > 0 && cartTotal < minOrder
  const remaining = Math.max(0, minOrder - cartTotal)
  const total = cartTotal + Number(deliveryFee || 0)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!branch?.id) return setError('Esta sede no está disponible para recibir pedidos.')
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (!form.phone.trim()) return setError('El teléfono es obligatorio.')
    if (!form.address.trim()) return setError('La dirección es obligatoria.')
    if (belowMin) return setError(`Faltan ${money(remaining, currency)} para alcanzar el pedido mínimo.`)

    setSaving(true)
    setError('')

    try {
      const saved = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      const response = await fetch(buildBackendUrl('/public/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          branch_id: branch.id,
          customer_name: saved.name,
          customer_phone: saved.phone,
          delivery_address: saved.address,
          notes: form.notes.trim() || null,
          delivery_fee: Number(deliveryFee || 0),
          items: cart.map(item => ({
            id: item.id || null,
            line_id: item.line_id || null,
            product_name: item.product_name || item.name || '',
            qty: Math.max(1, Number(item.qty || 1)),
            price: Number(item.price || 0),
            image_url: item.image_url || null,
            emoji: item.emoji || '',
            variants: item.variants || (item.selectedVariant ? [item.selectedVariant] : []),
            modifiers: item.modifiers || [],
            notes: item.notes || null,
          })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || payload?.message || 'No se pudo crear el pedido.')

      const order = payload?.data || payload
      setSuccess({
        orderNumber: order?.order_number,
        total: order?.total ?? total,
      })
      onClearCart?.()
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo crear el pedido.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={event => event.target === event.currentTarget && onClose?.()}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>Checkout rápido</div>
            <h2 className={styles.title}>Confirma el pedido sin salir del storefront</h2>
            <div className={styles.metaRow}>
              <span>{store?.name || 'Tienda'}</span>
              <span>{branch?.name || 'Sede'}</span>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>Cerrar</button>
        </div>

        {success ? (
          <div className={styles.successCard}>
            <strong>Pedido #{success.orderNumber} creado</strong>
            <span>Total confirmado: {money(success.total, currency)}</span>
            <button type="button" className={styles.primaryButton} onClick={onClose}>Seguir navegando</button>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryRow}><span>Subtotal</span><strong>{money(cartTotal, currency)}</strong></div>
              <div className={styles.summaryRow}><span>Envío</span><strong>{money(deliveryFee, currency)}</strong></div>
              <div className={styles.summaryRowTotal}><span>Total</span><strong>{money(total, currency)}</strong></div>
              {belowMin ? <div className={styles.warning}>Pedido mínimo pendiente: faltan {money(remaining, currency)}</div> : null}
            </div>

            <div className={styles.cartPreview}>
              {cart.map((item, index) => (
                <div className={styles.cartLine} key={item.line_id || `${item.id}-${index}`}>
                  <div className={styles.cartLineInfo}>
                    <span>{item.product_name || item.name}</span>
                    <small>{money(item.price, currency)} c/u</small>
                  </div>
                  <div className={styles.cartLineActions}>
                    <button type="button" className={styles.qtyButton} onClick={() => onUpdateQty?.(item.line_id, item.qty - 1)}>-</button>
                    <strong>{item.qty}</strong>
                    <button type="button" className={styles.qtyButton} onClick={() => onUpdateQty?.(item.line_id, item.qty + 1)}>+</button>
                    <button type="button" className={styles.removeButton} onClick={() => onRemoveItem?.(item.line_id)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}

            <form className={styles.form} onSubmit={handleSubmit}>
              <input className={styles.input} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Nombre" />
              <input className={styles.input} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="Teléfono" />
              <input className={styles.input} value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} placeholder="Dirección de entrega" />
              <textarea className={styles.textarea} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Notas para cocina o reparto" />
              <button type="submit" className={styles.primaryButton} disabled={saving || !cart.length}>
                {saving ? 'Enviando pedido...' : 'Confirmar pedido'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
