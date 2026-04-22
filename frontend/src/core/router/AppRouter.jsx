import React from 'react'
import { Navigate, createBrowserRouter, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '../providers/AuthProvider'
import { PlanProvider } from '../../shared/hooks/usePlan'
import { ProtectedRoute } from '../guards/ProtectedRoute'
import { ROLE_HOME } from './roleHome'
import AppLayout from '../app/AppLayout'

import LoginPage from '../../modules/auth/pages/LoginPage'
import UnauthorizedPage from '../../modules/auth/pages/UnauthorizedPage'
import StaffLoginPage from '../../modules/auth/pages/StaffLoginPage'

import LandingPage from '../../modules/admin/pages/LandingPage'
import SuperAdminPage from '../../modules/admin/pages/SuperAdminPage'
import OnboardingPage from '../../modules/admin/pages/OnboardingPage'

import TenantAdminPage from '../../modules/tenant/pages/TenantAdminPage'
import TenantAffiliatesPage from '../../modules/tenant/pages/TenantAffiliatesPage'

import BranchAdminPage from '../../modules/branch/pages/BranchAdminPage'
import BranchKitchenPage from '../../modules/branch/pages/BranchKitchenPage'
import BranchRidersPage from '../../modules/branch/pages/BranchRidersPage'

import LegacyAdminPage from '../../legacy/pages/Admin'
import LegacyMenuPage from '../../legacy/pages/Menu'
import LegacyKitchenPage from '../../legacy/pages/Pedidos'
import LegacyRidersPage from '../../legacy/pages/Repartidor'
import LegacySuperPage from '../../legacy/pages/OxidianPage'

import PublicMenuPage from '../../modules/public-menu/pages/PublicMenuPage'

function AuthRoot() {
  return <AuthProvider><PlanProvider><Outlet /></PlanProvider></AuthProvider>
}

function SessionLoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-tertiary)',
      padding: '2rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 16,
        padding: '1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Verificando acceso</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Estamos comprobando tu sesion para mostrarte el panel correcto.
        </div>
      </div>
    </div>
  )
}

function PendingApprovalScreen({ email, signOut }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-tertiary)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 460,
        width: '100%',
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 16,
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>Pendiente</div>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Cuenta pendiente de aprobacion</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
          Tu cuenta ya fue creada, pero todavia no ha sido habilitada por el super admin para entrar al panel.
        </p>
        {email && (
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>
            Cuenta detectada: <strong>{email}</strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { window.location.href = '/login' }}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-text-primary)',
              color: 'var(--color-background-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ir al login
          </button>
          <button
            onClick={() => { signOut?.() }}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: '1px solid var(--color-border-secondary)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionErrorScreen({ authError, retryLoadMembership }) {
  const [retrying, setRetrying] = React.useState(false)

  async function handleRetry() {
    setRetrying(true)
    await retryLoadMembership()
    setRetrying(false)
  }

  const messages = {
    membership_not_found: 'Tu cuenta no tiene un rol asignado. Contacta al administrador.',
    membership_load_failed: 'Error al verificar la sesion.',
    membership_exception: 'Error inesperado al cargar tu sesion.',
  }

  const rawDetail = authError?.includes(':') ? authError.split(':').slice(1).join(':') : null
  const baseKey = authError?.split(':')[0] || authError

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-tertiary)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 16,
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>Error</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Problema con la sesion</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: rawDetail ? 8 : 24 }}>
          {messages[baseKey] || 'No se pudo cargar tu perfil de acceso.'}
        </p>
        {rawDetail && (
          <pre style={{
            fontSize: 11,
            background: '#1a1a1a',
            color: '#f87171',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 20,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>{rawDetail}</pre>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleRetry} disabled={retrying} style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-text-primary)',
            color: 'var(--color-background-primary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: retrying ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: retrying ? 0.7 : 1,
          }}>
            {retrying ? 'Verificando...' : 'Reintentar'}
          </button>
          <button onClick={() => { window.location.href = '/login' }} style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: '1px solid var(--color-border-secondary)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Volver al login
          </button>
        </div>
      </div>
    </div>
  )
}

function HomeEntry() {
  const {
    loading,
    isAuthenticated,
    isPendingApproval,
    role,
    authError,
    retryLoadMembership,
    signOut,
    user,
  } = useAuth()

  if (loading) {
    return <SessionLoadingScreen />
  }

  if (isAuthenticated && role && role !== 'anonymous') {
    return <Navigate to={ROLE_HOME[role] || '/tenant/admin'} replace />
  }

  if (isAuthenticated && isPendingApproval && role === 'anonymous') {
    return <PendingApprovalScreen email={user?.email} signOut={signOut} />
  }

  if (isAuthenticated) {
    return (
      <SessionErrorScreen
        authError={authError || 'membership_not_found'}
        retryLoadMembership={retryLoadMembership}
      />
    )
  }

  return <LandingPage />
}

export const appRouter = createBrowserRouter([
  {
    element: <AuthRoot />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeEntry /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'unauthorized', element: <UnauthorizedPage /> },

          { path: 's/:storeSlug/:branchSlug/login', element: <StaffLoginPage /> },

          { path: 's/:storeSlug/menu', element: <PublicMenuPage /> },
          { path: 's/:storeSlug/menu/:branchSlug', element: <PublicMenuPage /> },
          { path: 'storefront/menu', element: <PublicMenuPage /> },

          {
            path: 'admin',
            element: (
              <ProtectedRoute roles={['super_admin']}>
                <SuperAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'onboarding',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'tenant_admin']}>
                <OnboardingPage />
              </ProtectedRoute>
            ),
          },

          {
            path: 'tenant/admin',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'tenant_admin', 'store_admin']}>
                <TenantAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'tenant/affiliates',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'tenant_admin']}>
                <TenantAffiliatesPage />
              </ProtectedRoute>
            ),
          },

          {
            path: 'branch/admin',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'store_admin', 'store_operator', 'branch_manager', 'cashier']}>
                <BranchAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'branch/kitchen',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'store_admin', 'branch_manager', 'kitchen']}>
                <BranchKitchenPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'branch/riders',
            element: (
              <ProtectedRoute roles={['super_admin', 'tenant_owner', 'store_admin', 'branch_manager', 'rider']}>
                <BranchRidersPage />
              </ProtectedRoute>
            ),
          },

          { path: 'legacy/admin', element: <LegacyAdminPage /> },
          { path: 'legacy/menu', element: <LegacyMenuPage /> },
          { path: 'legacy/pedidos', element: <LegacyKitchenPage /> },
          { path: 'legacy/repartidor', element: <LegacyRidersPage /> },
          { path: 'legacy/super', element: <LegacySuperPage /> },

          { path: 'menu', element: <Navigate to="/storefront/menu" replace /> },
          { path: 'pedidos', element: <Navigate to="/branch/kitchen" replace /> },
          { path: 'repartidor', element: <Navigate to="/branch/riders" replace /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
