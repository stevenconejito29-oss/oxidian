import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'
import {
  Actions, Button, GhostButton, Grid, Hero, Notice, Panel, QuickLinks, Shell, Stats,
} from '../../../shared/ui/ControlDeck'

export default function TenantAdminPage() {
  const { tenantId, role } = useAuth()
  const navigate = useNavigate()
  const [stores, setStores] = React.useState([])
  const [branches, setBranches] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [subInfo, setSubInfo] = React.useState(null)

  React.useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    Promise.all([
      supabase.from('stores').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('branches')
        .select('id, name, slug, city, status, store_id, stores(name, slug)')
        .eq('tenant_id', tenantId).order('name'),
      supabase.from('tenant_subscriptions')
        .select('plan_id, status, store_plans(name, monthly_price)')
        .eq('tenant_id', tenantId).maybeSingle(),
    ]).then(([{ data: s }, { data: b }, { data: sub }]) => {
      setStores(s ?? [])
      setBranches(b ?? [])
      setSubInfo(sub)
      setLoading(false)
    })
  }, [tenantId])

  if (!tenantId) return (
    <Shell>
      <Notice tone="error">
        Tu cuenta no tiene un tenant asignado. Contacta con el administrador o ve a{' '}
        <a href="/onboarding" style={{ color:'inherit' }}>configurar tu tienda</a>.
      </Notice>
    </Shell>
  )

  if (loading) return <Shell><Notice>Cargando tu cuenta...</Notice></Shell>

  function copyText(txt) {
    navigator.clipboard.writeText(txt).catch(() => {})
  }

  return (
    <Shell>
      <Hero
        eyebrow={`Panel del dueÃ±o Â· ${role}`}
        title="Mis tiendas y sedes"
        description="Gestiona cada tienda, sus sedes y los links de acceso del staff."
        signals={[
          { label: 'Plan', value: subInfo?.store_plans?.name ?? 'â€”' },
          { label: 'Tiendas', value: String(stores.length) },
          { label: 'Sedes', value: String(branches.length) },
        ]}
      />

      <Grid>
        {/* â”€â”€ Tiendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Panel title="Mis tiendas">
          {stores.length === 0
            ? <Notice>AÃºn no tienes tiendas. Crea tu primera desde el botÃ³n de abajo.</Notice>
            : stores.map(s => (
              <div key={s.id} style={{ padding:'12px 0',
                borderBottom:'1px solid var(--color-border-tertiary)',
                display:'flex', justifyContent:'space-between',
                alignItems:'center', gap:12 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:14 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                    {s.niche ?? s.business_type} Â· {s.city ?? 'â€”'} Â· {s.status}
                  </div>
                  <div style={{ fontSize:10, color:'var(--color-text-tertiary)', marginTop:2,
                    fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    /s/{s.slug}/menu
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <GhostButton type="button" style={{ fontSize:11 }}
                    onClick={() => window.open(`/s/${s.slug}/menu`)}>
                    Ver menÃº
                  </GhostButton>
                  <GhostButton type="button" style={{ fontSize:11 }}
                    onClick={() => navigate('/branch/admin')}>
                    Admin
                  </GhostButton>
                </div>
              </div>
            ))
          }
          <div style={{ marginTop:16 }}>
            <Button type="button" onClick={() => navigate('/onboarding')}>
              + Crear nueva tienda
            </Button>
          </div>
        </Panel>

        {/* â”€â”€ Sedes + links de staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Panel title="Sedes y accesos de staff" dark>
          {branches.length === 0
            ? <Notice>Sin sedes. Se crean durante el onboarding de cada tienda.</Notice>
            : branches.map(b => {
              const storeSlug = b.stores?.slug ?? b.store_id
              const loginUrl = `${window.location.origin}/s/${storeSlug}/${b.slug}/login`
              return (
                <div key={b.id} style={{ padding:'12px 0',
                  borderBottom:'1px solid var(--color-border-tertiary)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:500, fontSize:13 }}>
                        {b.name}
                        <span style={{ marginLeft:8, fontSize:11,
                          color:'var(--color-text-secondary)', fontWeight:400 }}>
                          â€” {b.stores?.name}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:1 }}>
                        {b.city ?? 'â€”'} Â· {b.status}
                      </div>
                    </div>
                    <GhostButton type="button" style={{ fontSize:10, flexShrink:0 }}
                      onClick={() => copyText(loginUrl)}>
                      Copiar link
                    </GhostButton>
                  </div>
                  <div style={{ marginTop:5, padding:'5px 8px',
                    background:'var(--color-background-primary)',
                    borderRadius:6, border:'0.5px solid var(--color-border-tertiary)' }}>
                    <div style={{ fontSize:9, color:'var(--color-text-tertiary)',
                      marginBottom:2 }}>Link de login para staff:</div>
                    <code style={{ fontSize:10, wordBreak:'break-all' }}>{loginUrl}</code>
                  </div>
                </div>
              )
            })
          }
        </Panel>

        {/* â”€â”€ Accesos rÃ¡pidos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Panel title="Accesos rÃ¡pidos">
          <QuickLinks links={[
            { emoji:'ðŸ¬', title:'Panel de tienda', text:'Productos, pedidos, staff y configuraciÃ³n.', href:'/branch/admin' },
            { emoji:'ðŸ½', title:'Vista cocina', text:'Cola de preparaciÃ³n en tiempo real.', href:'/branch/kitchen' },
            { emoji:'ðŸ›µ', title:'Vista repartidores', text:'Tablero de despacho y delivery.', href:'/branch/riders' },
            { emoji:'âž•', title:'Nueva tienda', text:'Crea otra tienda con un nicho diferente.', href:'/onboarding' },
          ]} />
        </Panel>
      </Grid>
    </Shell>
  )
}
