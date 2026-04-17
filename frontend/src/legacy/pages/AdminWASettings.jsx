import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { checkAgentStatus } from '../lib/sendWhatsApp'
import { CHATBOT_API_URL, buildChatbotHeaders } from '../lib/chatbotConfig'
import { loadMergedSettingsMap, upsertScopedSetting } from '../lib/storeSettings'
import styles from './Admin.module.css'

const DEFAULT_MSGS = {
  wa_confirm_msg:
    '*Pedido confirmado, {{nombre}}*\n\nHemos recibido tu pedido #{{numero}} por EUR {{total}}.\nEn breve empezamos a prepararlo.',
  wa_preparing_msg:
    '*Ya estamos preparando tu pedido*\n\nHola {{nombre}}, tu pedido #{{numero}} esta en preparacion.\nEn unos minutos saldra.',
  wa_ready_msg:
    '*Tu pedido esta listo*\n\nHola {{nombre}}, tu pedido #{{numero}} ya esta preparado.\nEl repartidor lo recogera en breve.',
  wa_delivering_msg:
    '*Tu pedido esta en camino*\n\nHola {{nombre}}, tu pedido #{{numero}} acaba de salir.\nPrepara EUR {{total}} en efectivo.',
  wa_delivered_msg:
    '*Pedido entregado*\n\n{{nombre}}, esperamos que disfrutes tu pedido #{{numero}}.\nGracias por confiar en nosotros.',
}

const MSG_KEYS = ['wa_confirm_msg', 'wa_preparing_msg', 'wa_ready_msg', 'wa_delivering_msg', 'wa_delivered_msg']
const AD_KEYS = ['ad_enabled', 'ad_type', 'ad_text', 'ad_cta', 'ad_url', 'ad_color', 'ad_image']
const URL_KEYS = ['review_url', 'affiliate_url']
const ALL_KEYS = [...MSG_KEYS, ...AD_KEYS, ...URL_KEYS]

const MSG_LABELS = [
  ['wa_confirm_msg', 'Al confirmar pedido'],
  ['wa_preparing_msg', 'Al poner en preparacion'],
  ['wa_ready_msg', 'Al quedar listo para reparto'],
  ['wa_delivering_msg', 'Al iniciar reparto'],
  ['wa_delivered_msg', 'Al entregar'],
]

function buildPreview(template) {
  return String(template || '')
    .replace(/\{\{nombre\}\}/g, 'Maria')
    .replace(/\{\{numero\}\}/g, '42')
    .replace(/\{\{total\}\}/g, '8.50')
    .replace(/\{\{direccion\}\}/g, 'Calle Mayor 12')
}

export default function AdminWASettings({ storeId = 'default' }) {
  const [cfg, setCfg] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agentOk, setAgentOk] = useState(null)
  const [checking, setChecking] = useState(false)
  const [preview, setPreview] = useState(null)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    load()
  }, [storeId])

  async function load() {
    setLoading(true)
    const map = await loadMergedSettingsMap(storeId, supabase).catch(() => ({}))
    MSG_KEYS.forEach(key => {
      if (!map[key]) map[key] = DEFAULT_MSGS[key]
    })
    setCfg(map)
    setLoading(false)
  }

  function setValue(key, value) {
    setCfg(current => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(cfg).map(([key, value]) => upsertScopedSetting(key, String(value ?? ''), storeId, supabase))
      )
      toast.success('Configuracion guardada')
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar')
    }
    setSaving(false)
  }

  async function verifyAgent() {
    setChecking(true)
    try {
      const result = await checkAgentStatus()
      const ready = result.ready === true
      setAgentOk(ready)
      toast[ready ? 'success' : 'error'](
        ready
          ? 'Agente conectado y listo'
          : `Agente no listo: ${result.error || 'revisa QR y el servidor local'}`
      )
    } catch (error) {
      setAgentOk(false)
      toast.error(error.message || 'No se pudo verificar el agente')
    }
    setChecking(false)
  }

  async function sendTest() {
    const phone = testPhone.trim()
    if (!phone) {
      toast.error('Introduce un numero de prueba')
      return
    }

    setSendingTest(true)
    try {
      const res = await fetch(`${CHATBOT_API_URL}/chatbot/send`, {
        method: 'POST',
        headers: buildChatbotHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ phone, message: 'Test del sistema: el canal WhatsApp responde correctamente.' }),
      })
      const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }))
      if (!(data.success || data.ok)) throw new Error(data.error || 'Sin detalle')
      toast.success(`Mensaje enviado a ${phone}`)
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar la prueba')
    }
    setSendingTest(false)
  }

  if (loading) return <div className={styles.loadingSpinner} />

  return (
    <div>
      <div className={styles.settingsSection} style={{ marginBottom: 16 }}>
        <h3 className={styles.settingsSectionTitle}>WhatsApp via servidor local</h3>
        <p className={styles.settingsSectionDesc}>
          Verifica el estado real del servidor del chatbot y prueba el envio desde aqui con el mismo gateway que usan pedidos, cocina y reparto.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            borderRadius: 14,
            marginBottom: 14,
            background: agentOk === true ? '#F0FDF4' : agentOk === false ? '#FEF2F2' : '#F9FAFB',
            border: `2px solid ${agentOk === true ? '#86EFAC' : agentOk === false ? '#FECACA' : '#E5E7EB'}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '.88rem', color: '#1C3829' }}>
              {agentOk === true ? 'Agente conectado y listo' : agentOk === false ? 'Agente no disponible' : 'Estado sin verificar'}
            </div>
            <div style={{ fontSize: '.68rem', color: '#9CA3AF', marginTop: 4, fontWeight: 600 }}>{CHATBOT_API_URL || 'Sin URL configurada'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={testPhone}
              onChange={event => setTestPhone(event.target.value)}
              placeholder="34600000000"
              style={{
                padding: '8px 12px',
                border: '2px solid #E5E7EB',
                borderRadius: 10,
                fontSize: '.78rem',
                fontFamily: 'inherit',
                width: 150,
                background: '#F9FAFB',
              }}
            />
            <button
              onClick={verifyAgent}
              disabled={checking}
              style={{
                padding: '8px 14px',
                background: '#2D6A4F',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: '.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: checking ? 0.6 : 1,
              }}
            >
              {checking ? 'Verificando...' : 'Verificar'}
            </button>
            <button
              onClick={sendTest}
              disabled={sendingTest}
              style={{
                padding: '8px 14px',
                background: '#1D4ED8',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: '.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: sendingTest ? 0.6 : 1,
              }}
            >
              {sendingTest ? 'Enviando...' : 'Probar'}
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#FFF8EE',
            border: '1.5px solid #FFE8CC',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: '.74rem',
            color: '#7A4F00',
            fontWeight: 600,
            lineHeight: 1.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>Si el QR caduca o cambias de PC, vuelve a abrir el panel QR y vincula WhatsApp otra vez.</span>
          <a
            href={`${CHATBOT_API_URL}/qr-page`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '7px 14px',
              background: '#25D366',
              color: 'white',
              borderRadius: 9,
              fontSize: '.74rem',
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Abrir QR
          </a>
        </div>
      </div>

      <div className={styles.settingsSection} style={{ marginBottom: 16 }}>
        <h3 className={styles.settingsSectionTitle}>Mensajes automaticos por estado</h3>
        <div
          style={{
            background: '#F0FDF4',
            border: '1.5px solid #86EFAC',
            borderRadius: 10,
            padding: '9px 14px',
            marginBottom: 16,
            fontSize: '.74rem',
            fontWeight: 600,
            color: '#166534',
          }}
        >
          Variables disponibles: {'{{nombre}}'} {'{{numero}}'} {'{{total}}'} {'{{direccion}}'}
        </div>

        {MSG_LABELS.map(([key, label]) => (
          <div key={key} className={styles.formField} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className={styles.formLabel} style={{ margin: 0 }}>{label}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPreview(preview === key ? null : key)}
                  style={{ background: 'none', border: '1.5px solid #D1D5DB', borderRadius: 7, padding: '3px 9px', fontSize: '.68rem', fontWeight: 700, cursor: 'pointer', color: '#6B7280' }}
                >
                  {preview === key ? 'Ocultar' : 'Preview'}
                </button>
                <button
                  onClick={() => setValue(key, DEFAULT_MSGS[key])}
                  style={{ background: 'none', border: '1.5px solid #D1D5DB', borderRadius: 7, padding: '3px 9px', fontSize: '.68rem', fontWeight: 700, cursor: 'pointer', color: '#6B7280' }}
                >
                  Reset
                </button>
              </div>
            </div>
            <textarea className={styles.formTextarea} rows={4} value={cfg[key] || ''} onChange={event => setValue(key, event.target.value)} />
            {preview === key && (
              <div
                style={{
                  marginTop: 8,
                  background: '#DCF8C6',
                  borderRadius: '12px 12px 12px 3px',
                  padding: '12px 14px',
                  fontSize: '.8rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  color: '#1C3829',
                  fontWeight: 600,
                }}
              >
                {buildPreview(cfg[key])}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.settingsSection} style={{ marginBottom: 16 }}>
        <h3 className={styles.settingsSectionTitle}>Publicidad en el menu</h3>
        <p className={styles.settingsSectionDesc}>Bloque de marketing visible en la tienda del cliente.</p>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Estado</label>
          <label className={styles.toggleRow} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={cfg.ad_enabled === 'true'} onChange={event => setValue('ad_enabled', event.target.checked ? 'true' : 'false')} />
            <span style={{ fontWeight: 700, color: cfg.ad_enabled === 'true' ? '#166534' : '#6B7280' }}>
              {cfg.ad_enabled === 'true' ? 'Visible en menu' : 'Desactivado'}
            </span>
          </label>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Tipo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['banner', 'Banner'], ['card', 'Tarjeta']].map(([value, label]) => (
              <button key={value} className={cfg.ad_type === value ? styles.roleBtnActive : styles.roleBtn} onClick={() => setValue('ad_type', value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.settingsGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Texto</label>
            <input className={styles.formInput} value={cfg.ad_text || ''} onChange={event => setValue('ad_text', event.target.value)} placeholder="Nuevo sabor o promo" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>CTA</label>
            <input className={styles.formInput} value={cfg.ad_cta || ''} onChange={event => setValue('ad_cta', event.target.value)} placeholder="Ver mas" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>URL</label>
            <input className={styles.formInput} value={cfg.ad_url || ''} onChange={event => setValue('ad_url', event.target.value)} placeholder="https://..." />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Color CSS</label>
            <input className={styles.formInput} value={cfg.ad_color || ''} onChange={event => setValue('ad_color', event.target.value)} placeholder="#E8607A" />
          </div>
          {cfg.ad_type === 'card' && (
            <div className={styles.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.formLabel}>URL imagen</label>
              <input className={styles.formInput} value={cfg.ad_image || ''} onChange={event => setValue('ad_image', event.target.value)} placeholder="https://..." />
            </div>
          )}
        </div>
      </div>

      <div className={styles.settingsSection} style={{ marginBottom: 16 }}>
        <h3 className={styles.settingsSectionTitle}>URLs del chatbot</h3>
        <p className={styles.settingsSectionDesc}>
          El bot usa estos enlaces para resenas, afiliados y respuestas comerciales.
        </p>
        <div className={styles.settingsGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>URL de resenas</label>
            <input className={styles.formInput} value={cfg.review_url || ''} onChange={event => setValue('review_url', event.target.value)} placeholder="https://..." />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>URL afiliados</label>
            <input className={styles.formInput} value={cfg.affiliate_url || ''} onChange={event => setValue('affiliate_url', event.target.value)} placeholder="https://tu-dominio.com/afiliado" />
          </div>
        </div>
      </div>

      <button className={styles.btnPrimary} onClick={save} disabled={saving} style={{ width: '100%', padding: 16 }}>
        {saving ? 'Guardando...' : 'Guardar toda la configuracion'}
      </button>
    </div>
  )
}
