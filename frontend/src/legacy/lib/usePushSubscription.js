// usePushSubscription.js — CarmoCream v1
// Gestiona el ciclo completo: permiso → subscripción VAPID → guardado Supabase → renovación
//
// SETUP REQUERIDO (una sola vez):
//   1. Genera VAPID keys:  npx web-push generate-vapid-keys
//   2. Añade a .env:       VITE_VAPID_PUBLIC_KEY=<tu_clave_publica>
//   3. Añade en tu backend/hosting: VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:tu@email.com
//   4. Crea la Edge Function de Supabase (ver supabase/functions/send-push/)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const STORAGE_KEY  = 'cc_push_endpoint'

// Convierte base64url a Uint8Array (para VAPID)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// ── Estado global en módulo (evita re-subscripciones en hot-reload) ──────────
let _subscriptionPromise = null

export function usePushSubscription() {
  const [status,       setStatus]       = useState('idle') // idle | requesting | subscribed | denied | unsupported
  const [subscription, setSubscription] = useState(null)
  const [subCount,     setSubCount]     = useState(null)  // total suscriptores (solo admin)

  // Comprobar estado al montar
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    // Si ya tenemos endpoint guardado, marcar como subscribed
    if (localStorage.getItem(STORAGE_KEY)) {
      setStatus('subscribed')
    }
    // Escuchar cambios de subscripción desde el SW (rotación de claves)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'PUSH_SUB_CHANGED') {
        saveSubscriptionToSupabase(e.data.subscription)
      }
    })
  }, [])

  // ── Solicitar subscripción completa ──────────────────────────────────────────
  const subscribe = useCallback(async (customerInfo = {}) => {
    if (!VAPID_PUBLIC) {
      console.warn('[PWA] VITE_VAPID_PUBLIC_KEY no configurada — push desactivado')
      return false
    }
    if (status === 'subscribed') return true
    if (_subscriptionPromise) return _subscriptionPromise

    setStatus('requesting')

    _subscriptionPromise = (async () => {
      try {
        // 1. Pedir permiso
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus('denied')
          return false
        }

        // 2. Obtener el SW activo
        const reg = await navigator.serviceWorker.ready

        // 3. Subscribir a push
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        })

        // 4. Guardar en Supabase
        const subJson = sub.toJSON()
        await saveSubscriptionToSupabase(subJson, customerInfo)

        localStorage.setItem(STORAGE_KEY, subJson.endpoint)
        setSubscription(sub)
        setStatus('subscribed')
        return true
      } catch (err) {
        console.error('[PWA] Error al subscribir:', err)
        setStatus('denied')
        return false
      } finally {
        _subscriptionPromise = null
      }
    })()

    return _subscriptionPromise
  }, [status])

  // ── Cancelar subscripción ─────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        const endpoint = localStorage.getItem(STORAGE_KEY)
        if (endpoint) {
          await supabase.from('push_subscriptions').update({ is_active: false }).eq('endpoint', endpoint)
        }
        localStorage.removeItem(STORAGE_KEY)
      }
      setStatus('idle')
      setSubscription(null)
    } catch (err) {
      console.error('[PWA] Error al cancelar subscripción:', err)
    }
  }, [])

  // ── Cargar total de suscriptores (solo admin) ────────────────────────────
  const loadSubCount = useCallback(async () => {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    setSubCount(count || 0)
  }, [])

  return { status, subscription, subscribe, unsubscribe, subCount, loadSubCount }
}

// ── Guardar o actualizar subscripción en Supabase ─────────────────────────────
export async function saveSubscriptionToSupabase(subJson, customerInfo = {}) {
  const { endpoint, keys } = subJson
  if (!endpoint || !keys?.p256dh || !keys?.auth) return

  const payload = {
    endpoint,
    p256dh:         keys.p256dh,
    auth:           keys.auth,
    user_agent:     navigator.userAgent.slice(0, 250),
    customer_phone: customerInfo.phone  || null,
    customer_name:  customerInfo.name   || null,
    is_active:      true,
    subscribed_at:  new Date().toISOString(),
  }

  // Upsert por endpoint (actualiza si ya existe)
  await supabase.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' })
}

// ── Actualizar info del cliente en su subscripción ────────────────────────────
export async function updatePushSubscriberInfo(phone, name, orderCount) {
  const endpoint = localStorage.getItem(STORAGE_KEY)
  if (!endpoint) return
  await supabase.from('push_subscriptions').update({
    customer_phone: phone  || null,
    customer_name:  name   || null,
    order_count:    orderCount || 0,
    last_order_at:  new Date().toISOString(),
  }).eq('endpoint', endpoint)
}
