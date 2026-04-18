import React from 'react'
import { setStoredActiveStoreId, shouldUseLocalPreviewDefaults, useResolvedStoreId } from '../../../legacy/lib/currentStore'
import { hasCurrentRouteSession } from '../../../legacy/lib/appSession'
import { supabase } from '../../../legacy/lib/supabase'
import { tenantApi } from '../../../shared/lib/backofficeApi'
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
  Button,
  Field,
  Form,
  FormGrid,
  GhostButton,
  Grid,
  Hero,
  Notice,
  Panel,
  QuickLinks,
  Shell,
  Stats,
  controlDeckStyles,
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

const STAFF_ROLE_OPTIONS = [
  { value: 'tenant_admin', view: '/tenant/admin', scope: 'tenant' },
  { value: 'store_admin', view: '/branch/admin', scope: 'store' },
  { value: 'store_operator', view: '/branch/admin', scope: 'store' },
  { value: 'branch_manager', view: '/branch/admin', scope: 'branch' },
  { value: 'cashier', view: '/branch/admin', scope: 'branch' },
  { value: 'kitchen', view: '/branch/kitchen', scope: 'branch' },
  { value: 'rider', view: '/branch/riders', scope: 'branch' },
]

const INITIAL_STAFF_FORM = {
  full_name: '',
  email: '',
  password: '',
  role: 'branch_manager',
  store_id: '',
  branch_id: '',
}

export default function TenantAdminPage() {
  const activeStoreId = useResolvedStoreId()
  const [config, setConfig] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [stores, setStores] = React.useState([])
  const [branches, setBranches] = React.useState([])
  const [staffAccounts, setStaffAccounts] = React.useState([])
  const [staffForm, setStaffForm] = React.useState(INITIAL_STAFF_FORM)
  const [staffLoading, setStaffLoading] = React.useState(true)
  const [staffSaving, setStaffSaving] = React.useState(false)
  const [staffError, setStaffError] = React.useState('')
  const [staffResult, setStaffResult] = React.useState(null)
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

  const refreshStaffAccounts = React.useCallback(async () => {
    setStaffLoading(true)
    setStaffError('')
    try {
      const [nextStores, nextBranches, nextAccounts] = await Promise.all([
        tenantApi('GET', '/stores'),
        tenantApi('GET', '/branches'),
        tenantApi('GET', '/accounts/staff'),
      ])
      setStores(nextStores || [])
      setBranches(nextBranches || [])
      setStaffAccounts(nextAccounts || [])
      setStaffForm(current => {
        const nextStoreId = current.store_id || activeStoreId || nextStores?.[0]?.id || ''
        const nextBranchId =
          current.branch_id ||
          nextBranches?.find(branch => branch.store_id === nextStoreId)?.id ||
          nextBranches?.[0]?.id ||
          ''
        return {
          ...current,
          store_id: nextStoreId,
          branch_id: nextBranchId,
        }
      })
    } catch (nextError) {
      setStaffError(nextError?.message || 'No se pudieron cargar las cuentas de staff.')
    } finally {
      setStaffLoading(false)
    }
  }, [activeStoreId])

  React.useEffect(() => {
    refreshStaffAccounts()
  }, [refreshStaffAccounts])

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
  const selectedRole = STAFF_ROLE_OPTIONS.find(option => option.value === staffForm.role) || STAFF_ROLE_OPTIONS[0]
  const filteredBranches = branches.filter(branch => !staffForm.store_id || branch.store_id === staffForm.store_id)

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

  async function handleStaffSubmit(event) {
    event.preventDefault()
    setStaffSaving(true)
    setStaffError('')
    setStaffResult(null)
    try {
      const payload = {
        ...staffForm,
        store_id: selectedRole.scope === 'tenant' ? null : staffForm.store_id || null,
        branch_id: selectedRole.scope === 'branch' ? staffForm.branch_id || null : null,
      }
      const created = await tenantApi('POST', '/accounts/staff', payload)
      setStaffResult(created)
      setStaffForm(current => ({
        ...INITIAL_STAFF_FORM,
        role: current.role,
        store_id: current.store_id || activeStoreId,
        branch_id: current.branch_id,
      }))
      await refreshStaffAccounts()
    } catch (nextError) {
      setStaffError(nextError?.message || 'No se pudo crear la cuenta de staff.')
    } finally {
      setStaffSaving(false)
    }
  }

  async function handleStaffStatusChange(account, isActive) {
    setStaffError('')
    try {
      await tenantApi('PATCH', `/accounts/staff/${account.membership_id}`, { is_active: isActive })
      await refreshStaffAccounts()
    } catch (nextError) {
      setStaffError(nextError?.message || 'No se pudo actualizar el estado del staff.')
    }
  }

  async function handleStaffPasswordReset(account) {
    const nextPassword = window.prompt(`Nueva password para ${account.email}`, '')
    if (!nextPassword) return
    setStaffError('')
    try {
      await tenantApi('PATCH', `/accounts/staff/${account.membership_id}`, { password: nextPassword })
      setStaffResult({ email: account.email, passwordReset: true })
      await refreshStaffAccounts()
    } catch (nextError) {
      setStaffError(nextError?.message || 'No se pudo actualizar la password del staff.')
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

            <Panel dark title="Jerarquía de acceso" text="Las vistas operativas viven dentro del panel administrativo de cada sede, no en el landing ni en menús públicos.">
              <QuickLinks
                links={[
                  { emoji: '🧭', title: 'Panel tenant', text: 'Desde aquí creas staff y gobiernas la marca.', href: '/tenant/admin' },
                  { emoji: '📍', title: 'Panel sede', text: 'Cocina, reparto y afiliados solo aparecen dentro del branch admin.', href: `/branch/admin?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🍽️', title: 'Menú público', text: 'Storefront modular conectado al store activo.', href: `/storefront/menu?store=${encodeURIComponent(activeStoreId)}` },
                  { emoji: '🧪', title: 'Legacy admin', text: 'Referencia temporal para funciones todavía no migradas.', href: `/legacy/admin?store=${encodeURIComponent(activeStoreId)}` },
                ]}
              />
            </Panel>
          </Grid>

          <Grid>
            <Panel title="Crear cuentas de staff" text="El dueño crea usuarios y asigna el rol exacto de cada vista.">
              {staffError && <Notice tone="error">{staffError}</Notice>}
              {staffResult && (
                <Notice tone="success">
                  Cuenta lista para <strong>{staffResult.email}</strong>.
                </Notice>
              )}
              <Form onSubmit={handleStaffSubmit}>
                <FormGrid>
                  <Field label="Rol">
                    <select
                      className={controlDeckStyles.select}
                      value={staffForm.role}
                      onChange={e => setStaffForm(current => ({ ...current, role: e.target.value }))}
                    >
                      {STAFF_ROLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nombre completo">
                    <input
                      className={controlDeckStyles.input}
                      value={staffForm.full_name}
                      onChange={e => setStaffForm(current => ({ ...current, full_name: e.target.value }))}
                      placeholder="Juan Operaciones"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className={controlDeckStyles.input}
                      type="email"
                      value={staffForm.email}
                      onChange={e => setStaffForm(current => ({ ...current, email: e.target.value }))}
                      placeholder="staff@marca.com"
                      required
                    />
                  </Field>
                  <Field label="Password inicial">
                    <input
                      className={controlDeckStyles.input}
                      type="text"
                      value={staffForm.password}
                      onChange={e => setStaffForm(current => ({ ...current, password: e.target.value }))}
                      placeholder="Minimo 8 caracteres"
                      required
                    />
                  </Field>
                  <Field label="Tienda">
                    <select
                      className={controlDeckStyles.select}
                      value={staffForm.store_id}
                      onChange={e => setStaffForm(current => ({
                        ...current,
                        store_id: e.target.value,
                        branch_id: branches.find(branch => branch.store_id === e.target.value)?.id || '',
                      }))}
                      disabled={selectedRole.scope === 'tenant'}
                    >
                      <option value="">Selecciona una tienda</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sede">
                    <select
                      className={controlDeckStyles.select}
                      value={staffForm.branch_id}
                      onChange={e => setStaffForm(current => ({ ...current, branch_id: e.target.value }))}
                      disabled={selectedRole.scope !== 'branch'}
                    >
                      <option value="">Selecciona una sede</option>
                      {filteredBranches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </Field>
                </FormGrid>
                <Notice>
                  Este rol entra por <strong>{selectedRole.view}</strong> y usa alcance de <strong>{selectedRole.scope}</strong>.
                </Notice>
                <Actions>
                  <Button type="submit" disabled={staffSaving}>
                    {staffSaving ? 'Guardando cuenta...' : 'Crear cuenta'}
                  </Button>
                  <GhostButton
                    type="button"
                    onClick={() => setStaffForm(current => ({
                      ...INITIAL_STAFF_FORM,
                      role: current.role,
                      store_id: current.store_id || activeStoreId,
                      branch_id: current.branch_id,
                    }))}
                  >
                    Limpiar
                  </GhostButton>
                </Actions>
              </Form>
            </Panel>

            <Panel title="Staff y permisos" text="Gestión operativa de usuarios por tienda, sede y vista." dark>
              {staffLoading ? <Notice>Cargando staff...</Notice> : null}
              {!staffLoading && staffAccounts.length === 0 ? (
                <Notice>No hay cuentas de staff registradas todavía.</Notice>
              ) : null}
              {!staffLoading && staffAccounts.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {staffAccounts.map(account => (
                    <article
                      key={account.membership_id}
                      style={{
                        padding: 16,
                        borderRadius: 18,
                        border: '1px solid var(--color-border-tertiary)',
                        background: 'var(--color-background-primary)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16 }}>{account.full_name || account.email}</h3>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                            {account.email}
                          </p>
                        </div>
                        <span className={controlDeckStyles.badge}>
                          {account.is_active ? 'activo' : 'pausado'}
                        </span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <BadgeRow items={[
                          account.role,
                          account.store_name || account.store_id || 'sin tienda',
                          account.branch_name || (account.branch_id ? 'sede asignada' : 'sin sede'),
                        ]} />
                      </div>
                      <Actions>
                        <GhostButton type="button" onClick={() => handleStaffStatusChange(account, !account.is_active)}>
                          {account.is_active ? 'Pausar acceso' : 'Reactivar acceso'}
                        </GhostButton>
                        <GhostButton type="button" onClick={() => handleStaffPasswordReset(account)}>
                          Resetear password
                        </GhostButton>
                      </Actions>
                    </article>
                  ))}
                </div>
              ) : null}
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
