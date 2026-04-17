import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  BUSINESS_TYPES,
  CATALOG_MODES,
  DEFAULT_STORE_CONFIG,
  loadStoreConfig,
  ORDER_FLOW_TYPES,
  saveStoreConfig,
  sanitizeStoreConfig,
  syncLegacySettingsFromStoreConfig,
} from '../lib/storeConfig'
import {
  applyStoreDesign,
  DAISY_THEMES,
  GOOGLE_FONTS_OPTIONS,
} from '../lib/style_generator'
import {
  MENU_STYLE_PRESETS,
  STORE_VIEW_FLOW_STEPS,
  buildExperienceSettingsPatch,
  getMenuStylePreset,
} from '../lib/storeExperience'
import ImageSourceField from '../components/admin/ImageSourceField'
import StoreLinksPanel from '../components/admin/StoreLinksPanel'
import BillingPortalButton from '../components/admin/BillingPortalButton'
import {
  WorkspaceSwitch,
  WorkspaceTabPanel,
  WorkspaceTabs,
} from '../components/admin/OxidianWorkspacePrimitives'
import styles from './Admin.module.css'

const WEEK_DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
]

const BUSINESS_TYPE_LABELS = {
  food: 'Restauracion',
  retail: 'Retail',
  service: 'Servicios',
  beauty: 'Belleza',
  other: 'Otro',
}

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

function toggleDayValue(rawDays, day) {
  const current = String(rawDays || '')
    .split(',')
    .map(token => Number.parseInt(token, 10))
    .filter(Number.isInteger)

  const next = current.includes(day)
    ? current.filter(value => value !== day)
    : [...current, day]

  return [...new Set(next)].sort((left, right) => left - right).join(',')
}

function ExperiencePresetCard({ preset, active, onClick }) {
  return (
    <button
      type="button"
      data-testid={`menu-preset-${preset.id}`}
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 18,
        border: active ? `2px solid ${preset.preview.accent}` : '1px solid #E5E7EB',
        background: preset.preview.surface,
        padding: '14px 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: active ? '0 10px 26px rgba(15,23,42,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '1.35rem' }}>{preset.icon}</span>
        <span style={{ padding: '5px 8px', borderRadius: 999, background: preset.preview.chip, color: preset.preview.accent, fontSize: '.63rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {preset.badge}
        </span>
      </div>
      <div style={{ fontWeight: 900, fontSize: '.9rem', color: preset.preview.text }}>{preset.label}</div>
      <div style={{ marginTop: 4, fontSize: '.64rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: preset.preview.accent }}>
        {preset.nicheLabel}
      </div>
      <div style={{ marginTop: 6, fontSize: '.73rem', color: '#475569', lineHeight: 1.55 }}>{preset.description}</div>
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.58)' }}>
        <div style={{ fontSize: '.62rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: preset.preview.accent }}>
          Flujo recomendado
        </div>
        <div style={{ marginTop: 4, fontSize: '.72rem', fontWeight: 800, color: preset.preview.text }}>{preset.flowLabel}</div>
      </div>
    </button>
  )
}

export default function AdminStoreCustomizationPanel({ onSaved, storeId = DEFAULT_STORE_CONFIG.store_code, capabilityScope = 'store' }) {
  const [form, setForm] = useState(DEFAULT_STORE_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsTab, setSettingsTab] = useState('overview')
  const isOxidianScope = capabilityScope === 'oxidian'

  const activePreset = useMemo(
    () => getMenuStylePreset(form.menu_layout || DEFAULT_STORE_CONFIG.menu_layout),
    [form.menu_layout],
  )
  const settingsTabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'brand', label: 'Marca' },
      { id: 'channels', label: 'Canales' },
      ...(isOxidianScope ? [{ id: 'operations', label: 'Operacion' }] : []),
      { id: 'storefront', label: 'Frontend' },
    ],
    [isOxidianScope],
  )

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function applyMenuPreset(styleId) {
    const patch = buildExperienceSettingsPatch(styleId)
    setForm(current => sanitizeStoreConfig({ ...current, ...patch, menu_layout: styleId }))
  }

  useEffect(() => {
    let active = true

    loadStoreConfig(storeId, supabase)
      .then(data => {
        if (!active) return
        setForm(sanitizeStoreConfig(data || DEFAULT_STORE_CONFIG))
      })
      .catch(error => {
        if (!active) return
        toast.error(`No pude cargar config_tienda: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [storeId])

  async function handleSave() {
    setSaving(true)
    try {
      const nextConfig = sanitizeStoreConfig(form)
      await saveStoreConfig(nextConfig, storeId, supabase)
      await syncLegacySettingsFromStoreConfig(nextConfig, storeId, supabase)
      applyStoreDesign(nextConfig)
      toast.success('Personalizacion guardada')
      onSaved?.()
    } catch (error) {
      toast.error(error.message || 'No pude guardar la tienda')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.formCard} style={{ marginBottom: 16 }}>
        <div className={styles.formTitle}>Cargando personalizacion...</div>
      </div>
    )
  }

  const activeDays = String(form.open_days || '')
    .split(',')
    .map(token => Number.parseInt(token, 10))
    .filter(Number.isInteger)

  return (
    <>
      {isOxidianScope && <StoreLinksPanel storeCode={form.store_code || storeId} />}
      <div className={styles.formCard} style={{ marginBottom: 16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <div>
          <h3 className={styles.settingsSectionTitle}>{isOxidianScope ? 'Ajustes de tenant y marca' : 'Marca y tienda online'}</h3>
          <p className={styles.settingsSectionDesc}>
            {isOxidianScope
              ? 'Esta capa separa configuracion comercial de parametros internos del tenant para que Oxidian gobierne la plataforma sin sobrecargar a la tienda.'
              : 'La tienda solo ve la capa comercial: marca, canales publicos, horario y storefront. La configuracion estructural queda protegida por Oxidian.'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ padding:'8px 12px', borderRadius:999, background:activePreset.preview.chip, color:activePreset.preview.accent, fontWeight:900, fontSize:'.72rem' }}>
            {activePreset.icon} {activePreset.label}
          </span>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar personalizacion'}
          </button>
        </div>
      </div>

      <WorkspaceTabs
        value={settingsTab}
        onValueChange={setSettingsTab}
        items={settingsTabs}
      >
        <WorkspaceTabPanel value="overview">
          <div style={{ display:'grid', gap:14, gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', marginBottom:18 }}>
            <div style={{ borderRadius:18, padding:'16px 16px', background:activePreset.preview.surface, border:`1px solid ${activePreset.preview.accent}22` }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:activePreset.preview.accent }}>
                Storefront activo del tenant
              </div>
              <div style={{ marginTop:8, fontWeight:900, fontSize:'1rem', color:activePreset.preview.text }}>
                {activePreset.label}
              </div>
              <div style={{ marginTop:4, fontSize:'.7rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:activePreset.preview.accent }}>
                {activePreset.nicheLabel}
              </div>
              <div style={{ marginTop:6, fontSize:'.76rem', color:'#475569', lineHeight:1.6 }}>
                {activePreset.description}
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                <span style={{ padding:'6px 10px', borderRadius:999, background:'rgba(255,255,255,.74)', color:activePreset.preview.text, fontWeight:800, fontSize:'.7rem' }}>
                  {activePreset.badge}
                </span>
                <span style={{ padding:'6px 10px', borderRadius:999, background:activePreset.preview.chip, color:activePreset.preview.accent, fontWeight:800, fontSize:'.7rem' }}>
                  {activePreset.flowLabel}
                </span>
              </div>
            </div>

            <div style={{ borderRadius:18, padding:'16px 16px', background:'#F8FAFC', border:'1px solid #E5E7EB' }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#64748B' }}>
                Flujo de vistas
              </div>
              <div style={{ marginTop:10, display:'grid', gap:8 }}>
                {STORE_VIEW_FLOW_STEPS.map(step => (
                  <div key={step.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:10, background:'#FFFFFF', border:'1px solid #E2E8F0', display:'grid', placeItems:'center', color:'#2563EB', fontWeight:900 }}>
                      {step.title.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize:'.76rem', fontWeight:800, color:'#1C3829' }}>{step.title}</div>
                      <div style={{ fontSize:'.7rem', color:'#64748B' }}>{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius:18, padding:'16px 16px', background:isOxidianScope ? '#EEF6FF' : '#FFF7ED', border:`1px solid ${isOxidianScope ? '#BFDBFE' : '#FED7AA'}` }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:isOxidianScope ? '#1D4ED8' : '#C2410C' }}>
                Alcance de configuracion
              </div>
              <div style={{ marginTop:8, fontWeight:900, fontSize:'1rem', color:'#1C3829' }}>
                {isOxidianScope ? 'Vista completa de plataforma' : 'Vista simplificada para la tienda'}
              </div>
              <div style={{ marginTop:6, fontSize:'.76rem', color:'#475569', lineHeight:1.6 }}>
                {isOxidianScope
                  ? 'Aqui se pueden ajustar modulos, flujo operativo, alcance del chatbot y parametros estructurales del tenant.'
                  : 'Aqui solo se exponen branding, canales publicos, horarios, estilo de menu y tema visual. El resto queda reservado a Oxidian.'}
              </div>
            </div>
          </div>
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value="brand">
          <div className={styles.adminChoiceGrid} style={{ marginBottom: 14 }}>
        <div className={styles.adminFieldCard}>
          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Identidad comercial</div>
              <div className={styles.adminFieldCardMeta}>Lo que ve el cliente en menu, footer y bot.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Marca</span>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nombre del negocio</label>
            <input value={form.business_name || ''} onChange={event => setForm({ ...form, business_name: event.target.value })} className={styles.input} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tagline</label>
            <input value={form.tagline || ''} onChange={event => setForm({ ...form, tagline: event.target.value })} className={styles.input} />
          </div>
          <ImageSourceField
            label="Logo"
            hint="URL externa o imagen subida"
            value={form.logo_url}
            onChange={logo_url => setForm({ ...form, logo_url })}
          />
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Zona / ubicacion visible</label>
            <input value={form.address || ''} onChange={event => setForm({ ...form, address: event.target.value })} className={styles.input} />
          </div>
        </div>
          </div>
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value="channels">
          <div className={styles.adminChoiceGrid} style={{ marginBottom: 14 }}>
        <div className={styles.adminFieldCard}>
          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>{isOxidianScope ? 'Canales y numero admin' : 'Canales publicos'}</div>
              <div className={styles.adminFieldCardMeta}>
                {isOxidianScope
                  ? 'El bot toma este numero para distinguir admin vs cliente.'
                  : 'Solo se muestran los canales visibles para el cliente y soporte comercial.'}
              </div>
            </div>
            <span className={styles.adminFieldCardBadge}>{isOxidianScope ? 'Bot' : 'Publico'}</span>
          </div>
          {isOxidianScope && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Numero admin WhatsApp</label>
              <input value={form.admin_phone || ''} onChange={event => setForm({ ...form, admin_phone: event.target.value })} className={styles.input} placeholder="346XXXXXXXX" />
            </div>
          )}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Numero publico WhatsApp</label>
            <input value={form.whatsapp_number || ''} onChange={event => setForm({ ...form, whatsapp_number: event.target.value })} className={styles.input} placeholder="346XXXXXXXX" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telefono soporte</label>
            <input value={form.support_phone || ''} onChange={event => setForm({ ...form, support_phone: event.target.value })} className={styles.input} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>URL Instagram</label>
            <input value={form.instagram_url || ''} onChange={event => setForm({ ...form, instagram_url: event.target.value })} className={styles.input} placeholder="https://instagram.com/tu_tienda" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Handle Instagram</label>
            <input value={form.instagram_handle || ''} onChange={event => setForm({ ...form, instagram_handle: event.target.value })} className={styles.input} placeholder="@tu_tienda" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>URL Maps</label>
            <input value={form.maps_url || ''} onChange={event => setForm({ ...form, maps_url: event.target.value })} className={styles.input} />
          </div>
        </div>

        <div className={styles.adminFieldCard}>
          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Horario configurable</div>
              <div className={styles.adminFieldCardMeta}>Sin tocar codigo: aperturas, cierres y texto visible.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Horas</span>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Hora apertura</label>
              <input type="number" min="0" max="23" value={form.open_hour || ''} onChange={event => setForm({ ...form, open_hour: event.target.value })} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Hora cierre</label>
              <input type="number" min="0" max="23" value={form.close_hour || ''} onChange={event => setForm({ ...form, close_hour: event.target.value })} className={styles.input} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dias abiertos</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
              {WEEK_DAYS.map(day => {
                const active = activeDays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={active ? styles.activeChip : styles.inactiveChip}
                    onClick={() => setForm({ ...form, open_days: toggleDayValue(form.open_days, day.value) })}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Texto de horario visible</label>
            <textarea value={form.store_hours_text || ''} onChange={event => setForm({ ...form, store_hours_text: event.target.value })} className={styles.textarea} rows={3} />
          </div>
        </div>
          </div>
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value="operations">
          <div className={styles.adminChoiceGrid} style={{ marginBottom: 14 }}>
        <div className={styles.adminFieldCard}>
          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Operacion y modulos</div>
              <div className={styles.adminFieldCardMeta}>Define si la tienda cocina, reparte, recoge o solo muestra catalogo.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Flow</span>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Codigo de tienda</label>
              <input value={form.store_code || ''} onChange={event => setForm({ ...form, store_code: event.target.value })} className={styles.input} placeholder="tienda-centro" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Plan</label>
              <input value={form.plan_slug || ''} onChange={event => setForm({ ...form, plan_slug: event.target.value })} className={styles.input} placeholder="growth" />
            </div>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo de negocio</label>
              <select value={form.business_type || 'food'} onChange={event => setForm({ ...form, business_type: event.target.value })} className={styles.input}>
                {BUSINESS_TYPES.map(type => <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type] || type}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Flujo de pedido</label>
              <select value={form.order_flow_type || 'standard'} onChange={event => setForm({ ...form, order_flow_type: event.target.value })} className={styles.input}>
                {ORDER_FLOW_TYPES.map(type => <option key={type} value={type}>{ORDER_FLOW_LABELS[type] || type}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Modo de catalogo</label>
            <select value={form.catalog_mode || 'food'} onChange={event => setForm({ ...form, catalog_mode: event.target.value })} className={styles.input}>
              {CATALOG_MODES.map(mode => <option key={mode} value={mode}>{CATALOG_MODE_LABELS[mode] || mode}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gap:8, marginTop:8 }}>
            {[
              ['requires_preparation', 'Requiere preparacion', 'Activa cocina o armado antes de despacho.'],
              ['requires_dispatch', 'Requiere pasar a reparto', 'Abre la operacion de repartidor.'],
              ['enable_delivery', 'Acepta delivery', 'Publica entrega a domicilio en el storefront.'],
              ['enable_pickup', 'Acepta recogida', 'Permite pedidos para retirar en tienda.'],
            ].map(([key, label, description]) => (
              <WorkspaceSwitch
                key={key}
                checked={Boolean(form[key])}
                onCheckedChange={value => setForm({ ...form, [key]: value })}
                label={label}
                description={description}
              />
            ))}
          </div>
        </div>

        <div className={styles.adminFieldCard}>
          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Persona del chatbot</div>
              <div className={styles.adminFieldCardMeta}>Prompt dinamico por tienda y rubro.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>IA</span>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Valores de la marca</label>
            <textarea value={form.business_values || ''} onChange={event => setForm({ ...form, business_values: event.target.value })} className={styles.textarea} rows={3} placeholder="Ej: elegante, rapido, artesanal, premium" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>System prompt del bot</label>
            <textarea value={form.system_prompt || ''} onChange={event => setForm({ ...form, system_prompt: event.target.value })} className={styles.textarea} rows={6} placeholder="Eres el asistente de [Nombre_Tienda]..." />
            <p className={styles.formHint} style={{ marginTop: 6 }}>
              Si queda vacio, el sistema genera un prompt base usando el nombre, horario, valores y catalogo real.
            </p>
          </div>
        </div>
          </div>
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value="storefront">
          <div className={styles.adminChoiceGrid} style={{ marginBottom: 14 }}>
        <div className={styles.adminFieldCard} style={{ gridColumn:'1 / -1' }}>
          {isOxidianScope && (
            <>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Modulos por tienda</div>
                  <div className={styles.adminFieldCardMeta}>Oxidian decide que capacidades de producto, growth y operacion existen para este tenant.</div>
                </div>
                <span className={styles.adminFieldCardBadge}>Scope</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:8, marginBottom:18 }}>
                {MODULE_FIELDS.map(([key, label]) => (
                  <WorkspaceSwitch
                    key={key}
                    checked={Boolean(form[key])}
                    onCheckedChange={value => setForm({ ...form, [key]: value })}
                    label={label}
                    description="Visible solo si esa tienda realmente necesita este modulo."
                  />
                ))}
              </div>
            </>
          )}

          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Plantilla de storefront</div>
              <div className={styles.adminFieldCardMeta}>El cliente puede elegir entre cuatro experiencias realmente distintas: artesanal, boutique, tienda de barrio y editorial.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Layout</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:10, marginBottom:18 }}>
            {MENU_STYLE_PRESETS.map(preset => (
              <ExperiencePresetCard
                key={preset.id}
                preset={preset}
                active={(form.menu_layout || 'delivery') === preset.id}
                onClick={() => applyMenuPreset(preset.id)}
              />
            ))}
          </div>

          <div style={{ display:'grid', gap:14, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', marginBottom:20 }}>
            <div style={{ borderRadius:18, padding:'16px 16px', background:activePreset.preview.surface, border:`1px solid ${activePreset.preview.accent}22` }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:activePreset.preview.accent }}>
                Preview del estilo
              </div>
              <div style={{ marginTop:8, fontWeight:900, fontSize:'1rem', color:activePreset.preview.text }}>
                {activePreset.label}
              </div>
              <div style={{ marginTop:4, fontSize:'.7rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:activePreset.preview.accent }}>
                {activePreset.nicheLabel}
              </div>
              <div style={{ marginTop:6, fontSize:'.76rem', color:'#475569', lineHeight:1.6 }}>
                {activePreset.bestFor}
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                <span style={{ padding:'6px 10px', borderRadius:999, background:'rgba(255,255,255,.74)', color:activePreset.preview.text, fontWeight:800, fontSize:'.7rem' }}>
                  {activePreset.badge}
                </span>
                <span style={{ padding:'6px 10px', borderRadius:999, background:activePreset.preview.chip, color:activePreset.preview.accent, fontWeight:800, fontSize:'.7rem' }}>
                  {activePreset.flowLabel}
                </span>
              </div>
            </div>

            <div style={{ borderRadius:18, padding:'16px 16px', background:'#F8FAFC', border:'1px solid #E5E7EB' }}>
              <div style={{ fontSize:'.68rem', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', color:'#64748B' }}>
                Impacto en la experiencia
              </div>
              <div style={{ marginTop:10, display:'grid', gap:8 }}>
                {STORE_VIEW_FLOW_STEPS.map(step => (
                  <div key={step.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:10, background:'#FFFFFF', border:'1px solid #E2E8F0', display:'grid', placeItems:'center', color:'#2563EB', fontWeight:900 }}>
                      {step.title.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize:'.76rem', fontWeight:800, color:'#1C3829' }}>{step.title}</div>
                      <div style={{ fontSize:'.7rem', color:'#64748B' }}>{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Contenido editable de plantilla</div>
              <div className={styles.adminFieldCardMeta}>Estos textos alimentan la portada y los bloques narrativos del menu activo. Se heredan desde la tienda modelo y luego se pueden ajustar por sede.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Copy</span>
          </div>
          <div className={styles.adminChoiceGrid} style={{ marginBottom: 20 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Badge superior</label>
              <input value={form.storefront_badge_text || ''} onChange={event => updateForm('storefront_badge_text', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Anuncio superior</label>
              <input value={form.storefront_announcement || ''} onChange={event => updateForm('storefront_announcement', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Placeholder de busqueda</label>
              <input value={form.storefront_search_placeholder || ''} onChange={event => updateForm('storefront_search_placeholder', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Eyebrow narrativo</label>
              <input value={form.storefront_intro_eyebrow || ''} onChange={event => updateForm('storefront_intro_eyebrow', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Titulo comercial</label>
              <input value={form.storefront_intro_title || ''} onChange={event => updateForm('storefront_intro_title', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CTA principal</label>
              <input value={form.storefront_primary_cta_label || ''} onChange={event => updateForm('storefront_primary_cta_label', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CTA secundario</label>
              <input value={form.storefront_secondary_cta_label || ''} onChange={event => updateForm('storefront_secondary_cta_label', event.target.value)} className={styles.input} />
            </div>
            <div className={styles.formGroup} style={{ gridColumn:'1 / -1' }}>
              <label className={styles.formLabel}>Texto introductorio</label>
              <textarea value={form.storefront_intro_text || ''} onChange={event => updateForm('storefront_intro_text', event.target.value)} className={styles.textarea} rows={3} />
            </div>
            <div className={styles.formGroup} style={{ gridColumn:'1 / -1' }}>
              <label className={styles.formLabel}>Cita / prueba social destacada</label>
              <textarea value={form.storefront_story_quote || ''} onChange={event => updateForm('storefront_story_quote', event.target.value)} className={styles.textarea} rows={3} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Autor de la cita</label>
              <input value={form.storefront_story_author || ''} onChange={event => updateForm('storefront_story_author', event.target.value)} className={styles.input} />
            </div>
          </div>

          <div className={styles.adminFieldCardHead}>
            <div>
              <div className={styles.adminFieldCardTitle}>Tema visual</div>
              <div className={styles.adminFieldCardMeta}>Variables CSS para adaptar la tienda sin tocar datos operativos.</div>
            </div>
            <span className={styles.adminFieldCardBadge}>Theme</span>
          </div>
          <div className={styles.adminChoiceGrid}>
            {[
              ['theme_primary_color', 'Color primario'],
              ['theme_secondary_color', 'Color secundario'],
              ['theme_accent_color', 'Color acento'],
              ['theme_surface_color', 'Color fondo'],
              ['theme_text_color', 'Color texto'],
            ].map(([key, label]) => (
              <div key={key} className={styles.formGroup}>
                <label className={styles.formLabel}>{label}</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} style={{ width:54, height:42, border:'none', background:'transparent' }} />
                  <input value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} className={styles.input} />
                </div>
              </div>
            ))}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fuente display</label>
              <select value={form.theme_font_display || ''} onChange={event => updateForm('theme_font_display', event.target.value)} className={styles.input}>
                {GOOGLE_FONTS_OPTIONS.filter(option => option.category !== 'sans-serif').map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fuente cuerpo</label>
              <select value={form.theme_font_body || ''} onChange={event => updateForm('theme_font_body', event.target.value)} className={styles.input}>
                {GOOGLE_FONTS_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Radio de boton</label>
              <input value={form.theme_button_radius || ''} onChange={event => updateForm('theme_button_radius', event.target.value)} className={styles.input} placeholder="14px" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tema base DaisyUI</label>
              <select value={form.theme_daisy_theme || ''} onChange={event => updateForm('theme_daisy_theme', event.target.value)} className={styles.input}>
                {DAISY_THEMES.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
          </div>
        </WorkspaceTabPanel>
      </WorkspaceTabs>
    </div>
    {isOxidianScope && <BillingPortalButton storeId={storeId} />}
    </>
  )
}
