import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from './core/router/AppRouter'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider
      router={appRouter}
      future={{ v7_startTransition: true }}
    />
    <Toaster position="top-right" />
  </React.StrictMode>,
)
