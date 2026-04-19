import React from 'react'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'
import { getChatbotDownloadUrl } from '../../../shared/lib/supabaseApi'
import {
  Actions, Button, GhostButton, Grid,
  Notice, Panel, Stats,
} from '../../../shared/ui/ControlDeck'

/**
 * ChatbotAuthManager
 * Gestiona la autorización del chatbot portable por sede.
 * - Autorizar/revocar: escribe en la tabla branches (chatbot_authorized)
 * - Descargar ZIP: llama al endpoint Flask en Vercel (/api/backend/admin/chatbot/download/:id)
 */
export default function ChatbotAuthManager() {
  const { session } = useAuth()
  const [branches, setBranches] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [busy,     setBusy]     = React.useState(null)
  const [notice,   setNotice]   = React.useState(null) // {type:'ok'|'err', msg}
  const [filter,   setFilter]   = React.useState('all') // 'all' | 'authorized' | 'pending'

  // ── Cargar sedes con estado de chatbot ──────────────────────────
  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabaseAuth
        .from('branches')
        .select(`
          id, name, slug, store_id, tenant_id, status,
          chatbot_authorized, chatbot_authorized_at, chatbot_last_seen,
          stores(name, slug)
        `)
        .eq('status', 'active')
        .order('chatbot_authorized', { ascending: false })
        .order('name')
      if (error) throw error
      setBranches(data || [])
    } catch (e) {
      setNotice({ type: 'err', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  // ── Autorizar sede ───────────────────────────────────────────────
  async function authorize(branchId) {
    setBusy(branchId); setNotice(null)
    try {
      const { error } = await supabaseAuth.from('branches').update({
        chatbot_authorized:    true,
        chatbot_authorized_at: new Date().toISOString(),
      }).eq('id', branchId)
      if (error) throw error
      setNotice({ type: 'ok', msg: 'Chatbot autorizado. Ya puede descargar el portable.' })
      await load()
    } catch (e) { setNotice({ type: 'err', msg: e.message }) }
    setBusy(null)
  }

  // ── Revocar sede ─────────────────────────────────────────────────
  async function revoke(branchId) {
    if (!window.confirm('¿Revocar acceso al chatbot de esta sede?')) return
    setBusy(branchId); setNotice(null)
    try {
      const { error } = await supabaseAuth.from('branches').update({
        chatbot_authorized: false,
      }).eq('id', branchId)
      if (error) throw error
      setNotice({ type: 'ok', msg: 'Acceso revocado.' })
      await load()
    } catch (e) { setNotice({ type: 'err', msg: e.message }) }
    setBusy(null)
  }

  // ── Descargar ZIP del chatbot portable ──────────────────────────
  function downloadZip(branchId, storeSlug, branchSlug) {
    const url = getChatbotDownloadUrl(branchId)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `oxidian-chatbot-${storeSlug || 'store'}-${branchSlug || branchId}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ── Filtered list ────────────────────────────────────────────────
  const visible = branches.filter(b => {
    if (filter === 'authorized') return b.chatbot_authorized
    if (filter === 'pending')    return !b.chatbot_authorized
    return true
  })
  const authorizedCount = branches.filter(b => b.chatbot_authorized).length

  return (
    <div>
      <Stats items={[
        { label:'Total sedes',    value: String(branches.length),      hint:'Sedes activas en la plataforma' },
        { label:'Autorizadas',    value: String(authorizedCount),       hint:'Con chatbot portable habilitado' },
        { label:'Sin autorizar',  value: String(branches.length - authorizedCount), hint:'Sin chatbot o no lo necesitan' },
      ]} />

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, margin:'16px 0' }}>
        {[['all','Todas'],['authorized','Autorizadas'],['pending','Sin autorizar']].map(([v,l]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} style={{
            padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit',
            border: filter===v ? 'none' : '1px solid var(--color-border-secondary)',
            background: filter===v ? 'var(--color-text-primary)' : 'transparent',
            color: filter===v ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
          }}>{l}</button>
        ))}
      </div>

      {/* Notices */}
      {notice?.type === 'ok'  && <Notice tone="success" style={{ marginBottom:12 }}>{notice.msg}</Notice>}
      {notice?.type === 'err' && <Notice tone="error"   style={{ marginBottom:12 }}>{notice.msg}</Notice>}

      {/* Lista */}
      {loading && <Notice>Cargando sedes…</Notice>}
      {!loading && !visible.length && <Notice>Sin sedes en este filtro.</Notice>}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {visible.map(b => {
          const storeSlug  = b.stores?.slug  || b.store_id
          const storeName  = b.stores?.name  || b.store_id
          const authorized = Boolean(b.chatbot_authorized)

          return (
            <div key={b.id} style={{
              padding:'14px 16px', borderRadius:12,
              border: authorized
                ? '1px solid #22c55e40'
                : '1px solid var(--color-border-tertiary)',
              background: authorized
                ? '#f0fdf4'
                : 'var(--color-background-primary)',
              display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap',
            }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16 }}>{authorized ? '🟢' : '⚫'}</span>
                  <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                </div>
                <div style={{ fontSize:12, color:'#666', marginTop:3 }}>
                  {storeName} · {b.slug}
                  {b.chatbot_last_seen && (
                    <span> · visto {new Date(b.chatbot_last_seen).toLocaleDateString('es-ES')}</span>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                {authorized ? (
                  <>
                    <button type="button" disabled={busy===b.id}
                      onClick={() => downloadZip(b.id, storeSlug, b.slug)}
                      style={{ padding:'6px 12px', fontSize:12, borderRadius:8, cursor:'pointer',
                        fontFamily:'inherit', border:'1px solid #22c55e', background:'#22c55e',
                        color:'#fff', fontWeight:600 }}>
                      📦 Descargar ZIP
                    </button>
                    <button type="button" disabled={busy===b.id} onClick={() => revoke(b.id)}
                      style={{ padding:'6px 12px', fontSize:12, borderRadius:8, cursor:'pointer',
                        fontFamily:'inherit', border:'1px solid #dc2626',
                        background:'transparent', color:'#dc2626' }}>
                      Revocar
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={busy===b.id} onClick={() => authorize(b.id)}
                    style={{ padding:'7px 16px', fontSize:12, borderRadius:8, cursor:'pointer',
                      fontFamily:'inherit', border:'none',
                      background:'var(--color-text-primary)', color:'var(--color-background-primary)',
                      fontWeight:600 }}>
                    {busy===b.id ? 'Procesando…' : 'Autorizar'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop:16, padding:'12px 14px', borderRadius:10,
        background:'var(--color-background-secondary)', fontSize:12,
        color:'var(--color-text-secondary)', lineHeight:1.7 }}>
        <strong>¿Cómo funciona?</strong><br />
        1. Autoriza la sede pulsando el botón.<br />
        2. Descarga el ZIP del chatbot portable.<br />
        3. El dueño/manager lo ejecuta en su PC o servidor con <code>iniciar.bat</code> (Windows) o <code>iniciar.sh</code> (Mac/Linux).<br />
        4. Escanea el QR con WhatsApp y el bot queda activo para esa sede.
      </div>
    </div>
  )
}
