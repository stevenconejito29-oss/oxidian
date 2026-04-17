import React from 'react'
import { supabase } from '../../../legacy/lib/supabase'
import { buildOrderItem } from '../../../legacy/lib/orderUtils'
import styles from './CheckoutDrawer.module.css'

const STORAGE_KEY = 'oxidian_public_checkout_customer'

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`
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
  cart,
  cartTotal,
  deliveryFee = 0,
  minOrder = 0,
  onClearCart,
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
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (!form.phone.trim()) return setError('El teléfono es obligatorio.')
    if (!form.address.trim()) return setError('La dirección es obligatoria.')
    if (belowMin) return setError(`Faltan ${money(remaining)} para alcanzar el pedido mínimo.`)

    setSaving(true)
    setError('')

    try {
      const saved = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_number')
        .eq('store_id', storeId)
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextOrderNumber = Number(lastOrder?.order_number || 0) + 1

      const payload = {
        store_id: storeId,
        order_number: nextOrderNumber,
        customer_name: saved.name,
        customer_phone: saved.phone,
        delivery_address: saved.address,
        notes: form.notes.trim() || null,
        items: cart.map(buildOrderItem),
        subtotal: cartTotal,
        delivery_fee: Number(deliveryFee || 0),
        total,
        status: 'pending',
      }

      const { error: insertError } = await supabase.from('orders').insert(payload)
      if (insertError) throw insertError

      setSuccess({ orderNumber: nextOrderNumber, total })
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
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>Cerrar</button>
        </div>

        {success ? (
          <div className={styles.successCard}>
            <strong>Pedido #{success.orderNumber} creado</strong>
            <span>Total confirmado: {money(success.total)}</span>
            <button type="button" className={styles.primaryButton} onClick={onClose}>Seguir navegando</button>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryRow}><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
              <div className={styles.summaryRow}><span>Envío</span><strong>{money(deliveryFee)}</strong></div>
              <div className={styles.summaryRowTotal}><span>Total</span><strong>{money(total)}</strong></div>
              {belowMin ? <div className={styles.warning}>Pedido mínimo pendiente: faltan {money(remaining)}</div> : null}
            </div>

            <div className={styles.cartPreview}>
              {cart.map((item, index) => (
                <div className={styles.cartLine} key={`${item.id}-${index}`}>
                  <span>{item.qty} × {item.product_name || item.name}</span>
                  <strong>{money(item.price * item.qty)}</strong>
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
