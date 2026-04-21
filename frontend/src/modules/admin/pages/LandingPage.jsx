import React from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../../core/providers/AuthProvider'
import { ROLE_HOME } from '../../../core/router/roleHome'
import { submitLandingRequest } from '../../../shared/lib/supabaseApi'

const FEATURES = [
  { icon: 'Store', title: 'Multi-tienda', desc: 'Un dueno puede gestionar varias tiendas desde una sola cuenta.' },
  { icon: 'Pin', title: 'Sedes', desc: 'Cada tienda puede operar con varias sedes y staff independiente.' },
  { icon: 'Module', title: 'Modulos flexibles', desc: 'Delivery, inventario, citas, cocina y mas segun el nicho.' },
  { icon: 'Bot', title: 'Chatbot WhatsApp', desc: 'Bot portable por QR para atender clientes por WhatsApp.' },
  { icon: 'Chart', title: 'Panel completo', desc: 'Dashboard, pedidos, staff, finanzas y configuracion en una sola interfaz.' },
  { icon: 'Star', title: 'Fidelidad', desc: 'Promociones, puntos y programas de recompensas por tienda.' },
]

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$29', stores: 1, branches: 1, highlight: false },
  { id: 'growth', name: 'Growth', price: '$59', stores: 3, branches: 3, highlight: true },
  { id: 'pro', name: 'Pro', price: '$99', stores: 10, branches: 10, highlight: false },
  { id: 'enterprise', name: 'Enterprise', price: 'A medida', stores: 'Ilimitadas', branches: 'Ilimitadas', highlight: false },
]

const NICHOS = ['Barberia', 'Comida rapida', 'Restaurante', 'Tienda barrio', 'Ropa/Moda', 'Servicios']

const inp = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 14,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role, loading } = useAuth()

  if (!loading && isAuthenticated && role !== 'anonymous') {
    return <Navigate to={ROLE_HOME[role] || '/tenant/admin'} replace />
  }

  const [form, setForm] = React.useState({
    full_name: '',
    email: '',
    phone: '',
    business_name: '',
    business_niche: '',
    city: '',
    message: '',
    password: '',
    password_confirm: '',
  })
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState('')

  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(e) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      if (form.password.length < 8) throw new Error('La contrasena debe tener al menos 8 caracteres')
      if (form.password !== form.password_confirm) throw new Error('Las contrasenas no coinciden')

      await submitLandingRequest({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        business_name: form.business_name,
        business_niche: form.business_niche,
        city: form.city,
        message: form.message,
        password: form.password,
      })
      setSent(true)
    } catch (err) {
      setError(err.message)
    }
    setSending(false)
  }

  const sec = { padding: '4rem 2rem', maxWidth: 880, margin: '0 auto' }
  const h2 = { fontSize: 26, fontWeight: 500, marginBottom: 10 }
  const sub = { fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 32 }

  return (
    <div style={{ background: 'var(--color-background-primary)' }}>
      <div style={{ ...sec, textAlign: 'center', paddingTop: '5rem', paddingBottom: '3rem' }}>
        <div
          style={{
            display: 'inline-block',
            background: 'var(--color-background-secondary)',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 20,
            border: '0.5px solid var(--color-border-tertiary)',
          }}
        >
          SaaS para negocios independientes
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
          Tu tienda online, lista en minutos
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Crea tu cuenta, envia tu solicitud y, cuando el super admin la apruebe, entra a tu panel para crear y gestionar tus tiendas.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="#solicitar"
            style={{
              padding: '11px 28px',
              borderRadius: 8,
              fontSize: 14,
              background: 'var(--color-text-primary)',
              color: 'var(--color-background-primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Solicitar acceso
          </a>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '11px 28px',
              borderRadius: 8,
              fontSize: 14,
              border: '1px solid var(--color-border-secondary)',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontFamily: 'inherit',
            }}
          >
            Ya tengo cuenta
          </button>
        </div>
      </div>

      <div style={{ ...sec, paddingTop: '2rem' }}>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Compatible con multiples tipos de negocio
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {NICHOS.map((n) => (
            <span
              key={n}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 13,
                border: '0.5px solid var(--color-border-secondary)',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-background-secondary)',
              }}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...sec }}>
        <h2 style={{ ...h2, textAlign: 'center' }}>Todo lo que necesita tu negocio</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                padding: '20px',
                borderRadius: 12,
                border: '0.5px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{feature.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...sec }}>
        <h2 style={{ ...h2, textAlign: 'center' }}>Planes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                padding: '20px',
                borderRadius: 12,
                border: plan.highlight ? '2px solid var(--color-text-primary)' : '0.5px solid var(--color-border-tertiary)',
                background: 'var(--color-background-primary)',
                textAlign: 'center',
              }}
            >
              {plan.highlight && (
                <div
                  style={{
                    fontSize: 11,
                    background: 'var(--color-text-primary)',
                    color: 'var(--color-background-primary)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    display: 'inline-block',
                    marginBottom: 8,
                  }}
                >
                  Mas popular
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 500 }}>{plan.name}</div>
              <div style={{ fontSize: 28, fontWeight: 500, margin: '8px 0' }}>{plan.price}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <div>{plan.stores} tienda(s)</div>
                <div>{plan.branches} sede(s)</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="solicitar" style={{ ...sec }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ ...h2, textAlign: 'center' }}>Solicitar acceso</h2>
          <p style={{ ...sub, textAlign: 'center', marginBottom: 24 }}>
            Crea ya tu cuenta de dueno. Quedara pendiente hasta que el super admin apruebe tu solicitud.
          </p>
          {sent ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                background: 'var(--color-background-secondary)',
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>OK</div>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>Solicitud enviada</div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Tu cuenta quedo creada y esta pendiente de aprobacion. Cuando el super admin la active, podras entrar con tu email y contrasena.
              </div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              {error && (
                <div
                  style={{
                    padding: '10px',
                    background: 'var(--color-background-danger)',
                    color: 'var(--color-text-danger)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              {[
                ['Nombre completo', 'full_name', 'Maria Garcia', 'text', true],
                ['Email de contacto', 'email', 'maria@negocio.com', 'email', true],
                ['Telefono / WhatsApp', 'phone', '+34 600 000 000', 'tel', false],
                ['Nombre del negocio', 'business_name', 'Panaderia La Masa', 'text', false],
                ['Ciudad', 'city', 'Madrid', 'text', false],
              ].map(([label, key, ph, type, req]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    {label}
                    {req ? ' *' : ''}
                  </label>
                  <input
                    style={inp}
                    type={type}
                    required={req}
                    placeholder={ph}
                    value={form[key]}
                    onChange={(e) => patch(key, e.target.value)}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  Contrasena de tu cuenta *
                </label>
                <input
                  style={inp}
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => patch('password', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  Repite la contrasena *
                </label>
                <input
                  style={inp}
                  type="password"
                  required
                  minLength={8}
                  placeholder="Repite tu contrasena"
                  value={form.password_confirm}
                  onChange={(e) => patch('password_confirm', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  Tipo de negocio
                </label>
                <select style={inp} value={form.business_niche} onChange={(e) => patch('business_niche', e.target.value)}>
                  <option value="">Selecciona...</option>
                  {NICHOS.map((n) => (
                    <option key={n} value={n.toLowerCase()}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  Cuentanos mas (opcional)
                </label>
                <textarea
                  style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                  placeholder="Que necesitas, cuantas sedes tienes, etc."
                  value={form.message}
                  onChange={(e) => patch('message', e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: '11px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-text-primary)',
                  color: 'var(--color-background-primary)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: sending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
          borderTop: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        Oxidian SaaS
      </div>
    </div>
  )
}
