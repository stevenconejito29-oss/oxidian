// AdminChatbotTab.jsx — Oxidian v3.0 (Chatbot Local)
// Sistema con servidor local, QR de WhatsApp, sin Railway

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import styles from './Admin.module.css'
import AdminWASettings from './AdminWASettings'
import {
  getDesktopRuntimeConfig,
  getDesktopChatbotRuntimeStatus,
  isDesktopChatbotRuntimeAvailable,
  loadDesktopChatbotRuntimeEnv,
  loadDesktopRuntimeConfig,
  openDesktopChatbotRuntimePath,
  restartDesktopChatbotRuntime,
  saveDesktopRuntimeConfig,
  saveDesktopChatbotRuntimeEnv,
  startDesktopChatbotRuntime,
  stopDesktopChatbotRuntime,
  subscribeDesktopChatbotRuntime,
} from '../lib/desktopChatbotRuntime'
import { loadMergedSettingsMap, upsertScopedSetting } from '../lib/storeSettings'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'
import { CHATBOT_API_SECRET, CHATBOT_API_URL } from '../lib/chatbotConfig'

const BOT_URL = CHATBOT_API_URL
const BOT_SECRET = CHATBOT_API_SECRET

const AI_PROVIDER_OPTIONS = [
  { value:'gemini', label:'Google Gemini' },
  { value:'huggingface', label:'Hugging Face' },
  { value:'groq', label:'Groq' },
  { value:'openai_compatible', label:'OpenAI compatible' },
  { value:'anthropic', label:'Anthropic / Claude' },
  { value:'disabled', label:'Solo motor local' },
]

const AI_PROVIDER_PRESETS = {
  gemini: {
    apiVersion: '',
    model: 'gemini-2.5-flash',
    temperature: '0.9',
    timeoutMs: '15000',
    baseUrl: '',
    baseUrlPlaceholder: 'Opcional · usa el endpoint oficial de Gemini por defecto',
    modelPlaceholder: 'gemini-2.5-flash',
    keyPlaceholder: 'Pega tu API key de Gemini',
  },
  huggingface: {
    apiVersion: '2023-06-01',
    model: 'meta-llama/Llama-3.1-8B-Instruct:cerebras',
    temperature: '0.82',
    timeoutMs: '18000',
    baseUrl: '',
    baseUrlPlaceholder: 'Opcional · usa https://router.huggingface.co/v1/chat/completions por defecto',
    modelPlaceholder: 'meta-llama/Llama-3.1-8B-Instruct:cerebras',
    keyPlaceholder: 'Pega tu HF token',
  },
  groq: {
    apiVersion: '2023-06-01',
    model: 'llama-3.3-70b-versatile',
    temperature: '0.85',
    timeoutMs: '12000',
    baseUrl: '',
    baseUrlPlaceholder: 'Opcional · https://api.groq.com/openai/v1/chat/completions',
    modelPlaceholder: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'Pega tu API key de Groq',
  },
  openai_compatible: {
    apiVersion: '2023-06-01',
    model: '',
    temperature: '0.8',
    timeoutMs: '15000',
    baseUrl: '',
    baseUrlPlaceholder: 'Obligatorio · https://.../v1/chat/completions',
    modelPlaceholder: 'Modelo del proveedor compatible',
    keyPlaceholder: 'Pega tu API key del proveedor compatible',
  },
  anthropic: {
    apiVersion: '2023-06-01',
    model: 'claude-sonnet-4-20250514',
    temperature: '0.82',
    timeoutMs: '18000',
    baseUrl: '',
    baseUrlPlaceholder: 'Opcional · usa el endpoint oficial por defecto',
    modelPlaceholder: 'claude-sonnet-4-20250514',
    keyPlaceholder: 'Pega tu API key de Anthropic',
  },
  disabled: {
    apiVersion: '2023-06-01',
    model: '',
    temperature: '0.85',
    timeoutMs: '12000',
    baseUrl: '',
    baseUrlPlaceholder: 'No aplica en modo local',
    modelPlaceholder: 'No aplica en modo local',
    keyPlaceholder: 'Modo local, sin API key',
  },
}

function getAIProviderLabel(provider) {
  const value = String(provider || '').trim()
  return AI_PROVIDER_OPTIONS.find(option => option.value === value)?.label || (value || 'Local')
}

function getAIProviderPreset(provider) {
  return AI_PROVIDER_PRESETS[String(provider || 'gemini').trim()] || AI_PROVIDER_PRESETS.gemini
}

function isLoopbackBotUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim())
    return ['127.0.0.1', 'localhost'].includes(url.hostname)
  } catch {
    return false
  }
}

function buildBotFetchMessage(error, targetUrl, label = 'el bot local') {
  const rawMessage = String(error?.message || error || '').trim() || 'Error desconocido'
  const failedToFetch = /failed to fetch|networkerror|load failed/i.test(rawMessage)
  const loopback = isLoopbackBotUrl(targetUrl)
  const isDesktop = typeof window !== 'undefined' && window.oxidianDesktopAdmin?.allowed === true

  if (failedToFetch && loopback) {
    if (isDesktop) {
      return `No pude conectar con ${label} en ${targetUrl}. Revisa que el servidor este levantado en esa PC y que la URL/secret del runtime desktop sean correctos.`
    }
    return `No pude conectar con ${label} en ${targetUrl}. Si estas usando el admin web, abre el Admin Desktop o usa esta misma PC con el chatbot corriendo.`
  }
  return rawMessage
}

async function fetchBotJson(url, options = {}, fallbackMessage = 'Respuesta invalida del bot local') {
  try {
    const response = await fetch(url, options)
    const data = await readBotJson(response, fallbackMessage)
    return { response, data }
  } catch (error) {
    throw new Error(buildBotFetchMessage(error, url))
  }
}

async function readBotJson(response, fallbackMessage = 'Respuesta invalida del bot local') {
  const text = await response.text()
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    try { return JSON.parse(text || '{}') } catch { throw new Error(fallbackMessage) }
  }

  const trimmed = String(text || '').trim()
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<')) {
    throw new Error('El bot devolvio HTML. Revisa la URL local, el Admin Desktop o si el servidor del bot esta caido.')
  }
  try { return JSON.parse(trimmed || '{}') } catch { throw new Error(trimmed || fallbackMessage) }
}

// ─── REGLAS POR DEFECTO ───────────────────────────────────────────────────────
const DEFAULT_RULES = [
  { id:'saludo', trigger:'hola,buenas,buenos dias,buenas tardes,buenas noches,hey,hi,saludos',
    response:'Hola. Soy el asistente de *{{business_name}}*.\n\n• *mi pedido* - estado de tu pedido\n• *cancelar* - cancelar pedido\n• *horario* - horario activo\n• *menu* - ver productos\n• *precio* - consultar precios\n• *hablar* - atencion humana\n\n¿En que te ayudo?', active:true },
  { id:'adios', trigger:'adios,hasta luego,bye,chao,gracias nada mas,ya esta',
    response:'Hasta pronto. Puedes pedir cuando quieras en:\n*{{web}}*', active:true },
  { id:'precio', trigger:'precio,cuanto cuesta,cuanto vale,coste,tarifa',
    response:'Los precios actualizados estan en el menu online:\n\n*{{web}}*', active:true },
  { id:'horario', trigger:'horario,cuando abren,hora,abris,cerrais,cerrado,abierto',
    response:'Horario actual:\n*{{hours}}*\n\nSi quieres dejar tu pedido online:\n*{{web}}*', active:true },
  { id:'zona', trigger:'reparto,envio,entrega,zona,domicilio,delivery,llevan',
    response:'La cobertura y condiciones de entrega dependen de esta tienda.\n\nSi quieres pedir o revisar detalle:\n*{{web}}*', active:true },
  { id:'pago', trigger:'pago,pagar,bizum,tarjeta,efectivo,como pago',
    response:'Los metodos de pago y condiciones se muestran al hacer el pedido en:\n*{{web}}*', active:true },
  { id:'alergenos', trigger:'alergeno,alergia,lactosa,gluten,sin lactosa,vegano,intolerante',
    response:'Si tienes dudas de alergias o ingredientes, escribe *hablar* y revisamos tu caso.\n\nTambien puedes consultar el menu:\n*{{web}}*', active:true },
  { id:'descuento', trigger:'descuento,cupon,oferta,promocion,codigo,promo',
    response:'Los cupones y promos se aplican desde el menu online:\n*{{web}}*\n\nNovedades en *{{instagram}}*', active:true },
  { id:'espera', trigger:'cuanto tarda,tiempo,espera,cuando llega,tardais',
    response:'Los tiempos pueden variar segun la operativa de la tienda. Si quieres pedir o revisar estado:\n*{{web}}*', active:true },
  { id:'instagram', trigger:'instagram,insta,ig,redes,tiktok,perfil',
    response:'Instagram oficial: *{{instagram}}*', active:true },
  { id:'contacto', trigger:'telefono,llamar,contacto,numero,email',
    response:'Si necesitas atencion humana, escribe *hablar* y escalamos tu caso.', active:true },
  { id:'natural', trigger:'ingredientes,natural,conservantes,artificial,fresco,casero,artesanal',
    response:'Si quieres detalle de un producto concreto, dime el nombre o entra al menu:\n*{{web}}*', active:true },
  { id:'resena', trigger:'resena,valoracion,google,opinion,review',
    response:'Tu reseña nos ayuda mucho:\n{{review}}', active:true },
  { id:'pedido', trigger:'hacer pedido,quiero pedir,como pido,quiero uno,pedir',
    response:'Pedir es muy facil:\n\n1. Entra en *{{web}}*\n2. Elige tus productos\n3. Introduce tus datos\n4. Confirma el pedido\n\nSi prefieres ayuda humana, escribe *hablar*.', active:true },
  { id:'gracias', trigger:'muchas gracias,gracias,genial,perfecto,excelente,buenisimo',
    response:'De nada. Si te ha ido bien, una reseña ayuda mucho:\n{{review}}', active:true },
  { id:'combo', trigger:'combo,combos,pack,oferta combo,conjunto',
    response:'Los combos y packs disponibles se muestran en:\n*{{web}}*', active:true },
  { id:'queja', trigger:'mal,queja,no me gusto,llego mal,estaba frio,equivocado,faltaba',
    response:'Lamentamos lo ocurrido. Escribe *hablar* y lo revisamos cuanto antes.', active:true },
  { id:'directo', trigger:'donde estais,tienda fisica,local,ubicacion,donde sois',
    response:'La ubicacion y operativa dependen de la tienda configurada. Si necesitas ayuda puntual, escribe *hablar*.', active:true },
  { id:'affiliate', trigger:'afiliado,comision,ganar dinero,ingreso extra,referido',
    response:'Si esta tienda tiene programa de afiliados, lo veras aqui:\n*{{affiliate}}*', active:true },
  { id:'club', trigger:'club,categoria,nivel,beneficios,fidelidad',
    response:'Si esta tienda usa club o fidelidad, tus ventajas se muestran en el menu:\n*{{web}}*', active:true },
]

const RULE_PLACEHOLDER_CHIPS = [
  { key:'business_name', label:'{{business_name}}' },
  { key:'hours', label:'{{hours}}' },
  { key:'web', label:'{{web}}' },
  { key:'affiliate', label:'{{affiliate}}' },
  { key:'review', label:'{{review}}' },
  { key:'instagram', label:'{{instagram}}' },
]

const previewBaseUrl = (import.meta.env.VITE_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : '') || 'https://tu-dominio.com').replace(/\/$/, '')
const PREVIEW_VALS = {
  business_name: 'Mi tienda',
  hours: 'Horario segun configuracion activa',
  web: previewBaseUrl,
  affiliate: `${previewBaseUrl}/afiliado`,
  review: `${previewBaseUrl}/menu?review=42`,
  instagram: '@mi_tienda',
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function stripAccents(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
}
function applyPreview(text='') {
  return Object.entries(PREVIEW_VALS).reduce((t,[k,v]) =>
    t.replace(new RegExp(`\\{\\{${k}\\}\\}`,'g'), v), text)
}
function timeAgo(ts) {
  if (!ts) return ''
  const m = Math.round((Date.now()-new Date(ts).getTime())/60000)
  if (m<1) return 'ahora mismo'
  if (m<60) return `hace ${m} min`
  return `hace ${Math.round(m/60)}h`
}
function fmtPhone(raw='') {
  const d = raw.replace('@c.us','').replace(/\D/g,'')
  if (d.startsWith('34') && d.length===11)
    return `+${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`
  return `+${d}`
}
function rawDigits(raw='') {
  return raw.replace('@c.us','').replace(/\D/g,'')
}
function isMissingStoreScope(error) {
  return /column .*store_id.* does not exist|schema cache/i.test(String(error?.message || ''))
}
function findBestRule(rules, msg) {
  const nm = stripAccents(msg.toLowerCase().trim())
  let best=null, bestScore=-1
  for (const r of rules) {
    if (!r?.active) continue
    for (const raw of String(r.trigger||'').split(',')) {
      const kw = stripAccents(raw.trim().toLowerCase())
      if (!kw||!nm.includes(kw)) continue
      const score = (nm===kw?1000:0)+kw.length
      if (score>bestScore) { best=r; bestScore=score }
    }
  }
  return best
}

// ─── SUB-COMPONENTE: Setup Panel ──────────────────────────────────────────────
function SetupPanel({ botUrl, botConnected }) {
  const steps = [
    {
      n:'1', icon:'🧩', title:'Configura la tienda desde este mismo admin',
      body: <>Guarda Supabase, numero admin, URLs y puerto local en el bloque <b>Runtime portable embebido</b>. Cada carpeta mantiene su propia configuracion.</>,
      action: null,
    },
    {
      n:'2', icon:'⚡', title:'Arranca o reinicia el bot aqui mismo',
      body: <>Usa <b>Iniciar bot</b> o <b>Reiniciar</b>. El flujo principal ya no depende de abrir carpetas separadas para el chatbot.</>,
      action: null,
    },
    {
      n:'3', icon:'📱', title:'Vincula WhatsApp desde la misma app',
      body: <>Ve a <b>QR / Conexión</b> y escanea el código con WhatsApp. Si lo prefieres, puedes abrir el panel QR externo.</>,
      action: { label:'Abrir panel QR', url: botUrl + '/qr-page' },
    },
    {
      n:'4', icon:'🧠', title:'Define la IA de esta sede',
      body: <>En <b>IA Admin</b> eliges proveedor, modelo y API key. Esa clave queda asociada a la carpeta portable de esta tienda.</>,
      action: null,
    },
    {
      n:'5', icon:'🧳', title:'Mueve la carpeta y la tienda viaja contigo',
      body: <>Puedes copiar la carpeta del admin a otro PC. El runtime local, la sesión de WhatsApp y la configuración de esta sede viajan juntos.</>,
      action: null,
    },
  ]

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0f1923,#1a2f1a)', borderRadius:16, padding:'20px 22px', marginBottom:16, color:'white' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          <span style={{ fontSize:28 }}>🖥️</span>
          <div>
            <div style={{ fontWeight:900, fontSize:'1rem', color:'#D4AF37' }}>Admin + chatbot en una sola carpeta portable</div>
            <div style={{ fontSize:'.75rem', opacity:.75, marginTop:2 }}>Cada sede opera con su propio runtime local, QR y clave AI desde este mismo centro</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background: botConnected ? '#22c55e' : '#ef4444',
              boxShadow: botConnected ? '0 0 8px #22c55e' : '0 0 8px #ef4444' }} />
            <span style={{ fontSize:'.75rem', fontWeight:800, color: botConnected ? '#86efac' : '#fca5a5' }}>
              {botConnected ? 'CONECTADO' : 'DESCONECTADO'}
            </span>
          </div>
        </div>
        <div style={{ background:'rgba(212,175,55,.1)', border:'1px solid rgba(212,175,55,.3)', borderRadius:10, padding:'10px 14px', fontSize:'.76rem', color:'#fde68a', lineHeight:1.7 }}>
          <b>Importante:</b> El desktop es ahora el punto principal de control. Usa <code style={{ fontFamily:'monospace', fontSize:'.73rem' }}>iniciar.bat</code> solo como respaldo manual si no puedes abrir el admin desktop en esa maquina.
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:13, padding:'14px 16px', display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#1C3829', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'.85rem', flexShrink:0 }}>{s.n}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829', marginBottom:5 }}>{s.icon} {s.title}</div>
              <div style={{ fontSize:'.79rem', color:'#4B5563', lineHeight:1.6 }}>{s.body}</div>
              {s.action && (
                <a href={s.action.url} target='_blank' rel='noopener noreferrer'
                  style={{ display:'inline-block', marginTop:10, padding:'7px 16px', background:'#1C3829', color:'white', borderRadius:9, fontSize:'.77rem', fontWeight:800, textDecoration:'none' }}>
                  {s.action.label} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DesktopRuntimePanel({ onRuntimeSync }) {
  const desktopAvailable = isDesktopChatbotRuntimeAvailable()
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null)
  const [envState, setEnvState] = useState({
    PORT: '', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '',
    WA_SECRET: '', SHOP_URL: '', CHATBOT_STORE_ID: '',
  })
  const [runtimeConfig, setRuntimeConfig] = useState(() => getDesktopRuntimeConfig() || null)
  const [busyAction, setBusyAction] = useState('')
  const [savingEnv, setSavingEnv] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const refreshRuntime = useCallback(async () => {
    if (!desktopAvailable) return
    const [status, env, config] = await Promise.all([
      getDesktopChatbotRuntimeStatus().catch(() => null),
      loadDesktopChatbotRuntimeEnv().catch(() => null),
      loadDesktopRuntimeConfig().catch(() => null),
    ])
    setRuntimeSnapshot(status)
    setRuntimeConfig(config || getDesktopRuntimeConfig() || null)
    if (env?.values) setEnvState(current => ({ ...current, ...env.values }))
  }, [desktopAvailable])

  useEffect(() => { refreshRuntime() }, [refreshRuntime])
  useEffect(() => {
    if (!desktopAvailable) return () => {}
    return subscribeDesktopChatbotRuntime(snapshot => { setRuntimeSnapshot(snapshot || null) })
  }, [desktopAvailable])

  async function runRuntimeAction(actionId, handler) {
    if (!desktopAvailable) return
    setBusyAction(actionId)
    try { await handler(); await refreshRuntime(); await onRuntimeSync?.() }
    catch (error) { toast.error(error?.message || 'No se pudo ejecutar la accion del runtime') }
    finally { setBusyAction('') }
  }

  async function saveEnv() {
    if (!desktopAvailable) return
    setSavingEnv(true)
    try { await saveDesktopChatbotRuntimeEnv(envState); toast.success('Entorno local del bot guardado'); await refreshRuntime(); await onRuntimeSync?.() }
    catch (error) { toast.error(error?.message || 'No se pudo guardar el entorno local') }
    finally { setSavingEnv(false) }
  }

  async function saveConfig() {
    if (!desktopAvailable || !runtimeConfig) return
    setSavingConfig(true)
    try { await saveDesktopRuntimeConfig(runtimeConfig); toast.success('Runtime portable actualizado'); await refreshRuntime(); await onRuntimeSync?.() }
    catch (error) { toast.error(error?.message || 'No se pudo guardar la configuracion portable') }
    finally { setSavingConfig(false) }
  }

  if (!desktopAvailable) {
    return (
      <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:14, padding:'16px 18px', fontSize:'.78rem', color:'#9A3412', lineHeight:1.7 }}>
        <b>Modo web detectado.</b> El runtime portable embebido solo se gestiona desde el Admin Desktop. En navegador web puedes revisar reglas y ajustes, pero no arrancar el bot local de esa PC.
      </div>
    )
  }

  const status = runtimeSnapshot?.serverStatus || null
  const runtimeOnline = runtimeSnapshot?.serverReachable === true
  const processOwned = runtimeSnapshot?.processOwned === true

  return (
    <div style={{ display:'grid', gap:14 }}>
      <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'16px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829' }}>Runtime portable embebido</div>
            <div style={{ fontSize:'.75rem', color:'#6B7280', marginTop:4, lineHeight:1.6 }}>
              Este panel controla el bot local que viaja dentro del admin portable de cada tienda.
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => runRuntimeAction('start', startDesktopChatbotRuntime)} disabled={busyAction !== ''} style={runtimeBtn('#1C3829', 'white')}>
              {busyAction === 'start' ? 'Iniciando...' : 'Iniciar bot'}
            </button>
            <button onClick={() => runRuntimeAction('restart', restartDesktopChatbotRuntime)} disabled={busyAction !== ''} style={runtimeBtn('#EFF6FF', '#1D4ED8', '#BFDBFE')}>
              {busyAction === 'restart' ? 'Reiniciando...' : 'Reiniciar'}
            </button>
            <button onClick={() => runRuntimeAction('stop', stopDesktopChatbotRuntime)} disabled={busyAction !== ''} style={runtimeBtn('#FEF2F2', '#B91C1C', '#FECACA')}>
              {busyAction === 'stop' ? 'Deteniendo...' : 'Detener'}
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10, marginTop:14 }}>
          {[
            { label:'Servidor', value: runtimeOnline ? 'Activo' : 'Caido', bg: runtimeOnline ? '#D1FAE5' : '#FEE2E2', color: runtimeOnline ? '#166534' : '#991B1B' },
            { label:'Proceso desktop', value: processOwned ? 'Gestionado' : 'No detectado', bg:'#F3F4F6', color:'#374151' },
            { label:'Puerto local', value: envState.PORT || status?.port || '-', bg:'#EFF6FF', color:'#1D4ED8' },
            { label:'Store local', value: runtimeConfig?.storeId || envState.CHATBOT_STORE_ID || status?.configuredStoreId || 'default', bg:'#F5F3FF', color:'#6D28D9' },
          ].map(card => (
            <div key={card.label} style={{ background:card.bg, borderRadius:12, padding:'11px 13px' }}>
              <div style={{ fontSize:'.63rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', color:card.color }}>{card.label}</div>
              <div style={{ fontSize:'.95rem', fontWeight:900, color:card.color, marginTop:4 }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginTop:14 }}>
          <div style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:12, padding:'12px 13px' }}>
            <label style={runtimeLabelStyle}>URL local del bot</label>
            <input value={runtimeConfig?.chatbotUrl || ''} onChange={e => setRuntimeConfig(c => ({ ...(c||{}), chatbotUrl: e.target.value }))} style={runtimeInputStyle} placeholder="http://127.0.0.1:3001" />
          </div>
          <div style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:12, padding:'12px 13px' }}>
            <label style={runtimeLabelStyle}>Store runtime</label>
            <input value={runtimeConfig?.storeId || ''} onChange={e => { const v = e.target.value; setRuntimeConfig(c => ({ ...(c||{}), storeId: v })); setEnvState(c => ({ ...c, CHATBOT_STORE_ID: v })) }} style={runtimeInputStyle} placeholder="default" />
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button onClick={saveConfig} disabled={savingConfig} style={runtimeBtn('#111827', 'white')}>{savingConfig ? 'Guardando runtime...' : 'Guardar runtime'}</button>
          <button onClick={() => openDesktopChatbotRuntimePath('runtimeRoot')} style={runtimeBtn('#F3F4F6', '#374151', '#E5E7EB')}>Abrir carpeta runtime</button>
          <button onClick={() => openDesktopChatbotRuntimePath('logs')} style={runtimeBtn('#F3F4F6', '#374151', '#E5E7EB')}>Abrir logs</button>
        </div>
      </div>

      <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'16px 18px' }}>
        <div style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829', marginBottom:10 }}>Entorno local del chatbot</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12 }}>
          {[
            { key:'SUPABASE_URL', label:'Supabase URL', placeholder:'https://...supabase.co' },
            { key:'SUPABASE_SERVICE_KEY', label:'Supabase service key', placeholder:'Pega la service role key', secret:true },
            { key:'WA_SECRET', label:'Secret local bot', placeholder:'Opcional para proteger llamadas locales' },
            { key:'SHOP_URL', label:'URL publica tienda', placeholder:'https://tu-dominio.com/menu' },
            { key:'PORT', label:'Puerto local', placeholder:'3001' },
            { key:'CHATBOT_STORE_ID', label:'Store ID local', placeholder:'default' },
          ].map(field => (
            <div key={field.key}>
              <label style={runtimeLabelStyle}>{field.label}</label>
              <input type={field.secret ? 'password' : 'text'} value={envState[field.key] || ''} onChange={e => setEnvState(c => ({ ...c, [field.key]: e.target.value }))} style={runtimeInputStyle} placeholder={field.placeholder} />
            </div>
          ))}
        </div>
        <button onClick={saveEnv} disabled={savingEnv} style={{ ...runtimeBtn('#2D6A4F', 'white'), marginTop:14 }}>
          {savingEnv ? 'Guardando entorno...' : 'Guardar entorno local'}
        </button>
      </div>
    </div>
  )
}

function runtimeBtn(background, color, borderColor = 'transparent') {
  return { padding:'8px 14px', background, color, border:`1.5px solid ${borderColor}`, borderRadius:10, fontSize:'.76rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }
}
const runtimeLabelStyle = { display:'block', marginBottom:6, fontSize:'.72rem', fontWeight:900, color:'#374151' }
const runtimeInputStyle = { width:'100%', borderRadius:10, border:'1.5px solid #E5E7EB', padding:'10px 12px', fontFamily:'inherit', fontSize:'.82rem', color:'#1C3829', boxSizing:'border-box' }

function QRPanel({ botUrl, botSecret, isConnected, onStatusChange }) {
  const [qrData, setQrData] = useState(null)
  const [checking, setChecking] = useState(false)

  async function checkStatus() {
    setChecking(true)
    try {
      const r = await fetch(`${botUrl}/status`, { headers:{ 'x-secret': botSecret } })
      if (!r.ok) { onStatusChange(false); setQrData(null); return }
      const d = await readBotJson(r, 'No se pudo leer el estado del bot')
      const connected = !!(d.connected||d.ready)
      onStatusChange(connected)
      if (!connected) loadQR()
      else setQrData(null)
    } catch { onStatusChange(false) }
    finally { setChecking(false) }
  }

  async function loadQR() {
    setQrData('loading')
    try {
      const r = await fetch(`${botUrl}/qr`, { headers:{ 'x-secret': botSecret } })
      if (!r.ok) { setQrData('unavailable'); return }
      const d = await readBotJson(r, 'No se pudo leer la respuesta del bot')
      if (d.connected) { onStatusChange(true); setQrData(null); return }
      setQrData(d.qr || (d.waiting ? 'waiting' : 'unavailable'))
    } catch { setQrData('unavailable') }
  }

  useEffect(() => { checkStatus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'20px', marginBottom:14, textAlign:'center' }}>
      <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829', marginBottom:14 }}>📱 Estado WhatsApp</div>
      {isConnected ? (
        <div>
          <div style={{ width:70, height:70, borderRadius:'50%', background:'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 12px' }}>✅</div>
          <div style={{ fontWeight:900, color:'#166534', fontSize:'1rem', marginBottom:4 }}>WhatsApp Conectado</div>
          <div style={{ fontSize:'.76rem', color:'#6B7280' }}>El bot está activo y respondiendo mensajes</div>
          <button onClick={checkStatus} disabled={checking} style={{ marginTop:14, padding:'8px 18px', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:9, color:'#166534', fontWeight:800, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
            {checking ? '⏳ Comprobando...' : '🔄 Verificar conexión'}
          </button>
        </div>
      ) : (
        <div>
          {!qrData && (
            <div>
              <div style={{ width:70, height:70, borderRadius:'50%', background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 12px' }}>❌</div>
              <div style={{ fontWeight:900, color:'#991B1B', fontSize:'.95rem', marginBottom:4 }}>Bot desconectado</div>
              <div style={{ fontSize:'.76rem', color:'#6B7280', marginBottom:16 }}>El servidor no está corriendo o WhatsApp no está vinculado</div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={loadQR} style={{ padding:'9px 20px', background:'#1C3829', color:'white', border:'none', borderRadius:10, fontWeight:800, fontSize:'.8rem', cursor:'pointer', fontFamily:'inherit' }}>📱 Obtener QR</button>
                <a href={`${botUrl}/qr-page`} target="_blank" rel="noopener noreferrer" style={{ padding:'9px 20px', background:'#25D366', color:'white', borderRadius:10, fontWeight:800, fontSize:'.8rem', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>🌐 Abrir panel QR</a>
              </div>
            </div>
          )}
          {qrData === 'loading' && <div style={{ padding:20, color:'#6B7280' }}>⏳ Generando QR... (arranca el servidor primero)</div>}
          {qrData === 'waiting' && <div style={{ padding:20, color:'#6B7280' }}>⏳ Servidor iniciando, espera unos segundos y vuelve a intentar</div>}
          {qrData === 'unavailable' && (
            <div style={{ padding:16, background:'#FEF3C7', borderRadius:10, color:'#92400E', fontSize:'.78rem', fontWeight:700 }}>
              ⚠️ El servidor no responde. Intenta <b>Iniciar bot</b> o <b>Reiniciar</b> desde la pestaña de configuración. Si estás fuera del desktop, usa <code style={{ fontFamily:'monospace' }}>iniciar.bat</code> solo como respaldo.
            </div>
          )}
          {qrData && qrData !== 'loading' && qrData !== 'waiting' && qrData !== 'unavailable' && (
            <div>
              <div style={{ fontSize:'.78rem', color:'#4B5563', marginBottom:12, fontWeight:700 }}>Escanea con WhatsApp → Menú → Dispositivos vinculados</div>
              <div style={{ display:'inline-block', background:'white', padding:12, borderRadius:12, border:'2px solid #E5E7EB' }}>
                <img src={qrData} alt="QR WhatsApp" style={{ width:220, height:220, display:'block' }} />
              </div>
              <div style={{ fontSize:'.72rem', color:'#9CA3AF', marginTop:10 }}>El QR expira en ~60s. Si caduca, pulsa "Obtener QR" de nuevo.</div>
              <button onClick={checkStatus} disabled={checking} style={{ marginTop:12, padding:'8px 16px', background:'#F3F4F6', border:'1.5px solid #E5E7EB', borderRadius:9, color:'#374151', fontWeight:800, fontSize:'.76rem', cursor:'pointer', fontFamily:'inherit' }}>
                {checking ? '⏳...' : '✅ Ya escaneé — verificar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PORTABLE DOWNLOAD TAB ────────────────────────────────────────────────────
function PortableDownloadTab({ storeId }) {
  const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL || ''
  const shopUrl       = typeof window !== 'undefined' ? window.location.origin : ''

  const [serviceKey,   setServiceKey]   = useState('')
  const [waSecret,     setWaSecret]     = useState('oxidian-secret-' + (storeId || 'tienda'))
  const [adminPhone,   setAdminPhone]   = useState('')
  const [aiProvider,   setAiProvider]   = useState('gemini')
  const [aiApiKey,     setAiApiKey]     = useState('')
  const [aiModel,      setAiModel]      = useState('gemini-2.5-flash')
  const [port,         setPort]         = useState('3001')
  const [showKey,      setShowKey]      = useState(false)
  const [downloaded,   setDownloaded]   = useState(false)

  function buildEnv() {
    return `# ════════════════════════════════════════════════════════════
# OXIDIAN Chatbot Local — Generado automáticamente para la tienda: ${storeId}
# Copia este archivo como .env dentro de tu carpeta chatbot-local
# ════════════════════════════════════════════════════════════

# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=${serviceKey.trim()}

# ── Tienda OXIDIAN ────────────────────────────────────────────────────
SHOP_URL=${shopUrl}
CHATBOT_STORE_ID=${storeId}

# ── WhatsApp ──────────────────────────────────────────────────────────
ADMIN_PHONE=${adminPhone.trim()}

# ── Seguridad ─────────────────────────────────────────────────────────
WA_SECRET=${waSecret.trim()}

# ── Puerto ────────────────────────────────────────────────────────────
PORT=${port}

# ── Monitor de pedidos ────────────────────────────────────────────────
ORDER_SYNC_INTERVAL_MS=10000
REVIEW_DELAY_MINUTES=3
ORDER_LOOKBACK_HOURS=72

# ── IA ───────────────────────────────────────────────────────────────
AI_PROVIDER=${aiProvider}
AI_API_KEY=${aiApiKey.trim()}
AI_MODEL=${aiModel.trim()}
AI_BASE_URL=
AI_API_VERSION=
AI_TEMPERATURE=0.9
AI_TIMEOUT_MS=15000
AI_CHAT_MODEL=${aiModel.trim()}
AI_CHAT_TEMPERATURE=0.9
AI_CHAT_TIMEOUT_MS=15000
AI_ADMIN_MODEL=${aiModel.trim()}
AI_ADMIN_TEMPERATURE=0.2
AI_ADMIN_TIMEOUT_MS=12000

# ── Filtros anti-ban ─────────────────────────────────────────────────
ANTI_BAN_ENABLED=true
ANTI_BAN_REPLY_MIN_DELAY_MS=5000
ANTI_BAN_REPLY_MAX_DELAY_MS=14000
ANTI_BAN_COOLDOWN_MS=45000
ANTI_BAN_GLOBAL_GAP_MIN_MS=2200
ANTI_BAN_GLOBAL_GAP_JITTER_MS=1800
ANTI_BAN_WINDOW_MS=600000
ANTI_BAN_MAX_REPLIES_PER_WINDOW=6
ANTI_BAN_DUPLICATE_INBOUND_WINDOW_MS=20000
ANTI_BAN_DUPLICATE_OUTBOUND_WINDOW_MS=900000
ANTI_BAN_MAX_SAME_REPLY_PER_WINDOW=2
ANTI_BAN_MAX_INBOUND_BURST=8
ANTI_BAN_BROADCAST_LIMIT=25
ANTI_BAN_BROADCAST_MIN_DELAY_MS=3500
ANTI_BAN_BROADCAST_MAX_DELAY_MS=9000

# ── Alertas admin ─────────────────────────────────────────────────────
ADMIN_ALERTS_ENABLED=true
ADMIN_ALERT_INTERVAL_MS=1200000
ADMIN_ALERT_MIN_CLUSTER_SIZE=2
`
  }

  function downloadEnv() {
    if (!serviceKey.trim()) { alert('Necesitas pegar la SERVICE ROLE KEY de Supabase antes de descargar.'); return }
    const blob = new Blob([buildEnv()], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = '.env'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  function downloadReadme() {
    const text = `# OXIDIAN Chatbot Local — Guía de instalación para: ${storeId}

## Requisitos
- Node.js 18 o superior (https://nodejs.org)
- WhatsApp en tu móvil

## Pasos
1. Descarga la carpeta portable de OXIDIAN (botón "Descargar carpeta chatbot" en esta página).
2. Descomprime la carpeta en tu PC (ej: C:\\oxidian-chatbot\\).
3. Mueve el archivo .env que descargaste a esa carpeta (junto a server.js).
4. Abre una terminal en la carpeta y ejecuta:
     npm install
5. Inicia el servidor:
     iniciar.bat   (Windows)
     node server.js  (cualquier sistema)
6. Abre el Admin de tu tienda → Chatbot → QR / Conexión → Obtener QR
7. Escanea el QR con WhatsApp → Menú → Dispositivos vinculados
8. ¡Listo! El chatbot está conectado a tu tienda ${storeId}.

## URL del admin chatbot
http://localhost:${port}/admin

## Notas de seguridad
- Nunca compartas tu SERVICE ROLE KEY ni tu .env con nadie.
- WA_SECRET debe coincidir con VITE_LOCAL_CHATBOT_SECRET en tu panel de OXIDIAN.
`
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'INSTRUCCIONES.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fieldStyle = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontFamily:'inherit', fontSize:'.82rem', fontWeight:700, color:'#1C3829', background:'#F9FAFB', boxSizing:'border-box' }
  const labelStyle = { fontSize:'.72rem', fontWeight:900, color:'#6B7280', marginBottom:4, display:'block' }
  const sectionStyle = { background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px 20px' }

  return (
    <div style={{ display:'grid', gap:16 }}>

      {/* Cabecera */}
      <div style={{ ...sectionStyle, background:'linear-gradient(135deg,#1C3829 0%,#2D6A4F 100%)', color:'white', border:'none' }}>
        <div style={{ fontWeight:900, fontSize:'1.05rem', marginBottom:6 }}>📦 Instala el chatbot en tu PC</div>
        <div style={{ fontSize:'.8rem', opacity:.85, lineHeight:1.5 }}>
          Descarga la carpeta portable OXIDIAN y el archivo <code style={{ background:'rgba(255,255,255,.15)', padding:'1px 6px', borderRadius:5 }}>.env</code> pre-configurado
          para tu tienda <b>{storeId}</b>. Solo necesitas Node.js instalado en tu PC.
        </div>
      </div>

      {/* Paso 1 — carpeta portable */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:900, color:'#1C3829', marginBottom:10, fontSize:'.9rem' }}>Paso 1 — Descargar la carpeta portable</div>
        <div style={{ fontSize:'.8rem', color:'#4B5563', marginBottom:12, lineHeight:1.5 }}>
          La carpeta portable contiene el servidor Node.js del chatbot. Es la misma para todas las tiendas OXIDIAN.
          Solo cambia el archivo <code>.env</code> que configurarás a continuación.
        </div>
        <a
          href="https://github.com/oxidian-saas/chatbot-portable/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#1C3829', color:'white', borderRadius:10, fontWeight:800, fontSize:'.82rem', textDecoration:'none' }}
        >
          ⬇️ Descargar carpeta chatbot portable
        </a>
        <div style={{ fontSize:'.7rem', color:'#9CA3AF', marginTop:8 }}>
          También puedes usar la carpeta <code>chatbot-local</code> que ya tienes en el proyecto OXIDIAN.
        </div>
      </div>

      {/* Paso 2 — configurar .env */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:900, color:'#1C3829', marginBottom:14, fontSize:'.9rem' }}>Paso 2 — Configura y descarga tu <code>.env</code></div>

        <div style={{ display:'grid', gap:12 }}>
          {/* Supabase URL — solo lectura */}
          <div>
            <label style={labelStyle}>SUPABASE URL <span style={{ color:'#9CA3AF', fontWeight:700 }}>(autocompletada)</span></label>
            <input value={supabaseUrl} readOnly style={{ ...fieldStyle, color:'#9CA3AF', cursor:'default' }} />
          </div>

          {/* Store ID — solo lectura */}
          <div>
            <label style={labelStyle}>STORE ID <span style={{ color:'#9CA3AF', fontWeight:700 }}>(autocompletado)</span></label>
            <input value={storeId} readOnly style={{ ...fieldStyle, color:'#9CA3AF', cursor:'default' }} />
          </div>

          {/* Service role key */}
          <div>
            <label style={labelStyle}>
              SUPABASE SERVICE ROLE KEY{' '}
              <span style={{ color:'#DC2626', fontWeight:900 }}>* obligatorio</span>
            </label>
            <div style={{ position:'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="eyJh... (Settings → API → service_role en Supabase)"
                value={serviceKey}
                onChange={e => setServiceKey(e.target.value)}
                style={{ ...fieldStyle, paddingRight:80 }}
              />
              <button
                onClick={() => setShowKey(s=>!s)}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:'.72rem', fontWeight:700, fontFamily:'inherit' }}
              >{showKey ? '🙈 Ocultar' : '👁 Ver'}</button>
            </div>
            <div style={{ fontSize:'.68rem', color:'#DC2626', marginTop:4 }}>
              ⚠️ Nunca compartas esta clave. Solo la necesitas aquí para generar el .env local.
            </div>
          </div>

          {/* Admin phone */}
          <div>
            <label style={labelStyle}>TELÉFONO ADMIN (escalaciones WhatsApp)</label>
            <input
              placeholder="34612345678 — sin + ni espacios"
              value={adminPhone}
              onChange={e => setAdminPhone(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {/* WA Secret */}
          <div>
            <label style={labelStyle}>WA_SECRET — clave de seguridad del servidor</label>
            <input
              placeholder="Clave que usará el admin para autenticar peticiones"
              value={waSecret}
              onChange={e => setWaSecret(e.target.value)}
              style={fieldStyle}
            />
            <div style={{ fontSize:'.68rem', color:'#6B7280', marginTop:3 }}>
              Debe coincidir con <code>VITE_LOCAL_CHATBOT_SECRET</code> en el .env del proyecto web OXIDIAN.
            </div>
          </div>

          {/* Puerto */}
          <div>
            <label style={labelStyle}>PUERTO del servidor</label>
            <input
              placeholder="3001"
              value={port}
              onChange={e => setPort(e.target.value)}
              style={{ ...fieldStyle, maxWidth:120 }}
            />
          </div>

          {/* AI Provider */}
          <div>
            <label style={labelStyle}>PROVEEDOR IA</label>
            <select value={aiProvider} onChange={e => {
              setAiProvider(e.target.value)
              const models = { gemini:'gemini-2.5-flash', groq:'llama-3.3-70b-versatile', anthropic:'claude-sonnet-4-20250514', huggingface:'meta-llama/Llama-3.1-8B-Instruct:cerebras', disabled:'', openai_compatible:'' }
              setAiModel(models[e.target.value] || '')
            }} style={fieldStyle}>
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq</option>
              <option value="anthropic">Anthropic / Claude</option>
              <option value="huggingface">Hugging Face</option>
              <option value="openai_compatible">OpenAI compatible</option>
              <option value="disabled">Solo motor local (sin IA)</option>
            </select>
          </div>

          {aiProvider !== 'disabled' && (
            <>
              <div>
                <label style={labelStyle}>API KEY del proveedor IA</label>
                <input
                  type="password"
                  placeholder="Pega aquí tu API key"
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>MODELO IA</label>
                <input
                  placeholder="gemini-2.5-flash"
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap' }}>
          <button
            onClick={downloadEnv}
            style={{ padding:'11px 22px', background: serviceKey.trim() ? '#1C3829' : '#9CA3AF', color:'white', border:'none', borderRadius:11, fontWeight:900, fontSize:'.85rem', cursor: serviceKey.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}
          >
            {downloaded ? '✅ .env descargado' : '⬇️ Descargar .env'}
          </button>
          <button
            onClick={downloadReadme}
            style={{ padding:'11px 18px', background:'white', color:'#1C3829', border:'1.5px solid #1C3829', borderRadius:11, fontWeight:800, fontSize:'.82rem', cursor:'pointer', fontFamily:'inherit' }}
          >
            📄 Descargar instrucciones
          </button>
        </div>
      </div>

      {/* Paso 3 — instrucciones rápidas */}
      <div style={{ ...sectionStyle, background:'#F0FDF4' }}>
        <div style={{ fontWeight:900, color:'#166534', marginBottom:10, fontSize:'.9rem' }}>Paso 3 — Instalar y arrancar</div>
        <ol style={{ margin:0, paddingLeft:20, fontSize:'.82rem', color:'#374151', lineHeight:2 }}>
          <li>Descomprime la carpeta portable en tu PC.</li>
          <li>Mueve el <code>.env</code> descargado a esa carpeta (junto a <code>server.js</code>).</li>
          <li>Abre una terminal en esa carpeta y ejecuta: <code style={{ background:'#D1FAE5', padding:'1px 6px', borderRadius:4 }}>npm install</code></li>
          <li>Inicia el servidor con: <code style={{ background:'#D1FAE5', padding:'1px 6px', borderRadius:4 }}>iniciar.bat</code> (Windows) o <code style={{ background:'#D1FAE5', padding:'1px 6px', borderRadius:4 }}>node server.js</code></li>
          <li>Vuelve aquí → pestaña <b>QR / Conexión</b> → escanea el QR con WhatsApp.</li>
        </ol>
        <div style={{ marginTop:12, padding:'10px 14px', background:'#DCFCE7', borderRadius:10, fontSize:'.78rem', color:'#166534', fontWeight:700 }}>
          ✅ WhatsApp seguirá funcionando de forma manual si no arrancas el servidor. El chatbot es opcional y se activa solo cuando está en línea.
        </div>
      </div>

    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function AdminChatbotTab({ storeId = 'default', capabilityScope = 'store' }) {
  const { isPhone } = useResponsiveAdminLayout()
  const isOxidianScope = capabilityScope === 'oxidian'
  const [activeTab,    setActiveTab]    = useState(isOxidianScope ? 'setup' : 'channel')
  const [enabled,      setEnabled]      = useState(false)
  const [rules,        setRules]        = useState(DEFAULT_RULES)
  const [saving,       setSaving]       = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [editIdx,      setEditIdx]      = useState(null)
  const [newRule,      setNewRule]      = useState({ trigger:'', response:'', active:true })
  const [addMode,      setAddMode]      = useState(false)
  const [testMsg,      setTestMsg]      = useState('')
  const [testResult,   setTestResult]   = useState(null)
  const [ruleSearch,   setRuleSearch]   = useState('')
  const [escalations,  setEscalations]  = useState([])
  const [loadingEsc,   setLoadingEsc]   = useState(false)
  const [botConnected, setBotConnected] = useState(false)
  const [serverTesting,setServerTesting]= useState(false)
  const [aiStatus,     setAiStatus]     = useState({ provider:'disabled', configured:false, model:'', temperature:0.85, baseUrl:'' })
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantLoading,  setAssistantLoading]  = useState(false)
  const [assistantResult,   setAssistantResult]   = useState(null)
  const [copyForm, setCopyForm] = useState({ targetName:'', objective:'product_description', tone:'premium_cercano', targetType:'', extraContext:'' })
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyResult,  setCopyResult]  = useState(null)
  const [playbookLoading, setPlaybookLoading] = useState(false)
  const [playbookResult,  setPlaybookResult]  = useState(null)
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [aiConfigSaving,  setAiConfigSaving]  = useState(false)
  const [showAiAdvanced, setShowAiAdvanced]   = useState(false)
  const [aiConfigForm,    setAiConfigForm]    = useState({
    adminPhone:'', provider:'gemini', apiKey:'', baseUrl:'', apiVersion:'',
    model:'gemini-2.5-flash', temperature:'0.9', timeoutMs:'15000',
    chatModel:'gemini-2.5-flash', chatTemperature:'0.9', chatTimeoutMs:'15000',
    adminModel:'gemini-2.5-flash', adminTemperature:'0.2', adminTimeoutMs:'12000', maskedKey:'',
  })
  const [inboxLoading,    setInboxLoading]    = useState(false)
  const [inboxResult,     setInboxResult]     = useState(null)
  const [reviewIntelLoading, setReviewIntelLoading] = useState(false)
  const [reviewIntelResult,  setReviewIntelResult]  = useState(null)
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignResult,  setCampaignResult]  = useState(null)
  const [campaignForm,    setCampaignForm]    = useState({ segment:'winback', objective:'reactivation' })
  useEffect(() => { loadSettings() }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab==='escalations') loadEscalations() }, [activeTab, storeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab==='ai') loadAiConfig() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'ai' && botConnected && !inboxResult) loadAIInbox()
  }, [activeTab, botConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSettings() {
    setLoading(true)
    const map = await loadMergedSettingsMap(storeId, supabase).catch(() => ({}))
    setEnabled(map.chatbot_enabled !== 'false')
    try {
      const saved = JSON.parse(map.chatbot_rules||'[]')
      if (saved.length) {
        const savedIds = new Set(saved.map(r=>r.id))
        const newDefs = DEFAULT_RULES.filter(r=>!savedIds.has(r.id))
        setRules([...saved,...newDefs])
      } else setRules(DEFAULT_RULES)
    } catch { setRules(DEFAULT_RULES) }
    setLoading(false)
    checkLocalServer()
  }

  async function checkLocalServer() {
    try {
      const r = await fetch(`${BOT_URL}/status`, { headers:{ 'x-secret': BOT_SECRET }, signal: AbortSignal.timeout(3000) })
      const d = await readBotJson(r, 'No se pudo leer el estado del bot')
      setBotConnected(!!(d.connected||d.ready||d.ok))
      setAiStatus(d.ai || { provider:'disabled', configured:false, model:'', temperature:0.85, baseUrl:'' })
    } catch {
      setBotConnected(false)
      setAiStatus({ provider:'disabled', configured:false, model:'', temperature:0.85, baseUrl:'' })
    }
  }

  async function testLocalServer() {
    setServerTesting(true)
    try {
      const r = await fetch(`${BOT_URL}/`, { signal: AbortSignal.timeout(4000) })
      const d = await readBotJson(r, 'No se pudo leer la respuesta del bot')
      if (d.ok||d.service) toast.success('✅ Servidor local OK — v' + (d.version||'?'))
      else toast.error('⚠️ Servidor responde pero con estado desconocido')
      const r2 = await fetch(`${BOT_URL}/status`, { headers:{ 'x-secret': BOT_SECRET } })
      const d2 = await readBotJson(r2, 'No se pudo leer el estado del bot')
      setBotConnected(!!(d2.connected||d2.ready))
      setAiStatus(d2.ai || { provider:'disabled', configured:false, model:'', temperature:0.85, baseUrl:'' })
      if (d2.connected||d2.ready) toast.success('📱 WhatsApp conectado ✓')
      else toast('📱 WhatsApp no vinculado — escanea el QR', { icon:'ℹ️' })
    } catch {
      toast.error('❌ Servidor no disponible — ¿ejecutaste iniciar.bat?')
      setBotConnected(false)
    } finally { setServerTesting(false) }
  }

  async function save() {
    setSaving(true)
    await Promise.all([
      upsertScopedSetting('chatbot_enabled', String(enabled), storeId, supabase),
      upsertScopedSetting('chatbot_rules', JSON.stringify(rules), storeId, supabase),
    ])
    try {
      await fetch(`${BOT_URL}/chatbot/reload`, { method:'POST', headers:{ 'x-secret':BOT_SECRET,'Content-Type':'application/json' } })
      toast.success('✅ Chatbot guardado y recargado en el servidor local')
    } catch {
      toast.success('✅ Guardado en Supabase (servidor local no disponible)')
    }
    setSaving(false)
  }

  async function loadEscalations() {
    setLoadingEsc(true)
    let response = await supabase.from('chatbot_conversations').select('*').eq('store_id', storeId).eq('resolved',false).order('updated_at',{ascending:false}).limit(30)
    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase.from('chatbot_conversations').select('*').eq('resolved',false).order('updated_at',{ascending:false}).limit(30)
    }
    setEscalations(response.data||[])
    setLoadingEsc(false)
  }

  async function takeover(phone, release=false) {
    try {
      await fetch(`${BOT_URL}/chatbot/takeover`, { method:'POST', headers:{ 'Content-Type':'application/json','x-secret':BOT_SECRET }, body: JSON.stringify({ phone, release }) })
    } catch {}
    let response = await supabase.from('chatbot_conversations').update({ admin_takeover:!release, resolved:release, updated_at: new Date().toISOString() }).eq('phone',phone).eq('store_id', storeId)
    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase.from('chatbot_conversations').update({ admin_takeover:!release, resolved:release, updated_at: new Date().toISOString() }).eq('phone',phone)
    }
    toast.success(release?'🤖 Bot reactivado':'🔒 Chat tomado — bot silenciado')
    loadEscalations()
  }

  async function markResolved(phone) {
    let response = await supabase.from('chatbot_conversations').update({ resolved:true, admin_takeover:false, updated_at: new Date().toISOString() }).eq('phone',phone).eq('store_id', storeId)
    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase.from('chatbot_conversations').update({ resolved:true, admin_takeover:false, updated_at: new Date().toISOString() }).eq('phone',phone)
    }
    toast.success('✅ Marcado como resuelto')
    loadEscalations()
  }

  function runTest() {
    if (!testMsg.trim()) return
    const msg = stripAccents(testMsg.toLowerCase().trim())
    const matched = findBestRule(rules, msg)
    setTestResult({ found:!!matched, rule:matched, preview: matched ? applyPreview(matched.response) : applyPreview('🔍 ¡Hola! No he encontrado una regla específica para ese mensaje.\n\nEl bot respondería con el fallback inteligente de intenciones (cancelar, estado, menú, horario, etc.).\n\nRevisa la pestaña *Reglas* para añadir una respuesta personalizada 👉 *{{web}}*') })
  }

  async function askAdminAssistant(questionOverride='') {
    const question = (questionOverride || assistantQuestion || '').trim()
    if (!question) { toast.error('Escribe una pregunta para la IA'); return }
    setAssistantLoading(true); setAssistantResult(null)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/ask`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-secret':BOT_SECRET }, body: JSON.stringify({ question }) })
      const d = await readBotJson(r, 'No se pudo consultar la IA')
      if (!r.ok) throw new Error(d.error || 'No se pudo consultar la IA')
      setAssistantQuestion(question); setAssistantResult(d)
      if (d.provider === 'local_fallback') toast('La IA del admin entró en modo respaldo local. Revisa cuota, latencia o respuesta del proveedor.', { icon:'ℹ️' })
    } catch (e) { toast.error(`Error IA admin: ${e.message}`) }
    finally { setAssistantLoading(false) }
  }

  async function generateAICopy() {
    if (!copyForm.targetName.trim()) { toast.error('Indica el producto, combo o club'); return }
    setCopyLoading(true); setCopyResult(null)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/generate-copy`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-secret':BOT_SECRET }, body: JSON.stringify(copyForm) })
      const d = await readBotJson(r, 'No se pudo generar el copy')
      if (!r.ok) throw new Error(d.error || 'No se pudo generar el copy')
      setCopyResult(d)
    } catch (e) { toast.error(`Error generando copy: ${e.message}`) }
    finally { setCopyLoading(false) }
  }

  async function generatePlaybook(focus='retention') {
    setPlaybookLoading(true); setPlaybookResult(null)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/playbook`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-secret':BOT_SECRET }, body: JSON.stringify({ focus }) })
      const d = await readBotJson(r, 'No se pudo generar el playbook')
      if (!r.ok) throw new Error(d.error || 'No se pudo generar el playbook')
      setPlaybookResult(d)
    } catch (e) { toast.error(`Error playbook IA: ${e.message}`) }
    finally { setPlaybookLoading(false) }
  }

  async function loadAiConfig() {
    setAiConfigLoading(true)
    try {
      const { response: r, data: d } = await fetchBotJson(`${BOT_URL}/chatbot/admin/ai-config`, { headers:{ 'x-secret': BOT_SECRET } }, 'No se pudo leer la configuracion AI')
      if (!r.ok) throw new Error(d.error || 'No se pudo leer la config AI')
      const ai = d.ai || {}
      const preset = getAIProviderPreset(ai.provider || 'gemini')
      setAiConfigForm({ adminPhone: ai.adminPhone || '', provider: ai.provider || 'gemini', apiKey:'', baseUrl: ai.baseUrl || '', apiVersion: ai.apiVersion || preset.apiVersion, model: ai.model || preset.model, temperature: String(ai.temperature ?? preset.temperature), timeoutMs: String(ai.timeoutMs ?? preset.timeoutMs), chatModel: ai.chatModel || ai.model || preset.model, chatTemperature: String(ai.chatTemperature ?? ai.temperature ?? preset.temperature), chatTimeoutMs: String(ai.chatTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs), adminModel: ai.adminModel || ai.model || preset.model, adminTemperature: String(ai.adminTemperature ?? 0.2), adminTimeoutMs: String(ai.adminTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs), maskedKey: ai.maskedKey || '' })
    } catch (e) {
      try {
        const { data: sd } = await fetchBotJson(`${BOT_URL}/status`, { headers:{ 'x-secret': BOT_SECRET }, signal: AbortSignal.timeout(3000) }, 'No se pudo leer el estado del bot')
        const ai = sd.ai || {}
        if (ai && Object.keys(ai).length > 0) {
          const preset = getAIProviderPreset(ai.provider || 'gemini')
          setAiConfigForm(prev => ({ ...prev, adminPhone: ai.adminPhone || prev.adminPhone || '', provider: ai.provider || prev.provider || 'gemini', apiKey: '', baseUrl: ai.baseUrl || prev.baseUrl || '', apiVersion: ai.apiVersion || prev.apiVersion || preset.apiVersion, model: ai.model || prev.model || preset.model, temperature: String(ai.temperature ?? prev.temperature ?? preset.temperature), timeoutMs: String(ai.timeoutMs ?? prev.timeoutMs ?? preset.timeoutMs), chatModel: ai.chatModel || prev.chatModel || ai.model || preset.model, chatTemperature: String(ai.chatTemperature ?? prev.chatTemperature ?? ai.temperature ?? preset.temperature), chatTimeoutMs: String(ai.chatTimeoutMs ?? prev.chatTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs), adminModel: ai.adminModel || prev.adminModel || ai.model || preset.model, adminTemperature: String(ai.adminTemperature ?? prev.adminTemperature ?? 0.2), adminTimeoutMs: String(ai.adminTimeoutMs ?? prev.adminTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs), maskedKey: ai.maskedKey || prev.maskedKey || '' }))
          toast('No pude abrir el endpoint de configuracion IA. Cargue la configuracion basica desde el estado del bot.', { icon:'ℹ️' })
          return
        }
      } catch {}
      toast.error(`Error leyendo config IA: ${e.message}`)
    } finally { setAiConfigLoading(false) }
  }

  async function saveAiConfig() {
    if (aiConfigForm.provider !== 'disabled' && !aiConfigForm.apiKey.trim() && !aiConfigForm.maskedKey) { toast.error('Pega una API key valida para el proveedor AI'); return }
    setAiConfigSaving(true)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/ai-config`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-secret':BOT_SECRET },
        body: JSON.stringify({ adminPhone: aiConfigForm.adminPhone.trim(), provider: aiConfigForm.provider, apiKey: aiConfigForm.apiKey.trim(), baseUrl: aiConfigForm.baseUrl.trim(), apiVersion: aiConfigForm.apiVersion.trim(), model: aiConfigForm.model.trim(), temperature: Number(aiConfigForm.temperature), timeoutMs: Number(aiConfigForm.timeoutMs), chatModel: aiConfigForm.chatModel.trim(), chatTemperature: Number(aiConfigForm.chatTemperature), chatTimeoutMs: Number(aiConfigForm.chatTimeoutMs), adminModel: aiConfigForm.adminModel.trim(), adminTemperature: Number(aiConfigForm.adminTemperature), adminTimeoutMs: Number(aiConfigForm.adminTimeoutMs) }),
      })
      const d = await readBotJson(r, 'No se pudo guardar la configuracion AI')
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar la configuracion AI')
      const ai = d.ai || {}
      const preset = getAIProviderPreset(ai.provider || aiConfigForm.provider || 'gemini')
      setAiStatus(ai)
      setAiConfigForm(prev => ({ ...prev, adminPhone: ai.adminPhone || prev.adminPhone || '', provider: ai.provider || prev.provider, apiKey:'', baseUrl: ai.baseUrl || prev.baseUrl, apiVersion: ai.apiVersion || prev.apiVersion || preset.apiVersion, maskedKey: ai.maskedKey || prev.maskedKey, model: ai.model || prev.model || preset.model, temperature: String(ai.temperature ?? prev.temperature ?? preset.temperature), timeoutMs: String(ai.timeoutMs ?? prev.timeoutMs ?? preset.timeoutMs), chatModel: ai.chatModel || prev.chatModel || ai.model || preset.model, chatTemperature: String(ai.chatTemperature ?? prev.chatTemperature ?? ai.temperature ?? preset.temperature), chatTimeoutMs: String(ai.chatTimeoutMs ?? prev.chatTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs), adminModel: ai.adminModel || prev.adminModel || ai.model || preset.model, adminTemperature: String(ai.adminTemperature ?? prev.adminTemperature ?? 0.2), adminTimeoutMs: String(ai.adminTimeoutMs ?? prev.adminTimeoutMs ?? ai.timeoutMs ?? preset.timeoutMs) }))
      toast.success('Configuracion AI guardada en el bot portable')
    } catch (e) { toast.error(`Error guardando configuracion AI: ${e.message}`) }
    finally { setAiConfigSaving(false) }
  }

  async function loadAIInbox() {
    setInboxLoading(true)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/inbox`, { headers:{ 'x-secret': BOT_SECRET } })
      const d = await readBotJson(r, 'No se pudo cargar la bandeja IA')
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la bandeja IA')
      setInboxResult(d)
    } catch (e) { toast.error(`Error AI Inbox: ${e.message}`) }
    finally { setInboxLoading(false) }
  }

  async function loadReviewIntelligence() {
    setReviewIntelLoading(true)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/review-intelligence`, { headers:{ 'x-secret': BOT_SECRET } })
      const d = await readBotJson(r, 'No se pudo cargar review intelligence')
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar review intelligence')
      setReviewIntelResult(d)
    } catch (e) { toast.error(`Error review intelligence: ${e.message}`) }
    finally { setReviewIntelLoading(false) }
  }

  async function generateCampaignDraftUI() {
    setCampaignLoading(true)
    try {
      const r = await fetch(`${BOT_URL}/chatbot/admin/campaign-draft`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-secret': BOT_SECRET }, body: JSON.stringify(campaignForm) })
      const d = await readBotJson(r, 'No se pudo generar la campaña')
      if (!r.ok) throw new Error(d.error || 'No se pudo generar la campaña')
      setCampaignResult(d)
    } catch (e) { toast.error(`Error campaña IA: ${e.message}`) }
    finally { setCampaignLoading(false) }
  }

  function applyAiProvider(provider) {
    const preset = getAIProviderPreset(provider)
    const previousPreset = getAIProviderPreset(aiConfigForm.provider)
    setAiConfigForm(current => ({ ...current, provider, baseUrl: current.baseUrl || preset.baseUrl, apiVersion: provider === 'anthropic' ? (current.apiVersion || preset.apiVersion) : preset.apiVersion, model: !current.model || current.model === previousPreset.model ? preset.model : current.model, temperature: !current.temperature ? preset.temperature : current.temperature, timeoutMs: !current.timeoutMs ? preset.timeoutMs : current.timeoutMs, chatModel: !current.chatModel || current.chatModel === previousPreset.model ? preset.model : current.chatModel, chatTemperature: !current.chatTemperature ? preset.temperature : current.chatTemperature, chatTimeoutMs: !current.chatTimeoutMs ? preset.timeoutMs : current.chatTimeoutMs, adminModel: !current.adminModel || current.adminModel === previousPreset.model ? preset.model : current.adminModel, adminTemperature: !current.adminTemperature ? '0.2' : current.adminTemperature, adminTimeoutMs: !current.adminTimeoutMs ? preset.timeoutMs : current.adminTimeoutMs }))
  }

  function toggleRule(idx)   { setRules(r=>r.map((x,i)=>i===idx?{...x,active:!x.active}:x)) }
  function deleteRule(idx)   { if(!window.confirm('¿Eliminar regla?'))return; setRules(r=>r.filter((_,i)=>i!==idx)) }
  function updateRule(idx,f,v){ setRules(r=>r.map((x,i)=>i===idx?{...x,[f]:v}:x)) }
  function addRule() {
    if (!newRule.trigger.trim()||!newRule.response.trim()) { toast.error('Rellena trigger y respuesta'); return }
    setRules(r=>[...r,{...newRule, id:Date.now().toString()}])
    setNewRule({ trigger:'', response:'', active:true }); setAddMode(false); toast.success('Regla añadida ✓')
  }
  function insertPlaceholder(field, token) {
    setNewRule(cur=>({...cur,[field]:`${cur[field]||''}${cur[field]?' ':''}${token}`}))
  }

  if (loading) return <div className={styles.loadingSpinner} />

  const pendingEsc  = escalations.filter(e=>!e.admin_takeover&&!e.resolved).length
  const activeCount = rules.filter(r=>r.active).length
  const visibleTabs = [
    { id:'channel', label:'Canal WA' },
    ...(isOxidianScope ? [{ id:'setup', label:'🖥️ Configuración' }] : []),
    { id:'qr', label:'📱 QR / Conexión' },
    { id:'rules', label:'📋 Reglas' },
    { id:'escalations', label:'🔔 Escalaciones', badge: pendingEsc },
    { id:'test', label:'🧪 Probar' },
    ...(isOxidianScope ? [
      { id:'ai', label:'🧠 IA Admin' },
      { id:'diag', label:'🔧 Diagnóstico' },
      { id:'portable', label:'📦 Portable' },
    ] : []),
  ]
  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || 'channel')
    }
  }, [activeTab, visibleTabs])
  const filteredRules = rules.filter(r => {
    const h = `${r.id||''} ${r.trigger||''} ${r.response||''}`.toLowerCase()
    return !ruleSearch.trim()||h.includes(ruleSearch.toLowerCase())
  })

  const tabStyle = (t) => ({
    padding:'8px 14px', borderRadius:10, fontWeight:800, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit',
    border: activeTab===t ? 'none' : '1.5px solid #E5E7EB',
    background: activeTab===t ? '#1C3829' : 'white',
    color: activeTab===t ? 'white' : '#374151',
    position:'relative',
  })

  return (
    <div>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:900, color:'#1C3829' }}>🤖 Centro WhatsApp y AI de la tienda</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:'.73rem', color:'#6B7280' }}>{activeCount} reglas activas</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 10px', borderRadius:99, fontSize:'.7rem', fontWeight:800, background: botConnected?'#D1FAE5':'#FEE2E2', color: botConnected?'#166534':'#991B1B' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />
              {botConnected?'Servidor local activo':'Servidor local inactivo'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div onClick={()=>setEnabled(e=>!e)} style={{ width:46, height:25, borderRadius:99, background:enabled?'#2D6A4F':'#D1D5DB', position:'relative', cursor:'pointer', transition:'background .2s' }}>
            <div style={{ position:'absolute', top:3, left:enabled?23:3, width:19, height:19, borderRadius:'50%', background:'white', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          <span style={{ fontWeight:800, fontSize:'.78rem', color:enabled?'#166534':'#6B7280' }}>{enabled?'✅ Activo':'⬜ Inactivo'}</span>
          <button onClick={testLocalServer} disabled={serverTesting} style={{ padding:'7px 14px', background:'#F3F4F6', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:'.76rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            {serverTesting?'⏳...':'🔌 Verificar servidor'}
          </button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 16px', background:'#1C3829', color:'white', border:'none', borderRadius:10, fontSize:'.8rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'⏳…':'💾 Guardar'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {visibleTabs.map(tabItem => (
          <button
            key={tabItem.id}
            style={{ ...tabStyle(tabItem.id) }}
            onClick={() => setActiveTab(tabItem.id)}
          >
            {tabItem.label}
            {tabItem.badge > 0 && (
              <span style={{ position:'absolute', top:-6, right:-6, background:'#DC2626', color:'white', borderRadius:'50%', width:17, height:17, fontSize:'.62rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {tabItem.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: CONFIGURACIÓN */}
      {activeTab==='setup' && (
        <div style={{ display:'grid', gap:14 }}>
          <DesktopRuntimePanel onRuntimeSync={checkLocalServer} />
          <SetupPanel botUrl={BOT_URL} botConnected={botConnected} />
        </div>
      )}

      {/* TAB: QR / CONEXIÓN */}
      {activeTab==='qr' && (
        <div>
          <QRPanel botUrl={BOT_URL} botSecret={BOT_SECRET} isConnected={botConnected} onStatusChange={setBotConnected} />
          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829', marginBottom:10 }}>📊 Estado del sistema</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
              {[
                { label:'Servidor local', value: botConnected?'🟢 Online':'🔴 Offline', bg: botConnected?'#D1FAE5':'#FEE2E2', color: botConnected?'#166534':'#991B1B' },
                { label:'WhatsApp', value: botConnected?'✅ Vinculado':'❌ Sin vincular', bg: botConnected?'#D1FAE5':'#FEE2E2', color: botConnected?'#166534':'#991B1B' },
                { label:'Bot', value: enabled?'✅ Activo':'⬜ Pausado', bg: enabled?'#DBEAFE':'#F3F4F6', color: enabled?'#1D4ED8':'#6B7280' },
                { label:'Reglas activas', value: activeCount, bg:'#F3F4F6', color:'#374151' },
                { label:'Escalaciones', value: pendingEsc, bg: pendingEsc>0?'#FEF3C7':'#F3F4F6', color: pendingEsc>0?'#92400E':'#374151' },
              ].map(c=>(
                <div key={c.label} style={{ background:c.bg, borderRadius:11, padding:'11px 13px' }}>
                  <div style={{ fontSize:'.63rem', fontWeight:900, color:c.color, textTransform:'uppercase', letterSpacing:'.06em' }}>{c.label}</div>
                  <div style={{ fontSize:'1rem', fontWeight:900, color:c.color, marginTop:4 }}>{c.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10, padding:'11px 14px', fontSize:'.75rem', color:'#0369A1', lineHeight:1.7 }}>
              <b>URL del servidor local:</b> <code style={{ fontFamily:'monospace', background:'#E0F2FE', padding:'1px 6px', borderRadius:4 }}>{BOT_URL}</code>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CANAL WA */}
      {activeTab==='channel' && (
        <div style={{ display:'grid', gap:14 }}>
          <div style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontWeight:900, fontSize:'.86rem', color:'#1C3829', marginBottom:6 }}>Todo el canal WhatsApp queda centralizado aquí</div>
            <div style={{ fontSize:'.75rem', lineHeight:1.65, color:'#6B7280' }}>Estado del gateway, plantillas automáticas y pruebas de envío viven en este mismo centro del chatbot para evitar pantallas separadas.</div>
          </div>
          <AdminWASettings storeId={storeId} />
        </div>
      )}

      {/* TAB: REGLAS */}
      {activeTab==='rules' && (
        <div>
          <div style={{ background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:12, padding:'11px 15px', marginBottom:14, fontSize:'.77rem', color:'#1E40AF', lineHeight:1.7 }}>
            <b>El bot gestiona automáticamente:</b> cancelaciones · estado en tiempo real · quejas → escala a admin · solicitudes de humano → escala · menú desde Supabase. Las reglas de abajo complementan con respuestas personalizadas.
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8, flexWrap:'wrap' }}>
            <input value={ruleSearch} onChange={e=>setRuleSearch(e.target.value)} placeholder="Buscar trigger o respuesta..."
              style={{ flex:1, minWidth:180, padding:'9px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit' }}/>
            <button onClick={()=>setAddMode(a=>!a)} style={{ padding:'8px 14px', background:addMode?'#FEE2E2':'#1C3829', color:addMode?'#DC2626':'white', border:'none', borderRadius:9, fontSize:'.76rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {addMode?'✕ Cancelar':'+ Nueva regla'}
            </button>
          </div>

          {addMode && (
            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:12, padding:14, marginBottom:12 }}>
              <input value={newRule.trigger} onChange={e=>setNewRule(r=>({...r,trigger:e.target.value}))} placeholder="Palabras clave separadas por comas: precio,cuánto,coste"
                style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #D1D5DB', borderRadius:9, fontSize:'.8rem', fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}/>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {RULE_PLACEHOLDER_CHIPS.map(c=>(
                  <button key={c.key} onClick={()=>insertPlaceholder('response',c.label)} style={{ padding:'4px 9px', borderRadius:99, border:'1px solid #D1D5DB', background:'#FFF', color:'#374151', fontSize:'.7rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea value={newRule.response} onChange={e=>setNewRule(r=>({...r,response:e.target.value}))} placeholder="Respuesta que verá el cliente... (usa {{web}}, {{review}}, {{instagram}}, {{affiliate}})"
                rows={3} style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #D1D5DB', borderRadius:9, fontSize:'.8rem', fontFamily:'inherit', marginBottom:8, boxSizing:'border-box', resize:'vertical' }}/>
              {newRule.response.trim() && (
                <div style={{ background:'white', border:'1px solid #D1D5DB', borderRadius:9, padding:'9px 12px', fontSize:'.76rem', color:'#374151', whiteSpace:'pre-wrap', lineHeight:1.5, marginBottom:8 }}>
                  <div style={{ fontSize:'.65rem', color:'#9CA3AF', fontWeight:800, marginBottom:4 }}>VISTA PREVIA</div>
                  {applyPreview(newRule.response)}
                </div>
              )}
              <button onClick={addRule} style={{ padding:'8px 18px', background:'#2D6A4F', color:'white', border:'none', borderRadius:9, fontSize:'.8rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>✓ Añadir regla</button>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filteredRules.map(rule => {
              const idx = rules.findIndex(r=>r.id===rule.id)
              return (
                <div key={rule.id||idx} style={{ background:'white', border:`1.5px solid ${rule.active?'#D1D5DB':'#F3F4F6'}`, borderRadius:12, padding:'11px 14px', opacity:rule.active?1:.55 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                    <div style={{ flex:1 }}>
                      {editIdx===idx ? (
                        <>
                          <input value={rule.trigger} onChange={e=>updateRule(idx,'trigger',e.target.value)} style={{ width:'100%', padding:'6px 10px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:'.76rem', fontFamily:'inherit', marginBottom:6, boxSizing:'border-box' }}/>
                          <textarea value={rule.response} onChange={e=>updateRule(idx,'response',e.target.value)} rows={3} style={{ width:'100%', padding:'6px 10px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:'.76rem', fontFamily:'inherit', boxSizing:'border-box', resize:'vertical' }}/>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize:'.68rem', color:'#9CA3AF', fontWeight:700, marginBottom:3 }}>🔑 {rule.trigger}</div>
                          <div style={{ fontSize:'.78rem', color:'#374151', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{applyPreview(rule.response)}</div>
                        </>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                      <button onClick={()=>toggleRule(idx)} style={{ padding:'3px 7px', border:'1.5px solid #E5E7EB', borderRadius:7, background:rule.active?'#D1FAE5':'#F3F4F6', cursor:'pointer', fontSize:'.7rem', fontWeight:800 }}>{rule.active?'✅':'⬜'}</button>
                      <button onClick={()=>setEditIdx(editIdx===idx?null:idx)} style={{ padding:'3px 7px', border:'1.5px solid #E5E7EB', borderRadius:7, background:'#EFF6FF', cursor:'pointer', fontSize:'.7rem', fontWeight:800 }}>{editIdx===idx?'✓':'✏️'}</button>
                      <button onClick={()=>deleteRule(idx)} style={{ padding:'3px 7px', border:'1.5px solid #FECACA', borderRadius:7, background:'#FEE2E2', cursor:'pointer', fontSize:'.7rem', color:'#DC2626', fontWeight:800 }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {filteredRules.length===0 && <div style={{ textAlign:'center', padding:30, color:'#9CA3AF', fontWeight:700 }}>No hay reglas para esa búsqueda.</div>}
          <button onClick={()=>{ if(window.confirm('¿Restaurar reglas por defecto?')) setRules(DEFAULT_RULES) }} style={{ marginTop:10, padding:'7px 14px', background:'#F3F4F6', color:'#374151', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:'.74rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            ↩ Restaurar defaults
          </button>
        </div>
      )}

      {/* TAB: ESCALACIONES */}
      {activeTab==='escalations' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829' }}>🔔 Conversaciones pendientes</div>
              <div style={{ fontSize:'.73rem', color:'#6B7280', marginTop:2 }}>El bot las detectó como urgentes. "Tomar el chat" silencia el bot para ese número. También puedes atender desde tu WhatsApp personal con: TOMAR numero, luego respondes normal, y cierras con RESOLVER. Si quieres pedirle información general a la tienda desde tu WhatsApp usa: BOT: tu pregunta.</div>
            </div>
            <button onClick={loadEscalations} style={{ padding:'7px 12px', background:'#F3F4F6', border:'1.5px solid #E5E7EB', borderRadius:9, fontSize:'.74rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>🔄 Actualizar</button>
          </div>
          {loadingEsc && <div style={{ textAlign:'center', color:'#9CA3AF', padding:20 }}>Cargando…</div>}
          {!loadingEsc && escalations.length===0 && (
            <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:8 }}>✅</div>
              <div style={{ fontWeight:700 }}>Sin escalaciones pendientes</div>
              <div style={{ fontSize:'.76rem', marginTop:4 }}>El chatbot está gestionando todo correctamente</div>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {escalations.map(conv => {
              const isTaken = conv.admin_takeover
              return (
                <div key={conv.id} style={{ background:isTaken?'#F0FDF4':'#FFFBEB', border:`2px solid ${isTaken?'#86EFAC':'#FDE68A'}`, borderRadius:14, padding:'14px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829' }}>{fmtPhone(conv.phone)}</span>
                        <span style={{ padding:'2px 8px', borderRadius:99, fontSize:'.67rem', fontWeight:800, background:isTaken?'#D1FAE5':'#FEF3C7', color:isTaken?'#166534':'#92400E' }}>
                          {isTaken?'🔒 Admin tomó el chat':'⚠️ Pendiente'}
                        </span>
                        <span style={{ fontSize:'.71rem', color:'#9CA3AF' }}>{timeAgo(conv.updated_at)}</span>
                      </div>
                      {conv.escalation_reason && <div style={{ fontSize:'.75rem', fontWeight:700, color:'#374151', marginBottom:5 }}>{conv.escalation_reason}</div>}
                      {conv.last_message && (
                        <div style={{ fontSize:'.77rem', color:'#6B7280', background:'rgba(0,0,0,.03)', borderRadius:8, padding:'7px 10px', borderLeft:'3px solid #D1D5DB', fontStyle:'italic', lineHeight:1.5 }}>
                          "{conv.last_message.slice(0,180)}{conv.last_message.length>180?'…':''}"
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7, flexShrink:0, minWidth:isPhone?0:145, width:isPhone?'100%':'auto' }}>
                      <a href={`https://wa.me/${rawDigits(conv.phone)}`} target="_blank" rel="noopener noreferrer" style={{ padding:'8px 14px', background:'#25D366', color:'white', borderRadius:9, fontSize:'.74rem', fontWeight:800, textDecoration:'none', textAlign:'center' }}>💬 Abrir en WhatsApp</a>
                      {!isTaken
                        ? <button onClick={()=>takeover(conv.phone,false)} style={{ padding:'8px 14px', background:'#1C3829', color:'white', border:'none', borderRadius:9, fontSize:'.74rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>🔒 Tomar el chat</button>
                        : <button onClick={()=>takeover(conv.phone,true)} style={{ padding:'8px 14px', background:'#6B7280', color:'white', border:'none', borderRadius:9, fontSize:'.74rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>🤖 Liberar al bot</button>
                      }
                      <button onClick={()=>markResolved(conv.phone)} style={{ padding:'8px 14px', background:'white', color:'#374151', border:'1.5px solid #D1D5DB', borderRadius:9, fontSize:'.74rem', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>✅ Marcar resuelto</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB: TEST */}
      {activeTab==='test' && (
        <div>
          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
            <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829', marginBottom:12 }}>🧪 Probar respuestas del bot</div>
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <input value={testMsg} onChange={e=>setTestMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runTest()} placeholder='Escribe un mensaje de prueba: "mi pedido", "cancelar", "precio"...'
                style={{ flex:1, minWidth:200, padding:'10px 13px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.82rem', fontFamily:'inherit' }}/>
              <button onClick={runTest} style={{ padding:'10px 20px', background:'#1C3829', color:'white', border:'none', borderRadius:10, fontWeight:800, fontSize:'.82rem', cursor:'pointer', fontFamily:'inherit' }}>▶ Probar</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
              {['hola','mi pedido','cancelar','menú','precio','horario','hablar','queja','gracias'].map(s=>(
                <button key={s} onClick={()=>{ setTestMsg(s); setTimeout(runTest,50) }} style={{ padding:'5px 11px', borderRadius:99, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#374151', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {s}
                </button>
              ))}
            </div>
            {testResult && (
              <div>
                <div style={{ background: testResult.found?'#F0FDF4':'#FEF3C7', border:`1.5px solid ${testResult.found?'#86EFAC':'#FCD34D'}`, borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontWeight:900, fontSize:'.8rem', color: testResult.found?'#166534':'#92400E', marginBottom:8 }}>
                    {testResult.found ? `✅ Regla encontrada: "${testResult.rule?.id||'intención'}"` : '⚠️ Sin regla específica — respondería con fallback inteligente'}
                  </div>
                  <div style={{ background:'white', borderRadius:10, padding:'12px', fontSize:'.8rem', whiteSpace:'pre-wrap', lineHeight:1.6, color:'#1F2937', border:'1px solid rgba(0,0,0,.06)' }}>
                    {testResult.preview}
                  </div>
                  {testResult.rule && (
                    <div style={{ marginTop:8, fontSize:'.72rem', color:'#6B7280' }}>
                      🔑 Trigger: <code style={{ fontFamily:'monospace', background:'#F3F4F6', padding:'1px 5px', borderRadius:4 }}>{testResult.rule.trigger}</code>
                    </div>
                  )}
                </div>
                <div style={{ marginTop:10, background:'#EFF6FF', borderRadius:10, padding:'11px 14px', fontSize:'.75rem', color:'#1E40AF', lineHeight:1.7 }}>
                  <b>💡 Nota:</b> Las intenciones del bot (cancelar, estado, menú, horario, etc.) se resuelven en el servidor antes de revisar las reglas personalizadas. Para probar intenciones en vivo, usa el servidor con WhatsApp real.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: IA ADMIN */}
      {activeTab==='ai' && (
        <div style={{ display:'grid', gap:16 }}>
          <div style={{ background:'linear-gradient(135deg,#0f1923,#1c3829)', borderRadius:16, padding:'18px 20px', color:'white' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:900, fontSize:'1rem', color:'#D4AF37' }}>IA distribuida para ventas y admin</div>
                <div style={{ fontSize:'.76rem', opacity:.78, marginTop:4, maxWidth:620 }}>Consulta ventas reales, detecta productos flojos, pide opiniones de negocio y genera copy promocional sobre stock y combos actualizados.</div>
              </div>
              <div style={{ display:'grid', gap:8, minWidth:isPhone ? '100%' : 260 }}>
                {[
                  { label:'PROVEEDOR', value: aiStatus.configured ? `${getAIProviderLabel(aiStatus.provider)} · ${aiStatus.model || 'modelo activo'}` : 'Modo local de respaldo' },
                  { label:'PERFILES', value: `Chat: ${aiStatus.chatModel || aiStatus.model || 'default'}\nAdmin: ${aiStatus.adminModel || aiStatus.model || 'default'}` },
                  { label:'TEMPERATURA', value: Number(aiStatus.temperature || 0.85).toFixed(2) },
                  { label:'ENDPOINT', value: aiStatus.baseUrl || `${getAIProviderLabel(aiStatus.provider)} endpoint por defecto` },
                ].map(card => (
                  <div key={card.label} style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'10px 12px' }}>
                    <div style={{ fontSize:'.65rem', fontWeight:900, letterSpacing:'.08em', opacity:.7 }}>{card.label}</div>
                    <div style={{ fontSize:'.85rem', fontWeight:800, marginTop:4, whiteSpace:'pre-wrap', lineHeight:1.4 }}>{card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ajuste rápido de IA */}
          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829' }}>Ajuste rápido de IA</div>
                <div style={{ fontSize:'.74rem', color:'#6B7280', marginTop:4 }}>Proveedor, clave, modelo y temperatura en un bloque corto.</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={loadAiConfig} disabled={aiConfigLoading || !botConnected} style={{ padding:'8px 13px', border:'1px solid #E5E7EB', background:'#F9FAFB', borderRadius:10, fontWeight:800, fontSize:'.74rem', cursor:aiConfigLoading||!botConnected ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity:aiConfigLoading||!botConnected ? .6 : 1 }}>
                  {aiConfigLoading ? 'Cargando...' : 'Refrescar'}
                </button>
                <button type='button' onClick={()=>setShowAiAdvanced(v=>!v)} style={{ padding:'8px 13px', border:'1px solid #D1D5DB', background:'white', borderRadius:10, fontWeight:800, fontSize:'.74rem', cursor:'pointer', fontFamily:'inherit', color:'#374151' }}>
                  {showAiAdvanced ? 'Ocultar avanzado' : 'Mostrar avanzado'}
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : '1fr 1.25fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:'.67rem', fontWeight:900, color:'#6B7280', marginBottom:6, letterSpacing:'.08em' }}>PROVEEDOR</label>
                <select value={aiConfigForm.provider} onChange={e=>applyAiProvider(e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit', boxSizing:'border-box' }}>
                  {AI_PROVIDER_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.67rem', fontWeight:900, color:'#6B7280', marginBottom:6, letterSpacing:'.08em' }}>API KEY</label>
                <input type='password' value={aiConfigForm.apiKey} onChange={e=>setAiConfigForm(f=>({ ...f, apiKey:e.target.value }))} placeholder={aiConfigForm.maskedKey || getAIProviderPreset(aiConfigForm.provider).keyPlaceholder} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.82rem', fontFamily:'inherit', boxSizing:'border-box' }} />
                {aiConfigForm.maskedKey && <div style={{ marginTop:6, fontSize:'.69rem', color:'#6B7280' }}>Actual: {aiConfigForm.maskedKey}</div>}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : '1.5fr .7fr auto', gap:12, alignItems:'end', marginTop:12 }}>
              <div>
                <label style={{ display:'block', fontSize:'.67rem', fontWeight:900, color:'#6B7280', marginBottom:6, letterSpacing:'.08em' }}>MODELO PRINCIPAL</label>
                <input value={aiConfigForm.model} onChange={e=>setAiConfigForm(f=>({ ...f, model:e.target.value }))} placeholder={getAIProviderPreset(aiConfigForm.provider).modelPlaceholder} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.67rem', fontWeight:900, color:'#6B7280', marginBottom:6, letterSpacing:'.08em' }}>TEMPERATURA</label>
                <input type='number' min='0' max='1.2' step='0.05' value={aiConfigForm.temperature} onChange={e=>setAiConfigForm(f=>({ ...f, temperature:e.target.value }))} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <button onClick={saveAiConfig} disabled={aiConfigSaving || !botConnected} style={{ padding:'10px 16px', background:aiConfigSaving||!botConnected ? '#9CA3AF' : '#1C3829', color:'white', border:'none', borderRadius:10, fontWeight:900, fontSize:'.8rem', cursor:aiConfigSaving||!botConnected ? 'not-allowed' : 'pointer', fontFamily:'inherit', minHeight:42 }}>
                {aiConfigSaving ? 'Guardando...' : 'Guardar IA'}
              </button>
            </div>
            <div style={{ marginTop:12, background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:12, padding:'10px 11px', fontSize:'.73rem', color:'#166534', lineHeight:1.6 }}>
              El número admin y la personalidad del negocio se gestionan en Ajustes generales. Este bloque solo cambia el motor de IA del bot portable.
            </div>
          </div>

          {showAiAdvanced && (
          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
            <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829', marginBottom:10 }}>🔧 Configuración AI avanzada</div>
            <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap:10, alignItems:'end' }}>
              {[
                { key:'baseUrl', label:'BASE URL', placeholder: getAIProviderPreset(aiConfigForm.provider).baseUrlPlaceholder },
                { key:'apiVersion', label:'API VERSION', placeholder:'2023-06-01' },
                { key:'chatModel', label:'MODELO CHAT', placeholder: getAIProviderPreset(aiConfigForm.provider).modelPlaceholder },
                { key:'chatTemperature', label:'TEMP CHAT', type:'number' },
                { key:'chatTimeoutMs', label:'TIMEOUT CHAT', type:'number' },
                { key:'adminPhone', label:'WHATSAPP ADMIN', placeholder:'34622663874' },
                { key:'adminModel', label:'MODELO ADMIN', placeholder: getAIProviderPreset(aiConfigForm.provider).modelPlaceholder },
                { key:'adminTemperature', label:'TEMP ADMIN', type:'number' },
                { key:'adminTimeoutMs', label:'TIMEOUT ADMIN', type:'number' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display:'block', fontSize:'.67rem', fontWeight:900, color:'#6B7280', marginBottom:6, letterSpacing:'.08em' }}>{field.label}</label>
                  <input type={field.type || 'text'} value={aiConfigForm[field.key] || ''} onChange={e=>setAiConfigForm(f=>({ ...f, [field.key]:e.target.value }))} placeholder={field.placeholder || ''} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:8, fontSize:'.72rem', color:'#6B7280', lineHeight:1.6 }}>
              Usa un perfil rápido para conversación y uno más frío para admin. El WhatsApp admin recibe escalaciones, permite relay con clientes y también te deja hablar con la tienda para consultas generales cuando no tengas un chat tomado.
            </div>
          </div>
          )}

          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
            <div style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829', marginBottom:8 }}>📈 Pregunta al asistente del admin</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {['¿Cuál es el producto menos vendido este mes?','Genera un resumen de ventas del club de fidelidad','¿Qué combo debería revisar por margen o rotación?'].map(q => (
                <button key={q} onClick={() => askAdminAssistant(q)} style={{ padding:'7px 11px', borderRadius:999, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#374151', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>{q}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
              <textarea value={assistantQuestion} onChange={e=>setAssistantQuestion(e.target.value)} placeholder='Ej: ¿Qué producto debería empujar esta semana y cuál revisar de precio?' rows={4} style={{ flex:1, minWidth:240, padding:'11px 13px', border:'1.5px solid #D1D5DB', borderRadius:12, fontSize:'.82rem', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
              <button onClick={() => askAdminAssistant()} disabled={assistantLoading || !botConnected} style={{ padding:'11px 18px', background:assistantLoading||!botConnected ? '#9CA3AF' : '#1C3829', color:'white', border:'none', borderRadius:12, fontWeight:900, fontSize:'.82rem', cursor:assistantLoading||!botConnected ? 'not-allowed' : 'pointer', fontFamily:'inherit', minWidth:140 }}>
                {assistantLoading ? '⏳ Analizando...' : 'Consultar IA'}
              </button>
            </div>
            {assistantResult && (
              <div style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:12, padding:'14px 15px' }}>
                <div style={{ fontSize:'.68rem', fontWeight:900, color:'#6B7280', letterSpacing:'.08em', marginBottom:8 }}>RESPUESTA {assistantResult.provider === 'local_fallback' ? 'LOCAL' : String(assistantResult.provider || 'AI').toUpperCase()}</div>
                <div style={{ fontSize:'.84rem', color:'#1F2937', lineHeight:1.65, whiteSpace:'pre-wrap' }}>{assistantResult.answer}</div>
                {!!assistantResult.bullets?.length && <div style={{ marginTop:10, display:'grid', gap:6 }}>{assistantResult.bullets.map((b,i) => <div key={i} style={{ fontSize:'.77rem', color:'#374151', lineHeight:1.55 }}>• {b}</div>)}</div>}
                {assistantResult.recommendation && <div style={{ marginTop:12, background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:10, padding:'10px 12px', fontSize:'.76rem', color:'#166534', lineHeight:1.6 }}><b>Recomendación:</b> {assistantResult.recommendation}</div>}
              </div>
            )}
          </div>

          <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
            <div style={{ fontWeight:900, fontSize:'.88rem', color:'#1C3829', marginBottom:8 }}>✨ Generador de copy</div>
            <div style={{ display:'grid', gap:10 }}>
              <input value={copyForm.targetName} onChange={e=>setCopyForm(f=>({ ...f, targetName:e.target.value }))} placeholder='Producto, combo o club' style={{ padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.82rem', fontFamily:'inherit' }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8 }}>
                <select value={copyForm.objective} onChange={e=>setCopyForm(f=>({ ...f, objective:e.target.value }))} style={{ padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit' }}>
                  <option value='product_description'>Descripción de producto</option>
                  <option value='club_promo'>Promo de club</option>
                  <option value='whatsapp_offer'>Oferta WhatsApp</option>
                </select>
                <select value={copyForm.tone} onChange={e=>setCopyForm(f=>({ ...f, tone:e.target.value }))} style={{ padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit' }}>
                  <option value='premium_cercano'>Premium cercano</option>
                  <option value='directo_vendedor'>Directo vendedor</option>
                  <option value='instagram_hook'>Gancho Instagram</option>
                </select>
              </div>
              <textarea value={copyForm.extraContext} onChange={e=>setCopyForm(f=>({ ...f, extraContext:e.target.value }))} rows={3} placeholder='Extra: destacar novedad, club-only, sabor, precio, escasez, etc.' style={{ padding:'10px 12px', border:'1.5px solid #D1D5DB', borderRadius:10, fontSize:'.8rem', fontFamily:'inherit', resize:'vertical' }} />
              <button onClick={generateAICopy} disabled={copyLoading || !botConnected} style={{ padding:'11px 18px', background:copyLoading||!botConnected ? '#9CA3AF' : '#2D6A4F', color:'white', border:'none', borderRadius:12, fontWeight:900, fontSize:'.82rem', cursor:copyLoading||!botConnected ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                {copyLoading ? '⏳ Generando...' : 'Generar copy'}
              </button>
            </div>
            {copyResult?.copy && (
              <div style={{ marginTop:14, display:'grid', gap:10 }}>
                {[['Titular', copyResult.copy.headline],['Descripción corta', copyResult.copy.shortDescription],['Descripción larga', copyResult.copy.longDescription],['WhatsApp', copyResult.copy.whatsappText],['Instagram', copyResult.copy.instagramCaption]].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label} style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:10, padding:'11px 12px' }}>
                    <div style={{ fontSize:'.66rem', fontWeight:900, color:'#6B7280', letterSpacing:'.08em', marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:'.79rem', color:'#1F2937', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Broadcast eliminado — riesgo anti-ban. Gestión de campañas via Supabase Edge Functions. */}
        </div>
      )}

      {/* TAB: DIAGNÓSTICO */}
      {activeTab==='diag' && (
        <div style={{ background:'white', border:'1.5px solid #E5E7EB', borderRadius:14, padding:'18px' }}>
          <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829', marginBottom:12 }}>🔧 Diagnóstico del servidor</div>
          <div style={{ display:'grid', gap:10 }}>
            <div style={{ background:'#F8FAFC', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:900, color:'#6B7280', marginBottom:4 }}>URL DEL BOT LOCAL</div>
              <code style={{ fontFamily:'monospace', fontSize:'.82rem', color:'#1C3829' }}>{BOT_URL || 'No configurada'}</code>
            </div>
            <div style={{ background:'#F8FAFC', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:900, color:'#6B7280', marginBottom:4 }}>ESTADO</div>
              <span style={{ fontWeight:800, color: botConnected ? '#166534' : '#991B1B' }}>{botConnected ? '✅ Conectado' : '❌ Desconectado'}</span>
            </div>
            <button onClick={testLocalServer} disabled={serverTesting} style={{ padding:'10px 18px', background:'#1C3829', color:'white', border:'none', borderRadius:10, fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:'.82rem' }}>
              {serverTesting ? '⏳ Verificando...' : '🔌 Verificar servidor ahora'}
            </button>
          </div>
        </div>
      )}

      {/* TAB: PORTABLE */}
      {activeTab==='portable' && (
        <PortableDownloadTab storeId={storeId} />
      )}
    </div>
  )
}
