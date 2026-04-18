-- Oxidian seed de perfiles por rol
-- Ejecutar completo en Supabase SQL Editor.
--
-- Requisitos:
-- 1. Los correos ya deben existir en auth.users.
-- 2. Si dejas tenant/store/branch vacios, el script intentara autodetectarlos.

do $$
declare
  p_tenant_ref text := '';
  p_store_ref text := '';
  p_branch_ref text := '';

  p_super_admin_email text := 'admin@tucorreo.com';
  p_tenant_owner_email text := 'dueno@tucorreo.com';
  p_tenant_admin_email text := 'tenantadmin@tucorreo.com';
  p_store_admin_email text := 'storeadmin@tucorreo.com';
  p_store_operator_email text := 'storeop@tucorreo.com';
  p_branch_manager_email text := 'encargado@tucorreo.com';
  p_cashier_email text := 'caja@tucorreo.com';
  p_kitchen_email text := 'cocina@tucorreo.com';
  p_rider_email text := 'rider@tucorreo.com';

  v_tenant_id uuid;
  v_store_id text;
  v_branch_id uuid;
  v_branch_tenant_id uuid;
  v_branch_store_id text;
  v_user_id uuid;
begin
  create temp table if not exists pg_temp.seed_role_emails (
    email text primary key
  ) on commit drop;

  truncate table pg_temp.seed_role_emails;

  insert into pg_temp.seed_role_emails(email)
  select x.email
  from (
    values
      (nullif(trim(p_super_admin_email), '')),
      (nullif(trim(p_tenant_owner_email), '')),
      (nullif(trim(p_tenant_admin_email), '')),
      (nullif(trim(p_store_admin_email), '')),
      (nullif(trim(p_store_operator_email), '')),
      (nullif(trim(p_branch_manager_email), '')),
      (nullif(trim(p_cashier_email), '')),
      (nullif(trim(p_kitchen_email), '')),
      (nullif(trim(p_rider_email), ''))
  ) as x(email)
  where x.email is not null;

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

  raise notice 'Contexto resuelto -> tenant_id: %, store_id: %, branch_id: %',
    v_tenant_id, v_store_id, v_branch_id;

  -- super_admin
  if nullif(trim(p_super_admin_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_super_admin_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'super_admin', null, null, null, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_super_admin_email;
    end if;
  end if;

  -- tenant_owner
  if nullif(trim(p_tenant_owner_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_tenant_owner_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'tenant_owner', v_tenant_id, null, null, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_tenant_owner_email;
    end if;
  end if;

  -- tenant_admin
  if nullif(trim(p_tenant_admin_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_tenant_admin_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'tenant_admin', v_tenant_id, null, null, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_tenant_admin_email;
    end if;
  end if;

  -- store_admin
  if nullif(trim(p_store_admin_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_store_admin_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'store_admin', v_tenant_id, v_store_id, null, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_store_admin_email;
    end if;
  end if;

  -- store_operator
  if nullif(trim(p_store_operator_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_store_operator_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'store_operator', v_tenant_id, v_store_id, null, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_store_operator_email;
    end if;
  end if;

  -- branch_manager
  if nullif(trim(p_branch_manager_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_branch_manager_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'branch_manager', v_tenant_id, v_store_id, v_branch_id, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_branch_manager_email;
    end if;
  end if;

  -- cashier
  if nullif(trim(p_cashier_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_cashier_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'cashier', v_tenant_id, v_store_id, v_branch_id, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_cashier_email;
    end if;
  end if;

  -- kitchen
  if nullif(trim(p_kitchen_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_kitchen_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'kitchen', v_tenant_id, v_store_id, v_branch_id, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_kitchen_email;
    end if;
  end if;

  -- rider
  if nullif(trim(p_rider_email), '') is not null then
    select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_rider_email)) limit 1;
    if v_user_id is not null then
      insert into public.user_memberships(user_id, role, tenant_id, store_id, branch_id, is_active)
      values (v_user_id, 'rider', v_tenant_id, v_store_id, v_branch_id, true)
      on conflict (user_id, role, tenant_id, store_id, branch_id)
      do update set is_active = true, updated_at = now();
    else
      raise warning 'Usuario no encontrado: %', p_rider_email;
    end if;
  end if;
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
join pg_temp.seed_role_emails e on lower(e.email) = lower(u.email)
order by u.email, m.role;
