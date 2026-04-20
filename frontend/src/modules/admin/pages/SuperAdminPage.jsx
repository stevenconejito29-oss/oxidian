/**
 * SuperAdminPage.jsx — Panel del Super Admin (Oxidian Platform)
 * Diseño inspirado en Vercel / Linear / Retool.
 * Tabs: Overview · Tenants · Tiendas · Planes · Pipeline · Chatbot
 */
import React from 'react'
import DashboardLayout from '../../../core/app/DashboardLayout'
import {
  listTenants, createTenant, updateTenant,
  listStores,  createStore,
  listBranches,
  listOwnerAccounts, createOwnerAccount,
  getSuperAdminStats,
  listLandingRequests,
} from '../../../shared/lib/supabaseApi'
import { PLANS, FEATURES, FEATURE_LABELS, planHasFeature } from '../../../shared/lib/planFeatures'
import ChatbotAuthManager from '../components/ChatbotAuthManager'
import SuperAdminPipelineTab from '../components/SuperAdminPipelineTab'
import { getPendingLandingRequests } from '../lib/superAdminPipeline'

// ─── helpers ─────────────────────────────────────────────────────
function slugify(v) {
  return String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')
}
function fmt(n){ return Number(n||0).toLocaleString('es-ES') }
function fmtMoney(n){ return '€'+Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:0}) }
function ago(d){
  if(!d) return '—'
  const s=Math.floor((Date.now()-new Date(d))/1000)
  if(s<60) return 'ahora'
  if(s<3600) return Math.floor(s/60)+'m'
  if(s<86400) return Math.floor(s/3600)+'h'
  return Math.floor(s/86400)+'d'
}

// ─── design tokens (inline, compatible con CSS vars del tema) ────
const C = {
  bg:     'var(--color-background-primary)',
  bg2:    'var(--color-background-secondary)',
  border: 'var(--color-border-tertiary)',
  border2:'var(--color-border-secondary)',
  text:   'var(--color-text-primary)',
  muted:  'var(--color-text-secondary)',
}
const card  = { background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }
const inp   = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13, border:`1px solid ${C.border2}`,
                background:C.bg, color:C.text, fontFamily:'inherit', boxSizing:'border-box' }

// ─── Micro-components ────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant='primary', size='md', type='button', style={} }) {
  const pad = size==='sm'?'5px 12px':'9px 20px'
  const fs  = size==='sm'?12:13
  const bg  = variant==='primary'?C.text : variant==='danger'?'#dc2626' : 'transparent'
  const cl  = variant==='ghost'?C.muted:'#fff'
  const bd  = variant==='ghost'?`1px solid ${C.border2}`:'none'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding:pad,borderRadius:8,border:bd,background:disabled?'#e5e7eb':bg,
      color:disabled?'#9ca3af':cl,fontSize:fs,fontWeight:500,cursor:disabled?'not-allowed':'pointer',
      fontFamily:'inherit',transition:'.15s',whiteSpace:'nowrap',...style,
    }}>{children}</button>
  )
}
function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{display:'block',fontSize:12,color:C.muted,marginBottom:5,fontWeight:500}}>{label}</label>
      {children}
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{hint}</div>}
    </div>
  )
}
function Alert({ children, type='error' }) {
  const palette={error:{bg:'#fef2f2',text:'#b91c1c'},success:{bg:'#f0fdf4',text:'#15803d'},info:{bg:'#eff6ff',text:'#1d4ed8'},warn:{bg:'#fefce8',text:'#854d0e'}}
  const p=palette[type]||palette.error
  return <div style={{padding:'10px 14px',borderRadius:8,marginBottom:12,background:p.bg,color:p.text,fontSize:13}}>{children}</div>
}
function StatCard({ label, value, icon, hint, color, onClick }) {
  return (
    <div onClick={onClick} style={{...card,padding:'18px 20px',cursor:onClick?'pointer':'default',transition:'.15s',boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <span style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.06em',color:C.muted,fontWeight:600}}>{label}</span>
        <span style={{fontSize:22}}>{icon}</span>
      </div>
      <div style={{fontSize:32,fontWeight:800,letterSpacing:'-1.5px',color:color||C.text}}>{value??'—'}</div>
      {hint&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>{hint}</div>}
    </div>
  )
}
function Badge({ children, color='#64748b' }) {
  return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:`${color}18`,color,whiteSpace:'nowrap'}}>{children}</span>
}
function StatusDot({ status }) {
  const colors={active:'#16a34a',suspended:'#dc2626',archived:'#6b7280',draft:'#ca8a04',pending:'#2563eb',converted:'#16a34a',rejected:'#dc2626',ghosted:'#9ca3af',contacted:'#7c3aed',demo_scheduled:'#0891b2',onboarding:'#ea580c'}
  const labels={active:'Activo',suspended:'Suspendido',archived:'Archivado',draft:'Borrador',pending:'Pendiente',converted:'Convertido',rejected:'Rechazado',ghosted:'Sin respuesta',contacted:'Contactado',demo_scheduled:'Demo',onboarding:'Onboarding'}
  const c=colors[status]||'#9ca3af', l=labels[status]||status
  return <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600,background:`${c}18`,color:c}}><span style={{width:5,height:5,borderRadius:'50%',background:c,flexShrink:0}} />{l}</span>
}
function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-0.5px'}}>{title}</h2>
        {subtitle&&<p style={{margin:'4px 0 0',fontSize:13,color:C.muted}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{display:'flex',gap:2,marginBottom:28,flexWrap:'wrap',background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:4}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          padding:'8px 16px',borderRadius:9,border:'none',cursor:'pointer',
          fontSize:13,fontWeight:active===t.id?600:400,fontFamily:'inherit',
          background:active===t.id?C.text:'transparent',
          color:active===t.id?C.bg:C.muted,
          display:'flex',alignItems:'center',gap:6,transition:'.15s',
        }}>{t.icon} {t.label}</button>
      ))}
    </div>
  )
}
function Modal({ title, onClose, children, width=560 }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.bg,borderRadius:16,width:'100%',maxWidth:width,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,fontSize:16}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:C.muted,lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:'22px'}}>{children}</div>
      </div>
    </div>
  )
}

// ─── Constantes ──────────────────────────────────────────────────
const NICHES = [
  { id:'restaurant',         icon:'🍕', label:'Restaurante',    color:'#ef4444' },
  { id:'supermarket',        icon:'🛒', label:'Supermercado',   color:'#22c55e' },
  { id:'boutique_fashion',   icon:'👗', label:'Moda/Boutique',  color:'#ec4899' },
  { id:'pharmacy',           icon:'💊', label:'Farmacia',       color:'#0ea5e9' },
  { id:'neighborhood_store', icon:'🏪', label:'Tienda Barrio',  color:'#f97316' },
  { id:'barbershop',         icon:'✂️', label:'Barbería',       color:'#1d4ed8' },
  { id:'beauty_salon',       icon:'💅', label:'Salón Belleza',  color:'#a855f7' },
  { id:'services',           icon:'🛠️', label:'Servicios',      color:'#6366f1' },
  { id:'universal',          icon:'⭐', label:'Otro',           color:'#64748b' },
]
const PIPELINE_COLS = [
  { id:'pending',        label:'Nuevo',       color:'#ca8a04' },
  { id:'contacted',      label:'Contactado',  color:'#7c3aed' },
  { id:'demo_scheduled', label:'Demo',        color:'#0891b2' },
  { id:'onboarding',     label:'Onboarding',  color:'#ea580c' },
  { id:'converted',      label:'Convertido',  color:'#16a34a' },
  { id:'rejected',       label:'Perdido',     color:'#dc2626' },
]
const PLAN_META = {
  starter:  { label:'Starter',  color:'#64748b', price:'€0',    icon:'🌱' },
  growth:   { label:'Growth',   color:'#2563eb', price:'€29',   icon:'🚀' },
  pro:      { label:'Pro',      color:'#7c3aed', price:'€79',   icon:'💎' },
  enterprise:{ label:'Enterprise',color:'#ea580c',price:'Personalizado',icon:'🏢' },
}
const TABS = [
  { id:'overview',  icon:'📊', label:'Panel'        },
  { id:'tenants',   icon:'🏢', label:'Tenants'      },
  { id:'stores',    icon:'🏪', label:'Tiendas'      },
  { id:'plans',     icon:'💎', label:'Planes'       },
  { id:'pipeline',  icon:'📋', label:'Pipeline'     },
  { id:'chatbot',   icon:'🤖', label:'Chatbot'      },
]

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
export default function SuperAdminPage() {
  const [tab, setTab] = React.useState('overview')
  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} title="Super Admin" subtitle="Oxidian Platform">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab==='overview'  && <OverviewTab  setTab={setTab} />}
      {tab==='tenants'   && <TenantsTab                  />}
      {tab==='stores'    && <StoresTab                   />}
      {tab==='plans'     && <PlansTab                    />}
      {tab==='pipeline'  && <SuperAdminPipelineTab       />}
      {tab==='chatbot'   && <ChatbotAuthManager          />}
    </DashboardLayout>
  )
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════
function OverviewTab({ setTab }) {
  const [stats,    setStats]    = React.useState(null)
  const [tenants,  setTenants]  = React.useState([])
  const [pipeline, setPipeline] = React.useState([])
  const [loading,  setLoading]  = React.useState(true)

  React.useEffect(() => {
    Promise.all([getSuperAdminStats(), listTenants(), listLandingRequests()])
      .then(([s, ts, leads]) => {
        setStats(s)
        setTenants(ts.slice(0,5))
        setPipeline(getPendingLandingRequests(leads, 4))
      })
      .finally(() => setLoading(false))
  }, [])

  const mrr = React.useMemo(() => {
    if(!Array.isArray(tenants)) return 0
    return tenants.reduce((s,t)=>s+Number(t.monthly_fee||0),0)
  },[tenants])

  if (loading) return <div style={{padding:'3rem',textAlign:'center',color:C.muted}}>Cargando…</div>

  return (
    <div style={{display:'grid',gap:24}}>
      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>
        <StatCard label="Tenants activos" value={fmt(stats?.tenants)}  icon="🏢" color="#2563eb" hint="Clientes activos" onClick={()=>setTab('tenants')} />
        <StatCard label="Tiendas"         value={fmt(stats?.stores)}   icon="🏪" color="#16a34a" hint="Todas las tiendas"onClick={()=>setTab('stores')}  />
        <StatCard label="Sedes"           value={fmt(stats?.branches)} icon="📍" color="#7c3aed" hint="Unidades operativas" />
        <StatCard label="Staff total"     value={fmt(stats?.members)}  icon="👥" color="#ea580c" hint="Cuentas de acceso" />
        <StatCard label="MRR estimado"    value={fmtMoney(mrr)}        icon="💰" color="#ca8a04" hint="Ingresos mensuales" />
      </div>

      {/* 2-col grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',gap:16}}>
        {/* Últimos tenants */}
        <div style={card}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:14}}>🏢 Tenants recientes</span>
            <Btn size="sm" onClick={()=>setTab('tenants')}>Ver todos →</Btn>
          </div>
          <div style={{padding:'0 18px'}}>
            {!tenants.length && <div style={{padding:'2rem',textAlign:'center',color:C.muted,fontSize:13}}>Sin tenants todavía</div>}
            {tenants.map(t=>{
              const pm=PLAN_META[t.plan_id]||PLAN_META.starter
              return (
                <div key={t.id} style={{padding:'12px 0',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'#6366f115',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🏢</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{t.owner_email||'Sin email'} · {ago(t.created_at)}</div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <StatusDot status={t.status||'active'} />
                    <Badge color={pm.color}>{pm.icon} {pm.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div style={card}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontWeight:700,fontSize:14}}>⚡ Acciones rápidas</span>
          </div>
          <div style={{padding:'12px 18px',display:'flex',flexDirection:'column',gap:8}}>
            {[
              {icon:'🏢',label:'Crear nuevo tenant + cuenta',tab:'tenants',desc:'Wizard completo en 3 pasos'},
              {icon:'🏪',label:'Ver todas las tiendas',tab:'stores',desc:`${fmt(stats?.stores)} tiendas registradas`},
              {icon:'💎',label:'Gestionar planes',tab:'plans',desc:'Starter · Growth · Pro · Enterprise'},
              {icon:'📋',label:'Pipeline de leads',tab:'pipeline',desc:`${pipeline.length} pendiente(s)`},
            ].map(a=>(
              <button key={a.tab} onClick={()=>setTab(a.tab)} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.bg2,cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'.15s'}}>
                <span style={{fontSize:22}}>{a.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.text}}>{a.label}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>{a.desc}</div>
                </div>
                <span style={{marginLeft:'auto',color:C.muted,fontSize:18}}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TENANTS TAB — lista + wizard creación
// ══════════════════════════════════════════════════════════════════
function TenantsTab() {
  const [tenants,  setTenants]  = React.useState([])
  const [owners,   setOwners]   = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [search,   setSearch]   = React.useState('')
  const [filter,   setFilter]   = React.useState('all')
  const [wizard,   setWizard]   = React.useState(false)
  const [editT,    setEditT]    = React.useState(null)

  const load = React.useCallback(async()=>{
    setLoading(true)
    const [ts,os] = await Promise.all([listTenants(), listOwnerAccounts()])
    setTenants(Array.isArray(ts)?ts:[])
    setOwners(Array.isArray(os)?os:[])
    setLoading(false)
  },[])
  React.useEffect(()=>{ load() },[load])

  const visible = tenants.filter(t=>{
    const q=search.toLowerCase()
    const m=!q||t.name?.toLowerCase().includes(q)||t.owner_email?.toLowerCase().includes(q)||t.owner_name?.toLowerCase().includes(q)
    const s=filter==='all'||t.status===filter
    return m&&s
  })

  return (
    <div style={{display:'grid',gap:20}}>
      <SectionHeader
        title={`Tenants (${tenants.length})`}
        subtitle="Gestiona los clientes de la plataforma y sus cuentas de acceso"
        action={<Btn onClick={()=>setWizard(true)}>+ Nuevo Tenant</Btn>}
      />

      {/* Filtros */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <input style={{...inp,width:240,flex:'none'}} placeholder="Buscar por nombre o email…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{...inp,width:'auto'}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
          <option value="archived">Archivados</option>
          <option value="draft">Borrador</option>
        </select>
        <span style={{fontSize:12,color:C.muted}}>{visible.length} resultado(s)</span>
      </div>

      {/* Tabla */}
      {loading?<div style={{textAlign:'center',padding:'3rem',color:C.muted}}>Cargando…</div>:(
        <div style={{...card}}>
          {/* Header */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 120px',gap:12,padding:'10px 18px',borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'.05em'}}>
            <span>Tenant</span><span>Contacto</span><span>Plan</span><span>Estado</span><span>Fee/mes</span><span>Acciones</span>
          </div>
          {!visible.length&&<div style={{padding:'3rem',textAlign:'center',color:C.muted,fontSize:13}}>Sin resultados</div>}
          {visible.map(t=>{
            const pm=PLAN_META[t.plan_id]||PLAN_META.starter
            const ownerCount=owners.filter(o=>o.tenant_id===t.id).length
            return (
              <div key={t.id} style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 120px',gap:12,padding:'13px 18px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{t.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>/{t.slug} · {ownerCount} cuenta(s) · {ago(t.created_at)}</div>
                </div>
                <div>
                  <div style={{fontSize:13}}>{t.owner_name||'—'}</div>
                  <div style={{fontSize:11,color:C.muted,wordBreak:'break-all'}}>{t.owner_email||'Sin email'}</div>
                </div>
                <Badge color={pm.color}>{pm.icon} {pm.label}</Badge>
                <StatusDot status={t.status||'active'} />
                <span style={{fontSize:13,fontWeight:600}}>{fmtMoney(t.monthly_fee)}</span>
                <div style={{display:'flex',gap:6}}>
                  <Btn size="sm" variant="ghost" onClick={()=>setEditT(t)}>Editar</Btn>
                  <Btn size="sm" variant="ghost" onClick={async()=>{ await updateTenant(t.id,{status:t.status==='active'?'suspended':'active'}); load() }}>
                    {t.status==='active'?'Suspender':'Activar'}
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {wizard && <TenantWizard onClose={()=>setWizard(false)} onDone={()=>{ setWizard(false); load() }} />}
      {editT  && <EditTenantModal tenant={editT} onClose={()=>setEditT(null)} onDone={()=>{ setEditT(null); load() }} />}
    </div>
  )
}

// ── Wizard Crear Tenant (3 pasos) ────────────────────────────────
function TenantWizard({ onClose, onDone }) {
  const [step,    setStep]    = React.useState(1)
  const [saving,  setSaving]  = React.useState(false)
  const [error,   setError]   = React.useState('')
  const [tenant,  setTenant]  = React.useState({ name:'', slug:'', owner_name:'', owner_email:'', owner_phone:'', monthly_fee:0, notes:'', status:'active' })
  const [account, setAccount] = React.useState({ full_name:'', email:'', password:'' })
  const [planId,  setPlanId]  = React.useState('growth')
  const [createdTenantId, setCreatedTenantId] = React.useState(null)

  async function handleStep1(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const t = await createTenant({ ...tenant, plan_id: planId })
      setCreatedTenantId(t.id)
      setAccount(a=>({...a, full_name: tenant.owner_name, email: tenant.owner_email}))
      setStep(2)
    } catch(e){ setError(e.message) }
    setSaving(false)
  }

  async function handleStep2(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      if (account.email && account.password) {
        await createOwnerAccount({ ...account, tenant_id: createdTenantId, role:'tenant_owner' })
      }
      setStep(3)
    } catch(e){ setError(e.message) }
    setSaving(false)
  }

  const STEPS = [['1','Datos del negocio'],['2','Cuenta del dueño'],['3','Confirmar']]

  return (
    <Modal title="Nuevo Tenant" onClose={onClose} width={620}>
      {/* Stepper */}
      <div style={{display:'flex',gap:0,marginBottom:24,background:C.bg2,borderRadius:10,padding:6}}>
        {STEPS.map(([n,l],i)=>(
          <div key={n} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 4px'}}>
            <div style={{width:28,height:28,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,
              background:Number(n)<=step?C.text:C.border2,
              color:Number(n)<=step?C.bg:C.muted}}>
              {Number(n)<step?'✓':n}
            </div>
            <span style={{fontSize:11,fontWeight:Number(n)===step?600:400,color:Number(n)===step?C.text:C.muted,textAlign:'center'}}>{l}</span>
          </div>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {/* PASO 1: Datos del negocio */}
      {step===1 && (
        <form onSubmit={handleStep1} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Field label="Nombre del negocio *" style={{gridColumn:'1/-1'}}>
            <input style={inp} required value={tenant.name}
              onChange={e=>setTenant(t=>({...t,name:e.target.value,slug:t.slug||slugify(e.target.value)}))}
              placeholder="Pizzería Roma" />
          </Field>
          <Field label="Slug (URL) *" hint="Solo minúsculas, números y guiones">
            <input style={inp} required value={tenant.slug}
              onChange={e=>setTenant(t=>({...t,slug:slugify(e.target.value)}))}
              placeholder="pizzeria-roma" />
          </Field>
          <Field label="Fee mensual (€)">
            <input style={inp} type="number" min={0} value={tenant.monthly_fee}
              onChange={e=>setTenant(t=>({...t,monthly_fee:Number(e.target.value)}))} placeholder="29" />
          </Field>
          <Field label="Nombre del dueño">
            <input style={inp} value={tenant.owner_name}
              onChange={e=>setTenant(t=>({...t,owner_name:e.target.value}))} placeholder="Juan García" />
          </Field>
          <Field label="Email del dueño">
            <input style={inp} type="email" value={tenant.owner_email}
              onChange={e=>setTenant(t=>({...t,owner_email:e.target.value}))} placeholder="juan@negocio.com" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={tenant.owner_phone}
              onChange={e=>setTenant(t=>({...t,owner_phone:e.target.value}))} placeholder="+34 600 000 000" />
          </Field>
          <Field label="Plan" style={{gridColumn:'1/-1'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:4}}>
              {Object.entries(PLAN_META).map(([id,pm])=>(
                <button key={id} type="button" onClick={()=>setPlanId(id)} style={{padding:'10px 8px',borderRadius:10,border:`2px solid ${planId===id?pm.color:C.border2}`,background:planId===id?`${pm.color}12`:'transparent',cursor:'pointer',fontFamily:'inherit',transition:'.12s'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{pm.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:planId===id?pm.color:C.text}}>{pm.label}</div>
                  <div style={{fontSize:11,color:C.muted}}>{pm.price}/mes</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas internas" style={{gridColumn:'1/-1'}}>
            <textarea style={{...inp,height:70,resize:'vertical'}} value={tenant.notes}
              onChange={e=>setTenant(t=>({...t,notes:e.target.value}))} placeholder="Notas sobre el cliente…" />
          </Field>
          <div style={{gridColumn:'1/-1',display:'flex',gap:8}}>
            <Btn type="submit" disabled={saving}>{saving?'Creando…':'Crear tenant →'}</Btn>
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          </div>
        </form>
      )}

      {/* PASO 2: Cuenta del dueño */}
      {step===2 && (
        <form onSubmit={handleStep2} style={{display:'grid',gap:14}}>
          <div style={{padding:'12px 14px',background:'#eff6ff',borderRadius:10,fontSize:13,color:'#1e40af'}}>
            ✅ Tenant <strong>{tenant.name}</strong> creado. Ahora crea la cuenta de acceso del dueño.
          </div>
          <Field label="Nombre completo *">
            <input style={inp} required value={account.full_name} onChange={e=>setAccount(a=>({...a,full_name:e.target.value}))} placeholder="Juan García" />
          </Field>
          <Field label="Email de acceso *">
            <input style={inp} type="email" required value={account.email} onChange={e=>setAccount(a=>({...a,email:e.target.value}))} placeholder="juan@negocio.com" />
          </Field>
          <Field label="Contraseña temporal *" hint="El dueño deberá cambiarla en su primer inicio de sesión">
            <input style={inp} required value={account.password} onChange={e=>setAccount(a=>({...a,password:e.target.value}))} placeholder="Mínimo 8 caracteres" />
          </Field>
          <div style={{display:'flex',gap:8}}>
            <Btn type="submit" disabled={saving}>{saving?'Creando cuenta…':'Crear cuenta →'}</Btn>
            <Btn variant="ghost" type="button" onClick={()=>setStep(3)}>Saltar (sin cuenta)</Btn>
          </div>
        </form>
      )}

      {/* PASO 3: Confirmación */}
      {step===3 && (
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{fontSize:56,marginBottom:16}}>🎉</div>
          <h3 style={{margin:'0 0 8px',fontSize:20,fontWeight:800}}>¡Tenant creado!</h3>
          <p style={{color:C.muted,fontSize:14,marginBottom:24}}>
            <strong>{tenant.name}</strong> está listo. {account.email && `Cuenta creada para ${account.email}.`}
          </p>
          <div style={{display:'flex',gap:8,justifyContent:'center'}}>
            <Btn onClick={onDone}>Ver todos los tenants</Btn>
            <Btn variant="ghost" onClick={()=>{ setStep(1); setTenant({name:'',slug:'',owner_name:'',owner_email:'',owner_phone:'',monthly_fee:0,notes:'',status:'active'}); setAccount({full_name:'',email:'',password:''}); setPlanId('growth'); setCreatedTenantId(null) }}>Crear otro</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Editar Tenant ─────────────────────────────────────────────────
function EditTenantModal({ tenant, onClose, onDone }) {
  const [form,   setForm]   = React.useState({ name:tenant.name, owner_name:tenant.owner_name||'', owner_email:tenant.owner_email||'', owner_phone:tenant.owner_phone||'', monthly_fee:tenant.monthly_fee||0, status:tenant.status||'active', notes:tenant.notes||'' })
  const [saving, setSaving] = React.useState(false)
  const [error,  setError]  = React.useState('')
  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    try { await updateTenant(tenant.id, form); onDone() }
    catch(e){ setError(e.message) }
    setSaving(false)
  }
  return (
    <Modal title={`Editar: ${tenant.name}`} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSave} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Field label="Nombre *" style={{gridColumn:'1/-1'}}>
          <input style={inp} required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        </Field>
        <Field label="Nombre del dueño">
          <input style={inp} value={form.owner_name} onChange={e=>setForm(f=>({...f,owner_name:e.target.value}))} />
        </Field>
        <Field label="Email del dueño">
          <input style={inp} type="email" value={form.owner_email} onChange={e=>setForm(f=>({...f,owner_email:e.target.value}))} />
        </Field>
        <Field label="Teléfono">
          <input style={inp} value={form.owner_phone} onChange={e=>setForm(f=>({...f,owner_phone:e.target.value}))} />
        </Field>
        <Field label="Fee mensual (€)">
          <input style={inp} type="number" value={form.monthly_fee} onChange={e=>setForm(f=>({...f,monthly_fee:Number(e.target.value)}))} />
        </Field>
        <Field label="Estado" style={{gridColumn:'1/-1'}}>
          <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="archived">Archivado</option>
            <option value="draft">Borrador</option>
          </select>
        </Field>
        <Field label="Notas" style={{gridColumn:'1/-1'}}>
          <textarea style={{...inp,height:80,resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
        </Field>
        <div style={{gridColumn:'1/-1',display:'flex',gap:8}}>
          <Btn type="submit" disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
        </div>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════
// STORES TAB
// ══════════════════════════════════════════════════════════════════
function StoresTab() {
  const [stores,   setStores]   = React.useState([])
  const [tenants,  setTenants]  = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [search,   setSearch]   = React.useState('')
  const [tenantF,  setTenantF]  = React.useState('all')

  React.useEffect(()=>{
    Promise.all([listStores(), listTenants()])
      .then(([ss,ts])=>{ setStores(Array.isArray(ss)?ss:[]); setTenants(Array.isArray(ts)?ts:[]) })
      .finally(()=>setLoading(false))
  },[])

  const visible=stores.filter(s=>{
    const q=search.toLowerCase()
    const m=!q||s.name?.toLowerCase().includes(q)||s.slug?.toLowerCase().includes(q)
    const tf=tenantF==='all'||s.tenant_id===tenantF
    return m&&tf
  })

  return (
    <div style={{display:'grid',gap:20}}>
      <SectionHeader title={`Tiendas (${stores.length})`} subtitle="Todas las tiendas de todos los tenants" />
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <input style={{...inp,width:220,flex:'none'}} placeholder="Buscar tienda…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{...inp,width:'auto'}} value={tenantF} onChange={e=>setTenantF(e.target.value)}>
          <option value="all">Todos los tenants</option>
          {tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span style={{fontSize:12,color:C.muted,alignSelf:'center'}}>{visible.length} resultado(s)</span>
      </div>
      {loading?<div style={{textAlign:'center',padding:'3rem',color:C.muted}}>Cargando…</div>:(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {!visible.length&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:'3rem',color:C.muted}}>Sin resultados</div>}
          {visible.map(s=>{
            const niche=NICHES.find(n=>n.id===s.niche)||NICHES[NICHES.length-1]
            const tenant=tenants.find(t=>t.id===s.tenant_id)
            const branches=s.branches?.[0]?.count||s.branches_count||0
            return (
              <div key={s.id} style={{...card,padding:0}}>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${niche.color}14`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{niche.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>/{s.slug}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:20,background:s.status==='active'?'#f0fdf4':'#fef2f2',color:s.status==='active'?'#16a34a':'#dc2626'}}>{s.status==='active'?'Activa':'Inactiva'}</span>
                </div>
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{fontSize:12,color:C.muted}}>🏢 {tenant?.name||'Sin tenant'} · 📍 {s.city||'Sin ciudad'}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <Badge color={niche.color}>{niche.label}</Badge>
                    {s.template_id&&<Badge color="#6366f1">{s.template_id}</Badge>}
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:4}}>
                    <Btn size="sm" variant="ghost" onClick={()=>window.open(`/s/${s.slug}/menu`,'_blank')}>Ver menú ↗</Btn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PLANS TAB
// ══════════════════════════════════════════════════════════════════
function PlansTab() {
  const [tenants, setTenants] = React.useState([])
  const [saving,  setSaving]  = React.useState({})
  const [search,  setSearch]  = React.useState('')

  React.useEffect(()=>{ listTenants().then(ts=>setTenants(Array.isArray(ts)?ts:[])) },[])

  async function changePlan(tenantId, planId) {
    setSaving(s=>({...s,[tenantId]:true}))
    try { await updateTenant(tenantId, { plan_id: planId }); setTenants(ts=>ts.map(t=>t.id===tenantId?{...t,plan_id:planId}:t)) }
    catch(e){ alert(e.message) }
    setSaving(s=>({...s,[tenantId]:false}))
  }

  const PLAN_FEATURES = {
    starter:    ['Menú digital','1 tienda','1 sede','Pedidos básicos'],
    growth:     ['Todo Starter','5 tiendas','10 sedes','Staff ilimitado','Chatbot WhatsApp'],
    pro:        ['Todo Growth','Tiendas ilimitadas','Analytics avanzado','API acceso','Personalización avanzada'],
    enterprise: ['Todo Pro','SLA prioritario','Integración custom','Multi-idioma','Soporte dedicado'],
  }

  return (
    <div style={{display:'grid',gap:24}}>
      <SectionHeader title="Gestión de Planes" subtitle="Compara planes y asigna a cada tenant" />

      {/* Comparison table */}
      <div style={{...card}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,fontWeight:700,fontSize:15}}>Comparativa de planes</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:C.bg2}}>
                <th style={{padding:'12px 16px',textAlign:'left',borderBottom:`1px solid ${C.border}`,fontWeight:600,fontSize:12,color:C.muted,textTransform:'uppercase',letterSpacing:'.05em'}}>Característica</th>
                {Object.entries(PLAN_META).map(([id,pm])=>(
                  <th key={id} style={{padding:'12px 16px',textAlign:'center',borderBottom:`1px solid ${C.border}`,borderLeft:`1px solid ${C.border}`}}>
                    <div style={{fontSize:20,marginBottom:4}}>{pm.icon}</div>
                    <div style={{fontWeight:700,color:pm.color}}>{pm.label}</div>
                    <div style={{fontSize:12,color:C.muted,fontWeight:400}}>{pm.price}/mes</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(PLAN_FEATURES)[0].map((_,i)=>{
                const featuresByPlan=Object.entries(PLAN_FEATURES)
                const row0=featuresByPlan[0][1][i]
                return (
                  <tr key={i}>
                    <td style={{padding:'10px 16px',borderBottom:`1px solid ${C.border}`,color:C.muted,fontSize:13}}>{row0}</td>
                    {featuresByPlan.map(([pid,feats])=>(
                      <td key={pid} style={{padding:'10px 16px',textAlign:'center',borderBottom:`1px solid ${C.border}`,borderLeft:`1px solid ${C.border}`}}>
                        {i<feats.length?<span style={{color:'#16a34a',fontSize:16}}>✓</span>:<span style={{color:C.border2,fontSize:16}}>—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-tenant plan override */}
      <div style={card}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,fontSize:15}}>Plan por tenant</span>
          <input style={{...inp,width:200}} placeholder="Buscar tenant…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {tenants.filter(t=>!search||t.name?.toLowerCase().includes(search.toLowerCase())).map(t=>{
          const pm=PLAN_META[t.plan_id]||PLAN_META.starter
          return (
            <div key={t.id} style={{padding:'13px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{t.owner_email||'Sin email'}</div>
              </div>
              <Badge color={pm.color}>{pm.icon} Plan actual: {pm.label}</Badge>
              <div style={{display:'flex',gap:6}}>
                {Object.entries(PLAN_META).map(([pid,pm2])=>(
                  <button key={pid} onClick={()=>changePlan(t.id,pid)} disabled={saving[t.id]||t.plan_id===pid} style={{
                    padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:600,cursor:t.plan_id===pid?'default':'pointer',fontFamily:'inherit',
                    border:`2px solid ${t.plan_id===pid?pm2.color:C.border2}`,
                    background:t.plan_id===pid?`${pm2.color}14`:'transparent',
                    color:t.plan_id===pid?pm2.color:C.muted,transition:'.12s',
                  }}>{pm2.icon} {pm2.label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
