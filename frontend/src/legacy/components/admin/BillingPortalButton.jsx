import React, { useState } from 'react'

/**
 * Botón que redirige al owner al Stripe Billing Portal.
 * Solo visible si el super admin ha configurado STRIPE_SECRET_KEY.
 * Aparece en la sección de personalización del admin.
 */
export default function BillingPortalButton({ storeId }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function openPortal() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/oxidian/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al abrir el portal')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      marginTop: 24,
      padding: '18px 20px',
      borderRadius: 16,
      border: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-background-secondary)',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '.92rem' }}>
        Suscripción
      </p>
      <p style={{ margin: '0 0 14px', fontSize: '.8rem', color: 'var(--color-text-secondary)' }}>
        Gestiona tu plan, método de pago y facturas desde el portal de Stripe.
      </p>
      {error && (
        <p style={{ margin: '0 0 10px', fontSize: '.78rem', color: 'var(--color-text-danger)' }}>
          {error}
        </p>
      )}
      <button
        onClick={openPortal}
        disabled={loading}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          border: '0.5px solid var(--color-border-secondary)',
          background: 'var(--color-background-primary)',
          fontWeight: 700,
          fontSize: '.86rem',
          cursor: loading ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {loading ? 'Abriendo…' : '↗ Gestionar suscripción'}
      </button>
    </div>
  )
}
