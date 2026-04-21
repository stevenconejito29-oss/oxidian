import React from 'react'
import {
  Btn,
  C,
  Field,
  Alert,
  SectionHeader,
  StatusDot,
  Badge,
  Modal,
  PIPELINE_COLS,
  PLAN_META,
  inp,
  slugify,
} from './superAdminShared'
import {
  countLandingRequestsByStatus,
  getPendingLandingRequests,
} from '../lib/superAdminPipeline'
import {
  getLeadStatusAfterActivation,
  getOwnerInviteRedirectPath,
} from '../lib/pipelineAdmission'
import {
  createTenant,
  inviteTenantOwner,
  listLandingRequests,
  updateLandingRequest,
} from '../../../shared/lib/supabaseApi'

function ActivarLeadWizard({ lead, onClose, onDone }) {
  const [step, setStep] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [createdTenantId, setCreatedTenantId] = React.useState(null)
  const [planId, setPlanId] = React.useState('growth')
  const [inviteResult, setInviteResult] = React.useState(null)

  const [tenant, setTenant] = React.useState({
    name: lead.business_name || lead.full_name || '',
    slug: slugify(lead.business_name || lead.full_name || ''),
    owner_name: lead.full_name || '',
    owner_email: lead.email || '',
    owner_phone: lead.phone || '',
    monthly_fee: 0,
    notes: `Lead de landing. Nicho: ${lead.business_niche || '-'}`,
    status: 'active',
  })

  const [owner, setOwner] = React.useState({
    full_name: lead.full_name || '',
    email: lead.email || '',
  })

  async function handleCreateTenant(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await createTenant({ ...tenant, plan_id: planId })
      setCreatedTenantId(created.id)
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleAdmitOwner(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const invite = await inviteTenantOwner(createdTenantId, {
        email: owner.email,
        full_name: owner.full_name,
        role: 'tenant_owner',
        redirect_to: getOwnerInviteRedirectPath(window.location.origin),
      })
      setInviteResult(invite)
      await updateLandingRequest(lead.id, {
        status: getLeadStatusAfterActivation({ hasOwnerAccess: true }),
      })
      setStep(3)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <Modal title={`Activar: ${lead.full_name || lead.business_name || lead.email}`} onClose={onClose} width={660}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: C.bg2, borderRadius: 10, padding: 6 }}>
        {[
          ['1', 'Tenant'],
          ['2', 'Acceso dueno'],
          ['3', 'Listo'],
        ].map(([n, label]) => (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              background: Number(n) <= step ? C.text : C.border2,
              color: Number(n) <= step ? C.bg : C.muted,
            }}>
              {Number(n) < step ? 'OK' : n}
            </div>
            <span style={{ fontSize: 11, fontWeight: Number(n) === step ? 600 : 400, color: Number(n) === step ? C.text : C.muted, textAlign: 'center' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {step === 1 && (
        <form onSubmit={handleCreateTenant} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nombre del negocio *" style={{ gridColumn: '1/-1' }}>
            <input
              style={inp}
              required
              value={tenant.name}
              onChange={(e) => setTenant((t) => ({ ...t, name: e.target.value, slug: t.slug || slugify(e.target.value) }))}
              placeholder="Pizzeria Roma"
            />
          </Field>
          <Field label="Slug (URL) *" hint="Solo minusculas y guiones">
            <input
              style={inp}
              required
              value={tenant.slug}
              onChange={(e) => setTenant((t) => ({ ...t, slug: slugify(e.target.value) }))}
              placeholder="pizzeria-roma"
            />
          </Field>
          <Field label="Fee mensual (EUR)">
            <input
              style={inp}
              type="number"
              min={0}
              value={tenant.monthly_fee}
              onChange={(e) => setTenant((t) => ({ ...t, monthly_fee: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Nombre del dueno">
            <input style={inp} value={tenant.owner_name} onChange={(e) => setTenant((t) => ({ ...t, owner_name: e.target.value }))} />
          </Field>
          <Field label="Email del dueno">
            <input style={inp} type="email" value={tenant.owner_email} onChange={(e) => setTenant((t) => ({ ...t, owner_email: e.target.value }))} />
          </Field>
          <Field label="Telefono">
            <input style={inp} value={tenant.owner_phone} onChange={(e) => setTenant((t) => ({ ...t, owner_phone: e.target.value }))} />
          </Field>
          <Field label="Plan" style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 4 }}>
              {Object.entries(PLAN_META).map(([id, meta]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlanId(id)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: `2px solid ${planId === id ? meta.color : C.border2}`,
                    background: planId === id ? `${meta.color}12` : 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{meta.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: planId === id ? meta.color : C.text }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{meta.price}/mes</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas" style={{ gridColumn: '1/-1' }}>
            <textarea style={{ ...inp, height: 60, resize: 'vertical' }} value={tenant.notes} onChange={(e) => setTenant((t) => ({ ...t, notes: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear tenant ->'}</Btn>
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleAdmitOwner} style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1e40af' }}>
            Tenant creado. Ahora admite al dueno y enviale acceso al panel.
          </div>
          <Field label="Nombre completo *">
            <input style={inp} required value={owner.full_name} onChange={(e) => setOwner((o) => ({ ...o, full_name: e.target.value }))} />
          </Field>
          <Field label="Email de acceso *">
            <input style={inp} type="email" required value={owner.email} onChange={(e) => setOwner((o) => ({ ...o, email: e.target.value }))} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Admitiendo...' : 'Admitir dueno ->'}</Btn>
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          </div>
        </form>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>OK</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Lead admitido</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 8 }}>
            <strong>{tenant.name}</strong> ya tiene tenant creado y el dueno puede entrar a su panel.
          </p>
          {inviteResult && (
            <div style={{ background: C.bg2, borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                Acceso del dueno
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted }}>Email</span>
                  <strong style={{ wordBreak: 'break-all' }}>{inviteResult.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}>
                  <span style={{ color: C.muted }}>Estado</span>
                  {inviteResult.already_exists
                    ? <Badge color="#ca8a04">Usuario existente con membresia activa</Badge>
                    : <Badge color="#16a34a">Invitacion enviada al login</Badge>}
                </div>
              </div>
            </div>
          )}
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
            El siguiente paso es que el dueno entre a su panel y cree sus tiendas desde alli.
          </p>
          <Btn onClick={onDone}>Cerrar</Btn>
        </div>
      )}
    </Modal>
  )
}

function PipelineLeadDetail({ lead, onClose, onRefresh }) {
  const [busy, setBusy] = React.useState(false)
  const [activarWizard, setActivarWizard] = React.useState(false)

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

  if (activarWizard) {
    return (
      <ActivarLeadWizard
        lead={lead}
        onClose={() => setActivarWizard(false)}
        onDone={async () => { await onRefresh(); onClose() }}
      />
    )
  }

  return (
    <Modal title={`Lead: ${lead.full_name || lead.business_name || lead.email || lead.id}`} onClose={onClose} width={680}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Nombre</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.full_name || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Empresa</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.business_name || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Email</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.email || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Telefono</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.phone || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Ciudad</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.city || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Estado</div>
            <StatusDot status={lead.status || 'pending'} />
          </div>
          {lead.business_niche && (
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 12, color: C.muted }}>Nicho</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.business_niche}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Activar acceso al panel</div>
          <div style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>
            Admite el lead creando el tenant y el acceso del dueno. Las tiendas se crean desde el panel del dueno.
          </div>
          <Btn onClick={() => setActivarWizard(true)} disabled={busy}>
            Activar y crear tenant + acceso del dueno
          </Btn>
        </div>

        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Gestion del pipeline</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => handleStatus('contacted')} disabled={busy}>Marcar contactado</Btn>
            <Btn variant="ghost" onClick={() => handleStatus('demo_scheduled')} disabled={busy}>Agendar demo</Btn>
            <Btn variant="ghost" onClick={() => handleStatus('onboarding')} disabled={busy}>Mover a onboarding</Btn>
            <Btn variant="ghost" onClick={() => handleStatus('converted')} disabled={busy}>Marcar convertido</Btn>
            <Btn variant="danger" onClick={() => handleStatus('rejected')} disabled={busy}>Rechazar</Btn>
          </div>
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

      {loading && <div style={{ padding: '3rem', textAlign: 'center', color: C.muted }}>Cargando...</div>}

      {!loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {pending.length > 0 && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14 }}>
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
                      <div style={{ fontSize: 12, color: C.muted }}>{lead.email || 'Sin email'} · {lead.phone || 'Sin telefono'}</div>
                    </div>
                    <StatusDot status={lead.status || 'pending'} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14 }}>
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
