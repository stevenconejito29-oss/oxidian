-- ============================================================
-- OXIDIAN SAAS
-- Migración 0002: Autorización de chatbot portable + sistema de cuentas
-- ============================================================

begin;

-- 1. Autorización de chatbot portable por branch (solo Super Admin puede conceder)
alter table public.branches
  add column if not exists chatbot_authorized boolean not null default false,
  add column if not exists chatbot_authorized_at timestamptz,
  add column if not exists chatbot_authorized_by uuid references auth.users(id),
  add column if not exists chatbot_store_id text,      -- store_id que usará el portable
  add column if not exists chatbot_wa_secret text,     -- secreto único para este portable
  add column if not exists chatbot_last_seen timestamptz,
  add column if not exists chatbot_version text;

comment on column public.branches.chatbot_authorized is
'Si el Super Admin ha autorizado esta sede para descargar y usar el chatbot portable.';
comment on column public.branches.chatbot_wa_secret is
'Secreto único generado al autorizar. Se incluye en el .env del portable.';

-- 2. Tabla de actividad del portable (ping desde el servidor local)
create table if not exists public.chatbot_portable_pings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id text not null,
  wa_connected boolean not null default false,
  chatbot_version text,
  ai_provider text,
  ping_at timestamptz not null default timezone('utc', now())
);

create index if not exists chatbot_pings_branch_idx on public.chatbot_portable_pings(branch_id);
create index if not exists chatbot_pings_at_idx on public.chatbot_portable_pings(ping_at desc);

alter table public.chatbot_portable_pings enable row level security;

-- Solo super admin puede leer pings (info sensible de conectividad)
drop policy if exists chatbot_pings_super_admin on public.chatbot_portable_pings;
create policy chatbot_pings_super_admin
  on public.chatbot_portable_pings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- El propio branch puede insertar su ping
drop policy if exists chatbot_pings_branch_insert on public.chatbot_portable_pings;
create policy chatbot_pings_branch_insert
  on public.chatbot_portable_pings
  for insert to authenticated
  with check (public.can_access_scope(tenant_id, store_id, branch_id));

-- 3. Logs de autorización (auditoría)
create table if not exists public.chatbot_authorization_log (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  action text not null check (action in ('authorized', 'revoked', 'regenerated_secret')),
  performed_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.chatbot_authorization_log enable row level security;
create policy chatbot_auth_log_super_admin on public.chatbot_authorization_log
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- 4. Tabla de sesiones de cuenta por nivel (state de onboarding + activación)
create table if not exists public.account_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  store_id text references public.stores(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  onboarding_completed boolean not null default false,
  onboarding_step text not null default 'welcome',
  activated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_activations_unique_user_role unique (user_id, role, tenant_id, store_id, branch_id)
);

alter table public.account_activations enable row level security;
create policy account_activations_own on public.account_activations
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- 5. Función para generar secreto seguro del portable
create or replace function public.generate_chatbot_secret()
returns text
language plpgsql
security definer
as $$
declare
  secret text;
begin
  select encode(gen_random_bytes(24), 'hex') into secret;
  return secret;
end;
$$;

-- 6. Función para autorizar/revocar chatbot (solo super admin)
create or replace function public.authorize_branch_chatbot(
  p_branch_id uuid,
  p_authorize boolean default true,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_branch public.branches%rowtype;
  v_secret text;
  v_action text;
begin
  -- Solo super admin
  if not public.is_super_admin() then
    raise exception 'Solo el Super Admin puede autorizar el chatbot portable';
  end if;

  select * into v_branch from public.branches where id = p_branch_id;
  if not found then
    raise exception 'Branch no encontrada';
  end if;

  if p_authorize then
    v_secret := public.generate_chatbot_secret();
    v_action := 'authorized';
    update public.branches set
      chatbot_authorized = true,
      chatbot_authorized_at = timezone('utc', now()),
      chatbot_authorized_by = auth.uid(),
      chatbot_store_id = v_branch.store_id,
      chatbot_wa_secret = v_secret
    where id = p_branch_id;
  else
    v_action := 'revoked';
    update public.branches set
      chatbot_authorized = false,
      chatbot_wa_secret = null
    where id = p_branch_id;
    v_secret := null;
  end if;

  insert into public.chatbot_authorization_log (branch_id, action, performed_by, note)
  values (p_branch_id, v_action, auth.uid(), p_note);

  return jsonb_build_object(
    'authorized', p_authorize,
    'branch_id', p_branch_id,
    'store_id', v_branch.store_id,
    'wa_secret', v_secret,
    'action', v_action
  );
end;
$$;

-- 7. Función para regenerar el secreto (sin revocar la autorización)
create or replace function public.regenerate_chatbot_secret(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el Super Admin puede regenerar el secreto';
  end if;

  if not exists (select 1 from public.branches where id = p_branch_id and chatbot_authorized) then
    raise exception 'Branch no autorizada o no encontrada';
  end if;

  v_secret := public.generate_chatbot_secret();
  update public.branches set chatbot_wa_secret = v_secret where id = p_branch_id;

  insert into public.chatbot_authorization_log (branch_id, action, performed_by, note)
  values (p_branch_id, 'regenerated_secret', auth.uid(), 'Regenerado desde panel Super Admin');

  return jsonb_build_object('wa_secret', v_secret, 'branch_id', p_branch_id);
end;
$$;

-- 8. RLS adicional: branches que SÍ pueden ver su propio chatbot_wa_secret
-- (solo si están autorizadas y quien accede es el branch manager de esa branch)
drop policy if exists branches_own_chatbot_config on public.branches;
create policy branches_own_chatbot_config
  on public.branches
  for select to authenticated
  using (
    public.can_access_scope(tenant_id, store_id, id)
  );

-- 9. Índices de rendimiento adicionales para queries frecuentes
create index if not exists products_store_active_idx
  on public.products(store_id, is_active)
  where is_active = true;

create index if not exists orders_branch_status_idx
  on public.orders(branch_id, status, created_at desc);

create index if not exists orders_store_date_idx
  on public.orders(store_id, created_at desc);

-- 10. Políticas RLS de lectura pública para menú (clientes sin autenticar)
-- products
drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and s.public_visible = true
        and s.status = 'active'
    )
  );

-- combos
drop policy if exists combos_public_read on public.combos;
create policy combos_public_read
  on public.combos
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.stores s
      where s.id = combos.store_id
        and s.public_visible = true
        and s.status = 'active'
    )
  );

-- toppings
drop policy if exists toppings_public_read on public.toppings;
create policy toppings_public_read
  on public.toppings
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.stores s
      where s.id = toppings.store_id
        and s.public_visible = true
        and s.status = 'active'
    )
  );

-- topping_categories
drop policy if exists topping_categories_public_read on public.topping_categories;
create policy topping_categories_public_read
  on public.topping_categories
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = topping_categories.store_id
        and s.public_visible = true
        and s.status = 'active'
    )
  );

commit;
