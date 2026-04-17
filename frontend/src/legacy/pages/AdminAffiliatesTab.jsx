import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { sendWhatsAppRaw } from '../lib/sendWhatsApp'
import {
  buildAffiliateCodeSeed,
  buildAffiliateInviteMessage,
  buildAffiliateMenuLink,
  buildAffiliateSetupLink,
  generateAffiliateSetupToken,
  normalizeAffiliateCode,
} from '../lib/affiliateAuth'
import { loadMergedSettingsMap, upsertScopedSetting } from '../lib/storeSettings'
import styles from './Admin.module.css'

const EMPTY_FORM = {
  name: '',
  code: '',
  phone: '',
  instagram_handle: '',
  discount_percent: 5,
  commission_percent: 5,
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function upsertAffiliateMessage(value, storeId = 'default') {
  await upsertScopedSetting('affiliate_message', String(value ?? ''), storeId, supabase)
}

function kpiItem(label, value, tone = 'green', icon = '') {
  const palettes = {
    green: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
    blue: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    amber: { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
    gray: { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151' },
  }
  return { label, value, icon, ...(palettes[tone] || palettes.gray) }
}

export default function AdminAffiliatesTab({ affiliates, applications = [], orders = [], settingsMap = {}, onRefresh, storeId = 'default' }) {
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [affMsg, setAffMsg] = useState('')
  const [savingMsg, setSavingMsg] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [approvalForm, setApprovalForm] = useState(EMPTY_FORM)
  const [processingAppId, setProcessingAppId] = useState(null)
  const [sendingAccessId, setSendingAccessId] = useState(null)
  const [payingId, setPayingId] = useState(null)

  useEffect(() => {
    loadMergedSettingsMap(storeId, supabase)
      .then(map => {
        if (map?.affiliate_message) setAffMsg(map.affiliate_message)
      })
      .catch(() => {})
  }, [storeId])

  function resetEditor() {
    setShowNew(false)
    setEditingId(null)
    setApprovalTarget(null)
    setForm(EMPTY_FORM)
    setApprovalForm(EMPTY_FORM)
  }

  function getAffStats(affiliateCode, commissionPercent, resetAt = null) {
    let affiliateOrders = orders.filter(order => order.affiliate_code === affiliateCode && order.status !== 'cancelled')
    if (resetAt) affiliateOrders = affiliateOrders.filter(order => new Date(order.created_at) >= new Date(resetAt))
    const sales = affiliateOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const commission = sales * (commissionPercent || 0) / 100
    return { ordersCount: affiliateOrders.length, sales, commission }
  }

  function startNew() {
    setApprovalTarget(null)
    setShowNew(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(affiliate) {
    setApprovalTarget(null)
    setShowNew(false)
    setEditingId(affiliate.id)
    setForm({
      name: affiliate.name || '',
      code: affiliate.code || '',
      phone: affiliate.phone || '',
      instagram_handle: affiliate.instagram_handle || '',
      discount_percent: affiliate.discount_percent ?? 5,
      commission_percent: affiliate.commission_percent ?? 5,
    })
  }

  function startApproval(application) {
    const suggestedName = application.requested_affiliate_name || application.full_name || ''
    setShowNew(false)
    setEditingId(null)
    setApprovalTarget(application)
    setApprovalForm({
      name: suggestedName,
      code: buildAffiliateCodeSeed(application.requested_code || suggestedName || application.full_name || ''),
      phone: application.phone || '',
      instagram_handle: application.instagram_handle || '',
      discount_percent: 5,
      commission_percent: 5,
    })
  }

  async function saveAffMsg() {
    setSavingMsg(true)
    await upsertAffiliateMessage(affMsg, storeId)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
    setSavingMsg(false)
    toast.success('Mensaje guardado')
  }

  async function createAffiliate() {
    if (!form.name || !form.code) {
      toast.error('Nombre y codigo son obligatorios')
      return
    }

    const payload = {
      ...form,
      code: normalizeAffiliateCode(form.code),
      phone: form.phone?.trim() || null,
      instagram_handle: form.instagram_handle?.trim() || null,
      total_orders: 0,
      total_sales: 0,
      total_commission: 0,
      active: true,
      store_id: storeId,
    }

    const { error } = await supabase.from('affiliates').insert([payload])
    if (error) {
      toast.error('Error: el codigo puede estar repetido')
      return
    }

    toast.success('Afiliado creado')
    resetEditor()
    onRefresh()
  }

  async function updateAffiliate() {
    if (!form.name || !form.code) {
      toast.error('Nombre y codigo son obligatorios')
      return
    }

    const { error } = await supabase.from('affiliates').update({
      ...form,
      code: normalizeAffiliateCode(form.code),
      phone: form.phone?.trim() || null,
      instagram_handle: form.instagram_handle?.trim() || null,
    }).eq('id', editingId).eq('store_id', storeId)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Afiliado actualizado')
    resetEditor()
    onRefresh()
  }

  async function toggleActive(id, current) {
    await supabase.from('affiliates').update({ active: !current }).eq('id', id).eq('store_id', storeId)
    onRefresh()
  }

  async function deleteAffiliate(id) {
    if (!confirm('Eliminar afiliado?')) return
    await supabase.from('affiliates').delete().eq('id', id).eq('store_id', storeId)
    toast.success('Afiliado eliminado')
    onRefresh()
  }

  async function sendAccessLink(affiliate) {
    if (!affiliate.phone) {
      toast.error('Este afiliado no tiene telefono')
      return
    }

    setSendingAccessId(affiliate.id)
    const setupToken = generateAffiliateSetupToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('affiliates').update({
      setup_token: setupToken,
      setup_token_expires_at: expiresAt,
      portal_invited_at: new Date().toISOString(),
      active: true,
    }).eq('id', affiliate.id).eq('store_id', storeId)

    if (error) {
      setSendingAccessId(null)
      toast.error('No se pudo generar el acceso')
      return
    }

    const message = buildAffiliateInviteMessage({
      affiliateName: affiliate.name,
      affiliateCode: affiliate.code,
      discountPercent: affiliate.discount_percent,
      commissionPercent: affiliate.commission_percent,
      setupLink: buildAffiliateSetupLink(setupToken, storeId),
      businessName: settingsMap.business_name,
    })

    const result = await sendWhatsAppRaw(affiliate.phone, message)
    setSendingAccessId(null)

    if (!result.sent) toast.error('Acceso generado, pero WhatsApp no se pudo enviar')
    else toast.success('Acceso enviado por WhatsApp')

    onRefresh()
  }

  async function approveApplication() {
    if (!approvalTarget) return
    if (!approvalForm.name || !approvalForm.code || !approvalForm.phone) {
      toast.error('Nombre, codigo y telefono son obligatorios')
      return
    }

    setProcessingAppId(approvalTarget.id)
    const setupToken = generateAffiliateSetupToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const insertPayload = {
      name: approvalForm.name.trim(),
      code: normalizeAffiliateCode(approvalForm.code),
      phone: approvalForm.phone.trim(),
      instagram_handle: approvalForm.instagram_handle?.trim() || null,
      discount_percent: Number(approvalForm.discount_percent || 0),
      commission_percent: Number(approvalForm.commission_percent || 0),
      total_orders: 0,
      total_sales: 0,
      total_commission: 0,
      active: true,
      password_hash: null,
      setup_token: setupToken,
      setup_token_expires_at: expiresAt,
      portal_invited_at: new Date().toISOString(),
      store_id: storeId,
    }

    const { data: affiliate, error: insertError } = await supabase.from('affiliates').insert([insertPayload]).select('*').maybeSingle()
    if (insertError || !affiliate) {
      setProcessingAppId(null)
      toast.error('No se pudo crear el afiliado. Revisa si el codigo ya existe.')
      return
    }

    await supabase.from('affiliate_applications').update({
      status: 'approved',
      approved_affiliate_id: affiliate.id,
      reviewed_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      admin_notes: `Aprobado con codigo ${affiliate.code}`,
    }).eq('id', approvalTarget.id).eq('store_id', storeId)

    const message = buildAffiliateInviteMessage({
      affiliateName: affiliate.name,
      affiliateCode: affiliate.code,
      discountPercent: affiliate.discount_percent,
      commissionPercent: affiliate.commission_percent,
      setupLink: buildAffiliateSetupLink(setupToken, storeId),
      businessName: settingsMap.business_name,
    })

    const result = await sendWhatsAppRaw(affiliate.phone, message)
    setProcessingAppId(null)
    setApprovalTarget(null)
    setApprovalForm(EMPTY_FORM)

    if (!result.sent) toast.error('Afiliado creado, pero el WhatsApp no se pudo enviar')
    else toast.success('Solicitud aprobada y acceso enviado')

    onRefresh()
  }

  async function rejectApplication(application) {
    const note = window.prompt('Motivo interno del rechazo (opcional):', '') || null
    setProcessingAppId(application.id)
    const { error } = await supabase.from('affiliate_applications').update({
      status: 'rejected',
      admin_notes: note,
      reviewed_at: new Date().toISOString(),
      rejected_at: new Date().toISOString(),
    }).eq('id', application.id).eq('store_id', storeId)
    setProcessingAppId(null)

    if (error) {
      toast.error('No se pudo rechazar la solicitud')
      return
    }

    if (approvalTarget?.id === application.id) {
      setApprovalTarget(null)
      setApprovalForm(EMPTY_FORM)
    }

    toast.success('Solicitud rechazada')
    onRefresh()
  }

  async function payCommission(affiliate) {
    const { ordersCount, commission } = getAffStats(affiliate.code, affiliate.commission_percent, affiliate.commission_reset_at)
    if (ordersCount === 0) {
      toast('Sin comision pendiente')
      return
    }

    if (!confirm(`Confirmar pago de EUR ${commission.toFixed(2)} a ${affiliate.name}?\nEsto reiniciara el contador de comisiones.`)) return

    setPayingId(affiliate.id)
    const { error } = await supabase.from('affiliates').update({ commission_reset_at: new Date().toISOString() }).eq('id', affiliate.id).eq('store_id', storeId)
    if (error) toast.error('Error: ' + error.message)
    else {
      toast.success(`Comision pagada: EUR ${commission.toFixed(2)}`)
      onRefresh()
    }
    setPayingId(null)
  }

  const pendingApplications = applications.filter(application => application.status === 'pending')
  const affiliateOrders = orders.filter(order => order.affiliate_code && order.status !== 'cancelled')
  const totalSalesDyn = affiliateOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalCommDyn = affiliates.reduce((sum, affiliate) => sum + getAffStats(affiliate.code, affiliate.commission_percent, affiliate.commission_reset_at).commission, 0)
  const filteredAffiliates = affiliates.filter(affiliate => {
    const q = normalizeSearchText(`${affiliate.name} ${affiliate.code} ${affiliate.phone || ''} ${affiliate.instagram_handle || ''}`)
    return !search || q.includes(normalizeSearchText(search))
  })
  const hasAdminPhone = Boolean(settingsMap.whatsapp_number)

  const kpis = [
    kpiItem('Solicitudes pendientes', pendingApplications.length, 'amber', '\u{1F4DD}'),
    kpiItem('Afiliados activos', affiliates.filter(affiliate => affiliate.active).length, 'green', '\u{1F3F7}\uFE0F'),
    kpiItem('Ventas via afiliados', `EUR ${totalSalesDyn.toFixed(0)}`, 'blue', '\u{1F4B0}'),
    kpiItem('Comisiones pendientes', `EUR ${totalCommDyn.toFixed(2)}`, 'gray', '\u{1F91D}'),
  ]

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Sistema de Afiliados</h2>
        <button className={styles.addBtn} onClick={startNew}>+ Nuevo Afiliado</button>
      </div>

      <div className={styles.statsGrid} style={{ marginBottom: 16 }}>
        {kpis.map(item => (
          <div key={item.label} className={styles.kpiCard} style={{ background: item.bg, border: `1.5px solid ${item.border}` }}>
            <span className={styles.kpiIcon} style={{ color: item.text }}>{item.icon}</span>
            <span className={styles.kpiNum} style={{ color: item.text }}>{item.value}</span>
            <span className={styles.kpiLabel}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.infoBox}>
        Flujo real: solicitud, revision admin, aprobacion, envio de acceso por WhatsApp y activacion del portal con contrasena.
        {!hasAdminPhone && ' Falta configurar el WhatsApp admin en Ajustes para avisos automaticos.'}
      </div>

      <div className={styles.formCard} style={{ marginBottom: 16 }}>
        <h3>Mensaje al aplicar codigo afiliado</h3>
        <div className={styles.settingInput}>
          <input value={affMsg} onChange={event => setAffMsg(event.target.value)} placeholder="Ej: Genial. Codigo de {{nombre}} aplicado." className={styles.input} />
          <button className={styles.saveSettingBtn} onClick={saveAffMsg} disabled={savingMsg}>{savedMsg ? 'OK' : savingMsg ? '...' : 'Guardar'}</button>
        </div>
        <p style={{ fontSize: '.7rem', color: '#8FAF96', marginTop: 6, fontWeight: 600 }}>Variables: {'{{nombre}}'}, {'{{descuento}}'}, {'{{codigo}}'}, {'{{link}}'}</p>
      </div>

      {pendingApplications.length > 0 && (
        <div className={styles.formCard} style={{ marginBottom: 16 }}>
          <h3>Solicitudes pendientes</h3>
          <div className={styles.affiliateApplicationList}>
            {pendingApplications.map(application => (
              <div key={application.id} className={styles.affiliateApplicationCard}>
                <div className={styles.affiliateApplicationHead}>
                  <div>
                    <strong style={{ display: 'block', color: '#1C3829' }}>{application.full_name}</strong>
                    <span className={styles.affiliateApplicationMeta}>
                      {application.phone} {'\u00B7'} {application.instagram_handle || 'sin red'} {'\u00B7'} {application.city || 'sin ciudad'}
                    </span>
                  </div>
                  <div className={styles.affiliateApplicationActions}>
                    <button className={styles.editBtn} onClick={() => startApproval(application)}>Aprobar</button>
                    <button className={styles.deleteBtn} onClick={() => rejectApplication(application)} disabled={processingAppId === application.id}>
                      {processingAppId === application.id ? '...' : 'Rechazar'}
                    </button>
                  </div>
                </div>
                <div className={styles.affiliateApplicationBody}>
                  <div><strong>Nombre afiliado:</strong> {application.requested_affiliate_name || '-'}</div>
                  <div><strong>Codigo deseado:</strong> {application.requested_code || '-'}</div>
                  <div><strong>Canal:</strong> {application.primary_channel || '-'} {'\u00B7'} <strong>Audiencia:</strong> {application.audience_size || '-'}</div>
                  <div className={styles.affiliateApplicationBodyRow}><strong>Motivacion:</strong> {application.motivation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvalTarget && (
        <div className={styles.formCard} style={{ marginBottom: 16, border: '2px solid #74C69D' }}>
          <h3>Aprobar solicitud</h3>
          <p style={{ fontSize: '.74rem', color: '#6B7280', marginTop: 6 }}>
            Al aprobar, se crea el afiliado activo y se envia por WhatsApp el acceso para crear contrasena.
          </p>
          <div className={styles.formGrid2} style={{ marginTop: 14 }}>
            <div className={styles.formGroup}><label className={styles.formLabel}>Nombre</label><input value={approvalForm.name} onChange={event => setApprovalForm({ ...approvalForm, name: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Codigo</label><input value={approvalForm.code} onChange={event => setApprovalForm({ ...approvalForm, code: normalizeAffiliateCode(event.target.value) })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Telefono</label><input value={approvalForm.phone} onChange={event => setApprovalForm({ ...approvalForm, phone: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Instagram</label><input value={approvalForm.instagram_handle} onChange={event => setApprovalForm({ ...approvalForm, instagram_handle: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Descuento cliente (%)</label><input type="number" min="0" max="50" value={approvalForm.discount_percent} onChange={event => setApprovalForm({ ...approvalForm, discount_percent: parseInt(event.target.value || '0', 10) })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Comision afiliado (%)</label><input type="number" min="0" max="30" value={approvalForm.commission_percent} onChange={event => setApprovalForm({ ...approvalForm, commission_percent: parseInt(event.target.value || '0', 10) })} className={styles.input} /></div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => { setApprovalTarget(null); setApprovalForm(EMPTY_FORM) }}>Cancelar</button>
            <button className={styles.saveBtn} onClick={approveApplication} disabled={processingAppId === approvalTarget.id}>{processingAppId === approvalTarget.id ? 'Enviando...' : 'Aprobar y enviar acceso'}</button>
          </div>
        </div>
      )}

      {(showNew || editingId) && (
        <div className={styles.formCard}>
          <h3>{editingId ? 'Editar afiliado' : 'Nuevo afiliado'}</h3>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}><label className={styles.formLabel}>Nombre *</label><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Codigo *</label><input value={form.code} onChange={event => setForm({ ...form, code: normalizeAffiliateCode(event.target.value) })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Telefono</label><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Instagram</label><input value={form.instagram_handle} onChange={event => setForm({ ...form, instagram_handle: event.target.value })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Descuento cliente (%)</label><input type="number" min="0" max="50" value={form.discount_percent} onChange={event => setForm({ ...form, discount_percent: parseInt(event.target.value || '0', 10) })} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Comision afiliado (%)</label><input type="number" min="0" max="30" value={form.commission_percent} onChange={event => setForm({ ...form, commission_percent: parseInt(event.target.value || '0', 10) })} className={styles.input} /></div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={resetEditor}>Cancelar</button>
            <button className={styles.saveBtn} onClick={editingId ? updateAffiliate : createAffiliate}>{editingId ? 'Actualizar' : 'Crear'}</button>
          </div>
        </div>
      )}

      <div className={styles.ordersSearchBar} style={{ marginBottom: 16 }}>
        <div className={styles.ordersSearchInputWrap}>
          <span className={styles.ordersSearchIcon}>{'\u{1F50D}'}</span>
          <input value={search} onChange={event => setSearch(event.target.value)} className={styles.ordersSearchInput} placeholder="Buscar afiliado, codigo, telefono o red..." />
          {search && <button className={styles.ordersSearchClear} onClick={() => setSearch('')}>{'\u2715'}</button>}
        </div>
      </div>

      <div className={styles.itemsList}>
        {filteredAffiliates.length === 0 && <div className={styles.empty}>No hay afiliados con ese filtro.</div>}
        {filteredAffiliates.map(affiliate => {
          const { ordersCount, sales, commission } = getAffStats(affiliate.code, affiliate.commission_percent, affiliate.commission_reset_at)
          const portalReady = Boolean(affiliate.password_hash)
          const menuLink = buildAffiliateMenuLink(affiliate.code, storeId)
          return (
            <div key={affiliate.id} className={`${styles.affiliateCard} ${!affiliate.active ? styles.itemUnavailable : ''}`}>
              <div className={styles.affiliateTop}>
                <div>
                  <strong className={styles.affiliateName}>{affiliate.name}</strong>
                  <code className={styles.affiliateCode}>{affiliate.code}</code>
                  <div style={{ marginTop: 6, fontSize: '.72rem', color: '#6B7280', fontWeight: 700 }}>
                    {affiliate.phone || 'sin telefono'}{affiliate.instagram_handle ? ` \u00B7 ${affiliate.instagram_handle}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => toggleActive(affiliate.id, affiliate.active)} className={affiliate.active ? styles.activeChip : styles.inactiveChip}>{affiliate.active ? 'Activo' : 'Inactivo'}</button>
                  <button onClick={() => startEdit(affiliate)} className={styles.editBtn}>Editar</button>
                  <button onClick={() => deleteAffiliate(affiliate.id)} className={styles.deleteBtn}>{'\u2715'}</button>
                </div>
              </div>

              <div className={styles.affiliateStats}>
                <div className={styles.stat}><span className={styles.statNum}>{affiliate.discount_percent}%</span><span className={styles.statLabel}>Dto cliente</span></div>
                <div className={styles.stat}><span className={styles.statNum}>{affiliate.commission_percent}%</span><span className={styles.statLabel}>Comision</span></div>
                <div className={styles.stat}><span className={styles.statNum}>{ordersCount}</span><span className={styles.statLabel}>Pedidos</span></div>
                <div className={styles.stat}><span className={styles.statNum}>EUR {sales.toFixed(0)}</span><span className={styles.statLabel}>Ventas</span></div>
                <div className={styles.stat}><span className={styles.statNum} style={{ color: '#166534' }}>EUR {commission.toFixed(2)}</span><span className={styles.statLabel}>A pagar</span></div>
              </div>

              <div className={styles.affiliateActions}>
                <button onClick={() => sendAccessLink(affiliate)} disabled={sendingAccessId === affiliate.id} className={styles.editBtn}>
                  {sendingAccessId === affiliate.id ? 'Enviando...' : portalReady ? 'Reenviar acceso' : 'Enviar acceso'}
                </button>
                {commission > 0 && (
                  <button onClick={() => payCommission(affiliate)} disabled={payingId === affiliate.id} className={styles.saveBtn}>
                    {payingId === affiliate.id ? 'Registrando...' : `Pagar comision EUR ${commission.toFixed(2)}`}
                  </button>
                )}
              </div>

              <div className={styles.affiliatePortalMeta}>
                <div>Portal: {portalReady ? 'Activo con contrasena' : 'Pendiente de crear contrasena'}</div>
                {affiliate.portal_invited_at && <div>Ultimo envio acceso: {new Date(affiliate.portal_invited_at).toLocaleDateString('es-ES')}</div>}
                {affiliate.last_portal_login_at && <div>Ultimo login portal: {new Date(affiliate.last_portal_login_at).toLocaleDateString('es-ES')}</div>}
                {affiliate.commission_reset_at && <div>Ultimo pago: {new Date(affiliate.commission_reset_at).toLocaleDateString('es-ES')}</div>}
              </div>

              <div className={styles.affiliateLinkBlock}>
                <code className={styles.affiliateLinkText}>{menuLink}</code>
                <div className={styles.affiliateLinkActions}>
                  <button
                    className={styles.btnSecondary}
                    onClick={() => {
                      navigator.clipboard.writeText(menuLink)
                      toast.success('Link copiado')
                    }}
                  >
                    Copiar link
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
