import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../legacy/lib/supabase'

const NICHOS = [
  { id:'barbershop', label:'Barbería / Estética', icon:'✂', desc:'Citas, servicios, galería' },
  { id:'fastfood',   label:'Comida Rápida',       icon:'🍔', desc:'Delivery, combos, modificadores' },
  { id:'restaurant', label:'Restaurante',          icon:'🍽', desc:'Mesas, reservas, carta' },
  { id:'minimarket', label:'Tienda de Barrio',     icon:'🛒', desc:'Stock, códigos de barra, POS' },
  { id:'clothing',   label:'Ropa / Moda',          icon:'👗', desc:'Tallas, colores, inventario' },
  { id:'universal',  label:'Otro negocio',         icon:'⚙', desc:'Configura tus módulos a mano' },
]

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14,
  border:'1px solid var(--color-border-secondary)',
  background:'var(--color-background-primary)',
  color:'var(--color-text-primary)', fontFamily:'inherit',
  boxSizing:'border-box', outline:'none',
}
const btn = (primary) => ({
  padding:'10px 24px', borderRadius:8, fontSize:14, cursor:'pointer',
  border: primary ? 'none' : '1px solid var(--color-border-secondary)',
  background: primary ? 'var(--color-text-primary)' : 'transparent',
  color: primary ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
  fontFamily:'inherit', fontWeight: primary ? 500 : 400,
})

const STEPS = ['nicho','info','sede','estética','listo']

function ProgressBar({ step }) {
  const idx = STEPS.indexOf(step)
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', gap:4 }}>
        {STEPS.map((s,i) => (
          <div key={s} style={{ flex:1, height:4, borderRadius:2,
            background: i <= idx ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
            transition:'.3s' }} />
        ))}
      </div>
      <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:6, textTransform:'capitalize' }}>
        Paso {idx + 1} de {STEPS.length} — {step}
      </div>
    </div>
  )
}

function NichoStep({ value, onChange, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>¿Qué tipo de negocio tienes?</h2>
      <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:20 }}>
        Esto pre-configura los módulos recomendados para tu tienda.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
        {NICHOS.map(n => (
          <button key={n.id} type="button" onClick={() => onChange(n.id)}
            style={{ padding:'14px', borderRadius:10, textAlign:'left', cursor:'pointer',
              border: value === n.id ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
              background: value === n.id ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
              fontFamily:'inherit' }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{n.icon}</div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>{n.label}</div>
            <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:2 }}>{n.desc}</div>
          </button>
        ))}
      </div>
      <button style={btn(true)} disabled={!value} onClick={onNext}>Continuar →</button>
    </div>
  )
}

function InfoStep({ data, onChange, onNext, onBack, saving, error }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onNext() }}>
      <h2 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>Tu negocio</h2>
      <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:20 }}>
        Crea tu primera tienda. Puedes añadir más desde el panel después.
      </p>
      {error && <div style={{ padding:'10px', background:'var(--color-background-danger)',
        color:'var(--color-text-danger)', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
      <div style={{ display:'grid', gap:14, marginBottom:24 }}>
        {[
          ['Nombre de la tienda','name','Panadería La Masa','text',true],
          ['Slug / URL','slug','panaderia-la-masa','text',true],
          ['Tu nombre','owner_name','Carlos García','text',false],
          ['Tu email','owner_email','carlos@negocio.com','email',true],
          ['Teléfono','owner_phone','+34 600 000 000','tel',false],
          ['Ciudad','city','Madrid','text',false],
        ].map(([label, key, ph, type, req]) => (
          <div key={key}>
            <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
              {label}{req ? ' *' : ''}
            </label>
            <input style={inp} type={type} required={req} placeholder={ph}
              value={data[key]} onChange={e => onChange(key, key === 'slug'
                ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')
                : e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button style={btn(true)} type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Continuar →'}
        </button>
        <button style={btn(false)} type="button" onClick={onBack}>← Atrás</button>
      </div>
    </form>
  )
}

function SedeStep({ data, onChange, onNext, onBack, saving, error }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onNext() }}>
      <h2 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>Sede principal</h2>
      <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:20 }}>
        Puedes crear más sedes desde el panel de administración.
      </p>
      {error && <div style={{ padding:'10px', background:'var(--color-background-danger)',
        color:'var(--color-text-danger)', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
      <div style={{ display:'grid', gap:14, marginBottom:24 }}>
        {[
          ['Nombre de la sede','name','Sede Central','text',true],
          ['Dirección','address','Calle Mayor 1','text',false],
          ['Ciudad','city','Madrid','text',false],
          ['Teléfono de la sede','phone','+34 911 000 000','tel',false],
        ].map(([label, key, ph, type, req]) => (
          <div key={key}>
            <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
              {label}{req ? ' *' : ''}
            </label>
            <input style={inp} type={type} required={req} placeholder={ph}
              value={data[key]} onChange={e => onChange(key, e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button style={btn(true)} type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Continuar →'}</button>
        <button style={btn(false)} type="button" onClick={onBack}>← Atrás</button>
      </div>
    </form>
  )
}

const PALETTES = [
  { primary:'#C0392B', surface:'#FEF9F0', label:'Caramelo' },
  { primary:'#2D6A4F', surface:'#F0FFF4', label:'Bosque' },
  { primary:'#1a1a2e', surface:'#F5F5FF', label:'Noche' },
  { primary:'#E76F51', surface:'#FFF8F5', label:'Coral' },
  { primary:'#6C3483', surface:'#F9F0FF', label:'Violeta' },
  { primary:'#0077B6', surface:'#EFF8FF', label:'Oceano' },
]

function EsteticaStep({ data, onChange, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>Estética de tu tienda</h2>
      <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:20 }}>
        Elige los colores de tu marca. Puedes cambiarlos en cualquier momento.
      </p>
      <div style={{ marginBottom:20 }}>
        <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:8 }}>
          Paleta de colores
        </label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {PALETTES.map(p => (
            <button key={p.label} type="button" onClick={() => onChange('palette', p)}
              style={{ padding:'12px 8px', borderRadius:8, cursor:'pointer', textAlign:'center',
                border: (data.palette?.label === p.label) ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                background:'var(--color-background-primary)', fontFamily:'inherit' }}>
              <div style={{ display:'flex', gap:4, justifyContent:'center', marginBottom:5 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:p.primary }} />
                <div style={{ width:18, height:18, borderRadius:'50%', background:p.surface, border:'1px solid var(--color-border-tertiary)' }} />
              </div>
              <div style={{ fontSize:11, color:'var(--color-text-secondary)' }}>{p.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button style={btn(true)} onClick={onNext}>Crear tienda →</button>
        <button style={btn(false)} type="button" onClick={onBack}>← Atrás</button>
      </div>
    </div>
  )
}

function ListoStep({ storeId, branchId, navigate }) {
  return (
    <div style={{ textAlign:'center', padding:'1rem 0' }}>
      <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
      <h2 style={{ fontSize:22, fontWeight:500, marginBottom:10 }}>Tu tienda está lista</h2>
      <p style={{ fontSize:14, color:'var(--color-text-secondary)', maxWidth:380, margin:'0 auto 28px', lineHeight:1.7 }}>
        Ya tienes tu primera tienda y sede activa. Desde el panel puedes añadir
        productos, gestionar staff y recibir pedidos.
      </p>
      <div style={{ background:'var(--color-background-secondary)', borderRadius:10,
        padding:'14px 18px', maxWidth:360, margin:'0 auto 24px', textAlign:'left', fontSize:13 }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0',
          borderBottom:'1px solid var(--color-border-tertiary)' }}>
          <span style={{ color:'var(--color-text-secondary)' }}>Tienda</span>
          <code style={{ fontSize:11 }}>{storeId}</code>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
          <span style={{ color:'var(--color-text-secondary)' }}>Sede</span>
          <code style={{ fontSize:11 }}>{branchId?.slice(0,12)}...</code>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button style={btn(true)} onClick={() => navigate('/tenant/admin')}>Ir a mi panel →</button>
        <button style={btn(false)} onClick={() => window.open(`/s/${storeId}/menu`)}>Ver menú público</button>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState('nicho')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [nicho, setNicho] = React.useState('')
  const [info, setInfo] = React.useState({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', city:'' })
  const [sede, setSede] = React.useState({ name:'Sede Principal', address:'', city:'', phone:'' })
  const [estetica, setEstetica] = React.useState({ palette: PALETTES[0] })
  const [createdStoreId, setCreatedStoreId] = React.useState(null)
  const [createdBranchId, setCreatedBranchId] = React.useState(null)

  const patchInfo = (k,v) => setInfo(p => ({...p,[k]:v}))
  const patchSede = (k,v) => setSede(p => ({...p,[k]:v}))

  React.useEffect(() => {
    if (info.name && !info.slug) {
      patchInfo('slug', info.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))
    }
  }, [info.name])

  async function handleSaveInfo() {
    setSaving(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id || !user?.email) throw new Error('Debes iniciar sesion para continuar el onboarding.')
      const ownerEmail = String(user.email).trim().toLowerCase()
      const { data: existing } = await supabase.from('tenants').select('id').eq('owner_email', ownerEmail).maybeSingle()
      let tenantId
      if (existing) {
        tenantId = existing.id
      } else {
        const { data: t, error: te } = await supabase.from('tenants').insert({
          slug: info.slug + '-tenant', name: info.name, owner_name: info.owner_name,
          owner_email: ownerEmail, owner_phone: info.owner_phone, status:'active',
        }).select().single()
        if (te) throw te
        tenantId = t.id
      }
      await supabase.from('user_memberships').upsert({
        user_id: user.id, role:'tenant_owner', tenant_id: tenantId, is_active:true
      }, { onConflict: 'user_id,role,tenant_id,store_id,branch_id' })
      await supabase.from('tenant_subscriptions').upsert({
        tenant_id: tenantId, plan_id:'growth', status:'active',
        current_period_end: new Date(Date.now()+30*86400000).toISOString()
      }, { onConflict: 'tenant_id' })
      const theme = { primary: estetica.palette.primary, surface: estetica.palette.surface }
      const { data: store, error: se } = await supabase.from('stores').insert({
        id: info.slug, slug: info.slug, name: info.name, tenant_id: tenantId,
        status:'active', business_type: nicho === 'universal' ? 'other' : 'food',
        niche: nicho, city: info.city, public_visible:true, theme_tokens: theme,
      }).select().single()
      if (se) throw se
      setCreatedStoreId(store.id)
      await supabase.rpc('apply_niche_preset', { p_store_id: store.id, p_tenant_id: tenantId, p_niche_id: nicho }).throwOnError()
      setStep('sede')
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function handleSaveSede() {
    setSaving(true); setError('')
    try {
      const { data: store } = await supabase.from('stores').select('tenant_id').eq('id', createdStoreId).single()
      const { data: branch, error: be } = await supabase.from('branches').insert({
        tenant_id: store.tenant_id, store_id: createdStoreId,
        slug:'sede-principal', name: sede.name, address: sede.address,
        city: sede.city, phone: sede.phone, status:'active', is_primary:true, public_visible:true,
      }).select().single()
      if (be) throw be
      setCreatedBranchId(branch.id)
      setStep('estética')
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await supabase.from('stores').update({
        theme_tokens: { primary: estetica.palette.primary, surface: estetica.palette.surface }
      }).eq('id', createdStoreId)
    } catch {}
    setSaving(false)
    setStep('listo')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--color-background-tertiary)', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--color-background-primary)',
        borderRadius:16, border:'0.5px solid var(--color-border-tertiary)', padding:'2rem' }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text-secondary)', marginBottom:20 }}>
          Oxidian — Configurar tienda
        </div>
        {step !== 'listo' && <ProgressBar step={step} />}
        {step === 'nicho'    && <NichoStep value={nicho} onChange={setNicho} onNext={() => setStep('info')} />}
        {step === 'info'     && <InfoStep data={info} onChange={patchInfo} onNext={handleSaveInfo} onBack={() => setStep('nicho')} saving={saving} error={error} />}
        {step === 'sede'     && <SedeStep data={sede} onChange={patchSede} onNext={handleSaveSede} onBack={() => setStep('info')} saving={saving} error={error} />}
        {step === 'estética' && <EsteticaStep data={estetica} onChange={(k,v) => setEstetica(p=>({...p,[k]:v}))} onNext={handleFinish} onBack={() => setStep('sede')} />}
        {step === 'listo'    && <ListoStep storeId={createdStoreId} branchId={createdBranchId} navigate={navigate} />}
      </div>
    </div>
  )
}
