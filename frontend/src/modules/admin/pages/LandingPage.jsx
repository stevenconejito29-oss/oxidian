import React from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../../legacy/lib/supabase'
import { useAuth } from '../../../core/providers/AuthProvider'

const ROLE_HOME = {
  super_admin:    '/admin',
  tenant_owner:   '/tenant/admin',
  tenant_admin:   '/tenant/admin',
  store_admin:    '/branch/admin',
  store_operator: '/branch/admin',
  branch_manager: '/branch/admin',
  kitchen:        '/branch/kitchen',
  rider:          '/branch/riders',
  cashier:        '/branch/admin',
}

const FEATURES = [
  { icon:'🏪', title:'Multi-tienda', desc:'Un dueño puede tener varias tiendas con nichos distintos desde una sola cuenta.' },
  { icon:'📍', title:'Sedes ilimitadas', desc:'Cada tienda puede operar en múltiples ubicaciones físicas con staff independiente.' },
  { icon:'🎛', title:'Módulos flexibles', desc:'Activa solo lo que necesitas: citas, delivery, inventario, mesas o tallas.' },
  { icon:'🤖', title:'Chatbot WhatsApp', desc:'Bot portable por QR que atiende clientes en WhatsApp desde cualquier dispositivo.' },
  { icon:'⭐', title:'Fidelidad por niveles', desc:'Sistema de puntos y tiers personalizables: Bronze, Plata, Oro, Diamante.' },
  { icon:'📊', title:'Panel completo', desc:'Dashboard, finanzas, staff, afiliados y reseñas en una sola interfaz.' },
]

const PLANS = [
  { id:'starter',    name:'Starter',    price:'$29', stores:1,  branches:1,  highlight:false },
  { id:'growth',     name:'Growth',     price:'$59', stores:3,  branches:3,  highlight:true  },
  { id:'pro',        name:'Pro',        price:'$99', stores:10, branches:10, highlight:false },
  { id:'enterprise', name:'Enterprise', price:'A medida', stores:'∞', branches:'∞', highlight:false },
]

const NICHOS = ['Barbería','Comida rápida','Restaurante','Tienda barrio','Ropa/Moda','Servicios']

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14,
  border:'1px solid var(--color-border-secondary)',
  background:'var(--color-background-primary)',
  color:'var(--color-text-primary)', fontFamily:'inherit',
  boxSizing:'border-box', outline:'none',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role, loading } = useAuth()

  // Usuarios ya autenticados no deben ver el landing — mandarlos a su panel
  if (!loading && isAuthenticated && role !== 'anonymous') {
    return <Navigate to={ROLE_HOME[role] || '/tenant/admin'} replace />
  }

  const [form, setForm] = React.useState({
    full_name:'', email:'', phone:'', business_name:'', business_niche:'', city:'', message:''
  })
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState('')
  const patch = (k,v) => setForm(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault(); setSending(true); setError('')
    try {
      const { error: err } = await supabase.from('landing_requests').insert({
        full_name: form.full_name, email: form.email, phone: form.phone,
        business_name: form.business_name, business_niche: form.business_niche,
        city: form.city, message: form.message, source:'landing', status:'pending',
      })
      if (err) throw err
      setSent(true)
    } catch(e) { setError(e.message) }
    setSending(false)
  }

  const sec = { padding:'4rem 2rem', maxWidth:880, margin:'0 auto' }
  const h2 = { fontSize:26, fontWeight:500, marginBottom:10 }
  const sub = { fontSize:15, color:'var(--color-text-secondary)', lineHeight:1.7, marginBottom:32 }

  return (
    <div style={{ background:'var(--color-background-primary)' }}>

      {/* HERO */}
      <div style={{ ...sec, textAlign:'center', paddingTop:'5rem', paddingBottom:'3rem' }}>
        <div style={{ display:'inline-block', background:'var(--color-background-secondary)',
          borderRadius:20, padding:'4px 14px', fontSize:12, color:'var(--color-text-secondary)',
          marginBottom:20, border:'0.5px solid var(--color-border-tertiary)' }}>
          SaaS para negocios independientes
        </div>
        <h1 style={{ fontSize:40, fontWeight:500, lineHeight:1.2, marginBottom:16, letterSpacing:'-0.5px' }}>
          Tu tienda en línea, lista en 5 minutos
        </h1>
        <p style={{ fontSize:16, color:'var(--color-text-secondary)', maxWidth:540, margin:'0 auto 32px', lineHeight:1.7 }}>
          Crea tu tienda con pedidos, delivery, chatbot de WhatsApp y gestión de staff.
          Sin código. Funciona para barberías, restaurantes, tiendas y más.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <a href="#solicitar" style={{ padding:'11px 28px', borderRadius:8, fontSize:14,
            background:'var(--color-text-primary)', color:'var(--color-background-primary)',
            textDecoration:'none', fontWeight:500 }}>
            Solicitar acceso
          </a>
          <button onClick={() => navigate('/login')} style={{ padding:'11px 28px', borderRadius:8,
            fontSize:14, border:'1px solid var(--color-border-secondary)', cursor:'pointer',
            background:'transparent', color:'var(--color-text-secondary)', fontFamily:'inherit' }}>
            Ya tengo cuenta
          </button>
        </div>
      </div>

      {/* NICHOS */}
      <div style={{ ...sec, paddingTop:'2rem' }}>
        <p style={{ textAlign:'center', fontSize:13, color:'var(--color-text-secondary)', marginBottom:16 }}>
          Compatible con cualquier tipo de negocio
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
          {NICHOS.map(n => (
            <span key={n} style={{ padding:'5px 14px', borderRadius:20, fontSize:13,
              border:'0.5px solid var(--color-border-secondary)',
              color:'var(--color-text-secondary)', background:'var(--color-background-secondary)' }}>
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* FUNCIONALIDADES */}
      <div style={{ ...sec }}>
        <h2 style={{ ...h2, textAlign:'center' }}>Todo lo que necesita tu negocio</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ padding:'20px', borderRadius:12,
              border:'0.5px solid var(--color-border-tertiary)',
              background:'var(--color-background-secondary)' }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{f.icon}</div>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>{f.title}</div>
              <div style={{ fontSize:13, color:'var(--color-text-secondary)', lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLANES */}
      <div style={{ ...sec }}>
        <h2 style={{ ...h2, textAlign:'center' }}>Planes transparentes</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{ padding:'20px', borderRadius:12,
              border: p.highlight ? '2px solid var(--color-text-primary)' : '0.5px solid var(--color-border-tertiary)',
              background:'var(--color-background-primary)', textAlign:'center' }}>
              {p.highlight && <div style={{ fontSize:11, background:'var(--color-text-primary)',
                color:'var(--color-background-primary)', borderRadius:4, padding:'2px 8px',
                display:'inline-block', marginBottom:8 }}>Más popular</div>}
              <div style={{ fontSize:14, fontWeight:500 }}>{p.name}</div>
              <div style={{ fontSize:28, fontWeight:500, margin:'8px 0' }}>{p.price}</div>
              <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>
                <div>{p.stores} tienda{p.stores !== 1 ? 's' : ''}</div>
                <div>{p.branches} sede{p.branches !== 1 ? 's' : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FORMULARIO */}
      <div id="solicitar" style={{ ...sec }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <h2 style={{ ...h2, textAlign:'center' }}>Solicitar acceso</h2>
          <p style={{ ...sub, textAlign:'center', marginBottom:24 }}>
            Revisamos cada solicitud y te contactamos en 24 horas para configurar tu cuenta.
          </p>
          {sent ? (
            <div style={{ textAlign:'center', padding:'2rem', background:'var(--color-background-secondary)',
              borderRadius:12, fontSize:14 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontWeight:500, marginBottom:6 }}>Solicitud enviada</div>
              <div style={{ color:'var(--color-text-secondary)' }}>
                Te contactaremos en {form.email} en las próximas 24 horas.
              </div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display:'grid', gap:14 }}>
              {error && <div style={{ padding:'10px', background:'var(--color-background-danger)',
                color:'var(--color-text-danger)', borderRadius:8, fontSize:13 }}>{error}</div>}
              {[
                ['Nombre completo','full_name','María García','text',true],
                ['Email de contacto','email','maria@negocio.com','email',true],
                ['Teléfono / WhatsApp','phone','+34 600 000 000','tel',false],
                ['Nombre del negocio','business_name','Panadería La Masa','text',false],
                ['Ciudad','city','Madrid','text',false],
              ].map(([label, key, ph, type, req]) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
                    {label}{req ? ' *' : ''}
                  </label>
                  <input style={inp} type={type} required={req} placeholder={ph}
                    value={form[key]} onChange={e => patch(key, e.target.value)} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
                  Tipo de negocio
                </label>
                <select style={inp} value={form.business_niche} onChange={e => patch('business_niche', e.target.value)}>
                  <option value="">Selecciona...</option>
                  {NICHOS.map(n => <option key={n} value={n.toLowerCase()}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--color-text-secondary)', marginBottom:5 }}>
                  Cuéntanos más (opcional)
                </label>
                <textarea style={{ ...inp, minHeight:80, resize:'vertical' }}
                  placeholder="¿Qué necesitas? ¿Cuántas sedes tienes?..."
                  value={form.message} onChange={e => patch('message', e.target.value)} />
              </div>
              <button type="submit" disabled={sending} style={{ padding:'11px', borderRadius:8,
                border:'none', background:'var(--color-text-primary)', color:'var(--color-background-primary)',
                fontSize:14, fontWeight:500, cursor:sending ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ textAlign:'center', padding:'2rem', fontSize:12, color:'var(--color-text-tertiary)',
        borderTop:'0.5px solid var(--color-border-tertiary)' }}>
        Oxidian SaaS · Todos los derechos reservados
      </div>
    </div>
  )
}
