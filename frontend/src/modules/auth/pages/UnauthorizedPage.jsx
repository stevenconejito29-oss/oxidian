import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../core/providers/AuthProvider'
import { Shell, Hero, Notice } from '../../../shared/ui/ControlDeck'
import { ROLE_HOME } from '../../../core/router/roleHome'

export default function UnauthorizedPage() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const home = ROLE_HOME[role] || '/'

  return (
    <Shell>
      <Hero
        eyebrow="Acceso denegado"
        title="No tienes permiso para ver esta página"
        description="Tu cuenta tiene un rol diferente. Usa el acceso correcto para tu nivel de usuario."
        signals={[{ label: 'Tu rol', value: role || 'anónimo' }]}
      />
      <Notice tone="error">
        No puedes acceder a esta sección con el rol <strong>{role}</strong>.
      </Notice>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={() => navigate(home)}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          Ir a mi panel
        </button>
        <button onClick={signOut}
          style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-border-secondary)',
            background: 'transparent', color: 'var(--color-text-primary)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          Cerrar sesión
        </button>
      </div>
    </Shell>
  )
}
