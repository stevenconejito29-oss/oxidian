const CACHE_NAME = 'oxidian-v1'
const SHELL_URLS = [
  '/',
  '/menu',
  '/pedidos',
  '/repartidor',
  '/logo.png',
  '/manifest-cocina.json',
  '/manifest-repartidor.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // NO cachear llamadas a Supabase, APIs externas ni chatbot local
  const isSupabase = url.hostname.includes('supabase.co')
  const isChatbot  = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  const isAPI      = url.pathname.startsWith('/api/')
  if (isSupabase || isChatbot || isAPI) return

  if (!url.origin.includes(self.location.hostname)) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(hit => {
        if (hit) return hit
        return fetch(event.request).then(response => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))
          return response
        })
      })
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = {
      title: 'Oxidian',
      body: event.data?.text() || 'Tienes un mensaje nuevo.',
    }
  }

  const vibrationByType = {
    promo: [200, 100, 200, 100, 400],
    order: [300, 100, 300],
    alert: [100, 50, 100, 50, 100],
    reminder: [200, 100, 200],
  }
  const actionsByType = {
    promo: [{ action: 'open', title: 'Ver oferta' }, { action: 'close', title: 'Cerrar' }],
    order: [{ action: 'open', title: 'Ver pedido' }, { action: 'close', title: 'Cerrar' }],
    alert: [{ action: 'open', title: 'Ver mas' }, { action: 'close', title: 'Cerrar' }],
    reminder: [{ action: 'order', title: 'Pedir ahora' }, { action: 'close', title: 'Cerrar' }],
  }

  const type = payload.type || 'promo'
  const emoji = payload.emoji || '🍓'
  const title = payload.title || `${emoji} Oxidian`
  const body = payload.body || 'Tenemos algo especial para ti.'
  const actions = payload.actions || actionsByType[type] || []
  const vibrate = vibrationByType[type] || [200, 100, 200]

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/logo.png',
      badge: '/logo.png',
      tag: `oxidian-${type}`,
      renotify: true,
      vibrate,
      actions,
      data: {
        url: payload.url || '/menu',
        type,
        campaign: payload.campaign || null,
        timestamp: Date.now(),
      },
      ...(payload.image ? { image: payload.image } : {}),
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const { url, campaign } = event.notification.data || {}
  const action = event.action

  if (campaign) {
    fetch(`${self.registration.scope}api/push-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign, action }),
    }).catch(() => {})
  }

  if (action === 'close') return

  const targetUrl = action === 'order' ? '/menu' : url || '/menu'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const existing = windows.find(client => client.url.includes(self.location.hostname))
      if (existing) {
        existing.focus()
        return existing.navigate(targetUrl)
      }
      return clients.openWindow(targetUrl)
    })
  )
})

self.addEventListener('sync', event => {
  if (event.tag === 'background-order-check') {
    event.waitUntil(Promise.resolve())
  }
})

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then(subscription =>
        self.clients.matchAll().then(clientsList => {
          clientsList.forEach(client => {
            client.postMessage({
              type: 'PUSH_SUB_CHANGED',
              subscription: subscription.toJSON(),
            })
          })
        })
      )
      .catch(() => {})
  )
})
