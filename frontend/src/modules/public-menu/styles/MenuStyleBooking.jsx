/**
 * MenuStyleBooking — Citas y reservas
 * Para barberías, salones de belleza, salones de uñas, servicios profesionales.
 * Servicios con duración, precio y botón de reservar.
 */
import React from 'react'

function money(v, currency = 'EUR') {
  return Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency })
}

function duration(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export function MenuStyleBooking({ store, menu, branch, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [booked, setBooked]               = React.useState(null)

  const primary  = theme?.primary  || '#a855f7'
  const currency = store?.currency || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id
  const services  = sections.find(s => s.id === activeSec)?.products || []
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#faf5ff', fontFamily: 'inherit', color: '#1a1a1a' }}>
      {/* Header */}
      <header style={{
        background: primary, color: '#fff', padding: '16px 20px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{store?.name || 'Reservas'}</div>
            {branch && (
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                📍 {branch.address || branch.city}
                {branch.phone && ` · 📞 ${branch.phone}`}
              </div>
            )}
          </div>
          <button onClick={onOpenCart} style={{
            background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.4)',
            borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Mis reservas {cartCount > 0 && `(${cartCount})`}
          </button>
        </div>

        {/* Tabs de servicio */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              flexShrink: 0, padding: '5px 14px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: activeSec === s.id ? '#fff' : 'rgba(255,255,255,.2)',
              color: activeSec === s.id ? primary : '#fff',
            }}>{s.name}</button>
          ))}
        </div>
      </header>

      {/* Lista de servicios */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, margin: '0 auto' }}>
        {services.map(svc => (
          <div key={svc.id} style={{
            background: '#fff', borderRadius: 14, padding: 18,
            boxShadow: '0 1px 8px rgba(168,85,247,.08)',
            border: `1px solid ${primary}18`,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            {/* Icono */}
            <div style={{ width: 56, height: 56, borderRadius: 28, background: `${primary}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, flexShrink: 0 }}>
              {svc.image_url
                ? <img src={svc.image_url} alt={svc.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 28 }} />
                : (svc.emoji || '✂️')}
            </div>

            {/* Detalles */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{svc.name}</div>
              {svc.description && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 3, lineHeight: 1.4 }}>
                  {svc.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: primary }}>
                  {money(svc.price, currency)}
                </span>
                {svc.service_duration_minutes && (
                  <span style={{ fontSize: 12, color: '#aaa',
                    display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⏱ {duration(svc.service_duration_minutes)}
                  </span>
                )}
              </div>
            </div>

            {/* Botón reservar */}
            <button onClick={() => { onAddToCart({ ...svc, qty: 1 }); setBooked(svc) }} style={{
              flexShrink: 0, background: primary, color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
            }}>Reservar</button>
          </div>
        ))}

        {!services.length && (
          <div style={{ textAlign: 'center', color: '#ccc', padding: '3rem 0', fontSize: 14 }}>
            Sin servicios disponibles en esta categoría
          </div>
        )}
      </div>

      {/* Toast de confirmación */}
      {booked && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: primary, color: '#fff', borderRadius: 12,
          padding: '12px 20px', zIndex: 100, fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(168,85,247,.4)', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          ✅ {booked.name} añadido a tus reservas
          <button onClick={() => setBooked(null)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,.7)',
            cursor: 'pointer', fontSize: 16, padding: 0,
          }}>×</button>
        </div>
      )}
    </div>
  )
}
