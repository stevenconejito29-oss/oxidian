import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { sendWhatsAppRaw } from '../lib/sendWhatsApp'
import {
  buildAffiliateApplicationAdminMessage,
  buildAffiliateLoginLink,
  buildAffiliateMenuLink,
  normalizeAffiliateCode,
  sha256Hex,
} from '../lib/affiliateAuth'
import { resolveConfiguredStoreId } from '../lib/currentStore'
import { loadStoreConfig } from '../lib/storeConfig'
import { loadPublicMergedSettingsMap } from '../lib/storeSettings'
import { buildStoreBrandingSnapshot } from '../lib/adminBranding'
import styles from './AffiliatePortal.module.css'

const moneyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const DEFAULT_APPLICATION = {
  full_name: '',
  requested_affiliate_name: '',
  requested_code: '',
  phone: '',
  instagram_handle: '',
  city: '',
  primary_channel: 'instagram',
  audience_size: '',
  motivation: '',
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function sanitizeApplication(form) {
  return {
    full_name: String(form.full_name || '').trim(),
    requested_affiliate_name: String(form.requested_affiliate_name || '').trim() || null,
    requested_code: normalizeAffiliateCode(form.requested_code || '') || null,
    phone: String(form.phone || '').trim(),
    instagram_handle: String(form.instagram_handle || '').trim() || null,
    city: String(form.city || '').trim() || null,
    primary_channel: String(form.primary_channel || '').trim() || null,
    audience_size: String(form.audience_size || '').trim() || null,
    motivation: String(form.motivation || '').trim(),
    status: 'pending',
  }
}

function buildBaseMessage(affiliate, template, storeId = 'default', businessName = 'la tienda') {
  const menuLink = buildAffiliateMenuLink(affiliate.code, storeId)
  const fallback = [
    `Hola. Usa mi codigo *${affiliate.code}* en ${businessName} y consigue un *${Number(affiliate.discount_percent || 0)}%* de descuento.`,
    '',
    `Pide aqui: ${menuLink}`,
  ].join('\n')

  if (!template) return fallback

  return String(template)
    .replace(/{{nombre}}/g, affiliate.name || '')
    .replace(/{{descuento}}/g, Number(affiliate.discount_percent || 0))
    .replace(/{{codigo}}/g, affiliate.code || '')
    .replace(/{{link}}/g, menuLink)
}

function MiniChart({ data }) {
  if (!data.length) return null

  const width = 400
  const height = 64
  const paddingLeft = 4
  const paddingBottom = 20
  const paddingTop = 4
  const paddingRight = 4
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const maxValue = Math.max(...data.map(item => item.value), 1)
  const barWidth = Math.max(4, Math.floor(plotWidth / data.length) - 3)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * plotHeight
        const x = paddingLeft + (plotWidth / data.length) * index + (plotWidth / data.length - barWidth) / 2
        const y = paddingTop + plotHeight - Math.max(barHeight, 2)
        return (
          <g key={item.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              fill={item.today ? '#fff' : item.value > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}
              rx={2}
            />
            {(index === 0 || index === data.length - 1 || index % 7 === 0) && (
              <text
                x={x + barWidth / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize="7"
                fill="rgba(255,255,255,0.45)"
                fontFamily="Nunito, sans-serif"
                fontWeight="600"
              >
                {item.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function getAffiliateSessionKey(storeId) {
  return `cc_affiliate_code_${storeId || 'default'}`
}

function getAffiliateMessageStorageKey(code, storeId) {
  return `affiliate_msg_${storeId || 'default'}_${code}`
}

function isMissingStoreScope(error) {
  return /column .*store_id|onConflict|constraint|schema cache|does not exist/i.test(String(error?.message || ''))
}

async function loadSavedMsg(code, storeId) {
  try {
    let query = supabase
      .from('affiliate_custom_messages')
      .select('message')
      .eq('affiliate_code', code)
      .eq('store_id', storeId)

    let { data, error } = await query.maybeSingle()

    if (error && isMissingStoreScope(error)) {
      const fallback = await supabase
        .from('affiliate_custom_messages')
        .select('message')
        .eq('affiliate_code', code)
        .maybeSingle()
      data = fallback.data
      error = fallback.error
    }

    if (error) throw error
    if (data?.message) return data.message
  } catch {}

  try {
    return localStorage.getItem(getAffiliateMessageStorageKey(code, storeId)) || null
  } catch {
    return null
  }
}

async function saveMsgToDb(code, message, storeId) {
  try {
    const payload = { affiliate_code: code, store_id: storeId, message, updated_at: new Date().toISOString() }
    let response = await supabase
      .from('affiliate_custom_messages')
      .upsert(payload, { onConflict: 'store_id,affiliate_code' })

    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase
        .from('affiliate_custom_messages')
        .upsert({ affiliate_code: code, message, updated_at: payload.updated_at }, { onConflict: 'affiliate_code' })
    }
  } catch {}

  try {
    localStorage.setItem(getAffiliateMessageStorageKey(code, storeId), message)
  } catch {}
}

export default function AffiliatePortal() {
  const [screen, setScreen] = useState('gate')
  const [entryMode, setEntryMode] = useState('login')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [aff, setAff] = useState(null)
  const [orders, setOrders] = useState([])
  const [setupAffiliate, setSetupAffiliate] = useState(null)
  const [setupPassword, setSetupPassword] = useState('')
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('')
  const [applicationForm, setApplicationForm] = useState(DEFAULT_APPLICATION)
  const [applicationSent, setApplicationSent] = useState(false)
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [baseTpl, setBaseTpl] = useState('')
  const [customMsg, setCustomMsg] = useState('')
  const [editMsg, setEditMsg] = useState('')
  const [editing, setEditing] = useState(false)
  const [savingMsg, setSavingMsg] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [storeId, setStoreId] = useState('default')
  const [brand, setBrand] = useState(() => buildStoreBrandingSnapshot({}, null, 'default'))

  useEffect(() => {
    resolveConfiguredStoreId().then(setStoreId).catch(() => setStoreId('default'))
  }, [])

  useEffect(() => {
    Promise.all([
      loadPublicMergedSettingsMap(storeId, supabase).catch(() => ({})),
      loadStoreConfig(storeId, supabase, { visibility: 'public' }).catch(() => null),
    ]).then(([settingsMap, nextStoreConfig]) => {
      setBrand(buildStoreBrandingSnapshot(settingsMap, nextStoreConfig, storeId))
    })
  }, [storeId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('setup')
    if (token) {
      setScreen('setup')
      loadAffiliateBySetupToken(token)
      return
    }

    try {
      const savedCode = sessionStorage.getItem(getAffiliateSessionKey(storeId))
      if (savedCode) setCode(savedCode)
    } catch {}
  }, [storeId])

  async function loadAffiliateBySetupToken(token) {
    setLoading(true)
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('store_id', storeId)
      .eq('setup_token', token)
      .gt('setup_token_expires_at', nowIso)
      .maybeSingle()

    setLoading(false)

    if (error) {
      toast.error('No se pudo validar el acceso')
      return
    }
    if (!data) {
      toast.error('El enlace ha caducado o ya fue usado')
      setScreen('gate')
      return
    }

    setSetupAffiliate(data)
  }

  async function hydrateAffiliatePortal(affiliate) {
    setAff(affiliate)
    try {
    sessionStorage.setItem(getAffiliateSessionKey(storeId), affiliate.code)
    } catch {}

    const [settingsMap, resolvedStoreConfig, ordersRes] = await Promise.all([
      loadPublicMergedSettingsMap(storeId, supabase),
      loadStoreConfig(storeId, supabase, { visibility: 'public' }).catch(() => null),
      supabase
        .from('orders')
        .select('id, order_number, created_at, status, total')
        .eq('store_id', storeId)
        .eq('affiliate_code', affiliate.code)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    let affiliateOrders = ordersRes.data || []
    if (affiliate.commission_reset_at) {
      const resetAt = new Date(affiliate.commission_reset_at)
      affiliateOrders = affiliateOrders.filter(order => new Date(order.created_at) >= resetAt)
    }
    setOrders(affiliateOrders)

    setBrand(buildStoreBrandingSnapshot(settingsMap, resolvedStoreConfig, storeId))
    const businessName = resolvedStoreConfig?.business_name || settingsMap?.business_name || 'la tienda'
    const message = buildBaseMessage(affiliate, settingsMap?.affiliate_message, storeId, businessName)
    const savedMessage = await loadSavedMsg(affiliate.code, storeId)
    setBaseTpl(message)
    setCustomMsg(savedMessage || message)
    setEditMsg(savedMessage || message)
    setEditing(false)
    setScreen('portal')
  }

  async function login() {
    const normalizedCode = normalizeAffiliateCode(code)
    if (!normalizedCode) {
      toast.error('Introduce tu codigo')
      return
    }
    if (!password) {
      toast.error('Introduce tu contrasena')
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('store_id', storeId)
      .eq('code', normalizedCode)
      .maybeSingle()

    if (error) {
      setLoading(false)
      toast.error('No se pudo cargar tu acceso')
      return
    }
    if (!data) {
      setLoading(false)
      toast.error('Codigo no encontrado')
      return
    }
    if (!data.active) {
      setLoading(false)
      toast.error('Tu acceso aun no esta activo')
      return
    }
    if (!data.password_hash) {
      setLoading(false)
      toast.error('Primero activa tu cuenta desde el enlace que te enviamos por WhatsApp')
      return
    }

    const hashHex = await sha256Hex(password)
    const passwordMatches = data.password_hash?.length === 64
      ? data.password_hash === hashHex
      : data.password_hash === password

    if (!passwordMatches) {
      setLoading(false)
      toast.error('Contrasena incorrecta')
      return
    }

    await supabase
      .from('affiliates')
      .update({ last_portal_login_at: new Date().toISOString() })
      .eq('id', data.id)
      .eq('store_id', storeId)

    await hydrateAffiliatePortal(data)
    setPassword('')
    setLoading(false)
  }

  async function completeSetup() {
    if (!setupAffiliate) return
    if (setupPassword.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres')
      return
    }
    if (setupPassword !== setupPasswordConfirm) {
      toast.error('Las contrasenas no coinciden')
      return
    }

    setLoading(true)
    const passwordHash = await sha256Hex(setupPassword)
    const nowIso = new Date().toISOString()

    const { data, error } = await supabase
      .from('affiliates')
      .update({
        password_hash: passwordHash,
        setup_token: null,
        setup_token_expires_at: null,
        portal_invited_at: setupAffiliate.portal_invited_at || nowIso,
        last_portal_login_at: nowIso,
        active: true,
      })
      .eq('id', setupAffiliate.id)
      .eq('store_id', storeId)
      .select('*')
      .maybeSingle()

    setLoading(false)

    if (error || !data) {
      toast.error('No se pudo activar tu acceso')
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('setup')
    window.history.replaceState({}, '', url.toString())

    setSetupPassword('')
    setSetupPasswordConfirm('')
    setSetupAffiliate(null)
    toast.success('Acceso activado')
    await hydrateAffiliatePortal(data)
  }

  async function submitApplication() {
    const payload = sanitizeApplication(applicationForm)
    if (!payload.full_name || !payload.phone || !payload.motivation) {
      toast.error('Completa nombre, telefono y motivacion')
      return
    }

    setSubmittingApplication(true)
    const payloadWithStore = { ...payload, store_id: storeId }
    const { error } = await supabase.from('affiliate_applications').insert([payloadWithStore])
    if (error) {
      setSubmittingApplication(false)
      toast.error('No se pudo enviar tu solicitud')
      return
    }

    try {
      const settingsMap = await loadPublicMergedSettingsMap(storeId, supabase)

      if (settingsMap?.whatsapp_number) {
        await sendWhatsAppRaw(settingsMap.whatsapp_number, buildAffiliateApplicationAdminMessage(payloadWithStore, settingsMap.business_name || 'Tienda'))
      }
    } catch {}

    setSubmittingApplication(false)
    setApplicationSent(true)
    setApplicationForm(DEFAULT_APPLICATION)
    toast.success('Solicitud enviada')
  }

  async function saveCustomMsg() {
    if (!aff) return
    setSavingMsg(true)
    await saveMsgToDb(aff.code, editMsg, storeId)
    setCustomMsg(editMsg)
    setEditing(false)
    setSavingMsg(false)
    toast.success('Mensaje guardado')
  }

  function resetMsg() {
    setEditMsg(baseTpl)
    toast('Mensaje restaurado')
  }

  function logout() {
    try {
    sessionStorage.removeItem(getAffiliateSessionKey(storeId))
    } catch {}
    setAff(null)
    setOrders([])
    setScreen('gate')
    setCode('')
    setPassword('')
  }

  async function copyLink() {
    if (!aff) return
      await navigator.clipboard.writeText(buildAffiliateMenuLink(aff.code, storeId))
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
    toast.success('Link copiado')
  }

  async function copyMsg() {
    await navigator.clipboard.writeText(editing ? editMsg : customMsg)
    toast.success('Mensaje copiado')
  }

  function shareWA() {
    const message = editing ? editMsg : customMsg
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const recent30 = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    cutoff.setHours(0, 0, 0, 0)
    return orders.filter(order => new Date(order.created_at) >= cutoff)
  }, [orders])

  const last7Days = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    cutoff.setHours(0, 0, 0, 0)
    return orders.filter(order => new Date(order.created_at) >= cutoff)
  }, [orders])

  const portalMetrics = useMemo(() => {
    const commissionPercent = Number(aff?.commission_percent || 0)
    const totalSales30 = recent30.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const commission30 = totalSales30 * commissionPercent / 100
    const totalCommission = orders.reduce((sum, order) => sum + Number(order.total || 0) * commissionPercent / 100, 0)
    const weeklySales = last7Days.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const weeklyCommission = weeklySales * commissionPercent / 100
    const averageOrderValue = recent30.length ? totalSales30 / recent30.length : 0
    const averageCommissionPerOrder = recent30.length ? commission30 / recent30.length : 0
    const projectedMonthlyCommission = weeklyCommission > 0 ? weeklyCommission * 4.3 : commission30
    const milestones = [25, 50, 100, 150, 250, 500]
    const nextMilestone = milestones.find(value => value > totalCommission) || Math.max(250, Math.ceil(totalCommission / 250) * 250 + 250)
    const milestoneRemaining = Math.max(0, nextMilestone - totalCommission)
    const milestoneProgress = nextMilestone > 0 ? Math.min(100, (totalCommission / nextMilestone) * 100) : 0
    const ordersToMilestone = averageCommissionPerOrder > 0 ? Math.ceil(milestoneRemaining / averageCommissionPerOrder) : null

    const bestDayMap = {}
    recent30.forEach(order => {
      const label = new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      bestDayMap[label] = (bestDayMap[label] || 0) + 1
    })
    const bestDayEntry = Object.entries(bestDayMap).sort((left, right) => right[1] - left[1])[0]

    let streak = 0
    for (let index = 0; index < 30; index += 1) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - index)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const hasOrders = recent30.some(order => {
        const createdAt = new Date(order.created_at)
        return createdAt >= dayStart && createdAt < dayEnd
      })
      if (hasOrders) streak += 1
      else if (index > 0) break
    }

    const chart = Array.from({ length: 30 }, (_, index) => {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - (29 - index))
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const count = recent30.filter(order => {
        const createdAt = new Date(order.created_at)
        return createdAt >= dayStart && createdAt < dayEnd
      }).length
      return {
        label: dayStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        value: count,
        today: index === 29,
      }
    })

    return {
      totalSales30,
      commission30,
      totalCommission,
      weeklyCommission,
      averageOrderValue,
      averageCommissionPerOrder,
      projectedMonthlyCommission,
      nextMilestone,
      milestoneRemaining,
      milestoneProgress,
      ordersToMilestone,
      streak,
      bestDay: bestDayEntry ? { label: bestDayEntry[0], count: bestDayEntry[1] } : null,
      chart,
    }
  }, [aff, orders, recent30, last7Days])

  const incomeExamples = useMemo(() => ([
    {
      label: '1 pedido medio',
      value: portalMetrics.averageCommissionPerOrder,
      helper: 'Lo normal que deja una recomendacion que se convierte en pedido.',
    },
    {
      label: '5 pedidos',
      value: portalMetrics.averageCommissionPerOrder * 5,
      helper: 'Un bloque pequeno de ventas ya empieza a pesar en caja.',
    },
    {
      label: 'Ritmo mensual',
      value: portalMetrics.projectedMonthlyCommission,
      helper: 'Proyeccion si mantienes el ritmo reciente de tus referidos.',
    },
  ]), [portalMetrics])

  if (screen === 'setup') {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <div className={styles.loginRing}>
            <img src="/logo.png" alt={brand.businessName} />
          </div>
          <h1 className={styles.loginTitle}>Activa tu acceso</h1>
          <p className={styles.loginSub}>
            Crea tu contrasena y entra a tu panel para mover tu enlace y ver tu ingreso real.
          </p>

          {setupAffiliate && (
            <div className={styles.setupCodeCard}>
              <span className={styles.setupCodeLabel}>Codigo aprobado</span>
              <strong className={styles.setupCodeValue}>{setupAffiliate.code}</strong>
            </div>
          )}

          <input
            className={styles.loginInput}
            type="password"
            placeholder="CREA TU CONTRASENA"
            value={setupPassword}
            onChange={event => setSetupPassword(event.target.value)}
          />
          <input
            className={styles.loginInput}
            type="password"
            placeholder="REPITE LA CONTRASENA"
            value={setupPasswordConfirm}
            onChange={event => setSetupPasswordConfirm(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && completeSetup()}
          />
          <button className={styles.loginBtn} onClick={completeSetup} disabled={loading || !setupAffiliate}>
            {loading ? <span className={styles.spin} /> : 'Activar acceso'}
          </button>
          <p className={styles.loginHint}>
            Si el enlace ya caducÃ³, pide uno nuevo al administrador de {brand.businessName}.
          </p>
        </div>
      </div>
    )
  }

  if (screen === 'gate') {
    return (
      <div className={styles.loginPage}>
        <div className={styles.fruits} aria-hidden>
          {['\u{1F353}', '\u{1F351}', '\u{1FAD0}', '\u{1F96D}', '\u{1F347}', '\u{1F352}', '\u{1F34B}', '\u{1F34A}'].map((fruit, index) => (
            <span key={fruit + index} style={{ '--i': index }}>{fruit}</span>
          ))}
        </div>
        <div className={styles.loginCard} style={{ maxWidth: 520, textAlign: 'left' }}>
          <div style={{ textAlign: 'center' }}>
            <div className={styles.loginRing}>
              <img src="/logo.png" alt={brand.businessName} />
            </div>
            <h1 className={styles.loginTitle}>{brand.businessName} Afiliados</h1>
            <p className={styles.loginSub}>
              Solicita acceso o entra a tu portal para convertir tu codigo en ingresos repetibles.
            </p>
          </div>

          <div className={styles.entryTabs}>
            <button
              type="button"
              className={`${styles.entryTab} ${entryMode === 'login' ? styles.entryTabActive : ''}`}
              onClick={() => setEntryMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`${styles.entryTab} ${entryMode === 'apply' ? styles.entryTabActive : ''}`}
              onClick={() => setEntryMode('apply')}
            >
              Solicitar acceso
            </button>
          </div>

          {entryMode === 'login' ? (
            <div className={styles.entryPanel}>
              <input
                data-testid="affiliate-code"
                className={styles.loginInput}
                placeholder="TU CODIGO"
                value={code}
                onChange={event => setCode(normalizeAffiliateCode(event.target.value))}
                autoCapitalize="characters"
              />
              <input
                data-testid="affiliate-password"
                className={styles.loginInput}
                type="password"
                placeholder="TU CONTRASENA"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && login()}
              />
              <button data-testid="affiliate-login-button" className={styles.loginBtn} onClick={login} disabled={loading}>
                {loading ? <span className={styles.spin} /> : 'Entrar al portal'}
              </button>
              <p className={styles.portalNote}>
                Si ya te aprobaron pero no activaste tu acceso, usa el enlace que te llego por WhatsApp.
              </p>
            </div>
          ) : (
            <div className={styles.entryPanel}>
              {applicationSent ? (
                <div className={styles.applicationSuccess}>
                  <strong>Solicitud enviada</strong>
                  <p>
                    Tu encuesta ya llego al admin. Si te aprueban, recibiras por WhatsApp tu codigo y el enlace para crear contrasena.
                  </p>
                  <button type="button" className={styles.secondaryWideBtn} onClick={() => setApplicationSent(false)}>
                    Enviar otra solicitud
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.requestGrid}>
                    <input
                      className={styles.requestInput}
                      placeholder="Nombre completo *"
                      value={applicationForm.full_name}
                      onChange={event => setApplicationForm({ ...applicationForm, full_name: event.target.value })}
                    />
                    <input
                      className={styles.requestInput}
                      placeholder="Telefono WhatsApp *"
                      value={applicationForm.phone}
                      onChange={event => setApplicationForm({ ...applicationForm, phone: event.target.value })}
                    />
                    <input
                      className={styles.requestInput}
                      placeholder="Nombre que quieres usar como afiliado"
                      value={applicationForm.requested_affiliate_name}
                      onChange={event => setApplicationForm({ ...applicationForm, requested_affiliate_name: event.target.value })}
                    />
                    <input
                      className={styles.requestInput}
                      placeholder="Codigo deseado"
                      value={applicationForm.requested_code}
                      onChange={event => setApplicationForm({ ...applicationForm, requested_code: event.target.value })}
                    />
                    <input
                      className={styles.requestInput}
                      placeholder="Instagram o red principal"
                      value={applicationForm.instagram_handle}
                      onChange={event => setApplicationForm({ ...applicationForm, instagram_handle: event.target.value })}
                    />
                    <input
                      className={styles.requestInput}
                      placeholder="Ciudad"
                      value={applicationForm.city}
                      onChange={event => setApplicationForm({ ...applicationForm, city: event.target.value })}
                    />
                    <select
                      className={styles.requestInput}
                      value={applicationForm.primary_channel}
                      onChange={event => setApplicationForm({ ...applicationForm, primary_channel: event.target.value })}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="tiktok">TikTok</option>
                      <option value="clientes">Clientes directos</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input
                      className={styles.requestInput}
                      placeholder="Tamano de audiencia o alcance"
                      value={applicationForm.audience_size}
                      onChange={event => setApplicationForm({ ...applicationForm, audience_size: event.target.value })}
                    />
                  </div>
                  <textarea
                    className={styles.requestTextarea}
                    rows={5}
                    placeholder="Por que quieres ser afiliado y como moverias tu codigo? *"
                    value={applicationForm.motivation}
                    onChange={event => setApplicationForm({ ...applicationForm, motivation: event.target.value })}
                  />
                  <button className={styles.loginBtn} onClick={submitApplication} disabled={submittingApplication}>
                    {submittingApplication ? <span className={styles.spin} /> : 'Enviar solicitud'}
                  </button>
                  <p className={styles.portalNote}>
                    Solo pedimos lo necesario para evaluar si encajas y poder activarte rapido si tiene sentido comercial.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const link = aff ? buildAffiliateMenuLink(aff.code, storeId) : ''
  const loginLink = buildAffiliateLoginLink(storeId)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/logo.png" alt="" className={styles.hLogo} />
        <div className={styles.hText}>
          <span className={styles.hName}>{brand.businessName}</span>
          <span className={styles.hCode}>{aff?.name} · {aff?.code}</span>
        </div>
        <button className={styles.hLogout} onClick={logout}>Salir</button>
      </header>

      <div className={styles.body}>
        <div className={styles.heroCard}>
          <div className={styles.heroBg} aria-hidden />
          <p className={styles.heroLabel}>Tu ingreso activo</p>
          <p className={styles.heroAmt}>{formatMoney(portalMetrics.commission30)}</p>
          <p className={styles.heroSub}>
            {recent30.length} pedido{recent30.length === 1 ? '' : 's'} en 30 dias Â· {aff?.commission_percent}% por venta referida cerrada
          </p>

          <div className={styles.heroMomentum}>
            <div>
              <span className={styles.heroMomentumLabel}>Proyeccion mensual</span>
              <strong className={styles.heroMomentumValue}>{formatMoney(portalMetrics.projectedMonthlyCommission)}/mes</strong>
            </div>
            <span className={styles.heroMomentumTag}>
              {portalMetrics.weeklyCommission > 0
                ? `${formatMoney(portalMetrics.weeklyCommission)} en 7 dias`
                : 'Activa tu primera venta'}
            </span>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{orders.length}</span>
              <span className={styles.heroStatLabel}>Pedidos del periodo</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{formatMoney(portalMetrics.totalCommission)}</span>
              <span className={styles.heroStatLabel}>Saldo acumulado</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{aff?.discount_percent}%</span>
              <span className={styles.heroStatLabel}>Gancho cliente</span>
            </div>
          </div>

          <div className={styles.heroProgressCard}>
            <div className={styles.heroProgressHead}>
              <div>
                <span className={styles.heroProgressLabel}>Siguiente hito</span>
                <strong className={styles.heroProgressValue}>{formatMoney(portalMetrics.nextMilestone)}</strong>
              </div>
              <div className={styles.heroProgressMeta}>
                <strong>{formatMoney(portalMetrics.milestoneRemaining)}</strong>
                <span>para llegar</span>
              </div>
            </div>
            <div className={styles.heroProgressBar}>
              <div className={styles.heroProgressFill} style={{ width: `${portalMetrics.milestoneProgress}%` }} />
            </div>
            <p className={styles.heroProgressHint}>
              {portalMetrics.ordersToMilestone
                ? `A este ritmo te faltan unos ${portalMetrics.ordersToMilestone} pedidos para tocar ese nivel.`
                : 'Comparte tu enlace para activar el primer tramo de ingresos.'}
            </p>
          </div>

          <div className={styles.heroBadges}>
            {portalMetrics.streak >= 3 && <span className={styles.heroBadge}>Racha: {portalMetrics.streak} dias</span>}
            {portalMetrics.bestDay?.count >= 3 && <span className={styles.heroBadge}>Mejor dia: {portalMetrics.bestDay.count} pedidos</span>}
            {recent30.length >= 10 && <span className={styles.heroBadge}>Ya mueves doble digito</span>}
          </div>

          <div className={styles.chartWrap}><MiniChart data={portalMetrics.chart} /></div>
          <p className={styles.heroChartLabel}>Pedidos ultimos 30 dias</p>
        </div>

        <div className={styles.incomeGrid}>
          <div className={styles.incomeCard}>
            <span className={styles.incomeEyebrow}>Comision media</span>
            <strong className={styles.incomeMain}>{formatMoney(portalMetrics.averageCommissionPerOrder)}</strong>
            <p className={styles.incomeText}>Lo que suele dejarte cada pedido que cierras con tu codigo.</p>
          </div>
          <div className={styles.incomeCard}>
            <span className={styles.incomeEyebrow}>Ventas movidas</span>
            <strong className={styles.incomeMain}>{formatMoney(portalMetrics.totalSales30)}</strong>
            <p className={styles.incomeText}>Facturacion generada por tus referidos en los ultimos 30 dias.</p>
          </div>
          <div className={styles.incomeCard}>
            <span className={styles.incomeEyebrow}>Ticket medio</span>
            <strong className={styles.incomeMain}>{formatMoney(portalMetrics.averageOrderValue)}</strong>
            <p className={styles.incomeText}>Cuanto gasta de media el cliente que entra con tu codigo.</p>
          </div>
        </div>

        <div className={styles.scenarioCard}>
          <div className={styles.scenarioHead}>
            <span className={styles.scenarioBadge}>Ingreso visible</span>
            <h2 className={styles.scenarioTitle}>Lo que vale mover tu enlace</h2>
          </div>
          <div className={styles.scenarioList}>
            {incomeExamples.map(item => (
              <div key={item.label} className={styles.scenarioItem}>
                <div>
                  <strong className={styles.scenarioLabel}>{item.label}</strong>
                  <p className={styles.scenarioHelper}>{item.helper}</p>
                </div>
                <span className={styles.scenarioValue}>{formatMoney(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.shareCard}>
          <div className={styles.shareCardHead}>
            <span className={styles.shareCardIcon}>Ingresos</span>
            <div>
              <h2 className={styles.shareTitle}>Tu maquina de comisiones</h2>
              <p className={styles.shareSubtitle}>Tu trabajo aqui es simple: compartir bien, convertir mejor y repetir.</p>
            </div>
          </div>

          <div className={styles.discountBanner}>
            <span className={styles.discountNum}>{aff?.discount_percent}%</span>
            <div className={styles.discountInfo}>
              <p className={styles.discountText}>descuento para cerrar pedidos con tu codigo</p>
              <p className={styles.discountSub}>Tu comision: <strong>{aff?.commission_percent}%</strong> Â· Codigo: <strong>{aff?.code}</strong></p>
            </div>
          </div>

          <div className={styles.linkBlock}>
            <p className={styles.linkLabel}>Tu enlace del menu</p>
            <div className={styles.linkRow}>
              <span className={styles.linkText}>{link}</span>
              <button className={`${styles.copyLinkBtn} ${copiedLink ? styles.copied : ''}`} onClick={copyLink}>
                {copiedLink ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className={styles.shareBtns}>
            <button className={styles.btnWA} onClick={shareWA}><span>WhatsApp</span></button>
            <button className={styles.btnCopy} onClick={copyMsg}><span>Copiar mensaje</span></button>
          </div>

          <div className={styles.msgBox}>
            <div className={styles.msgHeader}>
              <span className={styles.msgLabel}>Mensaje comercial</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className={styles.msgEdit} onClick={resetMsg}>Restaurar</button>}
                <button className={styles.msgEdit} onClick={() => setEditing(!editing)}>
                  {editing ? 'Cancelar' : 'Personalizar'}
                </button>
              </div>
            </div>

            {editing ? (
              <>
                <textarea className={styles.msgTextarea} rows={5} value={editMsg} onChange={event => setEditMsg(event.target.value)} />
                <button onClick={saveCustomMsg} disabled={savingMsg} className={styles.saveMsgBtn}>
                  {savingMsg ? 'Guardando...' : 'Guardar mensaje'}
                </button>
              </>
            ) : (
              <p className={styles.msgPreview}>{customMsg}</p>
            )}
          </div>

          <div className={styles.tipsRow}>
            {[
              { icon: '\u{1F4F2}', text: 'Sube el enlace a historias y estados cuando haya antojo.' },
              { icon: '\u{1F465}', text: 'Repite sobre clientes que ya compran postres o meriendas.' },
              { icon: '\u{1F4B8}', text: 'Recuerda siempre el descuento y el enlace directo al pedido.' },
            ].map(item => (
              <div key={item.icon} className={styles.tip}>
                <span>{item.icon}</span>
                <span className={styles.tipText}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.payCard}>
          <div className={styles.payIcon}>Saldo</div>
          <div>
            <p className={styles.payTitle}>Saldo del periodo: {formatMoney(portalMetrics.totalCommission)}</p>
            <p className={styles.payDesc}>
              Este panel solo muestra tu operativa: codigo, enlace, rendimiento y saldo. Acceso al portal: {loginLink}
            </p>
          </div>
        </div>

        <div className={styles.shareCard}>
          <div className={styles.shareCardHead}>
            <span className={styles.shareCardIcon}>Actividad</span>
            <div>
              <h2 className={styles.shareTitle}>Tus ultimos pedidos referidos</h2>
              <p className={styles.shareSubtitle}>Solo ves lo necesario para medir si tu codigo esta moviendo dinero.</p>
            </div>
          </div>
          {orders.length === 0 ? (
            <p className={styles.msgPreview}>Todavia no hay pedidos asociados a tu codigo en el periodo activo.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.slice(0, 8).map(order => (
                <div
                  key={order.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#FFF8EE',
                    border: '1.5px solid #FFE8CC',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '.84rem', color: '#1C3829' }}>Pedido #{order.order_number || order.id.slice(0, 6).toUpperCase()}</strong>
                    <span style={{ display: 'block', marginTop: 4, fontSize: '.72rem', color: '#4A7A5A', fontWeight: 700 }}>
                      {formatDate(order.created_at)} Â· {order.status}
                    </span>
                  </div>
                  <strong style={{ fontSize: '.86rem', color: '#2D6A4F' }}>{formatMoney(order.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
