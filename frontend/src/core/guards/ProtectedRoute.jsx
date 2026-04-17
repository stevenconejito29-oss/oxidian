import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

/**
 * ProtectedRoute — Guard por rol.
 * roles: lista de roles permitidos. Si vacío, solo requiere autenticación.
 */
export function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 14, color: 'var(--color-text-secondary)' }}>
        Verificando sesión...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

/**
 * RoleGate — Muestra children solo si el usuario tiene uno de los roles.
 * No redirige — solo oculta el contenido.
 */
export function RoleGate({ roles = [], children, fallback = null }) {
  const { role } = useAuth()
  if (!roles.includes(role)) return fallback
  return children
}
