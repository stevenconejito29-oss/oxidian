-- ============================================================
-- FIX DEFINITIVO: RLS user_memberships sin ninguna recursión
-- Ejecutar COMPLETO en Supabase SQL Editor
-- ============================================================

-- ─── PASO 1: Eliminar TODAS las políticas existentes ─────────────
-- (incluida la que crea recursión en migración 0001)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_memberships'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_memberships', pol.policyname);
  END LOOP;
END $$;

-- ─── PASO 2: Función is_super_admin sin recursión ────────────────
-- SECURITY DEFINER = las queries internas de esta función
-- se ejecutan como superusuario, evitando la evaluación de RLS.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- service_role siempre puede todo
    auth.role() = 'service_role'
    -- claim en el JWT (rápido, sin query)
    OR coalesce(
      nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role', ''),
      ''
    ) = 'super_admin'
    OR coalesce(
      nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
      ''
    ) = 'super_admin'
    -- membresía en BD (la función es SECURITY DEFINER, sin recursión)
    OR EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id  = auth.uid()
        AND m.role      = 'super_admin'
        AND m.is_active = true
    )
$$;

-- ─── PASO 3: Solo 2 políticas simples, cero recursión ────────────

-- Cualquier usuario autenticado puede leer SUS PROPIAS filas.
-- Esta política NO llama a ninguna función auxiliar.
CREATE POLICY "memberships_own_read"
  ON public.user_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admin puede hacer TODO.
-- is_super_admin() es SECURITY DEFINER → no recursa.
CREATE POLICY "memberships_super_admin_all"
  ON public.user_memberships
  FOR ALL
  TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- NOTA: INSERT/UPDATE/DELETE para tenants/staff se hace desde
-- el backend Flask (service_role key) que bypasea RLS.
-- El frontend solo hace SELECT de sus propias filas.

-- ─── PASO 4: Asegurar membresía super_admin ──────────────────────
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = 'pepemellamoyoo@oxidian.app'
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Usuario no encontrado. Créalo en Auth > Users primero.';
    RETURN;
  END IF;

  DELETE FROM public.user_memberships WHERE user_id = v_uid;

  INSERT INTO public.user_memberships
    (user_id, role, tenant_id, store_id, branch_id, is_active)
  VALUES
    (v_uid, 'super_admin', NULL, NULL, NULL, true);

  RAISE NOTICE 'OK: membresía super_admin creada para %', v_uid;
END $$;

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
SELECT
  pol.policyname,
  pol.cmd,
  pol.permissive
FROM pg_policies pol
WHERE pol.tablename = 'user_memberships'
  AND pol.schemaname = 'public'
ORDER BY pol.policyname;
