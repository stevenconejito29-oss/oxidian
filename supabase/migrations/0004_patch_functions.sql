-- ================================================================
-- OXIDIAN — Parche post-migración
-- Ejecutar en SQL Editor si ya aplicaste RESET_COMPLETE.sql
-- Añade funciones faltantes y correcciones menores
-- ================================================================

-- ── 1. Función invite_member (FALTABA) ───────────────────────────
create or replace function public.invite_member(
  p_email     text,
  p_role      public.app_role,
  p_tenant_id uuid    default null,
  p_store_id  text    default null,
  p_branch_id uuid    default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_caller_role text;
begin
  -- Verificar quién llama
  v_caller_role := public.current_request_app_role();

  -- Solo super_admin o tenant_owner del mismo tenant pueden invitar
  if not public.is_super_admin() then
    if not exists (
      select 1 from public.user_memberships
      where user_id = auth.uid()
        and role in ('tenant_owner','tenant_admin')
        and tenant_id = p_tenant_id
        and is_active
    ) then
      raise exception 'Sin permisos para invitar miembros';
    end if;
  end if;

  -- Super admin no puede ser asignado por nadie excepto make_super_admin
  if p_role = 'super_admin' and not public.is_super_admin() then
    raise exception 'Solo el Super Admin puede asignar rol super_admin';
  end if;

  -- Buscar usuario por email
  select id into v_user_id
  from auth.users
  where email = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado. Debe registrarse primero en /login.'
    );
  end if;

  -- Insertar o reactivar membresía
  insert into public.user_memberships(
    user_id, role, tenant_id, store_id, branch_id, is_active
  ) values (
    v_user_id, p_role, p_tenant_id, p_store_id, p_branch_id, true
  )
  on conflict (user_id, role, tenant_id, store_id, branch_id)
  do update set
    is_active  = true,
    updated_at = now();

  return jsonb_build_object(
    'success',   true,
    'user_id',   v_user_id,
    'role',      p_role,
    'email',     p_email,
    'tenant_id', p_tenant_id,
    'store_id',  p_store_id,
    'branch_id', p_branch_id
  );
end;
$$;

comment on function public.invite_member is
'Asigna un rol a un usuario existente. Uso:
  SELECT public.invite_member(''email'', ''branch_manager''::app_role, tenant_uuid, ''store-id'', branch_uuid);';

-- ── 2. Función revoke_member ──────────────────────────────────────
create or replace function public.revoke_member(
  p_email     text,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_count   integer;
begin
  if not public.is_super_admin() then
    if not exists (
      select 1 from public.user_memberships
      where user_id = auth.uid()
        and role in ('tenant_owner')
        and tenant_id = p_tenant_id
        and is_active
    ) then
      raise exception 'Sin permisos para revocar miembros';
    end if;
  end if;

  select id into v_user_id from auth.users
  where email = lower(trim(p_email)) limit 1;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  end if;

  update public.user_memberships
  set is_active = false, updated_at = now()
  where user_id = v_user_id
    and (p_tenant_id is null or tenant_id = p_tenant_id)
    and role != 'super_admin';

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'success', true,
    'revoked', v_count,
    'email', p_email
  );
end;
$$;

-- ── 3. Función get_my_membership (útil para el frontend) ─────────
create or replace function public.get_my_membership()
returns jsonb
language sql
stable
security definer
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'role',      m.role,
        'tenant_id', m.tenant_id,
        'store_id',  m.store_id,
        'branch_id', m.branch_id,
        'is_active', m.is_active
      ))
      from public.user_memberships m
      where m.user_id = auth.uid() and m.is_active
      order by case m.role
        when 'super_admin'    then 1
        when 'tenant_owner'   then 2
        when 'tenant_admin'   then 3
        when 'store_admin'    then 4
        when 'store_operator' then 5
        when 'branch_manager' then 6
        when 'kitchen'        then 7
        when 'rider'          then 8
        when 'cashier'        then 9
        else 99
      end
    ),
    '[]'::jsonb
  );
$$;

-- ── 4. Índice faltante para reviews ──────────────────────────────
create index if not exists reviews_store_approved_idx
  on public.reviews(store_id, approved);

-- ── 5. Índice para daily_sales_summary ───────────────────────────
create index if not exists daily_sales_store_date_idx
  on public.daily_sales_summary(store_id, date desc);

-- ── 6. Columna order_number auto-generada ────────────────────────
-- Genera #00001, #00002... por tienda
create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
declare
  next_num integer;
begin
  if new.order_number is null or new.order_number = '' then
    select coalesce(
      max(cast(regexp_replace(order_number, '[^0-9]', '', 'g') as integer)), 0
    ) + 1
    into next_num
    from public.orders
    where store_id = new.store_id;

    new.order_number := '#' || lpad(next_num::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_auto_number on public.orders;
create trigger orders_auto_number
  before insert on public.orders
  for each row execute function public.generate_order_number();
