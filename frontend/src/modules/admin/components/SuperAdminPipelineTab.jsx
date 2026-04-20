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
  inviteLandingRequest,
  listLandingRequests,
  updateLandingRequest,
  createTenant,
  createOwnerAccount,
} from '../../../shared/lib/supabaseApi'

// ══════════════════════════════════════════════════════════════════
// WIZARD — Activar lead: Tenant + Cuenta + Tienda
// ══════════════════════════════════════════════════════════════════
function ActivarLeadWizard({ lead, onClose, onDone }) {
  const [step, setStep]     = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const [error, setError]   = React.useState('')
  const [createdTenantId, setCreatedTenantId] = React.useState(null)
  const [planId, setPlanId] = React.useState('growth')

  const [tenant, setTenant] = React.useState({
    name:        lead.business_name || lead.full_name || '',
    slug:        slugify(lead.business_name || lead.full_name || ''),
    owner_name:  lead.full_name || '',
    owner_email: lead.email || '',
    owner_phone: lead.phone || '',
    monthly_fee: 0,
    notes:       `Lead de landing. Nicho: ${lead.business_niche || '—'}`,
    status:      'active',
  })

  const [account, setAccount] = React.useState({
    full_name: lead.full_name || '',
    email:     lead.email || '',
    password:  '',
  })

  const [store, setStore] = React.useState({
    id:            slugify(lead.business_name || lead.full_name || '') + '-principal',
    name:          lead.business_name || lead.full_name || '',
    template_id:   'delivery',
    business_type: lead.business_niche || 'food',
    city:          lead.city || '',
  })

  const STEPS = [
    ['1', 'Tenant'],
    ['2', 'Cuenta dueño'],
    ['3', 'Tienda'],
    ['4', '¡Listo!'],
  ]

  async function handleStep1(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const t = await createTenant({ ...tenant, plan_id: planId })
      setCreatedTenantId(t.id)
      setStore(s => ({ ...s, id: slugify(tenant.slug) + '-principal' }))
      setStep(2)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function handleStep2(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (account.email && account.password) {
        await createOwnerAccount({ ...account, tenant_id: createdTenantId, role: 'tenant_owner' })
      }
      setStep(3)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function handleStep3(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      // La tienda se crea via backend Flask (service_role — bypasea RLS de stores)
      const BACKEND = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''
      const token = (await import('../../../legacy/lib/appSession')).readCurrentSupabaseAccessToken()
      const res = await fetch(`${BACKEND}/admin/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...store, tenant_id: createdTenantId, plan_id: planId, status: 'active' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || err?.message || 'Error creando tienda')
      }
      // Marcar el lead como convertido
      await updateLandingRequest(lead.id, { status: 'converted' })
      setStep(4)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <Modal title={`Activar: ${lead.full_name || lead.business_name || lead.email}`} onClose={onClose} width={660}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: C.bg2, borderRadius: 10, padding: 6 }}>
        {STEPS.map(([n, l]) => (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, fontWeight: 700,
              background: Number(n) <= step ? C.text : C.border2,
              color: Number(n) <= step ? C.bg : C.muted,
            }}>
              {Number(n) < step ? '✓' : n}
            </div>
            <span style={{ fontSize: 11, fontWeight: Number(n) === step ? 600 : 400, color: Number(n) === step ? C.text : C.muted, textAlign: 'center' }}>{l}</span>
          </div>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {/* PASO 1 — Datos del tenant */}
      {step === 1 && (
        <form onSubmit={handleStep1} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nombre del negocio *" style={{ gridColumn: '1/-1' }}>
            <input style={inp} required value={tenant.name}
              onChange={e => setTenant(t => ({ ...t, name: e.target.value, slug: t.slug || slugify(e.target.value) }))}
              placeholder="Pizzería Roma" />
          </Field>
          <Field label="Slug (URL) *" hint="Solo minúsculas y guiones">
            <input style={inp} required value={tenant.slug}
              onChange={e => setTenant(t => ({ ...t, slug: slugify(e.target.value) }))}
              placeholder="pizzeria-roma" />
          </Field>
          <Field label="Fee mensual (€)">
            <input style={inp} type="number" min={0} value={tenant.monthly_fee}
              onChange={e => setTenant(t => ({ ...t, monthly_fee: Number(e.target.value) }))} />
          </Field>
          <Field label="Nombre del dueño">
            <input style={inp} value={tenant.owner_name}
              onChange={e => setTenant(t => ({ ...t, owner_name: e.target.value }))} />
          </Field>
          <Field label="Email del dueño">
            <input style={inp} type="email" value={tenant.owner_email}
              onChange={e => setTenant(t => ({ ...t, owner_email: e.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={tenant.owner_phone}
              onChange={e => setTenant(t => ({ ...t, owner_phone: e.target.value }))} />
          </Field>
          <Field label="Plan" style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 4 }}>
              {Object.entries(PLAN_META).map(([id, pm]) => (
                <button key={id} type="button" onClick={() => setPlanId(id)}
                  style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${planId === id ? pm.color : C.border2}`, background: planId === id ? `${pm.color}12` : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{pm.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: planId === id ? pm.color : C.text }}>{pm.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{pm.price}/mes</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas" style={{ gridColumn: '1/-1' }}>
            <textarea style={{ ...inp, height: 60, resize: 'vertical' }} value={tenant.notes}
              onChange={e => setTenant(t => ({ ...t, notes: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear tenant →'}</Btn>
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          </div>
        </form>
      )}

      {/* PASO 2 — Cuenta del dueño */}
      {step === 2 && (
        <form onSubmit={handleStep2} style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1e40af' }}>
            ✅ Tenant creado. Ahora crea la cuenta de acceso del dueño.
          </div>
          <Field label="Nombre completo *">
            <input style={inp} required value={account.full_name}
              onChange={e => setAccount(a => ({ ...a, full_name: e.target.value }))} />
          </Field>
          <Field label="Email de acceso *">
            <input style={inp} type="email" required value={account.email}
              onChange={e => setAccount(a => ({ ...a, email: e.target.value }))} />
          </Field>
          <Field label="Contraseña temporal *" hint="El dueño deberá cambiarla al entrar">
            <input style={inp} required value={account.password}
              onChange={e => setAccount(a => ({ ...a, password: e.target.value }))} placeholder="Mín. 8 caracteres" />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Creando cuenta…' : 'Crear cuenta →'}</Btn>
            <Btn variant="ghost" type="button" onClick={() => setStep(3)}>Saltar (sin cuenta)</Btn>
          </div>
        </form>
      )}

      {/* PASO 3 — Crear tienda principal */}
      {step === 3 && (
        <form onSubmit={handleStep3} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1e40af' }}>
            ✅ Cuenta creada. Ahora crea la primera tienda del dueño.
          </div>
          <Field label="ID de tienda (único) *" hint="Solo letras, números y guiones" style={{ gridColumn: '1/-1' }}>
            <input style={inp} required value={store.id}
              onChange={e => setStore(s => ({ ...s, id: slugify(e.target.value) }))}
              placeholder="mi-tienda-principal" />
          </Field>
          <Field label="Nombre de la tienda *">
            <input style={inp} required value={store.name}
              onChange={e => setStore(s => ({ ...s, name: e.target.value }))} />
          </Field>
          <Field label="Ciudad">
            <input style={inp} value={store.city}
              onChange={e => setStore(s => ({ ...s, city: e.target.value }))} placeholder="Madrid" />
          </Field>
          <Field label="Plantilla">
            <select style={inp} value={store.template_id}
              onChange={e => setStore(s => ({ ...s, template_id: e.target.value }))}>
              <option value="delivery">🚚 Delivery</option>
              <option value="grid">🧩 Grid</option>
              <option value="catalog">📋 Catálogo</option>
              <option value="boutique">👗 Boutique</option>
              <option value="booking">📅 Reservas</option>
            </select>
          </Field>
          <Field label="Tipo de negocio">
            <input style={inp} value={store.business_type}
              onChange={e => setStore(s => ({ ...s, business_type: e.target.value }))} placeholder="food" />
          </Field>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Creando tienda…' : '🏪 Crear tienda y activar →'}</Btn>
            <Btn variant="ghost" type="button" onClick={() => { updateLandingRequest(lead.id, { status: 'converted' }); onDone() }}>Saltar (sin tienda)</Btn>
          </div>
        </form>
      )}

      {/* PASO 4 — Confirmación */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>¡Dueño activado!</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 8 }}>
            <strong>{tenant.name}</strong> tiene acceso a su panel de control.
          </p>
          {account.email && (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
              Credenciales enviadas a <strong>{account.email}</strong>.
            </p>
          )}
          <Btn onClick={onDone}>Cerrar</Btn>
        </div>
      )}
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════
// DETALLE DEL LEAD
// ══════════════════════════════════════════════════════════════════
function PipelineLeadDetail({ lead, onClose, onRefresh }) {
  const [busy, setBusy]         = React.useState(false)
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

  async function handleInvite() {
    setBusy(true)
    try {
      const result = await inviteLandingRequest(lead.id, lead.redirect_to || lead.url || '/')
      if (result?.success === false && result?.error?.includes('ya existe')) {
        // Usuario ya registrado en Auth → abrir wizard de activación directamente
        setActivarWizard(true)
        return
      }
      await onRefresh()
      onClose()
    } catch (err) {
      // 409: el usuario ya existe en Auth — redirigir al wizard de activación
      if (err.message?.includes('409') || err.message?.includes('ya existe')) {
        setActivarWizard(true)
        return
      }
      alert(err.message)
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
        {/* Datos del lead */}
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
            <div style={{ fontSize: 12, color: C.muted }}>Teléfono</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.phone || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Ciudad</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.city || '—'}</div>
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

        {/* Botón principal de activación */}
        <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>🚀 Activar acceso al panel</div>
          <div style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>
            Crea el tenant, la cuenta del dueño y su primera tienda en un solo flujo.
          </div>
          <Btn onClick={() => setActivarWizard(true)} disabled={busy}>
            ✅ Activar → Crear tenant + cuenta + tienda
          </Btn>
        </div>

        {/* Acciones secundarias del pipeline */}
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Gestión del pipeline</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => handleStatus('contacted')} disabled={busy}>Marcar contactado</Btn>
            <Btn variant="ghost" onClick={() => handleStatus('demo_scheduled')} disabled={busy}>Agendar demo</Btn>
            <Btn variant="ghost" onClick={handleInvite} disabled={busy}>📧 Enviar invitación email</Btn>
            <Btn variant="ghost" onClick={() => handleStatus('converted')} disabled={busy}>Convertido (manual)</Btn>
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
