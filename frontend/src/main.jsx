import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from './core/router/AppRouter'
import { isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from './legacy/lib/supabase'
import './legacy/index.css'
import './styles/globals.css'

async function cleanupLegacyServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const legacyRegistrations = registrations.filter((registration) => {
      const worker = registration.active || registration.waiting || registration.installing
      return Boolean(worker?.scriptURL?.includes('/service-worker.js'))
    })
    await Promise.all(legacyRegistrations.map((registration) => registration.unregister()))
  } catch {}

  if (!('caches' in window)) return
  try {
    const keys = await window.caches.keys()
    await Promise.all(keys.filter((key) => key === 'oxidian-v1').map((key) => window.caches.delete(key)))
  } catch {}
}

cleanupLegacyServiceWorker()

function ConfigErrorScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F6F0E5',
      padding: '2rem',
      color: '#1F2937',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: '#ffffff',
        border: '1px solid rgba(31, 41, 55, 0.12)',
        borderRadius: 16,
        padding: '2rem',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Configuracion incompleta</div>
        <p style={{ margin: 0, lineHeight: 1.7, color: '#4B5563', fontSize: 14 }}>
          {SUPABASE_CONFIG_ERROR}
        </p>
        <p style={{ margin: '16px 0 0', lineHeight: 1.7, color: '#6B7280', fontSize: 13 }}>
          Revisa las variables de entorno de Vercel para Production y vuelve a desplegar.
        </p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <RouterProvider
        router={appRouter}
        future={{ v7_startTransition: true }}
      />
    ) : (
      <ConfigErrorScreen />
    )}
    <Toaster position="top-right" />
  </React.StrictMode>,
)
