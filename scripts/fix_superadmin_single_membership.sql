-- ============================================================
-- Deja SOLO la membresía super_admin para pepemellamoyoo@oxidian.app
-- Elimina todas las demás membresías (tenant_owner, cashier, etc.)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Obtener el user_id del email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'pepemellamoyoo@oxidian.app'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado: pepemellamoyoo@oxidian.app';
  END IF;

  -- Eliminar TODAS las membresías del usuario
  DELETE FROM public.user_memberships
  WHERE user_id = v_user_id;

  -- Insertar SOLO la membresía super_admin (sin tenant, store ni branch)
  INSERT INTO public.user_memberships (user_id, role, tenant_id, store_id, branch_id, is_active)
  VALUES (v_user_id, 'super_admin', NULL, NULL, NULL, true);

  RAISE NOTICE 'Listo: usuario % tiene solo la membresía super_admin.', v_user_id;
END
$$;

-- Verificar resultado final
SELECT
  u.email,
  m.role,
  m.tenant_id,
  m.store_id,
  m.branch_id,
  m.is_active
FROM public.user_memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE lower(u.email) = 'pepemellamoyoo@oxidian.app'
ORDER BY m.role;
