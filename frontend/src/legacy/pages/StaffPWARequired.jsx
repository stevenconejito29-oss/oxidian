import React from 'react'
import { usePWAInstall } from '../lib/usePWAInstall'
import styles from './StaffPWARequired.module.css'

const ROLE_META = {
  cocina: {
    icon: '👨‍🍳',
    title: 'Cocina PWA obligatoria',
    subtitle:
      'Instala la app de cocina para trabajar en modo horizontal, con acceso directo y sin depender del navegador.',
    route: '/pedidos',
    orientation: 'Horizontal obligatoria',
    note: 'Esta vista solo funciona como app instalada para proteger el flujo operativo de cocina.',
  },
  repartidor: {
    icon: '🛵',
    title: 'Repartidor PWA obligatoria',
    subtitle:
      'Instala la app de repartidor para trabajar en modo vertical, con acceso directo y sin romper el flujo en ruta.',
    route: '/repartidor',
    orientation: 'Vertical obligatoria',
    note: 'Esta vista solo funciona como app instalada para mantener la operacion de reparto estable.',
  },
}

function buildDirectLink(route) {
  if (typeof window === 'undefined') return route
  return `${window.location.origin}${route}`
}

export default function StaffPWARequired({ role, children }) {
  const meta = ROLE_META[role] || ROLE_META.cocina
  const {
    isInstalled,
    showButton,
    showIOSHint,
    setShowIOSHint,
    install,
    getButtonLabel,
    isWebView,
    isIOS,
  } = usePWAInstall()

  if (isInstalled) return children

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>{meta.icon}</div>
        <div className={styles.badge}>{meta.orientation}</div>
        <h1 className={styles.title}>{meta.title}</h1>
        <p className={styles.subtitle}>{meta.subtitle}</p>

        <div className={styles.actions}>
          {showButton && (
            <button className={styles.primaryBtn} onClick={install}>
              {getButtonLabel()} {role === 'cocina' ? 'Cocina' : 'Repartidor'}
            </button>
          )}

          <a className={styles.secondaryBtn} href={buildDirectLink(meta.route)} target="_blank" rel="noreferrer">
            Abrir vista de instalacion
          </a>
        </div>

        <div className={styles.infoBox}>
          <strong>Como se instala:</strong>
          <span>
            {isWebView
              ? 'Abre esta vista en el navegador nativo y luego usa el boton de instalar.'
              : 'Abre esta vista, instala la app y vuelve a entrar desde el icono creado en el dispositivo.'}
          </span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Ruta</span>
            <span className={styles.infoValue}>{meta.route}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Modo</span>
            <span className={styles.infoValue}>Standalone</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Uso</span>
            <span className={styles.infoValue}>{role === 'cocina' ? 'Produccion' : 'Entrega'}</span>
          </div>
        </div>

        <p className={styles.note}>{meta.note}</p>

        {showIOSHint && (
          <div className={styles.iosHint}>
            <p>
              En Safari toca <strong>Compartir</strong> y luego <strong>Anadir a pantalla de inicio</strong>.
            </p>
            <button className={styles.iosHintClose} onClick={() => setShowIOSHint(false)}>
              Cerrar
            </button>
          </div>
        )}

        {!showButton && !showIOSHint && !isWebView && !isIOS && (
          <div className={styles.softHint}>
            Si el navegador no muestra la instalacion automaticamente, usa Chrome o Edge en movil para instalar esta app.
          </div>
        )}
      </div>
    </div>
  )
}
