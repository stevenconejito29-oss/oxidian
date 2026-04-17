import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

const NAV_LINKS = {
  super_admin: [
    { to: '/admin', label: '⚡ Super Admin' },
    { to: '/tenant/admin', label: '🏬 Tenant' },
    { to: '/branch/admin', label: '📍 Branch' },
  ],
  tenant_owner: [
    { to: '/tenant/admin', label: '🏬 Mi tienda' },
    { to: '/tenant/affiliates', label: '🔗 Afiliados' },
    { to: '/branch/admin', label: '📍 Sede' },
  ],
  tenant_admin: [
    { to: '/tenant/admin', label: '🏬 Mi tienda' },
    { to: '/branch/admin', label: '📍 Sede' },
  ],
  store_admin:    [{ to: '/branch/admin', label: '📍 Panel sede' }],
  store_operator: [{ to: '/branch/admin', label: '📍 Panel sede' }],
  branch_manager: [
    { to: '/branch/admin',   label: '📍 Mi sede' },
    { to: '/branch/kitchen', label: '🍽️ Cocina' },
    { to: '/branch/riders',  label: '🛵 Reparto' },
  ],
  kitchen: [{ to: '/branch/kitchen', label: '🍽️ Cocina' }],
  rider:   [{ to: '/branch/riders',  label: '🛵 Reparto' }],
  cashier: [{ to: '/branch/admin',   label: '📍 Mi sede' }],
}

export default function UserMenu() {
  const { user, role, isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const links = NAV_LINKS[role] || []

  if (!isAuthenticated) return null

  return (
    <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {links.slice(0, 3).map(l => (
          <Link key={l.to} to={l.to} style={{
            fontSize: 12, padding: '5px 10px', borderRadius: 20,
            border: '0.5px solid var(--color-border-secondary)',
            color: 'var(--color-text-secondary)', textDecoration: 'none',
            background: 'var(--color-background-primary)', transition: '.15s',
          }}>{l.label}</Link>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--color-background-info)', color: 'var(--color-text-info)',
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}>
          {(user?.email || 'U').slice(0, 2).toUpperCase()}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 38, right: 0, minWidth: 200,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 10, padding: '6px 0', boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          }}>
            <div style={{ padding: '6px 14px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.email}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{role}</div>
            </div>
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} style={{
                display: 'block', padding: '7px 14px', fontSize: 13,
                color: 'var(--color-text-primary)', textDecoration: 'none',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{l.label}</Link>
            ))}
            <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', marginTop: 4 }}>
              <button onClick={() => { setOpen(false); signOut(); navigate('/login') }} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 14px', fontSize: 13, border: 'none',
                background: 'transparent', color: 'var(--color-text-danger)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
