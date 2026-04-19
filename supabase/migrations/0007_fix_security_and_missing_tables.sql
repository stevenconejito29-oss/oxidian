-- ============================================================
-- MIGRACIÓN 0007: Correcciones de seguridad y tablas faltantes
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── 1. SECURITY DEFINER en is_super_admin() ─────────────────────
-- Sin esto, la función consulta user_memberships CON RLS activo,
-- creando recursión infinita cuando user_memberships tiene políticas
-- que llaman a is_super_admin().
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.role() = 'service_role'
    OR coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role', ''), '') = 'super_admin'
    OR coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''), '') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.role = 'super_admin'
        AND m.is_active = true
    )
$$;

-- ─── 2. SECURITY DEFINER en can_access_scope() ───────────────────
-- Misma razón: consulta user_memberships y necesita bypassear RLS
-- para no crear recursión cuando otras tablas usan esta función.
CREATE OR REPLACE FUNCTION public.can_access_scope(
  target_tenant_id uuid,
  target_store_id  text    DEFAULT NULL,
  target_branch_id uuid    DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      public.current_request_tenant_id() IS NOT NULL
      AND public.current_request_tenant_id() = target_tenant_id
      AND (
        public.current_request_app_role() IN ('tenant_owner', 'tenant_admin')
        OR (
          target_store_id IS NOT NULL
          AND public.current_request_store_id() = target_store_id
          AND public.current_request_app_role() IN ('store_admin', 'store_operator', 'branch_manager')
        )
        OR (
          target_branch_id IS NOT NULL
          AND public.current_request_branch_id() = target_branch_id
          AND public.current_request_app_role() IN ('branch_manager', 'kitchen', 'rider', 'cashier')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.user_memberships m
      WHERE m.user_id    = auth.uid()
        AND m.is_active  = true
        AND m.tenant_id  = target_tenant_id
        AND (
          m.role IN ('tenant_owner', 'tenant_admin')
          OR (target_store_id IS NOT NULL AND m.store_id  = target_store_id AND m.role IN ('store_admin', 'store_operator'))
          OR (target_branch_id IS NOT NULL AND m.branch_id = target_branch_id AND m.role IN ('branch_manager', 'kitchen', 'rider', 'cashier'))
        )
    )
$$;

-- ─── 3. Políticas limpias en user_memberships ────────────────────
-- Eliminar TODAS las políticas existentes en user_memberships
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE tablename = 'user_memberships' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_memberships', pol.policyname);
  END LOOP;
END $$;

-- Política 1: cada usuario lee SUS PROPIAS filas.
-- Simple, sin llamadas a funciones externas → cero recursión.
CREATE POLICY "memberships_own_read"
  ON public.user_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Política 2: super_admin puede hacer TODO.
-- is_super_admin() es SECURITY DEFINER → no recursa.
CREATE POLICY "memberships_super_admin_all"
  ON public.user_memberships
  FOR ALL TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- NOTA: INSERT/UPDATE/DELETE para crear staff/owners se hace
-- desde el backend Flask con service_role key (bypasea RLS).

-- ─── 4. Tabla landing_requests (usada en PipelineTab) ────────────
CREATE TABLE IF NOT EXISTS public.landing_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text,
  email           text,
  phone           text,
  business_name   text,
  business_niche  text,
  city            text,
  message         text,
  source          text DEFAULT 'landing',
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','contacted','demo_scheduled','onboarding','converted','rejected','ghosted')),
  contacted_at    timestamptz,
  converted_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_requests ENABLE ROW LEVEL SECURITY;

-- Super admin gestiona los leads
DROP POLICY IF EXISTS landing_requests_super_admin ON public.landing_requests;
CREATE POLICY landing_requests_super_admin
  ON public.landing_requests FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Cualquiera puede insertar (formulario público del landing)
DROP POLICY IF EXISTS landing_requests_public_insert ON public.landing_requests;
CREATE POLICY landing_requests_public_insert
  ON public.landing_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ─── 5. Tabla tenant_subscriptions (usada en TenantsTab) ─────────
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id             text NOT NULL DEFAULT 'growth',
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','cancelled','past_due','trialing')),
  current_period_end  timestamptz,
  stripe_subscription_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_subscriptions_super_admin ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_super_admin
  ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS tenant_subscriptions_scoped ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_scoped
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (public.can_access_scope(tenant_id, NULL, NULL));

-- ─── 6. Columna metadata en user_memberships (si no existe) ──────
ALTER TABLE public.user_memberships
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- ─── 7. Columnas chatbot en branches (si no existen) ─────────────
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS chatbot_authorized    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS chatbot_wa_secret     text,
  ADD COLUMN IF NOT EXISTS chatbot_last_seen     timestamptz,
  ADD COLUMN IF NOT EXISTS chatbot_version       text;

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_super_admin', 'can_access_scope')
ORDER BY routine_name;
-- Debe mostrar security_type = 'DEFINER' para ambas funciones.

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'user_memberships' AND schemaname = 'public'
ORDER BY policyname;
-- Debe mostrar exactamente 2 filas: memberships_own_read, memberships_super_admin_all
