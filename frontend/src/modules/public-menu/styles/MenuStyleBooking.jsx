/**
 * MenuStyleBooking — Plantilla para barberías, salones y servicios.
 * Servicios con duración, galería de trabajos, staff visible,
 * botón "Reservar" prominente, info de contacto y horario.
 */
import React from 'react'
import { money, CartFab, HoursBar, ProductModal, BranchSelector, duration } from './MenuShared'

export function MenuStyleBooking({ store, menu, branch, branches, cart, onAddToCart, onOpenCart, theme }) {
  const [activeSection, setActiveSection] = React.useState(null)
  const [selected,      setSelected]      = React.useState(null)
  const [activeBranch,  setActiveBranch]  = React.useState(branch)
  const [toasted,       setToasted]       = React.useState(null)

  const primary  = theme?.primary   || '#7c3aed'
  const secondary= theme?.secondary || '#a78bfa'
  const currency = store?.currency  || 'EUR'
  const sections = (menu || []).filter(s => s.products?.length > 0)
  const activeSec = activeSection || sections[0]?.id
  const services  = sections.find(s => s.id === activeSec)?.products || []
  const cartCount = (cart || []).reduce((s, i) => s + (i.qty || 1), 0)
  const cartTotal = money((cart || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), currency)
  const b = activeBranch || branch

  function handleBook(svc) {
    onAddToCart({ ...svc, qty: 1 })
    setToasted(svc)
    setTimeout(() => setToasted(null), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdf4ff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        padding: '32px 20px 80px', color: '#fff', position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoración */}
        <div style={{ position:'absolute', top:-30, right:-30, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.06)' }} />
        <div style={{ position:'absolute', bottom:-50, left:20, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,.04)' }} />

        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{store?.emoji || '✂️'}</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {store?.name}
          </h1>
          {b && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', opacity: 0.9, fontSize: 14 }}>
              {b.address && <span>📍 {b.address}</span>}
              {b.phone && <a href={`tel:${b.phone}`} style={{ color:'#fff', textDecoration:'none' }}>📞 {b.phone}</a>}
              <HoursBar branch={b} />
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING CARD ───────────────────────────────────────── */}
      <div style={{
        maxWidth: 640, margin: '-40px auto 0',
        background: '#fff', borderRadius: 20,
        boxShadow: '0 8px 32px rgba(124,58,237,.15)',
        overflow: 'hidden', position: 'relative', zIndex: 10,
        marginLeft: 16, marginRight: 16,
      }}>
        {/* Tabs de servicios */}
        <div style={{
          display: 'flex', gap: 4, padding: '12px 12px 0',
          overflowX: 'auto', scrollbarWidth: 'none',
          borderBottom: '1px solid #f3f4f6',
        }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              flexShrink: 0, padding: '8px 18px', borderRadius: '10px 10px 0 0',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: activeSec === s.id ? primary : 'transparent',
              color: activeSec === s.id ? '#fff' : '#6b7280',
              fontFamily: 'inherit', transition: '.15s',
              borderBottom: activeSec === s.id ? `2px solid ${primary}` : '2px solid transparent',
            }}>{s.name}</button>
          ))}
        </div>

        {/* Lista de servicios */}
        <div style={{ padding: 16 }}>
          {!services.length && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
              Sin servicios en esta categoría
            </div>
          )}
          {services.map(svc => (
            <ServiceCard key={svc.id} service={svc} primary={primary} currency={currency}
              onBook={() => handleBook(svc)} onDetail={() => setSelected(svc)}
              inCart={(cart || []).some(i => i.id === svc.id)} />
          ))}
        </div>
      </div>

      {/* Selector de sede */}
      {branches && branches.length > 1 && (
        <div style={{ maxWidth: 640, margin: '16px auto', paddingInline: 16 }}>
          <BranchSelector branches={branches} activeBranch={activeBranch || branch} onSelect={setActiveBranch} color={primary} />
        </div>
      )}

      {/* ── CÓMO RESERVAR ───────────────────────────────────────── */}
      <div style={{ maxWidth: 640, margin: '20px auto', paddingInline: 16 }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20,
          border: `1px solid ${primary}20`,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📋 Cómo reservar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { step: '1', text: 'Selecciona el servicio que quieres', color: primary },
              { step: '2', text: 'Confirma tu reserva con el pedido', color: secondary },
              { step: '3', text: 'Nuestro equipo te confirmará la hora', color: primary },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 99, background: `${s.color}20`,
                  color: s.color, fontWeight: 800, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{s.step}</div>
                <div style={{ fontSize: 14, color: '#374151', paddingTop: 4 }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Carrito flotante */}
      {cartCount > 0 && (
        <CartFab count={cartCount} total={cartTotal} onClick={onOpenCart} color={primary} />
      )}

      {/* Toast de confirmación */}
      {toasted && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#111', color: '#fff', borderRadius: 12,
          padding: '12px 20px', zIndex: 200, fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap',
          animation: 'fadeIn .25s ease',
        }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          ✅ <strong>{toasted.name}</strong> añadido
        </div>
      )}

      <ProductModal product={selected} onClose={() => setSelected(null)}
        onAddToCart={onAddToCart} currency={currency} primaryColor={primary} />

      {/* Padding bottom */}
      <div style={{ height: 80 }} />
    </div>
  )
}

function ServiceCard({ service, primary, currency, onBook, onDetail, inCart }) {
  const dur = duration(service.service_duration_minutes)

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 0',
      borderBottom: '1px solid #f3f4f6', alignItems: 'center',
    }}>
      {/* Icono / Imagen */}
      <div onClick={onDetail} style={{
        width: 64, height: 64, borderRadius: 14, flexShrink: 0, cursor: 'pointer',
        background: `${primary}15`, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>
        {service.image_url
          ? <img src={service.image_url} alt={service.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (service.emoji || '✂️')
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={onDetail}>
        <div style={{ fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{service.name}</div>
        {service.description && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {service.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: primary }}>
            {money(service.price, currency)}
          </span>
          {dur && (
            <span style={{
              fontSize: 12, color: '#9ca3af',
              background: '#f3f4f6', padding: '2px 8px', borderRadius: 20,
            }}>⏱ {dur}</span>
          )}
        </div>
      </div>

      {/* Botón reservar */}
      <button onClick={onBook} style={{
        flexShrink: 0, background: inCart ? '#dcfce7' : primary,
        color: inCart ? '#166534' : '#fff', border: 'none',
        borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
        fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: '.15s',
      }}>
        {inCart ? '✓ Añadido' : 'Reservar'}
      </button>
    </div>
  )
}
