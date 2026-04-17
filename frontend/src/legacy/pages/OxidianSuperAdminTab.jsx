import React, { useEffect, useState, useCallback, useRef } from 'react'
import AdminSuperStoresTab from './AdminSuperStoresTab'
import { SUPER_ADMIN_BRAND } from '../lib/adminBranding'

// ── helpers ──────────────────────────────────────────────────────────────────
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0 }

async function fetchMetrics(password) {
  const res = await fetch('/api/oxidian/super-admin-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) throw new Error('401')
  if (!res.ok) throw new Error('Error al cargar métricas')
  return res.json()
}

// ── componente principal ──────────────────────────────────────────────────────
export default function OxidianSuperAdminTab({ oxidianPassword = '' }) {
  const [metrics, setMetrics]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error,   setError]       = useState(null)
  const [elapsed, setElapsed]     = useState(0)
  const [authOk,  setAuthOk]      = useState(false)
  const [pwInput, setPwInput]     = useState('')
  const pwRef = useRef(null)

  // Si el parent ya provee la contraseña (Admin.jsx la pasa como prop), usar directo
  useEffect(() => {
    if (oxidianPassword) { setAuthOk(true); setPwInput(oxidianPassword) }
  }, [oxidianPassword])

  const refresh = useCallback(async (pw) => {
    const password = pw || pwInput
    if (!password) return
    setLoading(true); setError(null)
    try {
      const data = await fetchMetrics(password)
      setMetrics(data)
      setAuthOk(true)
    } catch (e) {
      if (e.message === '401') {
        setAuthOk(false)
        setError('Contraseña incorrecta')
      } else {
        setError(e.message || 'No se pudieron cargar las métricas')
      }
    } finally { setLoading(false) }
  }, [pwInput])

  // auto-carga si ya tenemos auth
  useEffect(() => { if (authOk && pwInput) refresh(pwInput) }, [authOk]) // eslint-disable-line

  // contador de tiempo
  useEffect(() => {
    if (loading || !authOk) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading, authOk])

  const m = metrics

  // ── pantalla de contraseña ─────────────────────────────────────────────────
  if (!authOk) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{
          borderRadius: 24, padding: '28px 24px', color: 'white',
          background: 'linear-gradient(135deg,#0F172A,#1E293B 45%,#334155)',
        }}>
          <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>
            {SUPER_ADMIN_BRAND.name}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, marginTop: 6, marginBottom: 20 }}>
            Acceso al centro maestro
          </div>
          <input
            ref={pwRef}
            type="password"
            placeholder="Contraseña super admin"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && refresh(pwInput)}
            autoComplete="current-password"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 16px',
              borderRadius: 12, border: '1px solid rgba(255,255,255,.2)',
              background: 'rgba(255,255,255,.08)', color: 'white',
              fontSize: '.92rem', outline: 'none', marginBottom: 10,
            }}
          />
          {error && <p style={{ margin: '0 0 10px', fontSize: '.8rem', color: '#fca5a5' }}>{error}</p>}
          <button
            onClick={() => refresh(pwInput)}
            disabled={loading || !pwInput}
            style={{
              padding: '11px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,.25)',
              background: 'rgba(255,255,255,.12)', color: 'white', fontWeight: 700,
              cursor: loading ? 'default' : 'pointer', fontSize: '.88rem',
            }}
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </section>
        <AdminSuperStoresTab />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* ── cabecera con métricas ── */}
      <section style={{
        borderRadius: 24, padding: '22px 24px', color: 'white',
        background: 'linear-gradient(135deg,#0F172A,#1E293B 45%,#334155)',
        boxShadow: '0 18px 42px rgba(15,23,42,.24)',
      }}>
        <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>
          {SUPER_ADMIN_BRAND.name}
        </div>
        <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: 6 }}>
          Centro maestro multi-tienda
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.55)' }}>
            {loading ? 'Actualizando…' : `Actualizado hace ${elapsed}s`}
          </span>
          <button onClick={() => refresh(pwInput)} disabled={loading} style={{
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
            color: 'white', borderRadius: 8, padding: '3px 12px', fontSize: '.78rem',
            cursor: loading ? 'default' : 'pointer',
          }}>
            {loading ? '…' : 'Actualizar'}
          </button>
        </div>

        {m && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
            {[
              { title: 'Tiendas activas',      value: m.active,          detail: `de ${m.total} totales` },
              { title: 'En draft',              value: m.draft,           detail: 'pendientes de onboarding' },
              { title: 'Pagos confirmados',     value: m.paid,            detail: `${pct(m.completed, m.paid)}% completaron onboarding` },
              { title: 'Onboarding pendiente',  value: m.pendingOnboard,  detail: 'accesos por activar' },
              { title: 'GMV últimos 30d',       value: `$${(m.totalGmv || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, detail: 'suma de pedidos' },
            ].map(card => (
              <div key={card.title} style={{ borderRadius: 16, padding: '12px 14px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }}>
                <div style={{ fontSize: '.66rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 5 }}>{card.value}</div>
                <div style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.65)', marginTop: 4, lineHeight: 1.55 }}>{card.detail}</div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', fontSize: '.82rem', color: '#fca5a5' }}>
            {error}
          </div>
        )}
      </section>

      {/* ── últimos checkouts ── */}
      {m?.recentPaid?.length > 0 && (
        <section>
          <h3 style={{ fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>
            Últimos checkouts pagados
          </h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {m.recentPaid.map(c => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center',
                gap: 12, padding: '10px 14px', borderRadius: 12,
                background: 'var(--color-background-secondary,#f8fafc)',
                border: '0.5px solid var(--color-border-tertiary)', fontSize: '.84rem',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.business_name || c.store_id}</div>
                  <div style={{ fontSize: '.74rem', color: '#64748b', marginTop: 2 }}>
                    {c.customer_email} · {c.plan_id} · {new Date(c.created_at).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <Pill label={c.onboarding_status === 'completed' ? 'Activa' : 'Pendiente'} ok={c.onboarding_status === 'completed'} />
                <Pill label={c.access_email_status === 'sent' ? 'Email OK' : 'Sin email'} ok={c.access_email_status === 'sent'} warn={c.access_email_status !== 'sent'} />
              </div>
            ))}
          </div>
        </section>
      )}

      <AdminSuperStoresTab />
    </div>
  )
}

function Pill({ label, ok, warn }) {
  const bg    = ok ? 'rgba(34,197,94,.12)' : warn ? 'rgba(234,179,8,.12)' : 'rgba(148,163,184,.12)'
  const color = ok ? '#16a34a'             : warn ? '#a16207'             : '#64748b'
  return (
    <span style={{ background: bg, color, fontSize: '.72rem', fontWeight: 700, borderRadius: 8, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
