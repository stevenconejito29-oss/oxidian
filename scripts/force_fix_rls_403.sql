-- ============================================================
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → Run
-- Fuerza la corrección del 403 en user_memberships
-- ============================================================

-- 1. Garantizar permisos de schema y tabla al rol authenticated
grant usage on schema public to authenticated;
grant select on public.user_memberships to authenticated;

-- 2. Eliminar TODAS las políticas existentes de user_memberships
--    y recrearlas desde cero sin conflictos
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'user_memberships'
  loop
    execute format(
      'drop policy if exists %I on public.user_memberships',
      pol.policyname
    );
  end loop;
end $$;

-- 3. Asegurar RLS activo
alter table public.user_memberships enable row level security;

-- 4. Política 1: cada usuario lee SUS PROPIAS membresías (sin depender de JWT)
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- 5. Política 2: super_admin puede hacer todo
--    Usa subquery directa en lugar de is_super_admin() para evitar recursión
create policy user_memberships_super_admin_all
  on public.user_memberships
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships m2
      where m2.user_id   = auth.uid()
        and m2.role       = 'super_admin'
        and m2.is_active  = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_memberships m2
      where m2.user_id   = auth.uid()
        and m2.role       = 'super_admin'
        and m2.is_active  = true
    )
  );

-- 6. Política 3: tenant_owner gestiona membresías de su tenant
create policy user_memberships_tenant_owner_manage
  on public.user_memberships
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships owner_m
      where owner_m.user_id  = auth.uid()
        and owner_m.role      = 'tenant_owner'
        and owner_m.is_active = true
        and owner_m.tenant_id = public.user_memberships.tenant_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_memberships owner_m
      where owner_m.user_id  = auth.uid()
        and owner_m.role      = 'tenant_owner'
        and owner_m.is_active = true
        and owner_m.tenant_id = public.user_memberships.tenant_id
    )
  );

-- 7. Verificar políticas activas
select
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename  = 'user_memberships'
order by policyname;
