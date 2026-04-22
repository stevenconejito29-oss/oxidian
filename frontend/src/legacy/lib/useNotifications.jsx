// useNotifications.jsx — Oxidian v2
// Sistema centralizado: sonido Web Audio API + Push API + toasts premium con prioridad

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

// ─── Audio via Web Audio API (sin archivos externos) ─────────────────────────
export function playAlert(type = 'new_order') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const patterns = {
      new_order:  [{ f:880,d:.12,g:.8 },{ f:1100,d:.12,g:.9 },{ f:1320,d:.22,g:1   }],
      urgent:     [{ f:660,d:.1, g:.9 },{ f:660, d:.1, g:.9 },{ f:880, d:.28,g:1   }],
      delivery:   [{ f:523,d:.12,g:.7 },{ f:659, d:.12,g:.8 },{ f:784, d:.22,g:.9  }],
      success:    [{ f:784,d:.1, g:.7 },{ f:988, d:.22,g:.9 }],
      warning:    [{ f:440,d:.15,g:.8 },{ f:330, d:.25,g:.7 }],
      code_ok:    [{ f:523,d:.1, g:.8 },{ f:659, d:.1, g:.9 },{ f:784, d:.1, g:.9 },{ f:1047,d:.3,g:1}],
      code_fail:  [{ f:220,d:.25,g:.9 },{ f:180, d:.4, g:.8 }],
    }
    const notes = patterns[type] || patterns.new_order
    let t = ctx.currentTime + 0.04
    notes.forEach(({ f, d, g }) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, t)
      gain.gain.setValueAtTime(g * 0.30, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.06)
      osc.start(t); osc.stop(t + d + 0.12)
      t += d + 0.05
    })
  } catch { /* Safari u otros que bloqueen */ }
}

// ─── Browser Push API ─────────────────────────────────────────────────────────
export async function requestNotifPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false
  try {
    const perm = await Notification.requestPermission()
    return perm === 'granted'
  } catch { return false }
}

export function sendBrowserNotif(title, body, opts = {}) {
  if (typeof window === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon:     '/logo.png',
      badge:    '/logo.png',
      tag:      opts.tag      || 'store-admin',
      renotify: opts.renotify ?? true,
      silent:   false,
    })
    if (opts.onClick) n.onclick = opts.onClick
    setTimeout(() => n.close(), opts.timeout || 9000)
  } catch { /* ignorar si falla */ }
}

// ─── Estilos base de toasts ───────────────────────────────────────────────────
const BASE = {
  fontFamily: 'inherit',
  borderRadius: 14,
  boxShadow: '0 8px 32px rgba(0,0,0,.28)',
  maxWidth: 350,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 18px',
  color: 'white',
}

// ─── Biblioteca de notificaciones ────────────────────────────────────────────
export const notify = {

  newOrder(num, name) {
    playAlert('new_order')
    sendBrowserNotif('🛒 Nuevo pedido', `#${num} · ${name}`, { tag: 'order-'+num })
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#1C3829,#2D6A4F)' }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>🛒</span>
        <div>
          <div style={{ fontWeight:900, fontSize:'1rem' }}>¡Nuevo pedido! #{num}</div>
          <div style={{ fontSize:'.8rem', opacity:.85 }}>{name}</div>
        </div>
      </div>
    ), { duration: 7000 })
  },

  urgent(msg) {
    playAlert('urgent')
    sendBrowserNotif('Alerta urgente', msg, { tag: 'urgent-store-admin', timeout: 12000 })
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#7F1D1D,#DC2626)' }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>🚨</span>
        <div style={{ fontWeight: 800, fontSize: '.92rem', lineHeight: 1.3 }}>{msg}</div>
      </div>
    ), { duration: 9000 })
  },

  success(msg) {
    playAlert('success')
    toast.success(msg, { style: { fontWeight: 700, fontFamily:'inherit' }, duration: 4000 })
  },

  warning(msg) {
    playAlert('warning')
    toast(msg, {
      icon: '⚠️',
      style: { background:'#FEF3C7', color:'#92400E', fontWeight:700, fontFamily:'inherit' },
      duration: 6500,
    })
  },

  info(msg, emoji = 'ℹ️') {
    toast(`${emoji} ${msg}`, {
      style: { background:'#1D4ED8', color:'white', fontWeight:700, fontFamily:'inherit' },
      duration: 4500,
    })
  },

  marginAlert(productName, margin) {
    playAlert('warning')
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#7C2D12,#C2410C)' }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>📉</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: '.9rem' }}>Margen bajo detectado</div>
          <div style={{ fontSize: '.78rem', opacity: .9 }}>{productName}: {Number(margin).toFixed(1)}% (mín. 35%)</div>
        </div>
      </div>
    ), { duration: 8000 })
  },

  stockEmpty(name) {
    playAlert('warning')
    sendBrowserNotif('📦 Sin stock', `${name} desactivado automáticamente`)
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#1C3829,#374151)' }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>📦</span>
        <div>
          <div style={{ fontWeight: 900 }}>Sin stock</div>
          <div style={{ fontSize: '.78rem', opacity: .85 }}>{name} desactivado en tienda</div>
        </div>
      </div>
    ), { duration: 6000 })
  },

  codeVerified() {
    playAlert('code_ok')
    sendBrowserNotif('✅ Entrega confirmada', 'Código verificado — pedido cerrado')
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#065F46,#059669)' }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>✅</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem' }}>¡Código verificado!</div>
          <div style={{ fontSize: '.8rem', opacity: .85 }}>Pedido cerrado correctamente 🎉</div>
        </div>
      </div>
    ), { duration: 6000 })
  },

  codeWrong() {
    playAlert('code_fail')
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#7F1D1D,#DC2626)' }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>❌</span>
        <div>
          <div style={{ fontWeight: 900 }}>Código incorrecto</div>
          <div style={{ fontSize: '.78rem', opacity: .9 }}>Pide al cliente que revise su WhatsApp</div>
        </div>
      </div>
    ), { duration: 6000 })
  },

  arrivedAtDoor(orderNum) {
    playAlert('delivery')
    toast.custom(() => (
      <div style={{ ...BASE, background: 'linear-gradient(135deg,#1D4ED8,#2563EB)' }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>📍</span>
        <div>
          <div style={{ fontWeight: 900 }}>¡Llegaste al destino!</div>
          <div style={{ fontSize: '.8rem', opacity: .85 }}>Código enviado al cliente #{orderNum}</div>
        </div>
      </div>
    ), { duration: 6000 })
  },
}

// ─── Hook: detecta nuevos pedidos y dispara alertas ───────────────────────────
export function useNewOrderAlerts(orders, enabled = true) {
  const prevIds = useRef(new Set())
  const isFirst = useRef(true)

  useEffect(() => {
    if (!enabled) return
    if (isFirst.current) {
      orders.forEach(o => prevIds.current.add(o.id))
      isFirst.current = false
      return
    }
    const fresh = orders.filter(o => !prevIds.current.has(o.id))
    fresh.forEach(o => {
      notify.newOrder(o.order_number, o.customer_name)
      prevIds.current.add(o.id)
    })
  }, [orders, enabled])
}

// ─── Hook: solicita permiso de notificación al montar ─────────────────────────
export function useNotifPermission() {
  useEffect(() => {
    const t = setTimeout(() => requestNotifPermission(), 3500)
    return () => clearTimeout(t)
  }, [])
}
