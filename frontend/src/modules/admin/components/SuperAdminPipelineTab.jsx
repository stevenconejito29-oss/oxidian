import React from 'react'
import {
  Btn,
  C,
  SectionHeader,
  StatusDot,
  Badge,
  Modal,
  PIPELINE_COLS,
} from './superAdminShared'
import {
  countLandingRequestsByStatus,
  getPendingLandingRequests,
} from '../lib/superAdminPipeline'
import {
  inviteLandingRequest,
  listLandingRequests,
  updateLandingRequest,
} from '../../../shared/lib/supabaseApi'

function PipelineLeadDetail({ lead, onClose, onRefresh }) {
  const [busy, setBusy] = React.useState(false)

  async function handleStatus(nextStatus) {
    setBusy(true)
    try {
      await updateLandingRequest(lead.id, { status: nextStatus })
      await onRefresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function handleInvite() {
    setBusy(true)
    try {
      await inviteLandingRequest(lead.id, lead.redirect_to || lead.url || '/')
      await onRefresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Lead: ${lead.full_name || lead.business_name || lead.email || lead.id}`} onClose={onClose} width={680}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Nombre</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.full_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Empresa</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.business_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Email</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Estado</div>
            <StatusDot status={lead.status || 'pending'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={() => handleStatus('contacted')} disabled={busy}>Marcar contactado</Btn>
          <Btn variant="ghost" onClick={() => handleStatus('demo_scheduled')} disabled={busy}>Agendar demo</Btn>
          <Btn variant="ghost" onClick={handleInvite} disabled={busy}>Enviar invitación</Btn>
          <Btn variant="ghost" onClick={() => handleStatus('converted')} disabled={busy}>Convertir</Btn>
          <Btn variant="ghost" onClick={() => handleStatus('rejected')} disabled={busy}>Rechazar</Btn>
        </div>
      </div>
    </Modal>
  )
}

export default function SuperAdminPipelineTab() {
  const [leads, setLeads] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('pending')
  const [selectedLead, setSelectedLead] = React.useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await listLandingRequests()
      setLeads(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
  }, [])

  const counts = countLandingRequestsByStatus(leads)
  const visible = statusFilter === 'all'
    ? leads
    : leads.filter((lead) => lead?.status === statusFilter)
  const pending = getPendingLandingRequests(leads, 4)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <SectionHeader
        title={`Pipeline (${leads.length})`}
        subtitle="Leads de la landing, priorizados por estado y preparados para el siguiente paso"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {PIPELINE_COLS.map((col) => (
          <div key={col.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.bg }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700 }}>{col.label}</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: col.color }}>{counts[col.id] || 0}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', ...PIPELINE_COLS.map((col) => col.id)].map((id) => {
          const col = PIPELINE_COLS.find((item) => item.id === id)
          const active = statusFilter === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: active ? 'none' : `1px solid ${C.border2}`,
                background: active ? C.text : C.bg,
                color: active ? C.bg : C.muted,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {id === 'all' ? 'Todos' : col?.label}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: '3rem', textAlign: 'center', color: C.muted }}>Cargando…</div>}

      {!loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {pending.length > 0 && (
            <div style={{ ...C, background: C.bg, border: `1px solid ${C.border}` }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                <strong>Prioridad inmediata</strong>
              </div>
              <div style={{ padding: '12px 18px', display: 'grid', gap: 8 }}>
                {pending.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.bg2,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{lead.full_name || lead.business_name || 'Lead sin nombre'}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{lead.email || 'Sin email'} · {lead.phone || 'Sin teléfono'}</div>
                    </div>
                    <StatusDot status={lead.status || 'pending'} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...C, background: C.bg, border: `1px solid ${C.border}` }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>Leads</strong>
              <span style={{ fontSize: 12, color: C.muted }}>{visible.length} resultado(s)</span>
            </div>
            <div style={{ padding: '12px 18px', display: 'grid', gap: 10 }}>
              {visible.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.8fr 1fr 1fr',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{lead.full_name || lead.business_name || 'Lead sin nombre'}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{lead.email || 'Sin email'}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{lead.city || 'Sin ciudad'}</div>
                  <Badge color={(PIPELINE_COLS.find((col) => col.id === lead.status) || PIPELINE_COLS[0]).color}>
                    {lead.status || 'pending'}
                  </Badge>
                </button>
              ))}
              {!visible.length && <div style={{ padding: '2rem', textAlign: 'center', color: C.muted }}>Sin leads en este filtro.</div>}
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <PipelineLeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
