import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../legacy/lib/supabase'
import {
  Actions, Button, Field, Form, FormGrid,
  GhostButton, Hero, Notice, Shell, controlDeckStyles,
} from '../../../shared/ui/ControlDeck'

const STEPS = [
  { id: 'welcome',  label: 'Bienvenida',    icon: '👋' },
  { id: 'tenant',   label: 'Tu negocio',    icon: '🏢' },
  { id: 'store',    label: 'Tu tienda',     icon: '🏪' },
  { id: 'branch',   label: 'Sede principal',icon: '📍' },
  { id: 'template', label: 'Apariencia',    icon: '🎨' },
  { id: 'done',     label: 'Listo',         icon: '✅' },
]

const TEMPLATES = [
  { id: 'delivery', label: 'Delivery / Restaurante', desc: 'Agresivo, rápido, conversión directa', color: '#F4D85B', bg: '#151515' },
  { id: 'vitrina',  label: 'Boutique / Retail',      desc: 'Elegante, curado, premium',            color: '#D2B48C', bg: '#111111' },
  { id: 'minimal',  label: 'Wellness / Servicios',   desc: 'Tranquilo, silencioso, guiado',         color: '#9C7B5B', bg: '#5C6B5E' },
  { id: 'portfolio',label: 'Marca audaz / Neon',     desc: 'Vibrante, identidad fuerte',            color: '#FF4FD8', bg: '#9B2CFF' },
]

const BUSINESS_TYPES = ['food','retail','service','beauty','wellness','other']

function ProgressBar({ current }) {
  const idx = STEPS.findIndex(s => s.id === current)
  const pct = Math.round((idx / (STEPS.length - 1)) * 100)
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: i <= idx ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
              color: i <= idx ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 500, transition: '.3s',
            }}>
              {i < idx ? '✓' : s.icon}
            </div>
            <div style={{ fontSize: 10, marginTop: 4, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--color-background-secondary)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: 'var(--color-text-primary)', transition: '.4s' }} />
      </div>
    </div>
  )
}

function WelcomeStep({ onNext }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 12px' }}>Bienvenido a Oxidian</h2>
      <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7 }}>
        En 5 minutos tendrás tu tienda en línea con gestión de pedidos,
        menú público, staff y chatbot de WhatsApp listo para usar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 400, margin: '0 auto 32px', textAlign: 'left' }}>
        {[
          ['🍕','Menú público con carrito'],
          ['📦','Cola de pedidos en tiempo real'],
          ['🤖','Chatbot WhatsApp portable'],
          ['📊','Panel completo de gestión'],
        ].map(([icon, text]) => (
          <div key={text} style={{
            background: 'var(--color-background-secondary)', borderRadius: 10,
            padding: '12px 14px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center'
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <Button type="button" onClick={onNext} style={{ minWidth: 180 }}>Empezar →</Button>
    </div>
  )
}

function TenantStep({ data, onChange, onNext, onBack, saving, error }) {
  return (
    <Form onSubmit={e => { e.preventDefault(); onNext() }}>
      <h3 style={{ fontWeight: 500, marginBottom: 4 }}>Tu negocio</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Información del dueño y negocio para facturación y contacto.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <FormGrid>
        <Field label="Nombre del negocio *">
          <input className={controlDeckStyles.input} required
            value={data.name} onChange={e => onChange('name', e.target.value)}
            placeholder="Pizzería Aurora" />
        </Field>
        <Field label="Slug / URL *">
          <input className={controlDeckStyles.input} required
            value={data.slug} onChange={e => onChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))}
            placeholder="pizzeria-aurora" />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Solo letras, números y guiones
          </span>
        </Field>
        <Field label="Tu nombre">
          <input className={controlDeckStyles.input}
            value={data.owner_name} onChange={e => onChange('owner_name', e.target.value)}
            placeholder="Carlos García" />
        </Field>
        <Field label="Tu email *">
          <input className={controlDeckStyles.input} type="email" required
            value={data.owner_email} onChange={e => onChange('owner_email', e.target.value)}
            placeholder="carlos@negocio.com" />
        </Field>
        <Field label="Teléfono">
          <input className={controlDeckStyles.input}
            value={data.owner_phone} onChange={e => onChange('owner_phone', e.target.value)}
            placeholder="+34 600 000 000" />
        </Field>
      </FormGrid>
      <Actions style={{ marginTop: 16 }}>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Continuar →'}</Button>
        <GhostButton type="button" onClick={onBack}>← Atrás</GhostButton>
      </Actions>
    </Form>
  )
}

function StoreStep({ data, onChange, onNext, onBack, saving, error }) {
  return (
    <Form onSubmit={e => { e.preventDefault(); onNext() }}>
      <h3 style={{ fontWeight: 500, marginBottom: 4 }}>Tu tienda</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Configuración de la marca y el tipo de negocio.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <FormGrid>
        <Field label="Nombre de la tienda *">
          <input className={controlDeckStyles.input} required
            value={data.name} onChange={e => onChange('name', e.target.value)}
            placeholder="Pizzería Aurora" />
        </Field>
        <Field label="ID / Slug *">
          <input className={controlDeckStyles.input} required
            value={data.id} onChange={e => onChange('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))}
            placeholder="pizzeria-aurora" />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Es tu URL: /storefront/menu?store=<strong>{data.id || '...'}</strong>
          </span>
        </Field>
        <Field label="Tipo de negocio">
          <select className={controlDeckStyles.select} value={data.business_type}
            onChange={e => onChange('business_type', e.target.value)}>
            {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Ciudad">
          <input className={controlDeckStyles.input}
            value={data.city} onChange={e => onChange('city', e.target.value)}
            placeholder="Madrid" />
        </Field>
      </FormGrid>
      <Actions style={{ marginTop: 16 }}>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Continuar →'}</Button>
        <GhostButton type="button" onClick={onBack}>← Atrás</GhostButton>
      </Actions>
    </Form>
  )
}

function BranchStep({ data, onChange, onNext, onBack, saving, error }) {
  return (
    <Form onSubmit={e => { e.preventDefault(); onNext() }}>
      <h3 style={{ fontWeight: 500, marginBottom: 4 }}>Sede principal</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        La unidad operativa donde gestionarás pedidos y staff.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <FormGrid>
        <Field label="Nombre de la sede *">
          <input className={controlDeckStyles.input} required
            value={data.name} onChange={e => onChange('name', e.target.value)}
            placeholder="Sede Centro" />
        </Field>
        <Field label="Dirección">
          <input className={controlDeckStyles.input}
            value={data.address} onChange={e => onChange('address', e.target.value)}
            placeholder="Calle Mayor 1" />
        </Field>
        <Field label="Ciudad">
          <input className={controlDeckStyles.input}
            value={data.city} onChange={e => onChange('city', e.target.value)}
            placeholder="Madrid" />
        </Field>
        <Field label="Teléfono de la sede">
          <input className={controlDeckStyles.input}
            value={data.phone} onChange={e => onChange('phone', e.target.value)}
            placeholder="+34 911 000 000" />
        </Field>
        <Field label="Hora apertura">
          <input className={controlDeckStyles.input} type="number" min={0} max={23}
            value={data.open_hour} onChange={e => onChange('open_hour', parseInt(e.target.value))}
            placeholder="10" />
        </Field>
        <Field label="Hora cierre">
          <input className={controlDeckStyles.input} type="number" min={0} max={23}
            value={data.close_hour} onChange={e => onChange('close_hour', parseInt(e.target.value))}
            placeholder="22" />
        </Field>
      </FormGrid>
      <Actions style={{ marginTop: 16 }}>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Continuar →'}</Button>
        <GhostButton type="button" onClick={onBack}>← Atrás</GhostButton>
      </Actions>
    </Form>
  )
}

function TemplateStep({ selected, onChange, onNext, onBack, saving }) {
  return (
    <div>
      <h3 style={{ fontWeight: 500, marginBottom: 4 }}>Apariencia de tu tienda</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Elige el estilo visual. Puedes cambiarlo en cualquier momento.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {TEMPLATES.map(t => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            style={{
              padding: '16px 14px', borderRadius: 12, cursor: 'pointer',
              border: selected === t.id ? `2px solid var(--color-text-primary)` : '1px solid var(--color-border-tertiary)',
              background: selected === t.id ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
              textAlign: 'left', transition: '.15s', fontFamily: 'inherit',
            }}>
            <div style={{
              height: 48, borderRadius: 8, background: t.bg,
              marginBottom: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ width: 32, height: 8, borderRadius: 4, background: t.color }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>
      <Actions>
        <Button type="button" onClick={onNext} disabled={saving}>{saving ? 'Creando...' : 'Finalizar →'}</Button>
        <GhostButton type="button" onClick={onBack}>← Atrás</GhostButton>
      </Actions>
    </div>
  )
}

function DoneStep({ storeId, branchId, tenantId, onGoToDashboard }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 12px' }}>¡Tu tienda está lista!</h2>
      <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', maxWidth: 420, margin: '0 auto 28px', lineHeight: 1.7 }}>
        Se ha creado tu tienda, sede principal y configuración base.
        Ya puedes añadir productos y recibir pedidos.
      </p>
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 12, padding: '16px 20px', maxWidth: 380, margin: '0 auto 28px', textAlign: 'left' }}>
        {[
          ['Tienda', storeId],
          ['Tenant', tenantId?.slice(0, 16) + '...'],
          ['Branch', branchId?.slice(0, 16) + '...'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--color-border-tertiary)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            <code style={{ fontSize: 11 }}>{value}</code>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button type="button" onClick={onGoToDashboard}>Ir al panel →</Button>
        <GhostButton type="button" onClick={() => window.open(`/storefront/menu?store=${storeId}`)}>
          Ver menú público
        </GhostButton>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState('welcome')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  // IDs resultantes
  const [createdTenantId, setCreatedTenantId] = React.useState(null)
  const [createdStoreId, setCreatedStoreId] = React.useState(null)
  const [createdBranchId, setCreatedBranchId] = React.useState(null)

  // Formularios
  const [tenant, setTenant] = React.useState({ name: '', slug: '', owner_name: '', owner_email: '', owner_phone: '' })
  const [store, setStore] = React.useState({ name: '', id: '', business_type: 'food', city: '' })
  const [branch, setBranch] = React.useState({ name: 'Sede Principal', address: '', city: '', phone: '', open_hour: 10, close_hour: 22 })
  const [template, setTemplate] = React.useState('delivery')

  const patchTenant = (k, v) => setTenant(p => ({ ...p, [k]: v }))
  const patchStore  = (k, v) => setStore(p => ({ ...p, [k]: v }))
  const patchBranch = (k, v) => setBranch(p => ({ ...p, [k]: v }))

  // Sincronizar store.id con tenant.slug
  React.useEffect(() => {
    if (store.name && !store.id) {
      patchStore('id', store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,''))
    }
  }, [store.name])

  React.useEffect(() => {
    if (tenant.name && !tenant.slug) {
      setTenant(p => ({ ...p, slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }))
    }
  }, [tenant.name])

  async function saveTenant() {
    setSaving(true); setError('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id

      const { data, error: err } = await supabase.from('tenants').insert({
        slug: tenant.slug,
        name: tenant.name,
        owner_name: tenant.owner_name,
        owner_email: tenant.owner_email,
        owner_phone: tenant.owner_phone,
        status: 'active',
        monthly_fee: 0,
      }).select().single()

      if (err) throw err
      setCreatedTenantId(data.id)

      // Asignar rol tenant_owner al usuario actual
      if (userId) {
        await supabase.from('user_memberships').insert({
          user_id: userId,
          role: 'tenant_owner',
          tenant_id: data.id,
          is_active: true,
        }).throwOnError()
      }

      setStep('store')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function saveStore() {
    setSaving(true); setError('')
    try {
      const { data, error: err } = await supabase.from('stores').insert({
        id: store.id,
        name: store.name,
        tenant_id: createdTenantId,
        template_id: 'delivery',
        status: 'active',
        business_type: store.business_type,
        city: store.city,
        public_visible: true,
      }).select().single()

      if (err) throw err
      setCreatedStoreId(data.id)
      setStep('branch')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function saveBranch() {
    setSaving(true); setError('')
    try {
      const { data, error: err } = await supabase.from('branches').insert({
        tenant_id: createdTenantId,
        store_id: createdStoreId,
        slug: 'sede-principal',
        name: branch.name,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        open_hour: branch.open_hour,
        close_hour: branch.close_hour,
        status: 'active',
        is_primary: true,
        public_visible: true,
      }).select().single()

      if (err) throw err
      setCreatedBranchId(data.id)
      setStep('template')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function saveTemplate() {
    setSaving(true); setError('')
    try {
      // Aplicar template seleccionado
      await supabase.from('stores').update({
        template_id: template,
      }).eq('id', createdStoreId).throwOnError()

      // Añadir config_tienda básica
      await supabase.from('config_tienda').upsert({
        id: createdStoreId,
        store_code: createdStoreId,
        business_name: store.name,
        business_type: store.business_type,
        tenant_id: createdTenantId,
        store_id: createdStoreId,
      }, { onConflict: 'id' })

      setStep('done')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const steps = {
    welcome:  <WelcomeStep onNext={() => setStep('tenant')} />,
    tenant:   <TenantStep data={tenant} onChange={patchTenant} onNext={saveTenant} onBack={() => setStep('welcome')} saving={saving} error={error} />,
    store:    <StoreStep data={store} onChange={patchStore} onNext={saveStore} onBack={() => setStep('tenant')} saving={saving} error={error} />,
    branch:   <BranchStep data={branch} onChange={patchBranch} onNext={saveBranch} onBack={() => setStep('store')} saving={saving} error={error} />,
    template: <TemplateStep selected={template} onChange={setTemplate} onNext={saveTemplate} onBack={() => setStep('branch')} saving={saving} />,
    done:     <DoneStep storeId={createdStoreId} branchId={createdBranchId} tenantId={createdTenantId}
                onGoToDashboard={() => navigate('/tenant/admin')} />,
  }

  return (
    <Shell>
      <Hero
        eyebrow="Oxidian — Configuración inicial"
        title="Crea tu negocio en 5 minutos"
        description="Configura tu tienda, sede y apariencia. Puedes modificarlo todo desde el panel de administración."
        signals={[
          { label: 'Paso', value: `${STEPS.findIndex(s => s.id === step) + 1} de ${STEPS.length}` },
        ]}
      />
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 16, padding: '1.5rem',
        maxWidth: 620, margin: '0 auto',
      }}>
        <ProgressBar current={step} />
        {steps[step]}
      </div>
    </Shell>
  )
}
