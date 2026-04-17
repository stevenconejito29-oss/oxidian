import React from 'react'
import { useAuth } from '../../../core/providers/AuthProvider'
import {
  Actions, Button, GhostButton, Grid,
  Notice, Panel, Stats,
} from '../../../shared/ui/ControlDeck'

/**
 * ChatbotAuthManager — Panel de Super Admin para autorizar/revocar
 * el chatbot portable por branch. Se incluye en SuperAdminPage.
 */
export default function ChatbotAuthManager() {
  const { session } = useAuth()
  const [branches, setBranches] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState('')

  const load = async () => {
    setLoading(true)
    const token = session?.access_token || ''
    const res = await fetch('/admin/chatbot/authorizations', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    setBranches(Array.isArray(json) ? json : [])
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])

  async function callAction(path, method = 'POST', body = {}) {
    const token = session?.access_token || ''
    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function authorize(branchId) {
    setBusy(branchId); setError(''); setResult(null)
    try {
      const data = await callAction(`/admin/chatbot/authorize/${branchId}`, 'POST',
        { note: 'Autorizado desde Super Admin panel' })
      setResult({ type: 'authorized', branchId, data })
      load()
    } catch (err) { setError(err.message) }
    setBusy(null)
  }

  async function revoke(branchId) {
    if (!confirm('¿Revocar acceso al chatbot de esta sede?')) return
    setBusy(branchId); setError(''); setResult(null)
    try {
      await callAction(`/admin/chatbot/revoke/${branchId}`, 'POST')
      setResult({ type: 'revoked', branchId })
      load()
    } catch (err) { setError(err.message) }
    setBusy(null)
  }

  async function regenerateSecret(branchId) {
    if (!confirm('¿Regenerar el secreto? El portable actual dejará de funcionar hasta re-configurarlo.')) return
    setBusy(branchId); setError('')
    try {
      const data = await callAction(`/admin/chatbot/regenerate-secret/${branchId}`, 'POST')
      setResult({ type: 'secret', data })
    } catch (err) { setError(err.message) }
    setBusy(null)
  }

  async function downloadPortable(branchId) {
    const token = session?.access_token || ''
    const link = document.createElement('a')
    link.href = `/admin/chatbot/download/${branchId}?token=${token}`
    link.download = `oxidian-chatbot-${branchId}.zip`
    link.click()
  }

  const authorized = branches.filter(b => b.chatbot_authorized)
  const pending = branches.filter(b => !b.chatbot_authorized)

  return (
    <div>
      <Stats items={[
        { label: 'Total sedes', value: String(branches.length), hint: 'Sedes registradas en el sistema' },
        { label: 'Autorizadas', value: String(authorized.length), hint: 'Con chatbot portable habilitado' },
        { label: 'Sin autorizar', value: String(pending.length), hint: 'Esperan aprobación o no lo necesitan' },
      ]} />

      {error && <Notice tone="error" style={{ marginTop: 12 }}>{error}</Notice>}
      {result?.type === 'authorized' && (
        <Notice tone="success">
          Chatbot autorizado. La sede ya puede descargar su portable desde su panel.
        </Notice>
      )}
      {result?.type === 'revoked' && <Notice tone="error">Acceso revocado.</Notice>}
      {result?.type === 'secret' && (
        <Notice tone="success">
          Nuevo secreto: <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{result.data?.wa_secret}</code>
        </Notice>
      )}

      <Grid>
        <Panel title="Sedes autorizadas" dark>
          {loading && <Notice>Cargando...</Notice>}
          {!loading && authorized.length === 0 && (
            <Notice>Ninguna sede autorizada todavía.</Notice>
          )}
          {authorized.map(branch => (
            <div key={branch.id} style={{
              padding: '10px 0', borderBottom: '1px solid var(--color-border-tertiary)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>🟢 {branch.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {branch.store_id} · {branch.slug}
                    {branch.chatbot_last_seen && ` · visto ${new Date(branch.chatbot_last_seen).toLocaleDateString('es-ES')}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <GhostButton type="button" disabled={busy === branch.id}
                  style={{ padding: '3px 10px', fontSize: 11 }}
                  onClick={() => downloadPortable(branch.id)}>
                  📦 Descargar ZIP
                </GhostButton>
                <GhostButton type="button" disabled={busy === branch.id}
                  style={{ padding: '3px 10px', fontSize: 11 }}
                  onClick={() => regenerateSecret(branch.id)}>
                  🔄 Regenerar secreto
                </GhostButton>
                <GhostButton type="button" disabled={busy === branch.id}
                  style={{ padding: '3px 10px', fontSize: 11, color: '#dc2626' }}
                  onClick={() => revoke(branch.id)}>
                  Revocar
                </GhostButton>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Sedes sin autorizar">
          {loading && <Notice>Cargando...</Notice>}
          {!loading && pending.length === 0 && (
            <Notice tone="success">Todas las sedes están gestionadas.</Notice>
          )}
          {pending.map(branch => (
            <div key={branch.id} style={{
              padding: '10px 0', borderBottom: '1px solid var(--color-border-tertiary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>⚫ {branch.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {branch.store_id} · {branch.slug}
                </div>
              </div>
              <Button type="button" disabled={busy === branch.id}
                onClick={() => authorize(branch.id)}
                style={{ padding: '5px 14px', fontSize: 12 }}>
                {busy === branch.id ? 'Procesando...' : 'Autorizar'}
              </Button>
            </div>
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
