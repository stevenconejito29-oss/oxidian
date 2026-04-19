-- DIAGNÓSTICO — pega y ejecuta en Supabase SQL Editor

-- 1. Ver políticas activas
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename='user_memberships' AND schemaname='public';

-- 2. Ver columnas de la tabla
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name='user_memberships' AND table_schema='public'
ORDER BY ordinal_position;

-- 3. Ver la membresía del super admin
SELECT id, user_id, role, is_active
FROM public.user_memberships
WHERE role = 'super_admin';

-- 4. Probar is_super_admin() directamente
SELECT public.is_super_admin() AS resultado;
