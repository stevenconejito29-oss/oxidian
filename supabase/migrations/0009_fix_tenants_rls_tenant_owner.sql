-- ============================================================
-- MIGRACIÓN 0009: Políticas RLS para tabla tenants
--
-- PROBLEMA: El tenant_owner recibe "permission denied for table tenants"
-- porque no existe ninguna política que le permita leer su propio tenant.
-- Solo super_admin (via is_super_admin()) tenía acceso completo.
--
-- SOLUCIÓN: Agregar política SELECT para que cada tenant_owner/admin
-- pueda leer únicamente su propio tenant (scoped por tenant_id de su membresía).
-- ============================================================

BEGIN;

-- ─── Limpiar política anterior si existe ─────────────────────────
DROP POLICY IF EXISTS tenants_own_read ON public.tenants;
DROP POLICY IF EXISTS tenants_super_admin ON public.tenants;

-- ─── Super admin: acceso total ───────────────────────────────────
CREATE POLICY tenants_super_admin
  ON public.tenants
  FOR ALL
  TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── Tenant owner/admin: solo lee SU propio tenant ───────────────
-- Usa EXISTS para evitar recursión: no llama a can_access_scope,
-- consulta user_memberships directamente con SECURITY DEFINER implícito
-- del contexto del usuario autenticado.
CREATE POLICY tenants_own_read
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_memberships m
      WHERE m.user_id   = auth.uid()
        AND m.tenant_id = public.tenants.id
        AND m.is_active = true
        AND m.role IN ('tenant_owner', 'tenant_admin')
    )
  );

-- ─── Política INSERT bloqueada para usuarios normales ────────────
-- Los INSERT en tenants SOLO se hacen desde el backend Flask
-- con service_role key (bypasea RLS completamente).
-- No se crea política de INSERT para authenticated → denegado por defecto.

COMMIT;

-- ============================================================
-- VERIFICACIÓN:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'tenants' AND schemaname = 'public'
-- ORDER BY policyname;
-- Debe mostrar: tenants_own_read (SELECT), tenants_super_admin (ALL)
-- ============================================================
