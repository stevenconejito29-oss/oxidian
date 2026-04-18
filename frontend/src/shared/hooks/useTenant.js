import { useAuth } from '../../core/providers/AuthProvider'

export function useTenant() {
  const auth = useAuth()
  return {
    userId:          auth.user?.id ?? null,
    userEmail:       auth.user?.email ?? null,
    role:            auth.role,
    tenantId:        auth.tenantId,
    storeId:         auth.storeId,
    branchId:        auth.branchId,
    isSuperAdmin:    auth.isSuperAdmin,
    isTenantOwner:   auth.isTenantOwner,
    isStoreAdmin:    auth.isStoreAdmin,
    isBranchOp:      auth.isBranchOp,
    isAuthenticated: auth.isAuthenticated,
    loading:         auth.loading,
  }
}
