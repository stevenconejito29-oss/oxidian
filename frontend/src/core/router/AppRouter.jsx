import React from 'react'
import { Navigate, createBrowserRouter, Outlet } from 'react-router-dom'
import { AuthProvider } from '../providers/AuthProvider'
import { ProtectedRoute } from '../guards/ProtectedRoute'
import AppLayout from '../app/AppLayout'

// Auth
import LoginPage from '../../modules/auth/pages/LoginPage'
import UnauthorizedPage from '../../modules/auth/pages/UnauthorizedPage'

// Super Admin
import LandingPage from '../../modules/admin/pages/LandingPage'
import SuperAdminPage from '../../modules/admin/pages/SuperAdminPage'
import OnboardingPage from '../../modules/admin/pages/OnboardingPage'

// Tenant
import TenantAdminPage from '../../modules/tenant/pages/TenantAdminPage'
import TenantAffiliatesPage from '../../modules/tenant/pages/TenantAffiliatesPage'

// Branch — operaciones y panel completo
import BranchAdminPage from '../../modules/branch/pages/BranchAdminPage'
import BranchKitchenPage from '../../modules/branch/pages/BranchKitchenPage'
import BranchRidersPage from '../../modules/branch/pages/BranchRidersPage'

// Public storefront
import PublicMenuPage from '../../modules/public-menu/pages/PublicMenuPage'

// Legacy (sin guards por compatibilidad)
import LegacyAdminPage from '../../legacy/pages/Admin'
import LegacyMenuPage from '../../legacy/pages/Menu'
import LegacyKitchenPage from '../../legacy/pages/Pedidos'
import LegacyRidersPage from '../../legacy/pages/Repartidor'
import LegacySuperPage from '../../legacy/pages/OxidianPage'

/**
 * AuthRoot — Envuelve todo el árbol de rutas con AuthProvider.
 * AuthProvider necesita estar dentro de RouterProvider para poder
 * usar useNavigate, de ahí este wrapper en la raíz del árbol.
 */
function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export const appRouter = createBrowserRouter([
  {
    element: <AuthRoot />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          // ── Públicas ────────────────────────────────────────────
          { index: true, element: <LandingPage /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'unauthorized', element: <UnauthorizedPage /> },
          {
            path: 'storefront/menu',
            element: <PublicMenuPage />,
          },
          {
            path: 's/:storeSlug/menu',
            element: <PublicMenuPage />,
          },

          // ── Super Admin ─────────────────────────────────────────
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
              <ProtectedRoute roles={['super_admin']}>
                <OnboardingPage />
              </ProtectedRoute>
            ),
          },

          // ── Tenant ──────────────────────────────────────────────
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

          // ── Branch — panel completo ──────────────────────────────
          {
            path: 'branch/admin',
            element: (
              <ProtectedRoute roles={[
                'super_admin', 'tenant_owner', 'store_admin',
                'store_operator', 'branch_manager', 'cashier',
              ]}>
                <BranchAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'branch/kitchen',
            element: (
              <ProtectedRoute roles={[
                'super_admin', 'tenant_owner', 'store_admin',
                'branch_manager', 'kitchen',
              ]}>
                <BranchKitchenPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'branch/riders',
            element: (
              <ProtectedRoute roles={[
                'super_admin', 'tenant_owner', 'store_admin',
                'branch_manager', 'rider',
              ]}>
                <BranchRidersPage />
              </ProtectedRoute>
            ),
          },

          // ── Legacy (sin guards — compatibilidad) ─────────────────
          { path: 'legacy/admin', element: <LegacyAdminPage /> },
          { path: 'legacy/menu', element: <LegacyMenuPage /> },
          { path: 'legacy/pedidos', element: <LegacyKitchenPage /> },
          { path: 'legacy/repartidor', element: <LegacyRidersPage /> },
          { path: 'legacy/super', element: <LegacySuperPage /> },

          // ── Redirects ────────────────────────────────────────────
          { path: 'menu', element: <Navigate to="/storefront/menu" replace /> },
          { path: 'pedidos', element: <Navigate to="/branch/kitchen" replace /> },
          { path: 'repartidor', element: <Navigate to="/branch/riders" replace /> },

          // ── 404 ──────────────────────────────────────────────────
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
