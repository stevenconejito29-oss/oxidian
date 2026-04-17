import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowUpRight, LayoutTemplate, Rocket, Workflow } from 'lucide-react'
import styles from './Admin.module.css'
import {
  BUSINESS_TYPES,
  CATALOG_MODES,
  ORDER_FLOW_TYPES,
  loadStoreConfig,
  saveStoreConfig,
  syncLegacySettingsFromStoreConfig,
} from '../lib/storeConfig'
import {
  DEFAULT_STORE_PLAN,
  STORE_STATUSES,
  buildStoreDraft,
  cloneStoreCatalogSafe,
  loadStoreCatalog,
  saveStoreBundle,
  slugifyStoreToken,
  summarizePlanFeature,
} from '../lib/storeManagement'
import { loadMergedSettingsMap, upsertScopedSetting } from '../lib/storeSettings'
import {
  MENU_STYLE_PRESETS,
  STORE_OPTION_GROUPS,
  STORE_VIEW_FLOW_STEPS,
  buildExperienceSettingsPatch,
  getMenuStylePreset,
  recommendMenuStyleForBusinessType,
} from '../lib/storeExperience'
import {
  WorkspaceSwitch,
  WorkspaceTabPanel,
  WorkspaceTabs,
} from '../components/admin/OxidianWorkspacePrimitives'

const ORDER_FLOW_LABELS = {
  standard: 'Preparacion + entrega',
  direct_dispatch: 'Directo a reparto',
  pickup_only: 'Solo recogida',
  catalog_only: 'Solo catalogo',
}

const CATALOG_MODE_LABELS = {
  food: 'Food',
  retail: 'Retail',
  service: 'Servicio',
  generic: 'Generico',
}

const BUSINESS_TYPE_LABELS = {
  food: 'Restauracion',
  retail: 'Retail',
  service: 'Servicios',
  beauty: 'Belleza',
  other: 'Otro',
}

const MODULE_FIELDS = [
  ['module_products_enabled', 'Productos'],
  ['module_combos_enabled', 'Combos'],
  ['module_toppings_enabled', 'Extras / toppings'],
  ['module_stock_enabled', 'Stock y costes'],
  ['module_coupons_enabled', 'Cupones'],
  ['module_loyalty_enabled', 'Fidelidad'],
  ['module_reviews_enabled', 'Resenas'],
  ['module_affiliates_enabled', 'Afiliados'],
  ['module_chatbot_enabled', 'Chatbot'],
  ['module_staff_enabled', 'Cocina / reparto'],
  ['module_finance_enabled', 'Finanzas'],
]

function Field({ label, children, hint }) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      {children}
      {hint ? <div className={styles.formHint} style={{ marginTop: 6 }}>{hint}</div> : null}
    </div>
  )
}

function SummaryPill({ label, value, tone = '#1C3829', bg = '#F3F4F6' }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: bg, color: tone }}>
      <div style={{ fontSize: '.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', opacity: 0.7 }}>
        {label}
      </div>
      <div style={{ fontSize: '.95rem', fontWeight: 900, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

function getStoreRoutePrefix(code) {
  return code && code !== 'default' ? `/s/${code}` : ''
}

function buildStoreAccessLinks(store = {}) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const prefix = getStoreRoutePrefix(store.code)
  return [
    { id: 'menu', label: 'Menu publico', url: `${base}${prefix}/menu`, description: 'Link comercial para clientes' },
    { id: 'admin', label: 'Panel admin', url: `${base}${prefix}/admin`, description: 'Acceso owner y administracion' },
    { id: 'pedidos', label: 'PWA cocina', url: `${base}${prefix}/pedidos`, description: 'Operacion de cocina y pedidos' },
    { id: 'repartidor', label: 'PWA repartidor', url: `${base}${prefix}/repartidor`, description: 'Operacion de reparto' },
    { id: 'afiliado', label: 'Portal afiliados', url: `${base}${prefix}/afiliado`, description: 'Afiliados y promotores' },
  ]
}

function computeStoreReadiness(draft, { isExistingStore = false, ownerPassword = '', menuStyleId = 'delivery' } = {}) {
  const items = [
    { label: 'Nombre comercial', done: Boolean(String(draft.store.name || '').trim()) },
    { label: 'Slug y codigo', done: Boolean(String(draft.store.slug || '').trim() && String(draft.store.code || '').trim()) },
    { label: 'Owner principal', done: Boolean(String(draft.store.owner_name || '').trim() && String(draft.store.owner_email || '').trim()) },
    { label: 'Acceso owner', done: isExistingStore || String(ownerPassword || '').trim().length >= 6 },
    { label: 'Flujo operativo', done: Boolean(draft.process.order_flow_type && draft.process.catalog_mode) },
    { label: 'Catalogo base', done: Boolean(draft.process.module_products_enabled || draft.process.module_combos_enabled) },
    { label: 'Estilo comercial', done: Boolean(menuStyleId) },
    { label: 'Venta activa', done: draft.store.status === 'active' },
  ]

  const completed = items.filter(item => item.done).length
  const ratio = items.length ? completed / items.length : 0

  let tone = '#92400E'
  let bg = '#FFF7ED'
  let label = 'Pendiente'
  if (ratio >= 1) {
    tone = '#166534'
    bg = '#ECFDF5'
    label = 'Lista para entregar'
  } else if (ratio >= 0.72) {
    tone = '#1D4ED8'
    bg = '#EFF6FF'
    label = 'Casi lista'
  }

  return {
    items,
    completed,
    total: items.length,
    ratio,
    tone,
    bg,
    label,
  }
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')))
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function ensureScopedSettingValue(key, value, storeId) {
  await upsertScopedSetting(key, value, storeId)
  const settingsMap = await loadMergedSettingsMap(storeId)
  if (String(settingsMap?.[key] || '') !== String(value || '')) {
    await upsertScopedSetting(key, value, storeId)
  }
}

function ClientLinksCard({ store, links = [] }) {
  async function copyPack() {
    const payload = [
      `Tienda: ${store.name || 'Nueva tienda'}`,
      `Codigo: ${store.code || 'sin-codigo'}`,
      ...links.map(link => `${link.label}: ${link.url}`),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Pack de links copiado')
    } catch {
      toast.error('No pude copiar el pack')
    }
  }

  return (
    <div className={styles.formCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className={styles.settingsSectionTitle}>Links de entrega</div>
          <div className={styles.settingsSectionDesc}>Todo el circuito comercial y operativo queda listo por tenant.</div>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={copyPack}>
          Copiar pack
        </button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {links.map(link => (
          <div key={link.id} style={{ borderRadius: 14, padding: '12px 14px', border: '1px solid #E5E7EB', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900, color: '#1C3829' }}>{link.label}</div>
                <div style={{ fontSize: '.74rem', color: '#6B7280', marginTop: 4 }}>{link.description}</div>
              </div>
              <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '.76rem', fontWeight: 800, textDecoration: 'none', color: '#1D4ED8' }}>
                Abrir
              </a>
            </div>
            <div style={{ marginTop: 8, fontSize: '.76rem', color: '#334155', wordBreak: 'break-all' }}>{link.url}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadinessCard({ readiness, draft, preset }) {
  return (
    <div className={styles.formCard} style={{ background: readiness.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className={styles.settingsSectionTitle}>Estado de lanzamiento</div>
          <div className={styles.settingsSectionDesc}>Oxidian valida si la tienda ya puede entregarse como negocio listo para arrancar.</div>
        </div>
        <div style={{ padding: '8px 12px', borderRadius: 999, background: 'white', color: readiness.tone, fontWeight: 900, fontSize: '.78rem' }}>
          {readiness.label}
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.8)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${Math.round(readiness.ratio * 100)}%`, height: '100%', background: readiness.tone, borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: '.76rem', fontWeight: 800, color: readiness.tone, marginBottom: 14 }}>
        {readiness.completed}/{readiness.total} pasos completos · {draft.store.status === 'active' ? 'publicable' : 'todavia en configuracion'}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {readiness.items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.78)' }}>
            <span style={{ fontSize: '.9rem' }}>{item.done ? '✓' : '•'}</span>
            <span style={{ fontSize: '.82rem', fontWeight: 800, color: '#1C3829' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.88)', border: '1px solid rgba(255,255,255,.65)' }}>
        <div style={{ fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748B' }}>
          Experiencia recomendada
        </div>
        <div style={{ marginTop: 6, fontWeight: 900, color: '#1C3829' }}>
          {preset.icon} {preset.label}
        </div>
        <div style={{ marginTop: 4, fontSize: '.74rem', color: '#475569', lineHeight: 1.55 }}>
          {preset.flowLabel}
        </div>
        <div style={{ marginTop: 6, fontSize: '.72rem', color: '#64748B', fontWeight: 800 }}>
          {preset.nicheLabel}
        </div>
      </div>
    </div>
  )
}

function FlowBlueprintCard() {
  return (
    <div className={styles.formCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#EEF2FF', color: '#4F46E5' }}>
          <Workflow size={18} />
        </div>
        <div>
          <div className={styles.settingsSectionTitle}>Flujo de vistas</div>
          <div className={styles.settingsSectionDesc}>Cada tenant debe tener un flujo claro de captación, conversión, confianza y operación.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {STORE_VIEW_FLOW_STEPS.map((step, index) => (
          <div key={step.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 12, alignItems: 'start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#1D4ED8' }}>
              {index + 1}
            </div>
            <div>
              <div style={{ fontWeight: 900, color: '#1C3829' }}>{step.title}</div>
              <div style={{ marginTop: 4, fontSize: '.75rem', lineHeight: 1.6, color: '#475569' }}>{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {STORE_OPTION_GROUPS.map(group => (
          <div key={group.id} style={{ borderRadius: 12, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748B' }}>
              {group.title}
            </div>
            <div style={{ marginTop: 4, fontSize: '.74rem', color: '#475569', lineHeight: 1.55 }}>{group.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StoreActionBoard({ links = [] }) {
  return (
    <div className={styles.formCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#ECFDF5', color: '#166534' }}>
          <Rocket size={18} />
        </div>
        <div>
          <div className={styles.settingsSectionTitle}>Acciones de tienda</div>
          <div className={styles.settingsSectionDesc}>Abre cada vista clave del tenant sin perder contexto.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {links.map(link => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: 'none',
              borderRadius: 16,
              padding: '14px 14px',
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              color: '#1C3829',
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{link.label}</div>
              <ArrowUpRight size={16} color="#2563EB" />
            </div>
            <div style={{ fontSize: '.74rem', color: '#64748B', lineHeight: 1.55 }}>{link.description}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function ExperiencePresetCard({ preset, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 18,
        border: active ? `2px solid ${preset.preview.accent}` : '1px solid #E5E7EB',
        background: preset.preview.surface,
        padding: '14px 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: active ? '0 10px 26px rgba(15,23,42,0.1)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '1.35rem' }}>{preset.icon}</span>
        <span style={{ padding: '5px 8px', borderRadius: 999, background: preset.preview.chip, color: preset.preview.accent, fontSize: '.63rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {preset.badge}
        </span>
      </div>
      <div style={{ fontWeight: 900, fontSize: '.9rem', color: preset.preview.text }}>{preset.label}</div>
        <div style={{ marginTop: 6, fontSize: '.73rem', color: '#475569', lineHeight: 1.55 }}>{preset.description}</div>
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.58)' }}>
          <div style={{ fontSize: '.62rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: preset.preview.accent }}>
            Flujo recomendado
          </div>
          <div style={{ marginTop: 4, fontSize: '.72rem', fontWeight: 800, color: preset.preview.text }}>{preset.flowLabel}</div>
        </div>
        <div style={{ marginTop: 8, fontSize: '.7rem', color: '#64748B', fontWeight: 800 }}>
          {preset.nicheLabel}
        </div>
    </button>
  )
}

export default function AdminSuperStoresTab() {
  const [entries, setEntries] = useState([])
  const [plans, setPlans] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(() => buildStoreDraft())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [missingSchema, setMissingSchema] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [menuStyleId, setMenuStyleId] = useState('delivery')
  const [editorTab, setEditorTab] = useState('overview')

  const activePlan = useMemo(() => {
    const planId = draft.store.plan_id
    return plans.find(plan => plan.id === planId) || DEFAULT_STORE_PLAN
  }, [draft.store.plan_id, plans])

  const selectedPreset = useMemo(
    () => getMenuStylePreset(menuStyleId),
    [menuStyleId],
  )

  async function loadSelectedExperience(storeId, businessType) {
    if (!storeId || String(storeId).startsWith('draft-')) {
      setMenuStyleId(recommendMenuStyleForBusinessType(businessType))
      return
    }

    try {
      const config = await loadStoreConfig(storeId)
      setMenuStyleId(getMenuStylePreset(config?.menu_layout || recommendMenuStyleForBusinessType(businessType)).id)
    } catch {
      setMenuStyleId(recommendMenuStyleForBusinessType(businessType))
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      const result = await loadStoreCatalog()
      setEntries(result.stores)
      setPlans(result.plans)
      setMissingSchema(result.missingSchema)
      if (String(selectedId || '').startsWith('draft-')) {
        return
      }
      if (result.stores.length > 0) {
        const nextSelectedId = selectedId && result.stores.some(entry => entry.store.id === selectedId)
          ? selectedId
          : result.stores[0].store.id
        const nextEntry = result.stores.find(entry => entry.store.id === nextSelectedId) || result.stores[0]
        setSelectedId(nextSelectedId)
        setDraft(buildStoreDraft(nextEntry))
        await loadSelectedExperience(nextEntry.store.id, nextEntry.store.business_type)
      } else {
        const fallback = buildStoreDraft()
        setSelectedId(fallback.store.id)
        setDraft(fallback)
        setMenuStyleId(recommendMenuStyleForBusinessType(fallback.store.business_type))
      }
    } catch (error) {
      toast.error(error.message || 'No pude cargar las tiendas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function selectEntry(entry) {
    setSelectedId(entry.store.id)
    setDraft(buildStoreDraft(entry))
    setOwnerPassword('')
    setOwnerPasswordConfirm('')
    setEditorTab('overview')
    await loadSelectedExperience(entry.store.id, entry.store.business_type)
  }

  function updateStore(field, value) {
    setDraft(current => {
      const previousStoreId = String(current.store.id || '')
      const nextStore = { ...current.store, [field]: value }
      const usesDraftIdentity = !current.store.slug || current.store.slug === 'store' || String(current.store.id || '').startsWith('draft-')
      if (field === 'name' && usesDraftIdentity) {
        const nextSlug = slugifyStoreToken(value, 'store')
        nextStore.slug = nextSlug
        nextStore.code = nextSlug
        nextStore.id = nextSlug
      }
      if (field === 'slug') {
        const nextSlug = slugifyStoreToken(value, current.store.slug || 'store')
        nextStore.slug = nextSlug
        if (!current.store.id || current.store.id === current.store.slug || String(current.store.id).startsWith('draft-')) nextStore.id = nextSlug
      }
      if (field === 'code') {
        nextStore.code = slugifyStoreToken(value, current.store.code || 'store')
      }
      const nextStoreId = String(nextStore.id || '')
      const storeIdChanged = previousStoreId !== nextStoreId
      return {
        ...current,
        store: nextStore,
        process: storeIdChanged ? { ...current.process, store_id: nextStoreId } : current.process,
        runtime: storeIdChanged ? { ...current.runtime, store_id: nextStoreId } : current.runtime,
      }
    })

    if (field === 'business_type' && String(selectedId || '').startsWith('draft-')) {
      setMenuStyleId(recommendMenuStyleForBusinessType(value))
    }
  }

  function updateProcess(field, value) {
    setDraft(current => ({ ...current, process: { ...current.process, [field]: value } }))
  }

  function updateRuntime(field, value) {
    setDraft(current => ({ ...current, runtime: { ...current.runtime, [field]: value } }))
  }

  function createNewStore() {
    const draftId = `draft-${Date.now()}`
    const fresh = buildStoreDraft({
      id: draftId,
      name: '',
      slug: '',
      code: '',
      plan_id: 'growth',
      status: 'draft',
    })
    setSelectedId(draftId)
    setDraft({
      ...fresh,
      store: {
        ...fresh.store,
        id: draftId,
        slug: '',
        code: '',
        name: '',
      },
      process: {
        ...fresh.process,
        store_id: draftId,
      },
      runtime: {
        ...fresh.runtime,
        store_id: draftId,
      },
    })
    setMenuStyleId(recommendMenuStyleForBusinessType(fresh.store.business_type))
    setOwnerPassword('')
    setOwnerPasswordConfirm('')
    setEditorTab('overview')
  }

  async function persistStoreExperience(savedStore) {
    const currentConfig = await loadStoreConfig(savedStore.id).catch(() => null)
    const sourceConfig = savedStore.id !== 'default'
      ? await loadStoreConfig('default').catch(() => null)
      : null
    const nextConfig = {
      ...(sourceConfig || {}),
      ...(currentConfig || {}),
      store_code: savedStore.code,
      business_name: savedStore.name,
      business_type: savedStore.business_type,
      plan_slug: savedStore.plan_id,
      ...buildExperienceSettingsPatch(menuStyleId, { includeContent: false }),
    }

    await saveStoreConfig(nextConfig, savedStore.id)
    await syncLegacySettingsFromStoreConfig(nextConfig, savedStore.id)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const isExistingStore = entries.some(entry => entry.store.id === draft.store.id)
      const trimmedPassword = ownerPassword.trim()
      const confirmPassword = ownerPasswordConfirm.trim()

      if (!isExistingStore && trimmedPassword.length < 6) {
        toast.error('Define una contrasena owner de al menos 6 caracteres para la tienda nueva')
        return
      }

      if (trimmedPassword || confirmPassword) {
        if (trimmedPassword.length < 6) {
          toast.error('La contrasena owner debe tener al menos 6 caracteres')
          return
        }
        if (trimmedPassword !== confirmPassword) {
          toast.error('Las contrasenas owner no coinciden')
          return
        }
      }

      const bundleToSave = {
        ...draft,
        store: {
          ...draft.store,
          public_url: String(draft.store.public_url || buildStoreAccessLinks(draft.store)[0]?.url || '').trim(),
        },
        process: {
          ...draft.process,
          store_id: draft.store.id,
        },
        runtime: {
          ...draft.runtime,
          store_id: draft.store.id,
        },
      }

      const saved = await saveStoreBundle(bundleToSave)
      await Promise.all([
        ensureScopedSettingValue('business_name', saved.store.name, saved.store.id),
        ensureScopedSettingValue('store_code', saved.store.code, saved.store.id),
      ])
      await persistStoreExperience(saved.store)

      if (trimmedPassword) {
        const passwordHash = await sha256Hex(trimmedPassword)
        await ensureScopedSettingValue('admin_password_hash', passwordHash, saved.store.id)
      }

      if (!isExistingStore && saved.store.id !== 'default') {
        try {
          const cloneResult = await cloneStoreCatalogSafe('default', saved.store.id)
          if (cloneResult?.success) {
            const { products = 0, toppings = 0, combos = 0 } = cloneResult
            toast.success(
              `Catalogo clonado: ${products} productos, ${toppings} toppings, ${combos} combos`,
              { duration: 5000 },
            )
          } else if (cloneResult?.skipped) {
            toast(`Catalogo no clonado: ${cloneResult.reason}`, { icon: 'ℹ️' })
          }
        } catch (cloneError) {
          console.warn('[OXIDIAN] clone_store_catalog error:', cloneError?.message)
          toast(`No se pudo clonar el catalogo: ${cloneError?.message || 'error'}`, { icon: '⚠️' })
        }
      }

      toast.success('Tienda guardada')
      await refresh()
      setSelectedId(saved.store.id)
      setOwnerPassword('')
      setOwnerPasswordConfirm('')
      await loadSelectedExperience(saved.store.id, saved.store.business_type)
    } catch (error) {
      toast.error(error.message || 'No pude guardar la tienda')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const active = entries.filter(entry => entry.store.status === 'active').length
    const draftCount = entries.filter(entry => entry.store.status === 'draft').length
    const paused = entries.filter(entry => entry.store.status === 'paused').length
    return { total: entries.length, active, draft: draftCount, paused }
  }, [entries])

  const isExistingStore = useMemo(
    () => entries.some(entry => entry.store.id === draft.store.id),
    [entries, draft.store.id],
  )

  const readiness = useMemo(
    () => computeStoreReadiness(draft, { isExistingStore, ownerPassword, menuStyleId }),
    [draft, isExistingStore, ownerPassword, menuStyleId],
  )

  const clientLinks = useMemo(
    () => buildStoreAccessLinks(draft.store),
    [draft.store],
  )

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter(entry => {
      const matchesStatus = statusFilter === 'all' ? true : entry.store.status === statusFilter
      if (!matchesStatus) return false
      if (!term) return true
      return [
        entry.store.name,
        entry.store.code,
        entry.store.owner_name,
        entry.store.city,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(term))
    })
  }, [entries, search, statusFilter])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={styles.formCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h3 className={styles.settingsSectionTitle}>Tiendas gestionadas</h3>
            <p className={styles.settingsSectionDesc}>
              Alta, gobierno y activacion de tenants con identidad aislada, flujo comercial por nicho y accesos listos para operar.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={styles.btnSecondary} onClick={refresh} disabled={loading || saving}>
              Recargar
            </button>
            <button type="button" className={styles.saveBtn} onClick={createNewStore} disabled={loading || saving} data-testid="oxidian-create-store">
              Alta de tienda
            </button>
          </div>
        </div>

        <div className={styles.adminChoiceGrid} style={{ marginBottom: 14 }}>
          <SummaryPill label="Tiendas" value={summary.total} />
          <SummaryPill label="Activas" value={summary.active} tone="#166534" bg="#ECFDF5" />
          <SummaryPill label="Borrador" value={summary.draft} tone="#92400E" bg="#FFF7ED" />
          <SummaryPill label="Pausadas" value={summary.paused} tone="#1D4ED8" bg="#EFF6FF" />
        </div>

        {missingSchema && (
          <div style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74', color: '#9A3412', borderRadius: 14, padding: '12px 14px', fontSize: '.82rem', fontWeight: 700 }}>
            Falta la migracion multi-tienda en Supabase. Aplica `20260404_super_admin_multistore_foundation.sql` para activar este centro.
          </div>
        )}

        {!missingSchema && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            <ReadinessCard readiness={readiness} draft={draft} preset={selectedPreset} />
            <ClientLinksCard store={draft.store} links={clientLinks} />
            <FlowBlueprintCard />
          </div>
        )}
      </div>

      {!missingSchema && <StoreActionBoard links={clientLinks} />}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <div className={styles.formCard}>
          <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
            <div className={styles.settingsSectionTitle}>Cartera de tiendas</div>
            <input className={styles.input} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, codigo, owner o ciudad" />
            <select className={styles.input} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">Todos los estados</option>
              {STORE_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <div style={{ color: '#6B7280', fontWeight: 700 }}>Cargando...</div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ color: '#6B7280', fontWeight: 700 }}>No hay tiendas registradas todavia.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredEntries.map(entry => {
                const active = entry.store.id === selectedId
                const plan = entry.plan || DEFAULT_STORE_PLAN
                const status = computeStoreReadiness(buildStoreDraft(entry), { isExistingStore: true, ownerPassword: '', menuStyleId })
                return (
                  <button
                    key={entry.store.id}
                    type="button"
                    onClick={() => { selectEntry(entry) }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: active ? '1.5px solid #2D6A4F' : '1.5px solid #E5E7EB',
                      background: active ? '#F0FDF4' : 'white',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 900, color: '#1C3829' }}>{entry.store.name}</div>
                      <span style={{ fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', color: active ? '#166534' : '#6B7280' }}>
                        {entry.store.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '.74rem', color: '#6B7280', marginTop: 4 }}>
                      {entry.store.code} · {plan.name}
                    </div>
                    <div style={{ fontSize: '.72rem', color: '#4B5563', marginTop: 6 }}>
                      {ORDER_FLOW_LABELS[entry.process.order_flow_type] || entry.process.order_flow_type}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.68rem', fontWeight: 900, color: status.tone }}>
                        {status.completed}/{status.total} · {status.label}
                      </span>
                      <span style={{ fontSize: '.68rem', color: '#64748B', fontWeight: 800 }}>
                        {entry.store.owner_name || 'Sin owner'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div className={styles.settingsSectionTitle}>Ficha de tienda</div>
              <div className={styles.settingsSectionDesc}>
              Identidad, estilo comercial por nicho, operacion y runtime en un mismo flujo multi-tenant.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ padding: '8px 12px', borderRadius: 999, background: selectedPreset.preview.chip, color: selectedPreset.preview.accent, fontWeight: 900, fontSize: '.72rem' }}>
                {selectedPreset.icon} {selectedPreset.label}
              </span>
              <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || missingSchema} data-testid="oxidian-save-store">
                {saving ? 'Guardando...' : 'Guardar tienda'}
              </button>
            </div>
          </div>

          <WorkspaceTabs
            value={editorTab}
            onValueChange={setEditorTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'essentials', label: 'Identidad' },
              { id: 'experience', label: 'Frontend y flujo' },
              { id: 'operations', label: 'Plan' },
              { id: 'runtime', label: 'Runtime' },
            ]}
          >
            <WorkspaceTabPanel value="overview">
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                <ReadinessCard readiness={readiness} draft={draft} preset={selectedPreset} />
                <ClientLinksCard store={draft.store} links={clientLinks} />
                <FlowBlueprintCard />
              </div>
            </WorkspaceTabPanel>

            <WorkspaceTabPanel value="essentials">
              <div className={styles.adminChoiceGrid}>
            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Identidad</div>
                  <div className={styles.adminFieldCardMeta}>Codigo, tenant, responsable y visibilidad.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Store</span>
              </div>
              <Field label="Nombre">
                <input data-testid="store-name" className={styles.input} value={draft.store.name} onChange={event => updateStore('name', event.target.value)} />
              </Field>
              <div className={styles.formGrid2}>
                <Field label="Slug">
                  <input data-testid="store-slug" className={styles.input} value={draft.store.slug} onChange={event => updateStore('slug', event.target.value)} />
                </Field>
                <Field label="Codigo">
                  <input data-testid="store-code" className={styles.input} value={draft.store.code} onChange={event => updateStore('code', event.target.value)} />
                </Field>
              </div>
              <div className={styles.formGrid2}>
                <Field label="Estado">
                  <select data-testid="store-status" className={styles.input} value={draft.store.status} onChange={event => updateStore('status', event.target.value)}>
                    {STORE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Tipo de negocio">
                  <select data-testid="store-business-type" className={styles.input} value={draft.store.business_type} onChange={event => updateStore('business_type', event.target.value)}>
                    {BUSINESS_TYPES.map(type => <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type] || type}</option>)}
                  </select>
                </Field>
              </div>
              <div className={styles.formGrid2}>
                <Field label="Owner / gerente">
                  <input className={styles.input} value={draft.store.owner_name} onChange={event => updateStore('owner_name', event.target.value)} />
                </Field>
                <Field label="Telefono">
                  <input className={styles.input} value={draft.store.owner_phone} onChange={event => updateStore('owner_phone', event.target.value)} />
                </Field>
              </div>
              <Field label="Email">
                <input className={styles.input} value={draft.store.owner_email} onChange={event => updateStore('owner_email', event.target.value)} />
              </Field>
              <div className={styles.formGrid2}>
                <Field label="Ciudad">
                  <input className={styles.input} value={draft.store.city} onChange={event => updateStore('city', event.target.value)} />
                </Field>
                <Field label="Pais">
                  <input className={styles.input} value={draft.store.country} onChange={event => updateStore('country', event.target.value)} />
                </Field>
              </div>
              <div className={styles.formGrid2}>
                <Field label="Contrasena owner" hint="Necesaria para entrar al /admin de esta tienda como acceso principal.">
                  <input data-testid="store-owner-password" type="password" className={styles.input} value={ownerPassword} onChange={event => setOwnerPassword(event.target.value)} placeholder="Minimo 6 caracteres" />
                </Field>
                <Field label="Confirmar contrasena owner">
                  <input data-testid="store-owner-password-confirm" type="password" className={styles.input} value={ownerPasswordConfirm} onChange={event => setOwnerPasswordConfirm(event.target.value)} placeholder="Repite la contrasena" />
                </Field>
              </div>
            </div>
              </div>
            </WorkspaceTabPanel>

            <WorkspaceTabPanel value="operations">
              <div className={styles.adminChoiceGrid}>
            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Plan y supervision</div>
                  <div className={styles.adminFieldCardMeta}>Define alcance comercial y capacidad operativa.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Plan</span>
              </div>
              <Field label="Plan">
                <select className={styles.input} value={draft.store.plan_id} onChange={event => updateStore('plan_id', event.target.value)}>
                  {(plans.length ? plans : [DEFAULT_STORE_PLAN]).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </Field>
              <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px', marginTop: 4 }}>
                <div style={{ fontWeight: 900, color: '#1C3829' }}>{activePlan.name}</div>
                <div style={{ fontSize: '.8rem', color: '#4B5563', marginTop: 4 }}>{activePlan.description || 'Sin descripcion operativa.'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className={styles.inactiveChip}>Hasta {activePlan.feature_bundle?.max_products || 'n/a'} productos</span>
                  <span className={styles.inactiveChip}>Hasta {activePlan.feature_bundle?.max_staff || 'n/a'} staff</span>
                  {summarizePlanFeature(activePlan, 'supports_loyalty') && <span className={styles.activeChip}>Fidelidad</span>}
                  {summarizePlanFeature(activePlan, 'supports_affiliates') && <span className={styles.activeChip}>Afiliados</span>}
                  {summarizePlanFeature(activePlan, 'supports_multi_store_dashboard') && <span className={styles.activeChip}>Supervision multi-tienda</span>}
                </div>
              </div>
              <Field label="Notas internas">
                <textarea className={styles.textarea} rows={4} value={draft.store.notes} onChange={event => updateStore('notes', event.target.value)} />
              </Field>
            </div>
              </div>
            </WorkspaceTabPanel>

            <WorkspaceTabPanel value="experience">
              <div className={styles.adminChoiceGrid}>
            <div className={styles.adminFieldCard} style={{ gridColumn: '1 / -1' }}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Experiencia comercial</div>
                  <div className={styles.adminFieldCardMeta}>La misma data, cuatro menús totalmente distintos para que cada nicho escoja el que mejor convierte.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>View</span>
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 18 }}>
                {MENU_STYLE_PRESETS.map(preset => (
                  <ExperiencePresetCard
                    key={preset.id}
                    preset={preset}
                    active={preset.id === menuStyleId}
                    onClick={() => setMenuStyleId(preset.id)}
                  />
                ))}
              </div>

              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ borderRadius: 18, padding: '16px 16px', background: selectedPreset.preview.surface, border: `1px solid ${selectedPreset.preview.accent}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: selectedPreset.preview.accent }}>
                    Preview comercial
                  </div>
                    <div style={{ fontWeight: 900, color: selectedPreset.preview.text }}>{selectedPreset.icon}</div>
                  </div>
                  <div style={{ marginTop: 10, fontWeight: 900, fontSize: '1rem', color: selectedPreset.preview.text }}>
                    {draft.store.name || 'Nueva tienda'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: '.76rem', color: '#475569', lineHeight: 1.6 }}>
                    {selectedPreset.description}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,.74)', color: selectedPreset.preview.text, fontWeight: 800, fontSize: '.7rem' }}>
                      {selectedPreset.badge}
                    </span>
                    <span style={{ padding: '6px 10px', borderRadius: 999, background: selectedPreset.preview.chip, color: selectedPreset.preview.accent, fontWeight: 800, fontSize: '.7rem' }}>
                      {selectedPreset.flowLabel}
                    </span>
                  </div>
                </div>

                <div style={{ borderRadius: 18, padding: '16px 16px', background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748B' }}>
                    Mejor encaje
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 900, color: '#1C3829' }}>{selectedPreset.bestFor}</div>
                  <div style={{ marginTop: 6, fontSize: '.72rem', color: '#64748B', fontWeight: 800 }}>
                    {selectedPreset.nicheLabel}
                  </div>
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    {STORE_VIEW_FLOW_STEPS.map(step => (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'grid', placeItems: 'center', color: '#2563EB' }}>
                          <LayoutTemplate size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '.76rem', fontWeight: 800, color: '#1C3829' }}>{step.title}</div>
                          <div style={{ fontSize: '.7rem', color: '#64748B' }}>{step.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Proceso operativo</div>
                  <div className={styles.adminFieldCardMeta}>El flujo manda sobre cocina, reparto y experiencia real.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Flow</span>
              </div>
              <div className={styles.formGrid2}>
                <Field label="Flujo de pedido">
                  <select className={styles.input} value={draft.process.order_flow_type} onChange={event => updateProcess('order_flow_type', event.target.value)}>
                    {ORDER_FLOW_TYPES.map(type => <option key={type} value={type}>{ORDER_FLOW_LABELS[type] || type}</option>)}
                  </select>
                </Field>
                <Field label="Modo de catalogo">
                  <select className={styles.input} value={draft.process.catalog_mode} onChange={event => updateProcess('catalog_mode', event.target.value)}>
                    {CATALOG_MODES.map(mode => <option key={mode} value={mode}>{CATALOG_MODE_LABELS[mode] || mode}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['requires_preparation', 'Requiere preparacion', 'Activa cocina o armado antes del despacho.'],
                  ['requires_dispatch', 'Requiere pasar a reparto', 'Abre la capa operativa de repartidor.'],
                  ['enable_delivery', 'Admite delivery', 'Publica y opera entrega a domicilio.'],
                  ['enable_pickup', 'Admite recogida', 'Permite pedidos para retiro en tienda.'],
                ].map(([key, label, description]) => (
                  <WorkspaceSwitch
                    key={key}
                    checked={Boolean(draft.process[key])}
                    onCheckedChange={value => updateProcess(key, value)}
                    label={label}
                    description={description}
                  />
                ))}
              </div>
              <Field label="Notas de proceso">
                <textarea className={styles.textarea} rows={4} value={draft.process.operational_notes || ''} onChange={event => updateProcess('operational_notes', event.target.value)} />
              </Field>
            </div>

            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Modulos activos</div>
                  <div className={styles.adminFieldCardMeta}>Activa solo lo que la tienda realmente necesita.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Scope</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {MODULE_FIELDS.map(([key, label]) => (
                  <WorkspaceSwitch
                    key={key}
                    checked={Boolean(draft.process[key])}
                    onCheckedChange={value => updateProcess(key, value)}
                    label={label}
                    description="Se activa solo si esa tienda necesita ese modulo en su operacion real."
                  />
                ))}
              </div>
            </div>
              </div>
            </WorkspaceTabPanel>

            <WorkspaceTabPanel value="runtime">
              <div className={styles.adminChoiceGrid}>
            <div className={styles.adminFieldCard} style={{ gridColumn: '1 / -1' }}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Runtime portable</div>
                  <div className={styles.adminFieldCardMeta}>Lo que viaja con la carpeta del tenant: exe, bot, QR y motor AI local.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Portable</span>
              </div>
              <div className={styles.adminChoiceGrid}>
                <Field label="Carpeta sugerida">
                  <input className={styles.input} value={draft.store.portable_folder_name} onChange={event => updateStore('portable_folder_name', event.target.value)} />
                </Field>
                <Field label="Ruta portable / nota local">
                  <input className={styles.input} value={draft.runtime.portable_root_hint} onChange={event => updateRuntime('portable_root_hint', event.target.value)} />
                </Field>
                <Field label="Puerto bot local">
                  <input className={styles.input} type="number" min="1" max="65535" value={draft.runtime.chatbot_port} onChange={event => updateRuntime('chatbot_port', event.target.value)} />
                </Field>
                <Field label="URL bot local">
                  <input className={styles.input} value={draft.runtime.chatbot_url} onChange={event => updateRuntime('chatbot_url', event.target.value)} />
                </Field>
                <Field label="Proveedor AI">
                  <input className={styles.input} value={draft.runtime.ai_provider} onChange={event => updateRuntime('ai_provider', event.target.value)} />
                </Field>
                <Field label="Modelo AI">
                  <input className={styles.input} value={draft.runtime.ai_model} onChange={event => updateRuntime('ai_model', event.target.value)} />
                </Field>
                <Field label="Etiqueta API key" hint="No guardo la clave completa aqui. Este campo es para supervision.">
                  <input className={styles.input} value={draft.runtime.ai_key_label} onChange={event => updateRuntime('ai_key_label', event.target.value)} placeholder="Gemini principal" />
                </Field>
                <Field label="Ultimos 4 de la key">
                  <input className={styles.input} value={draft.runtime.ai_key_last4} onChange={event => updateRuntime('ai_key_last4', event.target.value)} placeholder="A1B2" />
                </Field>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <WorkspaceSwitch
                  checked={Boolean(draft.runtime.chatbot_autostart)}
                  onCheckedChange={value => updateRuntime('chatbot_autostart', value)}
                  label="Arranque automatico del bot"
                  description="Inicia el bot local al levantar el tenant portable."
                />
                <WorkspaceSwitch
                  checked={Boolean(draft.runtime.admin_desktop_enabled)}
                  onCheckedChange={value => updateRuntime('admin_desktop_enabled', value)}
                  label="Admin desktop habilitado"
                  description="Permite operar la tienda desde el cliente desktop."
                />
              </div>
              <Field label="Notas runtime">
                <textarea className={styles.textarea} rows={3} value={draft.runtime.runtime_notes || ''} onChange={event => updateRuntime('runtime_notes', event.target.value)} />
              </Field>
            </div>
              </div>
            </WorkspaceTabPanel>
          </WorkspaceTabs>
        </div>
      </div>
    </div>
  )
}
