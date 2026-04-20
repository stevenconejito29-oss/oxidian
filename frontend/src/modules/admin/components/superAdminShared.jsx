import React from 'react'

export const C = {
  bg: 'var(--color-background-primary)',
  bg2: 'var(--color-background-secondary)',
  border: 'var(--color-border-tertiary)',
  border2: 'var(--color-border-secondary)',
  text: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
}

export const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }
export const inp = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 13,
  border: `1px solid ${C.border2}`,
  background: C.bg,
  color: C.text,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export function slugify(v) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('es-ES')
}

export function fmtMoney(n) {
  return '€' + Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 0 })
}

export function ago(d) {
  if (!d) return '—'
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

export function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', type = 'button', style = {} }) {
  const pad = size === 'sm' ? '5px 12px' : '9px 20px'
  const fs = size === 'sm' ? 12 : 13
  const bg = variant === 'primary' ? C.text : variant === 'danger' ? '#dc2626' : 'transparent'
  const cl = variant === 'ghost' ? C.muted : '#fff'
  const bd = variant === 'ghost' ? `1px solid ${C.border2}` : 'none'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad,
        borderRadius: 8,
        border: bd,
        background: disabled ? '#e5e7eb' : bg,
        color: disabled ? '#9ca3af' : cl,
        fontSize: fs,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: '.15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children, style = {} }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

export function Alert({ children, type = 'error' }) {
  const palette = {
    error: { bg: '#fef2f2', text: '#b91c1c' },
    success: { bg: '#f0fdf4', text: '#15803d' },
    info: { bg: '#eff6ff', text: '#1d4ed8' },
    warn: { bg: '#fefce8', text: '#854d0e' },
  }
  const p = palette[type] || palette.error
  return <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: p.bg, color: p.text, fontSize: 13 }}>{children}</div>
}

export function StatCard({ label, value, icon, hint, color, onClick }) {
  return (
    <div onClick={onClick} style={{ ...card, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default', transition: '.15s', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1.5px', color: color || C.text }}>{value ?? '—'}</div>
      {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

export function Badge({ children, color = '#64748b' }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, color, whiteSpace: 'nowrap' }}>{children}</span>
}

export function StatusDot({ status }) {
  const colors = {
    active: '#16a34a',
    suspended: '#dc2626',
    archived: '#6b7280',
    draft: '#ca8a04',
    pending: '#2563eb',
    converted: '#16a34a',
    rejected: '#dc2626',
    ghosted: '#9ca3af',
    contacted: '#7c3aed',
    demo_scheduled: '#0891b2',
    onboarding: '#ea580c',
  }
  const labels = {
    active: 'Activo',
    suspended: 'Suspendido',
    archived: 'Archivado',
    draft: 'Borrador',
    pending: 'Pendiente',
    converted: 'Convertido',
    rejected: 'Rechazado',
    ghosted: 'Sin respuesta',
    contacted: 'Contactado',
    demo_scheduled: 'Demo',
    onboarding: 'Onboarding',
  }
  const c = colors[status] || '#9ca3af'
  const l = labels[status] || status
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${c}18`, color: c }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />{l}</span>
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 28, flexWrap: 'wrap', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 16px',
            borderRadius: 9,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: active === t.id ? 600 : 400,
            fontFamily: 'inherit',
            background: active === t.id ? C.text : 'transparent',
            color: active === t.id ? C.bg : C.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: '.15s',
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.bg, borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.muted, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '22px' }}>{children}</div>
      </div>
    </div>
  )
}

export const NICHES = [
  { id: 'restaurant', icon: '🍕', label: 'Restaurante', color: '#ef4444' },
  { id: 'supermarket', icon: '🛒', label: 'Supermercado', color: '#22c55e' },
  { id: 'boutique_fashion', icon: '👗', label: 'Moda/Boutique', color: '#ec4899' },
  { id: 'pharmacy', icon: '💊', label: 'Farmacia', color: '#0ea5e9' },
  { id: 'neighborhood_store', icon: '🏪', label: 'Tienda Barrio', color: '#f97316' },
  { id: 'barbershop', icon: '✂️', label: 'Barbería', color: '#1d4ed8' },
  { id: 'beauty_salon', icon: '💄', label: 'Salón Belleza', color: '#a855f7' },
  { id: 'services', icon: '🛠️', label: 'Servicios', color: '#6366f1' },
  { id: 'universal', icon: '⭐', label: 'Otro', color: '#64748b' },
]

export const PIPELINE_COLS = [
  { id: 'pending', label: 'Nuevo', color: '#ca8a04' },
  { id: 'contacted', label: 'Contactado', color: '#7c3aed' },
  { id: 'demo_scheduled', label: 'Demo', color: '#0891b2' },
  { id: 'onboarding', label: 'Onboarding', color: '#ea580c' },
  { id: 'converted', label: 'Convertido', color: '#16a34a' },
  { id: 'rejected', label: 'Perdido', color: '#dc2626' },
]

export const PLAN_META = {
  starter: { label: 'Starter', color: '#64748b', price: '€0', icon: '🌱' },
  growth: { label: 'Growth', color: '#2563eb', price: '€29', icon: '🚀' },
  pro: { label: 'Pro', color: '#7c3aed', price: '€79', icon: '💎' },
  enterprise: { label: 'Enterprise', color: '#ea580c', price: 'Personalizado', icon: '🏢' },
}

export const TABS = [
  { id: 'overview', icon: '📊', label: 'Panel' },
  { id: 'tenants', icon: '🏢', label: 'Tenants' },
  { id: 'stores', icon: '🏪', label: 'Tiendas' },
  { id: 'plans', icon: '💎', label: 'Planes' },
  { id: 'pipeline', icon: '📋', label: 'Pipeline' },
  { id: 'chatbot', icon: '🤖', label: 'Chatbot' },
]
