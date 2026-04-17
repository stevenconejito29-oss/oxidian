import React from 'react'
import { setStoredActiveStoreId, shouldUseLocalPreviewDefaults, useResolvedStoreId } from '../../../legacy/lib/currentStore'
import { hasCurrentRouteSession } from '../../../legacy/lib/appSession'
import { supabase } from '../../../legacy/lib/supabase'
import {
  buildStoreOperationalProfile,
  isStoreModuleEnabled,
  loadStoreConfig,
} from '../../../legacy/lib/storeConfig'
import {
  getDesktopChatbotRuntimeStatus,
  isDesktopChatbotRuntimeAvailable,
  restartDesktopChatbotRuntime,
  startDesktopChatbotRuntime,
  stopDesktopChatbotRuntime,
  subscribeDesktopChatbotRuntime,
} from '../../../legacy/lib/desktopChatbotRuntime'
import { getMenuStylePreset } from '../../../modules/theming/presets/menuPresets'
import {
  Actions,
  BadgeRow,
  GhostButton,
  Grid,
  Hero,
  Notice,
  Panel,
  QuickLinks,
  Shell,
  Stats,
} from '../../../shared/ui/ControlDeck'

function buildEnabledModules(config = {}) {
  const modules = [
    ['Productos', isStoreModuleEnabled(config, 'products')],
    ['Combos', isStoreModuleEnabled(config, 'combos')],
    ['Toppings', isStoreModuleEnabled(config, 'toppings')],
    ['Stock', isStoreModuleEnabled(config, 'stock')],
    ['Cupones', isStoreModuleEnabled(config, 'coupons')],
    ['Fidelidad', isStoreModuleEnabled(config, 'loyalty')],
    ['Reviews', isStoreModuleEnabled(config, 'reviews')],
    ['Afiliados', isStoreModuleEnabled(config, 'affiliates')],
    ['Chatbot', isStoreModuleEnabled(config, 'chatbot')],
    ['Staff', isStoreModuleEnabled(config, 'staff')],
    ['Finanzas', isStoreModuleEnabled(config, 'finance')],
  ]

  return modules.filter(([, enabled]) => enabled).map(([label]) => label)
}

export default function TenantAdminPage() {
  const activeStoreId = useResolvedStoreId()
  const [config, setConfig] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [runtimeProfile, setRuntimeProfile] = React.useState(null)
  const [runtimeStatus, setRuntimeStatus] = React.useState(null)
  const [staffPulse, setStaffPulse] = React.useState({ total: 0, online: 0 })
  const [runtimeBusy, setRuntimeBusy] = React.useState(false)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    loadStoreConfig(activeStoreId)
      .then(nextConfig => {
        if (!active) return
        setConfig(nextConfig)
        setStoredActiveStoreId(activeStoreId)
      })
      .catch(nextError => {
        if (active) setError(nextError?.message || 'No se pudo cargar la configuracion de tienda.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeStoreId])

  React.useEffect(() => {
    let active = true

    if (shouldUseLocalPreviewDefaults(activeStoreId) || !hasCurrentRouteSession()) {
      setRuntimeProfile(null)
      setStaffPulse({ total: 0, online: 0 })
      return undefined
    }

    async function loadOperationalPulse() {
      const [{ data: runtimeData }, staffTotalRes, staffOnlineRes] = await Promise.all([
        supabase.from('store_runtime_profiles').select('*').eq('store_id', activeStoreId).maybeSingle(),
        supabase.from('staff_users').select('id', { count: 'exact', head: true }).eq('store_id', activeStoreId),
        supabase.from('staff_users').select('id', { count: 'exact', head: true }).eq('store_id', activeStoreId).eq('is_online', true),
      ])

      if (!active) return
      setRuntimeProfile(runtimeData || null)
      setStaffPulse({
        total: staffTotalRes.count || 0,
        online: staffOnlineRes.count || 0,
      })
    }

    loadOperationalPulse().catch(() => {})

    if (isDesktopChatbotRuntimeAvailable()) {
      getDesktopChatbotRuntimeStatus().then(status => {
        if (active) setRuntimeStatus(status)
      }).catch(() => {})
    }

    const unsubscribe = subscribeDesktopChatbotRuntime(status => {
      if (active) setRuntimeStatus(status)
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [activeStoreId])

  const operational = buildStoreOperationalProfile(config || {})
  const enabledModules = buildEnabledModules(config || {})
  const preset = getMenuStylePreset(config?.menu_layout || 'delivery')

  async function runRuntimeAction(action) {
    setRuntimeBusy(true)
    try {
      if (action === 'start') await startDesktopChatbotRuntime()
      if (action === 'restart') await restartDesktopChatbotRuntime()
      if (action === 'stop') await stopDesktopChatbotRuntime()
      const nextStatus = await getDesktopChatbotRuntimeStatus()
      setRuntimeStatus(nextStatus)
    } finally {
      setRuntimeBusy(false)
    }
  }

  return (
    <Shell>
      <Hero
        eyebrow="Tenant Admin · Control de marca"
        title={config?.business_name || 'Panel del dueño para una marca viva.'}
        description="La intención aquí es que el dueño controle operación, branding, fidelidad, afiliados, finanzas y runtime local sin entrar al super admin. La lógica viene del proyecto anterior; la experiencia empieza a ser nueva."
        signals={[
          { label: 'Store', value: activeStoreId },
          { label: 'Layout', value: preset.label },
        ]}
      />

      {loading ? <Notice>Cargando configuracion de la tienda...</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {!loading && !error ? (
        <>
          <Grid>
            <Panel title="Mapa de control" text="Resumen operativo y comercial de la marca activa.">
              <Stats
                items={[
                  { label: 'Store activo', value: activeStoreId, hint: 'Scope local resuelto desde query, dominio o sesion.' },
                  { label: 'Plantilla', value: preset.label, hint: preset.description },
                  { label: 'Flujo', value: operational.order_flow_type, hint: 'Define si hay cocina, pickup o despacho directo.' },
                  { label: 'Módulos', value: String(enabledModules.length), hint: 'Capacidades activadas para esta marca.' },
                ]}
              />
            </Panel>

            <Panel dark title="Entradas rápidas" text="Accesos directos para cocina, reparto, menú, afiliados y referencia legacy mientras termina la migración.">
              <QuickLinks
                links={[
                  { emoji: '🧾', title: 'Pedidos / cocina', text: 'Vista operativa por sede para preparación.', href: `/branch/kitchen?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🛵', title: 'Repartidores', text: 'Seguimiento de despacho y entrega.', href: `/branch/riders?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🍽️', title: 'Menú público', text: 'Storefront modular conectado al store activo.', href: `/storefront/menu?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🏷️', title: 'Afiliados', text: 'Portal y crecimiento por referidos.', href: '/tenant/affiliates' },
                  { emoji: '🧪', title: 'Legacy admin', text: 'Referencia temporal para funciones todavía no migradas.', href: `/legacy/admin?store=${encodeURIComponent(activeStoreId)}` },
                ]}
              />
            </Panel>
          </Grid>

          <Grid>
            <Panel title="Módulos activos" text="Estado operativo derivado de la configuración real de tienda.">
              <BadgeRow items={enabledModules.length ? enabledModules : ['Sin modulos activos']} />
            </Panel>

            <Panel title="Marca y storefront" text="Snapshot de branding y plantilla para la UI pública.">
              <BadgeRow items={[config?.business_type || 'food', config?.plan_slug || 'growth', config?.menu_layout || 'delivery', config?.theme_font_display || 'display font', config?.theme_font_body || 'body font']} />
              <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[config?.theme_primary_color, config?.theme_secondary_color, config?.theme_accent_color, config?.theme_surface_color].filter(Boolean).map(color => (
                    <span
                      key={color}
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 18,
                        background: color,
                        border: '1px solid rgba(15,23,42,0.08)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
                      }}
                      title={color}
                    />
                  ))}
                </div>
                <Notice>{config?.storefront_intro_title || preset.settings?.storefront_intro_title || 'Esta tienda todavía no tiene narrativa comercial propia definida.'}</Notice>
              </div>
            </Panel>
          </Grid>

          <Panel title="Capas del sistema" text="Cómo se reparte la responsabilidad entre owner, marca y sede dentro de la arquitectura nueva.">
            <QuickLinks
              links={[
                { emoji: '🏢', title: 'Store', text: 'Template visual, branding, catálogo y dominio de la marca.', href: '#' },
                { emoji: '📍', title: 'Branch', text: 'Cocina, riders, menú visible y staff operativo por sede.', href: '#' },
                { emoji: '💎', title: 'Fidelidad', text: 'Rewards, reviews y club access sobre la base actual.', href: '#' },
                { emoji: '🤖', title: 'Chatbot local', text: 'Runtime portable conectado a la base de datos de la tienda.', href: '#' },
              ]}
            />
            <Actions>
              <GhostButton type="button" onClick={() => window.open('http://127.0.0.1:3001', '_blank', 'noopener,noreferrer')}>
                Abrir chatbot local
              </GhostButton>
            </Actions>
          </Panel>

          <Grid>
            <Panel title="Runtime local" text="Pulso del runtime portable y del perfil técnico de la tienda.">
              <Stats
                items={[
                  { label: 'Chatbot URL', value: runtimeProfile?.chatbot_url || '127.0.0.1:3001', hint: 'Runtime local esperado para WhatsApp y automatizaciones.' },
                  { label: 'Autostart', value: runtimeProfile?.chatbot_autostart ? 'activo' : 'manual', hint: 'Configuración guardada por tienda.' },
                  { label: 'Desktop admin', value: runtimeProfile?.admin_desktop_enabled ? 'sí' : 'no', hint: 'Puerta de entrada al runtime de escritorio.' },
                  { label: 'Bridge', value: isDesktopChatbotRuntimeAvailable() ? 'detectado' : 'no detectado', hint: 'Disponible solo desde el entorno desktop.' },
                ]}
              />
              <Actions>
                <GhostButton type="button" disabled={runtimeBusy || !isDesktopChatbotRuntimeAvailable()} onClick={() => runRuntimeAction('start')}>
                  Iniciar chatbot
                </GhostButton>
                <GhostButton type="button" disabled={runtimeBusy || !isDesktopChatbotRuntimeAvailable()} onClick={() => runRuntimeAction('restart')}>
                  Reiniciar
                </GhostButton>
                <GhostButton type="button" disabled={runtimeBusy || !isDesktopChatbotRuntimeAvailable()} onClick={() => runRuntimeAction('stop')}>
                  Detener
                </GhostButton>
              </Actions>
              {runtimeStatus ? (
                <Notice>
                  Estado bridge: {JSON.stringify(runtimeStatus)}
                </Notice>
              ) : (
                <Notice>
                  El estado detallado del runtime solo aparece cuando abres la app desde el desktop bridge.
                </Notice>
              )}
            </Panel>

            <Panel dark title="Pulso de staff" text="Lectura rápida del equipo activo conectado a esta tienda.">
              <Stats
                items={[
                  { label: 'Staff total', value: String(staffPulse.total), hint: 'Usuarios de staff asociados al store.' },
                  { label: 'Online', value: String(staffPulse.online), hint: 'Presencia viva detectada en la base.' },
                  { label: 'Módulo staff', value: isStoreModuleEnabled(config || {}, 'staff') ? 'activo' : 'apagado', hint: 'Controlado por el perfil operativo.' },
                  { label: 'Chatbot', value: isStoreModuleEnabled(config || {}, 'chatbot') ? 'activo' : 'apagado', hint: 'Controlado por el perfil operativo.' },
                ]}
              />
              <QuickLinks
                links={[
                  { emoji: '📦', title: 'Cocina', text: 'Entrar a la cola de preparación.', href: `/branch/kitchen?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🛵', title: 'Reparto', text: 'Entrar al tablero de riders.', href: `/branch/riders?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🧪', title: 'Legacy ops', text: 'Comparar con las pantallas anteriores.', href: `/legacy/admin?store=${encodeURIComponent(activeStoreId)}` },
                ]}
              />
            </Panel>
          </Grid>
        </>
      ) : null}
    </Shell>
  )
}
