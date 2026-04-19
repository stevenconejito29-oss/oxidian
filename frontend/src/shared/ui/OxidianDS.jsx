/**
 * OxidianDS.jsx — Sistema de diseño compartido para todos los paneles operativos
 * Componentes: Card, Btn, Badge, Field, Alert, Modal, Avatar, StatBar, Spinner
 */
import React from 'react'

// ─── Design tokens inline ─────────────────────────────────────────
export const t = {
  r8:  '8px',  r10: '10px', r12: '12px', r14: '14px',
  shadow: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)',
  shadowMd: '0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06)',
}

// ─── Color tokens por estado ──────────────────────────────────────
export const STATUS = {
  pending:   { bg:'#fef9c3', border:'#fde047', text:'#713f12', label:'Pendiente'   },
  preparing: { bg:'#dbeafe', border:'#3b82f6', text:'#1e3a8a', label:'Preparando'  },
  ready:     { bg:'#dcfce7', border:'#22c55e', text:'#14532d', label:'Listo'        },
  delivering:{ bg:'#ede9fe', border:'#8b5cf6', text:'#3b0764', label:'En camino'   },
  delivered: { bg:'#f0fdf4', border:'#86efac', text:'#166534', label:'Entregado'   },
  cancelled: { bg:'#fee2e2', border:'#f87171', text:'#7f1d1d', label:'Cancelado'   },
  active:    { bg:'#dcfce7', border:'#86efac', text:'#166534', label:'Activo'      },
  paused:    { bg:'#f3f4f6', border:'#d1d5db', text:'#374151', label:'Pausado'     },
  draft:     { bg:'#f3f4f6', border:'#d1d5db', text:'#374151', label:'Borrador'    },
}

// ─── Atoms ───────────────────────────────────────────────────────

export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size, border: `${size * 0.12}px solid var(--color-border-secondary)`,
      borderTopColor: 'var(--color-text-primary)', borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

export function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS[status] || { bg:'#f3f4f6', border:'#d1d5db', text:'#374151', label: status }
  const p = size === 'sm' ? '2px 8px' : '5px 12px'
  const fs = size === 'sm' ? 11 : 13
  return (
    <span style={{
      padding: p, borderRadius: 20, fontSize: fs, fontWeight: 600, whiteSpace: 'nowrap',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>{s.label}</span>
  )
}

export function Badge({ children, color = '#64748b', size = 'sm' }) {
  const p = size === 'sm' ? '2px 8px' : '4px 12px'
  return (
    <span style={{
      padding: p, borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

export function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', type = 'button', full = false, style: sx = {} }) {
  const sizes = { sm:'6px 14px', md:'9px 18px', lg:'12px 24px', xl:'16px 32px' }
  const fss   = { sm:11, md:13, lg:14, xl:15 }
  const bgs = {
    primary: 'var(--color-text-primary)', ghost:'transparent',
    danger:'#dc2626', success:'#16a34a', warning:'#f59e0b',
    blue:'#2563eb', purple:'#7c3aed', orange:'#ea580c',
  }
  const cls = { primary:'#fff', ghost:'var(--color-text-secondary)', danger:'#fff', success:'#fff', warning:'#fff', blue:'#fff', purple:'#fff', orange:'#fff' }
  const bds = { ghost:`1px solid var(--color-border-secondary)` }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: sizes[size] || sizes.md, borderRadius: t.r8, fontSize: fss[size] || 13,
      fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      border: bds[variant] || 'none', width: full ? '100%' : undefined,
      background: disabled ? '#e5e7eb' : bgs[variant],
      color: disabled ? '#9ca3af' : cls[variant],
      transition: '.15s', whiteSpace: 'nowrap',
      boxShadow: variant !== 'ghost' && !disabled ? t.shadow : 'none',
      ...sx,
    }}>{children}</button>
  )
}

export function Card({ children, title, sub, action, accent, p = '16px', style: sx = {} }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `1px solid ${accent || 'var(--color-border-tertiary)'}`,
      borderRadius: t.r14, overflow: 'hidden',
      boxShadow: t.shadow, ...sx,
    }}>
      {(title || action) && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: p }}>{children}</div>
    </div>
  )
}

export function Field({ label, required, hint, children }) {
  return (
    <div>
      {label && (
        <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--color-text-secondary)', marginBottom:5 }}>
          {label} {required && <span style={{color:'#dc2626'}}>*</span>}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:4 }}>{hint}</div>}
    </div>
  )
}

const inputBase = {
  width:'100%', padding:'9px 12px', borderRadius:t.r8, fontSize:13,
  border:'1px solid var(--color-border-secondary)', boxSizing:'border-box',
  background:'var(--color-background-primary)', color:'var(--color-text-primary)',
  fontFamily:'inherit', outline:'none', transition:'.15s',
}

export function Input({ label, required, hint, ...p }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <input {...p} style={{ ...inputBase, ...(p.style||{}) }} />
    </Field>
  )
}

export function Select({ label, required, hint, children, ...p }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <select {...p} style={{ ...inputBase, cursor:'pointer', ...(p.style||{}) }}>{children}</select>
    </Field>
  )
}

export function Textarea({ label, required, hint, ...p }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <textarea {...p} style={{ ...inputBase, resize:'vertical', minHeight:80, ...(p.style||{}) }} />
    </Field>
  )
}

export function Alert({ children, type = 'error', onClose }) {
  const c = { error:'#dc2626', success:'#16a34a', info:'#2563eb', warn:'#d97706' }
  const b = { error:'#fef2f2', success:'#f0fdf4', info:'#eff6ff', warn:'#fffbeb' }
  return (
    <div style={{
      padding:'10px 14px', borderRadius:t.r8, marginBottom:12,
      background:b[type]||b.info, color:c[type]||c.info,
      fontSize:13, border:`1px solid ${c[type]||c.info}30`,
      display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8,
    }}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:16,lineHeight:1,flexShrink:0}}>✕</button>}
    </div>
  )
}

export function Avatar({ name = '?', color = '#6366f1', size = 36 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:size/3,
      background:`${color}20`, color,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size*0.35, fontWeight:700, flexShrink:0, letterSpacing:'-0.5px',
    }}>{String(name).slice(0,2).toUpperCase()}</div>
  )
}

export function Empty({ icon='📭', title, sub }) {
  return (
    <div style={{textAlign:'center', padding:'2.5rem 1rem', color:'var(--color-text-secondary)'}}>
      <div style={{fontSize:40, marginBottom:10}}>{icon}</div>
      {title && <div style={{fontSize:14, fontWeight:500, marginBottom:4}}>{title}</div>}
      {sub   && <div style={{fontSize:13}}>{sub}</div>}
    </div>
  )
}

export function Divider() {
  return <div style={{ height:1, background:'var(--color-border-tertiary)', margin:'12px 0' }} />
}

export function Grid2({ children, gap=16 }) {
  return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap }}>{children}</div>
}

export function StatGrid({ items }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          background:'var(--color-background-primary)',
          border:'1px solid var(--color-border-tertiary)',
          borderRadius:t.r12, padding:'14px 16px',
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--color-text-secondary)'}}>{it.label}</span>
            {it.icon && <span style={{fontSize:18}}>{it.icon}</span>}
          </div>
          <div style={{fontSize:28,fontWeight:800,letterSpacing:'-1px',marginTop:6,color:it.color||'var(--color-text-primary)'}}>{it.value??'…'}</div>
          {it.hint && <div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:3}}>{it.hint}</div>}
        </div>
      ))}
    </div>
  )
}

// Timer: muestra cuánto tiempo lleva un pedido
export function OrderTimer({ createdAt }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const start = new Date(createdAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [createdAt])

  const mins = Math.floor(elapsed / 60)
  const color = mins < 10 ? '#16a34a' : mins < 20 ? '#f59e0b' : '#dc2626'

  return (
    <span style={{
      fontSize:12, fontWeight:700, color,
      background:`${color}15`, padding:'2px 7px', borderRadius:20,
    }}>
      {mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`}
    </span>
  )
}

// inject spinner animation
if (typeof document !== 'undefined' && !document.getElementById('ods-anim')) {
  const s = document.createElement('style')
  s.id = 'ods-anim'
  s.textContent = '@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}'
  document.head.appendChild(s)
}
