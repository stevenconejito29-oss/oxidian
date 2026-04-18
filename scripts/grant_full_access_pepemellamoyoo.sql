-- Acceso total para un solo usuario
-- Usuario objetivo:
--   email: pepemellamoyoo@oxidian.app
--   password sugerida para crear en Supabase Auth: Oxidian#2026!Acceso
--
-- Importante:
-- 1. Crea primero el usuario en Supabase Authentication > Users
-- 2. Marca "Auto Confirm User" al crearlo
-- 3. Luego ejecuta este script completo en SQL Editor

do $$
declare
  p_email text := 'pepemellamoyoo@oxidian.app';
  p_tenant_ref text := '';
  p_store_ref text := '';
  p_branch_ref text := '';

  v_user_id uuid;
  v_tenant_id uuid;
  v_store_id text;
  v_branch_id uuid;
  v_branch_tenant_id uuid;
  v_branch_store_id text;
begin
  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'El usuario % no existe en auth.users. Crealo primero en Supabase Auth.', p_email;
  end if;

  if nullif(trim(p_branch_ref), '') is not null then
    select b.id, b.tenant_id, b.store_id
      into v_branch_id, v_branch_tenant_id, v_branch_store_id
    from public.branches b
    where b.name = p_branch_ref
       or b.id::text = p_branch_ref
    order by b.is_primary desc nulls last, b.created_at desc nulls last, b.id
    limit 1;
  end if;

  if v_branch_id is null then
    select b.id, b.tenant_id, b.store_id
      into v_branch_id, v_branch_tenant_id, v_branch_store_id
    from public.branches b
    order by b.is_primary desc nulls last, b.created_at desc nulls last, b.id
    limit 1;
  end if;

  if nullif(trim(p_store_ref), '') is not null then
    select s.id
      into v_store_id
    from public.stores s
    where s.id = p_store_ref
       or s.name = p_store_ref
    order by s.created_at desc nulls last, s.id
    limit 1;
  end if;

  if v_store_id is null and v_branch_store_id is not null then
    v_store_id := v_branch_store_id;
  end if;

  if v_store_id is null then
    select s.id
      into v_store_id
    from public.stores s
    order by s.created_at desc nulls last, s.id
    limit 1;
  end if;

  if nullif(trim(p_tenant_ref), '') is not null then
    select t.id
      into v_tenant_id
    from public.tenants t
    where t.name = p_tenant_ref
       or t.id::text = p_tenant_ref
    order by t.created_at desc nulls last, t.id
    limit 1;
  end if;

  if v_tenant_id is null and v_branch_tenant_id is not null then
    v_tenant_id := v_branch_tenant_id;
  end if;

  if v_tenant_id is null and v_store_id is not null then
    select s.tenant_id
      into v_tenant_id
    from public.stores s
    where s.id = v_store_id
    limit 1;
  end if;

  if v_tenant_id is null then
    select t.id
      into v_tenant_id
    from public.tenants t
    order by t.created_at desc nulls last, t.id
    limit 1;
  end if;

  if v_tenant_id is null then
    raise exception 'No se pudo resolver tenant';
  end if;

  if v_store_id is null then
    raise exception 'No se pudo resolver store';
  end if;

  if v_branch_id is null then
    raise exception 'No se pudo resolver branch';
  end if;

  raise notice 'Contexto -> tenant_id: %, store_id: %, branch_id: %', v_tenant_id, v_store_id, v_branch_id;

  insert into public.user_memberships (user_id, role, tenant_id, store_id, branch_id, is_active)
  values
    (v_user_id, 'super_admin', null, null, null, true),
    (v_user_id, 'tenant_owner', v_tenant_id, null, null, true),
    (v_user_id, 'tenant_admin', v_tenant_id, null, null, true),
    (v_user_id, 'store_admin', v_tenant_id, v_store_id, null, true),
    (v_user_id, 'store_operator', v_tenant_id, v_store_id, null, true),
    (v_user_id, 'branch_manager', v_tenant_id, v_store_id, v_branch_id, true),
    (v_user_id, 'cashier', v_tenant_id, v_store_id, v_branch_id, true),
    (v_user_id, 'kitchen', v_tenant_id, v_store_id, v_branch_id, true),
    (v_user_id, 'rider', v_tenant_id, v_store_id, v_branch_id, true)
  on conflict (user_id, role, tenant_id, store_id, branch_id)
  do update set is_active = true, updated_at = now();
end
$$;

select
  u.email,
  m.role,
  m.tenant_id,
  m.store_id,
  m.branch_id,
  m.is_active
from public.user_memberships m
join auth.users u on u.id = m.user_id
where lower(u.email) = lower('pepemellamoyoo@oxidian.app')
order by m.role;
