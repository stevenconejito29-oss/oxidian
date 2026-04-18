-- ============================================================
-- EJECUTAR COMPLETO EN: Supabase Dashboard > SQL Editor
-- Soluciona el 403 en user_memberships y deja solo
-- la membresía super_admin para pepemellamoyoo@oxidian.app
-- ============================================================

-- ─── PASO 1: Política self-read en user_memberships ──────────
-- Sin esto, AuthProvider recibe 403 y nunca puede leer el role.
-- El círculo vicioso: RLS llama is_super_admin() que necesita
-- leer user_memberships, pero RLS bloquea esa lectura.
-- La solución: un usuario SIEMPRE puede leer SUS PROPIAS filas.

drop policy if exists user_memberships_self_read on public.user_memberships;
create policy user_memberships_self_read
  on public.user_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- ─── PASO 2: Dejar solo membresía super_admin ─────────────────

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'pepemellamoyoo@oxidian.app'
  limit 1;

  if v_user_id is null then
    raise exception 'Usuario no encontrado. Verifica que el email exista en Auth > Users.';
  end if;

  -- Borrar todas las membresías del usuario
  delete from public.user_memberships
  where user_id = v_user_id;

  -- Insertar SOLO super_admin (sin tenant, store ni branch)
  insert into public.user_memberships (user_id, role, tenant_id, store_id, branch_id, is_active)
  values (v_user_id, 'super_admin', null, null, null, true);

  raise notice 'OK: usuario % tiene solo la membresía super_admin.', v_user_id;
end
$$;

-- ─── VERIFICACIÓN FINAL ────────────────────────────────────────
select
  u.email,
  m.role,
  m.tenant_id,
  m.store_id,
  m.branch_id,
  m.is_active
from public.user_memberships m
join auth.users u on u.id = m.user_id
where lower(u.email) = 'pepemellamoyoo@oxidian.app';
