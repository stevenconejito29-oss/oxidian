/**
 * OxidianDS.jsx — Oxidian Design System v2
 * Sistema de diseño completo para todos los paneles admin.
 * Inspirado en Linear, Vercel Dashboard, y Notion.
 * Todos los componentes usan CSS variables del tema global.
 */
import React from 'react'

// ─── CSS Global inject ────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('ods-v2')) {
  const s = document.createElement('style')
  s.id = 'ods-v2'
  s.textContent = `
    @keyframes ods-spin { to { transform: rotate(360deg) } }
    @keyframes ods-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes ods-slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes ods-fadeIn  { from{opacity:0} to{opacity:1} }
    .ods-hover-row:hover { background: var(--color-background-secondary) !important; }
    .ods-btn:hover:not(:disabled) { filter: brightness(0.92); }
    .ods-card { transition: box-shadow .15s; }
    .ods-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08) !important; }
    input:focus, select:focus, textarea:focus {
      border-color: var(--color-text-primary) !important;
      box-shadow: 0 0 0 3px rgba(var(--color-text-primary-rgb, 17,17,17), 0.08);
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--color-border-secondary); border-radius: 3px; }
  `
  document.head.appendChild(s)
}

// ─── Status colors & labels ───────────────────────────────────────
export const STATUS = {
  active:          { label:'Activo',       bg:'#dcfce7', border:'#86efac', text:'#15803d' },
  suspended:       { label:'Suspendido',   bg:'#fee2e2', border:'#fca5a5', text:'#b91c1c' },
  archived:        { label:'Archivado',    bg:'#f3f4f6', border:'#d1d5db', text:'#4b5563' },
  draft:           { label:'Borrador',     bg:'#f3f4f6', border:'#d1d5db', text:'#6b7280' },
  paused:          { label:'Pausado',      bg:'#fef3c7', border:'#fcd34d', text:'#92400e' },
  pending:         { label:'Pendiente',    bg:'#fef9c3', border:'#fde047', text:'#713f12' },
  contacted:       { label:'Contactado',   bg:'#dbeafe', border:'#93c5fd', text:'#1e40af' },
  demo_scheduled:  { label:'Demo',         bg:'#ede9fe', border:'#c4b5fd', text:'#5b21b6' },
  onboarding:      { label:'Onboarding',   bg:'#cffafe', border:'#67e8f9', text:'#155e75' },
  converted:       { label:'Convertido',   bg:'#dcfce7', border:'#86efac', text:'#15803d' },
  rejected:        { label:'Rechazado',    bg:'#fee2e2', border:'#fca5a5', text:'#b91c1c' },
  ghosted:         { label:'Ghosted',      bg:'#f9fafb', border:'#e5e7eb', text:'#9ca3af' },
  preparing:       { label:'Preparando',   bg:'#dbeafe', border:'#93c5fd', text:'#1e40af' },
  ready:           { label:'Listo',        bg:'#dcfce7', border:'#86efac', text:'#15803d' },
  delivering:      { label:'En camino',    bg:'#ede9fe', border:'#c4b5fd', text:'#5b21b6' },
  delivered:       { label:'Entregado',    bg:'#f0fdf4', border:'#bbf7d0', text:'#166534' },
  cancelled:       { label:'Cancelado',    bg:'#fee2e2', border:'#fca5a5', text:'#b91c1c' },
}

export function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS[status] || { label: status, bg:'#f3f4f6', border:'#d1d5db', text:'#374151' }
  const p = size === 'sm' ? '2px 8px' : '4px 12px'
  const fs = size === 'sm' ? 11 : 12
  return (
    <span style={{
      padding: p, borderRadius: 20, fontSize: fs, fontWeight: 600, whiteSpace: 'nowrap',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.text, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ─── StatCard ────────────────────────────────────────────────────
export function StatCard({ label, value, icon, hint, color, trend }) {
  return (
    <div className="ods-card" style={{
      background:'var(--color-background-primary)',
      border:'1px solid var(--color-border-tertiary)',
      borderRadius:12, padding:'16px 18px',
      boxShadow:'0 1px 4px rgba(0,0,0,.05)',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <span style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--color-text-secondary)',fontWeight:500}}>{label}</span>
        {icon&&<span style={{fontSize:20}}>{icon}</span>}
      </div>
      <div style={{fontSize:30,fontWeight:800,letterSpacing:'-1px',color:color||'var(--color-text-primary)'}}>
        {value??<span style={{color:'var(--color-border-secondary)'}}>—</span>}
      </div>
      {(hint||trend)&&(
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
          {hint&&<span style={{fontSize:12,color:'var(--color-text-secondary)'}}>{hint}</span>}
          {trend&&<span style={{fontSize:11,fontWeight:600,color:trend>0?'#16a34a':'#dc2626'}}>{trend>0?'↑':'↓'}{Math.abs(trend)}%</span>}
        </div>
      )}
    </div>
  )
}

// ─── StatGrid ────────────────────────────────────────────────────
export function StatGrid({ items }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
      {items.map((it,i)=><StatCard key={i} {...it} />)}
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────
export function Badge({ children, color='#64748b', size='sm' }) {
  const p = size==='sm'?'2px 8px':'4px 12px'
  return (
    <span style={{
      padding:p, borderRadius:20, fontSize:11, fontWeight:600,
      background:`${color}18`, color, border:`1px solid ${color}28`,
      display:'inline-flex', alignItems:'center',
    }}>{children}</span>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────
export function Avatar({ name='?', color='#6366f1', size=36, src }) {
  if (src) return <img src={src} alt={name} style={{width:size,height:size,borderRadius:size/3,objectFit:'cover',flexShrink:0}} />
  return (
    <div style={{
      width:size,height:size,borderRadius:size/3,flexShrink:0,
      background:`${color}20`,color,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:size*0.36,fontWeight:700,letterSpacing:'-0.5px',
    }}>{String(name).slice(0,2).toUpperCase()}</div>
  )
}

// ─── Empty ───────────────────────────────────────────────────────
export function Empty({ icon='📭', title, sub, action }) {
  return (
    <div style={{textAlign:'center',padding:'2.5rem 1rem',color:'var(--color-text-secondary)'}}>
      <div style={{fontSize:40,marginBottom:10}}>{icon}</div>
      {title&&<div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{title}</div>}
      {sub&&<div style={{fontSize:13,marginBottom:12}}>{sub}</div>}
      {action&&<div style={{marginTop:8}}>{action}</div>}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────
export function Spinner({ size=20, color }) {
  return (
    <div style={{
      width:size,height:size,borderRadius:'50%',flexShrink:0,
      border:`${Math.max(2,size*0.12)}px solid var(--color-border-secondary)`,
      borderTopColor:color||'var(--color-text-primary)',
      animation:'ods-spin .7s linear infinite',
    }}/>
  )
}

// ─── Divider ─────────────────────────────────────────────────────
export function Divider({ my=12 }) {
  return <div style={{height:1,background:'var(--color-border-tertiary)',margin:`${my}px 0`}}/>
}

// ─── Grid helpers ────────────────────────────────────────────────
export function Grid2({ children, gap=16 }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',gap}}>{children}</div>
}

// ─── OrderTimer ──────────────────────────────────────────────────
export function OrderTimer({ createdAt }) {
  const [elapsed,setElapsed]=React.useState(0)
  React.useEffect(()=>{
    const start=new Date(createdAt).getTime()
    const tick=()=>setElapsed(Math.floor((Date.now()-start)/1000))
    tick(); const id=setInterval(tick,10000); return()=>clearInterval(id)
  },[createdAt])
  const mins=Math.floor(elapsed/60)
  const color=mins<10?'#16a34a':mins<20?'#f59e0b':'#dc2626'
  return (
    <span style={{fontSize:12,fontWeight:700,color,background:`${color}15`,padding:'2px 7px',borderRadius:20}}>
      {mins<60?`${mins}m`:`${Math.floor(mins/60)}h ${mins%60}m`}
    </span>
  )
}

// ─── TabBar ──────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display:'flex',gap:4,flexWrap:'wrap',
      background:'var(--color-background-primary)',
      border:'1px solid var(--color-border-tertiary)',
      borderRadius:12,padding:4,marginBottom:20,
    }}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          padding:'7px 14px',borderRadius:9,border:'none',cursor:'pointer',
          fontSize:13,fontWeight:active===t.id?600:400,fontFamily:'inherit',
          background:active===t.id?'var(--color-text-primary)':'transparent',
          color:active===t.id?'var(--color-background-primary)':'var(--color-text-secondary)',
          display:'flex',alignItems:'center',gap:5,transition:'.15s',
        }}>
          {t.icon&&<span>{t.icon}</span>}
          {t.label}
          {t.count!=null&&<span style={{fontSize:10,background:active===t.id?'rgba(255,255,255,.25)':'var(--color-background-secondary)',padding:'1px 6px',borderRadius:20,fontWeight:700}}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width=520 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,.5)',
      zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--color-background-primary)',
        border:'1px solid var(--color-border-tertiary)',
        borderRadius:16,width:'100%',maxWidth:width,maxHeight:'90vh',
        overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)',
        animation:'ods-slideUp .2s ease',
      }}>
        {title&&(
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--color-border-tertiary)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:700,fontSize:15}}>{title}</div>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text-secondary)',fontSize:20,lineHeight:1,padding:0}}>×</button>
          </div>
        )}
        <div style={{padding:'20px'}}>{children}</div>
      </div>
    </div>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────
export function Stepper({ steps, current }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:24}}>
      {steps.map((step,i)=>(
        <React.Fragment key={i}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{
              width:28,height:28,borderRadius:14,
              background:i<current?'#16a34a':i===current?'var(--color-text-primary)':'var(--color-background-secondary)',
              color:i<=current?'#fff':'var(--color-text-secondary)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:12,fontWeight:700,flexShrink:0,
            }}>{i<current?'✓':i+1}</div>
            <span style={{fontSize:13,fontWeight:i===current?600:400,color:i===current?'var(--color-text-primary)':'var(--color-text-secondary)'}}>{step}</span>
          </div>
          {i<steps.length-1&&<div style={{flex:1,height:1,background:'var(--color-border-tertiary)',margin:'0 12px',minWidth:20}}/>}
        </React.Fragment>
      ))}
    </div>
  )
}

export function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}

// ─── Card ────────────────────────────────────────────────────────
export function Card({ children, style, className, title, sub, action, accent }) {
  const borderStyle = accent
    ? `1px solid ${accent}40`
    : '1px solid var(--color-border-secondary)'
  return (
    <div className={`ods-card ${className||''}`} style={{
      background:'var(--color-background-primary)',
      border:borderStyle,
      borderTop: accent ? `4px solid ${accent}` : borderStyle,
      borderRadius:12,
      padding:20,
      ...style
    }}>
      {(title || sub || action) && (
        <div style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'flex-start',
          gap:12,
          marginBottom:children ? 16 : 0,
        }}>
          <div style={{minWidth:0}}>
            {title && <div style={{fontSize:15,fontWeight:700,color:'var(--color-text-primary)'}}>{title}</div>}
            {sub && <div style={{fontSize:12,color:'var(--color-text-secondary)',marginTop:4}}>{sub}</div>}
          </div>
          {action && <div style={{flexShrink:0}}>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Btn ─────────────────────────────────────────────────────────
export function Btn({
  children,
  onClick,
  variant='primary',
  size='md',
  disabled,
  style,
  sx,
  type='button',
  full=false,
}) {
  const base = {
    display:'inline-flex', alignItems:'center', gap:6, fontWeight:600,
    borderRadius:8, border:'none', cursor:disabled?'not-allowed':'pointer',
    opacity:disabled?0.5:1, transition:'filter .15s',
    fontSize: size==='sm'?13:size==='lg'?16:14,
    padding: size==='sm'?'6px 12px':size==='lg'?'12px 22px':'9px 18px',
    justifyContent:'center',
    width: full ? '100%' : undefined,
    ...sx,
    ...style
  }
  const variants = {
    primary:  { background:'var(--color-text-primary)', color:'var(--color-background-primary)' },
    secondary:{ background:'var(--color-background-secondary)', color:'var(--color-text-primary)', border:'1px solid var(--color-border-secondary)' },
    danger:   { background:'#ef4444', color:'#fff' },
    ghost:    { background:'transparent', color:'var(--color-text-primary)', border:'1px solid var(--color-border-secondary)' },
    success:  { background:'#16a34a', color:'#fff' },
    blue:     { background:'#2563eb', color:'#fff' },
    purple:   { background:'#7c3aed', color:'#fff' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="ods-btn"
      style={{...base, ...(variants[variant]||variants.primary)}}>
      {children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type='text', disabled, error, style }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      {label&&<label style={{fontSize:13,fontWeight:600,color:'var(--color-text-secondary)'}}>{label}</label>}
      <input
        type={type} value={value??''} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        style={{
          padding:'9px 12px', borderRadius:8, fontSize:14,
          border:`1px solid ${error?'#ef4444':'var(--color-border-secondary)'}`,
          background:'var(--color-background-primary)',
          color:'var(--color-text-primary)', width:'100%', boxSizing:'border-box',
          ...style
        }}
      />
      {error&&<span style={{fontSize:12,color:'#ef4444'}}>{error}</span>}
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────
export function Select({ label, value, onChange, children, disabled, error, style }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      {label&&<label style={{fontSize:13,fontWeight:600,color:'var(--color-text-secondary)'}}>{label}</label>}
      <select
        value={value??''} onChange={onChange} disabled={disabled}
        style={{
          padding:'9px 12px', borderRadius:8, fontSize:14,
          border:`1px solid ${error?'#ef4444':'var(--color-border-secondary)'}`,
          background:'var(--color-background-primary)',
          color:'var(--color-text-primary)', width:'100%', boxSizing:'border-box',
          ...style
        }}
      >{children}</select>
      {error&&<span style={{fontSize:12,color:'#ef4444'}}>{error}</span>}
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────────
export function Textarea({ label, value, onChange, placeholder, rows=3, disabled, error, style }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      {label&&<label style={{fontSize:13,fontWeight:600,color:'var(--color-text-secondary)'}}>{label}</label>}
      <textarea
        value={value??''} onChange={onChange} rows={rows}
        placeholder={placeholder} disabled={disabled}
        style={{
          padding:'9px 12px', borderRadius:8, fontSize:14, resize:'vertical',
          border:`1px solid ${error?'#ef4444':'var(--color-border-secondary)'}`,
          background:'var(--color-background-primary)',
          color:'var(--color-text-primary)', width:'100%', boxSizing:'border-box',
          ...style
        }}
      />
      {error&&<span style={{fontSize:12,color:'#ef4444'}}>{error}</span>}
    </div>
  )
}

// ─── Alert ───────────────────────────────────────────────────────
export function Alert({ children, type='info', style }) {
  const colors = {
    info:    { bg:'#eff6ff', border:'#bfdbfe', text:'#1d4ed8' },
    success: { bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d' },
    warning: { bg:'#fffbeb', border:'#fde68a', text:'#92400e' },
    error:   { bg:'#fef2f2', border:'#fecaca', text:'#b91c1c' },
  }
  const c = colors[type]||colors.info
  return (
    <div style={{
      padding:'10px 14px', borderRadius:8, fontSize:14,
      background:c.bg, border:`1px solid ${c.border}`, color:c.text,
      ...style
    }}>{children}</div>
  )
}
