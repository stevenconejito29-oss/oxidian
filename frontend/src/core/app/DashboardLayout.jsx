/**
 * DashboardLayout — Sidebar + topbar para paneles admin/tenant.
 * Se adapta al rol del usuario y colapsa en móvil.
 */
import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

// ─── Iconos SVG inline (sin dependencias extra) ──────────────────
const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    tenants:   'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    stores:    'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
    users:     'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    pipeline:  'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
    chatbot:   'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
    settings:  'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z',
    logout:    'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
    menu:      'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    close:     'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    overview:  'M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z',
    branch:    'M17 5h-2V3h-2v2H9V3H7v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H5V9h14v12z',
    affiliate: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
    orders:    'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.33 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d={icons[name] || icons.dashboard} />
    </svg>
  )
}

// ─── Definición de navegación por rol ────────────────────────────
const NAV_BY_ROLE = {
  super_admin: [
    { to: '/admin',           icon: 'overview',  label: 'Panel' },
    { to: '/admin#tenants',   icon: 'tenants',   label: 'Tenants',   tab: 'tenants' },
    { to: '/admin#owners',    icon: 'users',     label: 'Dueños',    tab: 'owners' },
    { to: '/admin#pipeline',  icon: 'pipeline',  label: 'Solicitudes', tab: 'pipeline' },
    { to: '/admin#stores',    icon: 'stores',    label: 'Tiendas',   tab: 'stores' },
    { to: '/admin#chatbot',   icon: 'chatbot',   label: 'Chatbot',   tab: 'chatbot' },
  ],
  tenant_owner: [
    { to: '/tenant/admin',            icon: 'overview',   label: 'Panel' },
    { to: '/tenant/admin#stores',     icon: 'stores',     label: 'Tiendas',  tab: 'stores' },
    { to: '/tenant/admin#branches',   icon: 'branch',     label: 'Sedes',    tab: 'branches' },
    { to: '/tenant/admin#staff',      icon: 'users',      label: 'Staff',    tab: 'staff' },
    { to: '/tenant/admin#affiliates', icon: 'affiliate',  label: 'Afiliados', tab: 'affiliates' },
    { to: '/tenant/admin#customize',  icon: 'settings',   label: 'Diseño',   tab: 'customize' },
  ],
  tenant_admin: [
    { to: '/tenant/admin',            icon: 'overview',  label: 'Panel' },
    { to: '/tenant/admin#stores',     icon: 'stores',    label: 'Tiendas',  tab: 'stores' },
    { to: '/tenant/admin#branches',   icon: 'branch',    label: 'Sedes',    tab: 'branches' },
    { to: '/tenant/admin#staff',      icon: 'users',     label: 'Staff',    tab: 'staff' },
  ],
}

function Avatar({ name, role }) {
  const initials = (name || role || '?').slice(0, 2).toUpperCase()
  const colors = { super_admin:'#6366f1', tenant_owner:'#f59e0b', tenant_admin:'#10b981', default:'#64748b' }
  const bg = colors[role] || colors.default
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      background: bg, color: '#fff', fontWeight: 700,
      fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  )
}

export default function DashboardLayout({ children, activeTab, onTabChange, title, subtitle }) {
  const { user, membership, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const navItems = NAV_BY_ROLE[role] || NAV_BY_ROLE['tenant_owner'] || []
  const name = membership?.metadata?.full_name || user?.email?.split('@')[0] || role

  const ROLE_LABELS = {
    super_admin: 'Super Admin',
    tenant_owner: 'Dueño',
    tenant_admin: 'Admin',
    store_admin: 'Admin tienda',
  }

  function handleNavClick(item) {
    if (item.tab && onTabChange) onTabChange(item.tab)
    setMobileOpen(false)
  }

  const W = collapsed ? 60 : 220

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--color-background-secondary)' }}>

      {/* ── Overlay móvil ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:99, display:'none' }}
          className="mobile-overlay"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        width: W, flexShrink: 0, transition: 'width .2s',
        background: 'var(--color-background-primary)',
        borderRight: '1px solid var(--color-border-tertiary)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Logo / Brand */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: '1px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>Oxidian</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                {ROLE_LABELS[role] || role}
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <Icon name={collapsed ? 'menu' : 'close'} size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 8px', overflow: 'auto' }}>
          {navItems.map(item => {
            const isActive = activeTab ? item.tab === activeTab : false
            return (
              <button
                key={item.to}
                onClick={() => handleNavClick(item)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, width: '100%', padding: collapsed ? '10px 0' : '9px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  marginBottom: 2, transition: '.15s',
                  background: isActive ? 'var(--color-background-secondary)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                }}
              >
                <Icon name={item.icon} size={16} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: '1px solid var(--color-border-tertiary)',
          padding: collapsed ? '12px 0' : '12px',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <Avatar name={name} role={role} />
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
          )}
          {!collapsed && (
            <button onClick={signOut} style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
            }}>
              <Icon name="logout" size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{
          background: 'var(--color-background-primary)',
          borderBottom: '1px solid var(--color-border-tertiary)',
          padding: '0 24px', height: 56,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 9,
        }}>
          <div style={{ flex: 1 }}>
            {title && <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>}
            {subtitle && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 10 }}>{subtitle}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {new Date().toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })}
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
