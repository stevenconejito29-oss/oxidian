-- ================================================================
-- OXIDIAN — Parche de corrección SQL
-- ERROR: 42803 column "m.role" must appear in GROUP BY
-- CAUSA: ORDER BY fuera del aggregate jsonb_agg()
-- SOLUCIÓN: Mover ORDER BY DENTRO de jsonb_agg(... ORDER BY ...)
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. Corregir get_my_membership ────────────────────────────────
-- ORDER BY movido DENTRO de jsonb_agg()
create or replace function public.get_my_membership()
returns jsonb
language sql
stable
security definer
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'role',      m.role,
          'tenant_id', m.tenant_id,
          'store_id',  m.store_id,
          'branch_id', m.branch_id,
          'is_active', m.is_active
        )
        order by
          case m.role
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
      )
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
    ),
    '[]'::jsonb
  );
$$;

-- ── 2. Corregir invite_member (limpieza de sintaxis) ─────────────
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
begin
  -- Verificar permisos
  if not public.is_super_admin() then
    if not exists (
      select 1 from public.user_memberships
      where user_id = auth.uid()
        and role in ('tenant_owner', 'tenant_admin')
        and tenant_id = p_tenant_id
        and is_active = true
    ) then
      raise exception 'Sin permisos para invitar miembros';
    end if;
  end if;

  if p_role = 'super_admin' and not public.is_super_admin() then
    raise exception 'Solo el Super Admin puede asignar rol super_admin';
  end if;

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
    'role',      p_role::text,
    'email',     p_email,
    'tenant_id', p_tenant_id,
    'store_id',  p_store_id,
    'branch_id', p_branch_id
  );
end;
$$;

-- ── 3. Corregir revoke_member ────────────────────────────────────
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
        and role = 'tenant_owner'
        and tenant_id = p_tenant_id
        and is_active = true
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
    and role != 'super_admin'
    and (p_tenant_id is null or tenant_id = p_tenant_id);

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'success', true,
    'revoked', v_count,
    'email',   p_email
  );
end;
$$;

-- ── 4. Corregir trigger de order_number ─────────────────────────
create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
declare
  next_num integer;
begin
  if new.order_number is null or new.order_number = '' then
    select coalesce(
      max(
        case
          when order_number ~ '^#[0-9]+$'
          then cast(substring(order_number from 2) as integer)
          else 0
        end
      ), 0
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

-- ── 5. Índices de rendimiento ────────────────────────────────────
create index if not exists reviews_store_approved_idx
  on public.reviews(store_id, approved);

create index if not exists daily_sales_store_date_idx
  on public.daily_sales_summary(store_id, date desc);

-- ── 6. Verificar que todo funciona ───────────────────────────────
-- Probar la función corregida (devuelve [] si no hay usuario autenticado)
select public.get_my_membership();

-- Probar make_super_admin existe
select proname from pg_proc
where proname in ('make_super_admin','invite_member','revoke_member',
                  'get_my_membership','clone_store_catalog',
                  'authorize_branch_chatbot','custom_jwt_claims')
order by proname;
