import React from 'react'
import {
  Grid,
  Hero,
  Panel,
  QuickLinks,
  Shell,
  Stats,
} from '../../../shared/ui/ControlDeck'

export default function LandingPage() {
  return (
    <Shell>
      <Hero
        eyebrow="Oxidian · Nuevo sistema de tiendas clonadas"
        title="Una base nueva para owners, marcas, sedes y storefronts vivos."
        description="Este proyecto ya no nace como copia visual de CarmoCream. La estructura y el diseño son nuevos, mientras la lógica útil de pedidos, fidelidad, afiliados, catálogo y chatbot se está migrando por capas."
        signals={[
          { label: 'Arquitectura', value: 'tenant → store → branch' },
          { label: 'Modo', value: 'local first' },
        ]}
      />

      <Grid>
        <Panel title="Estado actual" text="Lo que ya queda montado para empezar a probar sin subir nada todavía.">
          <Stats
            items={[
              { label: 'Frontend', value: 'listo', hint: 'React + Tailwind con router modular y capa legacy temporal.' },
              { label: 'Backend', value: 'listo', hint: 'Flask con app factory, blueprints y tenant scope middleware.' },
              { label: 'Chatbot', value: 'copiado', hint: 'Runtime portable reutilizado desde el proyecto origen.' },
              { label: 'SQL base', value: 'listo', hint: 'Jerarquía multitenant y RLS preparada en migraciones.' },
            ]}
          />
        </Panel>

        <Panel dark title="Entrar al sistema" text="Rutas principales para validar la nueva base antes de empezar el refactor profundo de cada módulo.">
          <QuickLinks
            links={[
              { emoji: '🧠', title: 'Super Admin', text: 'Crear y clonar tiendas con panel nuevo.', href: '/admin' },
              { emoji: '🏬', title: 'Tenant Admin', text: 'Panel nuevo del dueño para la marca activa.', href: '/tenant/admin' },
            { emoji: '🍽️', title: 'Storefront', text: 'Menu público conectado al store activo.', href: '/storefront/menu' },
              { emoji: '📦', title: 'Branch Ops', text: 'Entradas rápidas a cocina y reparto.', href: '/branch/kitchen' },
            ]}
          />
        </Panel>
      </Grid>
    </Shell>
  )
}
