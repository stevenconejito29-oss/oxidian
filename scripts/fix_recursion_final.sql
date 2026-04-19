-- ============================================================
-- SOLUCIÓN DEFINITIVA — Ejecutar en Supabase SQL Editor
-- Elimina la recursión infinita en user_memberships
-- ============================================================

-- 1. Borrar TODAS las políticas de user_memberships sin excepción
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'user_memberships'
  loop
    execute format('drop policy if exists %I on public.user_memberships', pol.policyname);
  end loop;
end $$;

-- 2. Crear UNA SOLA política: el usuario lee sus propias filas
--    SIN subqueries a user_memberships → imposible recursión
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Verificar: debe aparecer exactamente 1 fila
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'user_memberships';
