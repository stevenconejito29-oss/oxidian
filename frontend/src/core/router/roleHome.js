/**
 * roleHome.js — Mapa de rol → ruta de inicio.
 * Archivo independiente para evitar importaciones circulares.
 */
export const ROLE_HOME = {
  super_admin:    '/admin',
  tenant_owner:   '/tenant/admin',
  tenant_admin:   '/tenant/admin',
  store_admin:    '/branch/admin',
  store_operator: '/branch/admin',
  branch_manager: '/branch/admin',
  cashier:        '/branch/admin',
  kitchen:        '/branch/kitchen',
  rider:          '/branch/riders',
}
