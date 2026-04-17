// src/components/admin/StoreLinksPanel.jsx
// Panel que muestra todos los links independientes de una tienda
// con botón de copiar para cada uno. Se integra en AdminStoreCustomizationPanel.
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from '../../pages/Admin.module.css'

function buildLinks(storeCode) {
  const isDefault = !storeCode || storeCode === 'default'
  const base      = typeof window !== 'undefined' ? window.location.origin : ''
  const prefix    = isDefault ? '' : `/s/${storeCode}`

  return [
    {
      id: 'menu',
      label: 'Menú público',
      icon: '🛒',
      url: `${base}${prefix}/menu`,
      desc: 'Comparte este link con tus clientes',
    },
    {
      id: 'admin',
      label: 'Panel de administración',
      icon: '⚙️',
      url: `${base}${prefix}/admin`,
      desc: 'Solo para el operador de esta tienda',
    },
    {
      id: 'afiliado',
      label: 'Portal de afiliados',
      icon: '🤝',
      url: `${base}${prefix}/afiliado`,
      desc: 'Link para tus repartidores afiliados',
    },
    {
      id: 'cocina',
      label: 'PWA Cocina',
      icon: '👨‍🍳',
      url: `${base}${prefix}/pedidos`,
      desc: 'Instalar como app en tablet de cocina',
    },
    {
      id: 'repartidor',
      label: 'PWA Repartidor',
      icon: '🛵',
      url: `${base}${prefix}/repartidor`,
      desc: 'Instalar como app en móvil del repartidor',
    },
  ]
}

function LinkRow({ item }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(item.url).then(() => {
      setCopied(true)
      toast.success(`Link de ${item.label} copiado`)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('No se pudo copiar'))
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: 'var(--color-bg-input, rgba(255,255,255,0.05))',
      border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text, #e8e8e8)', marginBottom: 1 }}>
          {item.label}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-muted, #888)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.url}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)', marginTop: 1 }}>{item.desc}</div>
      </div>
      <button
        onClick={copy}
        style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: 7, border: 'none',
          background: copied ? 'var(--verde, #2D6A4F)' : 'rgba(255,255,255,0.1)',
          color: copied ? '#fff' : 'var(--color-text, #e8e8e8)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background .2s',
          fontFamily: 'inherit',
        }}
      >
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export default function StoreLinksPanel({ storeCode }) {
  const links = buildLinks(storeCode)
  return (
    <div className={styles.formCard} style={{ marginBottom: 20 }}>
      <div className={styles.formTitle} style={{ marginBottom: 14 }}>
        🔗 Links de esta tienda
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)', marginBottom: 14, marginTop: 0 }}>
        Cada link es independiente para esta tienda. Comparte el menú con clientes e instala las PWA
        en los dispositivos del personal.
      </p>
      {links.map(item => <LinkRow key={item.id} item={item} />)}
    </div>
  )
}
