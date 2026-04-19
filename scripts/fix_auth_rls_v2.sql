-- ============================================================
-- FIX CRÍTICO v4 — Sin ON CONFLICT con NULLs
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ─── PASO 1: Política self-read (rompe la recursión circular) ────
drop policy if exists user_memberships_self_read on public.user_memberships;
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- ─── PASO 2: is_super_admin() corregida ──────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role',  ''), '') = 'super_admin'
    or coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''), '') = 'super_admin'
    or exists (
      select 1 from public.user_memberships m
      where m.user_id = auth.uid()
        and m.role = 'super_admin'
        and m.is_active = true
    )
$$;

-- ─── PASO 3: Membresía super_admin (DELETE + INSERT limpio) ──────
do $$
declare
  v_uid uuid;
begin
  select id into v_uid
  from auth.users
  where lower(email) = 'pepemellamoyoo@oxidian.app'
  limit 1;

  if v_uid is null then
    raise notice 'AVISO: usuario no encontrado en auth.users';
    return;
  end if;

  -- Borrar cualquier membresía previa del usuario que no sea super_admin
  delete from public.user_memberships
  where user_id = v_uid and role::text != 'super_admin';

  -- Borrar si ya existe super_admin para hacer INSERT limpio
  delete from public.user_memberships
  where user_id = v_uid and role::text = 'super_admin';

  -- Insertar fresca
  insert into public.user_memberships
    (user_id, role, tenant_id, store_id, branch_id, is_active)
  values
    (v_uid, 'super_admin', null, null, null, true);

  raise notice 'OK: membresía super_admin creada para %', v_uid;
end
$$;

-- ─── PASO 4: Política write para super_admin ─────────────────────
drop policy if exists user_memberships_super_admin_all on public.user_memberships;
create policy user_memberships_super_admin_all
  on public.user_memberships
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
select
  u.email,
  m.role::text      as role,
  m.is_active,
  m.created_at
from public.user_memberships m
join auth.users u on u.id = m.user_id
where lower(u.email) = 'pepemellamoyoo@oxidian.app';
