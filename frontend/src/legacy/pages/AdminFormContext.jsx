import React from 'react'

export function EditFormIntro({ eyebrow, title, description, chips = [], tone = 'green', aside = null }) {
  const palette = {
    green: { bg: 'linear-gradient(145deg,#F0FDF4,#DCFCE7)', border: '#86EFAC', title: '#166534', text: '#166534', chipBg: '#FFFFFF', chipText: '#166534' },
    blue: { bg: 'linear-gradient(145deg,#EFF6FF,#DBEAFE)', border: '#93C5FD', title: '#1D4ED8', text: '#1E3A8A', chipBg: '#FFFFFF', chipText: '#1D4ED8' },
    amber: { bg: 'linear-gradient(145deg,#FFF7ED,#FFEDD5)', border: '#FDBA74', title: '#C2410C', text: '#9A3412', chipBg: '#FFFFFF', chipText: '#C2410C' },
  }[tone] || { bg: '#F9FAFB', border: '#E5E7EB', title: '#111827', text: '#374151', chipBg: '#FFFFFF', chipText: '#374151' }

  return (
    <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, background: palette.bg, border: `1.5px solid ${palette.border}`, display: 'flex', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        {eyebrow && <div style={{ fontSize: '.64rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: palette.text, opacity: .75, marginBottom: 6 }}>{eyebrow}</div>}
        <div style={{ fontSize: '1rem', fontWeight: 900, color: palette.title }}>{title}</div>
        {description && <div style={{ marginTop: 6, fontSize: '.8rem', lineHeight: 1.6, color: palette.text, fontWeight: 700 }}>{description}</div>}
        {chips.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map(chip => (
              <span key={chip} style={{ padding: '4px 10px', borderRadius: 999, background: palette.chipBg, color: palette.chipText, border: `1px solid ${palette.border}`, fontSize: '.7rem', fontWeight: 800 }}>{chip}</span>
            ))}
          </div>
        )}
      </div>
      {aside && <div style={{ minWidth: 140, flexShrink: 0 }}>{aside}</div>}
    </div>
  )
}

export function MiniPreviewCard({ emoji, imageUrl, title, lines = [] }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 150, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.75)', border: '1px solid rgba(255,255,255,.85)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', background: '#F3F4F6', border: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={event => { event.currentTarget.style.display = 'none' }} /> : <span style={{ fontSize: '1.45rem' }}>{emoji || '•'}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.82rem', fontWeight: 900, color: '#1C3829', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || 'Sin nombre'}</div>
        {lines.map(line => <div key={line} style={{ marginTop: 3, fontSize: '.68rem', fontWeight: 700, color: '#6B7280' }}>{line}</div>)}
      </div>
    </div>
  )
}
