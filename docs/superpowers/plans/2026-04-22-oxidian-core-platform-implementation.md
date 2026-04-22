# Oxidian Core Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Oxidian codebase into the approved multi-store, branch-first platform contract by fixing staff auth, public branch storefront + checkout, schema alignment, and real plan gating without breaking the current owner approval flow.

**Architecture:** First lock the schema and server-side contracts so frontend work stops guessing about tables, roles, and public writes. Then rebuild staff auth and public ordering on those contracts, apply plan gating and wizard constraints, and finish with branch-level public customization foundations plus end-to-end verification.

**Tech Stack:** React 18, Vite, React Router, Supabase JS, Flask serverless on Vercel, PostgreSQL/Supabase RLS, Python unittest, node:test, PowerShell

---

## File map

### Create

- `docs/superpowers/plans/2026-04-22-oxidian-core-platform-implementation.md`
  Responsibility: execution plan for the approved product contract.
- `frontend/tests/useResolvedStoreId.test.mjs`
  Responsibility: verify store and branch scope resolution for new branch routes.
- `frontend/tests/publicBranchCheckoutContract.test.mjs`
  Responsibility: verify public branch checkout payload and branch propagation.
- `frontend/tests/planGateContract.test.mjs`
  Responsibility: verify plan limit and feature gating behavior.
- `test_api_staff_pin_login.py`
  Responsibility: verify server-side staff PIN authentication contract.
- `test_api_public_order_route.py`
  Responsibility: verify secure branch-scoped public order creation.

### Modify

- `PROJECT_STATE.md`
  Append implementation outcomes and architecture decisions after code lands.
- `database_schema.sql`
  Align the repo-level schema contract with the approved store/branch override model.
- `supabase/migrations/RESET_COMPLETE.sql`
  Add or normalize the actual SQL objects and RLS required by the new contract.
- `supabase/migrations/0008_plans_and_feature_overrides.sql`
  Normalize plan/table assumptions so plan runtime and SQL stay aligned.
- `api/index.py`
  Add staff PIN login and secure public order creation endpoints, plus supporting validation.
- `frontend/src/core/providers/AuthProvider.jsx`
  Accept staff-backed identity and preserve native Supabase auth behavior.
- `frontend/src/core/guards/ProtectedRoute.jsx`
  Keep route protection compatible with native + staff identity sources.
- `frontend/src/shared/hooks/useResolvedStoreId.js`
  Resolve `store_id` and `branch_id` correctly for branch-first routes.
- `frontend/src/modules/auth/pages/StaffLoginPage.jsx`
  Replace browser-side staff lookup with backend login and branch-scoped redirect.
- `frontend/src/modules/branch/pages/BranchKitchenPage.jsx`
  Use explicit branch/store scope from query params and auth context.
- `frontend/src/modules/branch/pages/BranchRidersPage.jsx`
  Use explicit branch/store scope from query params and auth context.
- `frontend/src/legacy/lib/useRealtimeOrders.js`
  Keep realtime order subscriptions branch-safe for staff views.
- `frontend/src/modules/public-menu/hooks/useStorePublicConfig.js`
  Align public menu data loading with the actual schema and branch-first public pages.
- `frontend/src/modules/public-menu/pages/PublicMenuPage.jsx`
  Hoist branch selection and pass active branch to templates and checkout.
- `frontend/src/modules/public-menu/components/CheckoutDrawer.jsx`
  Use the secure public order path, include branch scope, and support cart editing.
- `frontend/src/modules/public-menu/styles/MenuShared.jsx`
  Preserve product name, variant and pricing information in the public cart model.
- `frontend/src/shared/lib/supabaseApi.js`
  Align plan helper behavior and any frontend-facing backend calls with the new contracts.
- `frontend/src/shared/hooks/usePlan.js`
  Respect numeric overrides and keep plan runtime consistent.
- `frontend/src/shared/ui/FeatureGate.jsx`
  Fix limit upgrade resolution and keep branch/tenant gating predictable.
- `frontend/src/shared/lib/planFeatures.js`
  Add limit-aware upgrade resolution and keep plan metadata usable by the UI.
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  Apply real plan gating and constrain the wizard to the approved product model.
- `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
  Apply branch-level plan gating and wire branch public customization foundations.

---

### Task 1: Lock the schema and data contract for store-base + branch overrides

**Files:**
- Modify: `database_schema.sql`
- Modify: `supabase/migrations/RESET_COMPLETE.sql`
- Modify: `supabase/migrations/0008_plans_and_feature_overrides.sql`

- [ ] **Step 1: Write the failing schema contract test**

```python
import unittest
from pathlib import Path


class SchemaContractTests(unittest.TestCase):
    def test_reset_complete_declares_branch_override_tables_and_store_mode_fields(self):
        sql = Path('supabase/migrations/RESET_COMPLETE.sql').read_text(encoding='utf-8')
        self.assertIn('primary_mode', sql)
        self.assertIn('enabled_modules', sql)
        self.assertIn('branch_public_settings', sql)
        self.assertIn('branch_catalog_visibility', sql)
        self.assertIn('branch_product_overrides', sql)
        self.assertIn('branch_category_overrides', sql)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_schema_contract.py -v
```

Expected: FAIL because the override tables and fields are not fully declared yet.

- [ ] **Step 3: Normalize the schema in `RESET_COMPLETE.sql`**

Required SQL shape:

```sql
alter table public.stores
  add column if not exists primary_mode text default 'catalogo',
  add column if not exists enabled_modules jsonb not null default '[]'::jsonb,
  add column if not exists branding_base jsonb not null default '{}'::jsonb,
  add column if not exists template_type text default 'delivery';

create table if not exists public.branch_public_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  template_type text not null default 'delivery',
  theme_tokens jsonb not null default '{}'::jsonb,
  hero_content jsonb not null default '{}'::jsonb,
  layout_blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.branch_catalog_visibility (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_key text,
  product_id uuid,
  is_visible boolean not null default true,
  sort_order integer default 0
);

create table if not exists public.branch_product_overrides (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  is_visible boolean not null default true,
  sort_order integer default 0,
  badge text,
  short_description text,
  promo_label text,
  override_price numeric,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.branch_category_overrides (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_key text not null,
  is_visible boolean not null default true,
  sort_order integer default 0,
  hero_label text,
  metadata jsonb not null default '{}'::jsonb
);
```

- [ ] **Step 4: Add public-read and tenant-scoped RLS for the new branch override tables**

```sql
alter table public.branch_public_settings enable row level security;
alter table public.branch_catalog_visibility enable row level security;
alter table public.branch_product_overrides enable row level security;
alter table public.branch_category_overrides enable row level security;

create policy branch_public_settings_public_read on public.branch_public_settings
  for select to anon, authenticated
  using (exists (
    select 1 from public.branches b
    where b.id = branch_id and b.public_visible = true and b.status = 'active'
  ));
```

Use the same `can_access_scope()` pattern already used elsewhere for authenticated management policies.

- [ ] **Step 5: Align `database_schema.sql` and plan migration assumptions**

Update `database_schema.sql` so it documents the same canonical contract:

```sql
-- stores: niche + primary_mode + enabled_modules + branding_base
-- branches: branch-first public pages
-- branch_public_settings: visual/layout overrides by branch
-- branch_catalog_visibility: visible category/product map per branch
-- branch_product_overrides / branch_category_overrides: local content overrides
```

Also ensure `0008_plans_and_feature_overrides.sql` does not contradict the base tables and keeps `tenant_subscriptions.feature_overrides` idempotent.

- [ ] **Step 6: Run schema contract verification**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_schema_contract.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add database_schema.sql supabase/migrations/RESET_COMPLETE.sql supabase/migrations/0008_plans_and_feature_overrides.sql test_schema_contract.py
git commit -m "feat: align schema with multi-store branch override contract"
```

---

### Task 2: Replace pseudo staff auth with a backend-issued scoped identity

**Files:**
- Create: `test_api_staff_pin_login.py`
- Modify: `api/index.py`
- Modify: `frontend/src/core/providers/AuthProvider.jsx`
- Modify: `frontend/src/modules/auth/pages/StaffLoginPage.jsx`
- Modify: `frontend/src/core/guards/ProtectedRoute.jsx`
- Modify: `frontend/src/shared/hooks/useResolvedStoreId.js`
- Modify: `frontend/src/modules/branch/pages/BranchKitchenPage.jsx`
- Modify: `frontend/src/modules/branch/pages/BranchRidersPage.jsx`
- Modify: `frontend/src/legacy/lib/useRealtimeOrders.js`

- [ ] **Step 1: Write the failing backend staff login test**

```python
import unittest
from unittest.mock import patch

from api.index import app


class StaffPinLoginRouteTests(unittest.TestCase):
    def test_staff_pin_login_returns_scoped_identity_payload(self):
        client = app.test_client()

        with patch('api.index._verify_staff_pin_login') as verify_login:
            verify_login.return_value = {
                'access_token': 'signed-token',
                'membership': {
                    'role': 'kitchen',
                    'tenant_id': 'tenant-1',
                    'store_id': 'store-1',
                    'branch_id': 'branch-1',
                },
            }

            response = client.post('/api/backend/public/staff-pin-login', json={
                'store_slug': 'pizza-demo',
                'branch_slug': 'centro',
                'identifier': 'Camila',
                'pin': '1234',
            })

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['data']['membership']['role'], 'kitchen')
        self.assertEqual(payload['data']['access_token'], 'signed-token')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_api_staff_pin_login.py -v
```

Expected: FAIL because the route/helper does not exist yet.

- [ ] **Step 3: Add a public staff PIN login route in `api/index.py`**

Required behavior:

```python
@app.route('/api/backend/public/staff-pin-login', methods=['POST'])
def public_staff_pin_login():
    body = request.get_json(silent=True) or {}
    result = _verify_staff_pin_login(
        store_slug=body.get('store_slug'),
        branch_slug=body.get('branch_slug'),
        identifier=body.get('identifier'),
        pin=body.get('pin'),
    )
    return _ok(result, 'Staff login OK')
```

The helper must:

- resolve store by slug
- resolve branch by store + branch slug
- find an active `staff_users` row scoped to that branch
- validate `pin`
- return a signed short-lived token plus `membership`

The token claims must include:

```python
claims = {
    'sub': str(staff_row['id']),
    'role': 'authenticated',
    'app_role': staff_row['role'],
    'tenant_id': staff_row['tenant_id'],
    'store_id': staff_row['store_id'],
    'branch_id': staff_row['branch_id'],
}
```

- [ ] **Step 4: Update frontend staff login and auth provider to use the new identity**

`StaffLoginPage.jsx` must stop querying `staff_users` directly and instead call the backend:

```js
const payload = await fetch(buildBackendUrl('/public/staff-pin-login'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    store_slug: storeSlug,
    branch_slug: branchSlug,
    identifier: username.trim(),
    pin,
  }),
}).then((res) => res.json())
```

Persist a session-like object that includes the real `supabase_access_token`, source marker, and membership scope:

```js
persistStoredSession(storageKey, {
  source: 'staff_pin',
  supabase_access_token: payload.data.access_token,
  membership: payload.data.membership,
  user: { id: payload.data.membership.user_id || payload.data.membership.staff_id },
})
```

`AuthProvider.jsx` must accept `staff_pin` sessions and derive `membership` from stored payload when native Supabase auth is absent.

- [ ] **Step 5: Fix scope resolution and staff route compatibility**

Apply these minimal changes:

```js
// useResolvedStoreId.js
const query = new URLSearchParams(window.location.search)
if (query.get('store_id')) return query.get('store_id')
if (query.get('store')) return query.get('store')
```

```js
// BranchKitchenPage.jsx / BranchRidersPage.jsx
const storeId = params.get('store_id') || params.get('store') || authStoreId || resolvedStoreId || ''
const branchId = params.get('branch_id') || params.get('branch') || authBranchId || ''
```

Also make the staff login redirect explicit:

```js
navigate(`/branch/${dest}?store_id=${membership.store_id}&branch_id=${membership.branch_id}`)
```

Update realtime channel naming to include `branchId` when present.

- [ ] **Step 6: Run focused verification**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_api_staff_pin_login.py -v
npm.cmd run build
```

Workdir for build:

```text
<repo-root>\frontend
```

Expected: backend test PASS, frontend build PASS.

- [ ] **Step 7: Commit**

```bash
git add api/index.py test_api_staff_pin_login.py frontend/src/core/providers/AuthProvider.jsx frontend/src/modules/auth/pages/StaffLoginPage.jsx frontend/src/core/guards/ProtectedRoute.jsx frontend/src/shared/hooks/useResolvedStoreId.js frontend/src/modules/branch/pages/BranchKitchenPage.jsx frontend/src/modules/branch/pages/BranchRidersPage.jsx frontend/src/legacy/lib/useRealtimeOrders.js
git commit -m "feat: add scoped staff pin auth for branch operations"
```

---

### Task 3: Make branch-first public storefront and checkout use a secure server contract

**Files:**
- Create: `test_api_public_order_route.py`
- Create: `frontend/tests/publicBranchCheckoutContract.test.mjs`
- Modify: `api/index.py`
- Modify: `frontend/src/modules/public-menu/hooks/useStorePublicConfig.js`
- Modify: `frontend/src/modules/public-menu/pages/PublicMenuPage.jsx`
- Modify: `frontend/src/modules/public-menu/components/CheckoutDrawer.jsx`
- Modify: `frontend/src/modules/public-menu/styles/MenuShared.jsx`

- [ ] **Step 1: Write the failing public order backend test**

```python
import unittest
from unittest.mock import patch

from api.index import app


class PublicOrderRouteTests(unittest.TestCase):
    def test_public_order_route_persists_branch_scoped_order_payload(self):
        client = app.test_client()

        with patch('api.index._create_public_branch_order') as create_order:
            create_order.return_value = {'order_id': 'ord-1', 'order_number': 1042}

            response = client.post('/api/backend/public/orders', json={
                'store_slug': 'pizza-demo',
                'branch_slug': 'centro',
                'customer_name': 'Ana',
                'customer_phone': '600111222',
                'delivery_address': 'Calle Mayor 1',
                'items': [{'product_id': 'prod-1', 'product_name': 'Pizza', 'qty': 2, 'unit_price': 12}],
                'total': 24,
            })

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload['data']['order_number'], 1042)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_api_public_order_route.py -v
```

Expected: FAIL because the route/helper does not exist yet.

- [ ] **Step 3: Add a secure public order creation route in `api/index.py`**

Required route contract:

```python
@app.route('/api/backend/public/orders', methods=['POST'])
def create_public_order():
    body = request.get_json(silent=True) or {}
    created = _create_public_branch_order(body)
    return _ok(created, 'Pedido creado', 201)
```

The helper must:

- resolve `store` and `branch` by slug
- validate branch is public and active
- validate required customer fields
- normalize `items`
- compute a safe `order_number` server-side
- persist the order with `store_id`, `branch_id`, `tenant_id`

Persisted shape:

```python
payload = {
    'store_id': store['id'],
    'branch_id': branch['id'],
    'tenant_id': branch['tenant_id'],
    'order_number': next_number,
    'customer_name': customer_name,
    'customer_phone': customer_phone,
    'delivery_address': delivery_address,
    'items': items,
    'total': total,
    'status': 'pending',
}
```

- [ ] **Step 4: Align public menu loading with the actual branch-first schema**

`useStorePublicConfig.js` must stop assuming a `categories` table if the schema does not own it yet. Use a branch-visible view model derived from `products` plus override tables:

```js
const productsRes = await sb
  .from('products')
  .select('id,name,description,price,emoji,category,tags,variants,modifiers,is_active')
  .eq('store_id', storeData.id)
  .eq('is_active', true)

const visibilityRes = activeBranch
  ? await sb.from('branch_product_overrides')
      .select('product_id,is_visible,sort_order,badge,short_description,promo_label,override_price')
      .eq('branch_id', activeBranch.id)
  : { data: [] }
```

Build visible sections from the base store catalog plus branch overrides.

- [ ] **Step 5: Refactor `PublicMenuPage` and `CheckoutDrawer` around active branch**

`PublicMenuPage.jsx` must own `activeBranch` and pass it to templates and checkout:

```jsx
const [activeBranch, setActiveBranch] = React.useState(branch || branches[0] || null)

<CurrentTemplate
  branch={activeBranch}
  onBranchChange={setActiveBranch}
  ...
/>

<CheckoutDrawer
  branch={activeBranch}
  store={store}
  currency={store?.currency}
  onUpdateQty={updateQty}
  onRemoveItem={removeItem}
  ...
/>
```

`CheckoutDrawer.jsx` must stop inserting directly into Supabase. It should call the new backend route and preserve real item detail:

```js
const payload = {
  store_slug: store.slug,
  branch_slug: branch.slug,
  customer_name: saved.name,
  customer_phone: saved.phone,
  delivery_address: saved.address,
  items: cart.map((item) => ({
    product_id: item.id,
    product_name: item.product_name || item.name,
    qty: item.qty,
    unit_price: item.unit_price ?? item.price,
    variant: item.selectedVariant || null,
    modifiers: item.modifiers || [],
  })),
  total,
}
```

It must also render `onUpdateQty` and `onRemoveItem` controls inside the drawer.

- [ ] **Step 6: Add the focused frontend contract test and run verification**

Example test:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPublicOrderPayload } from '../src/modules/public-menu/components/publicOrderPayload.js'

test('buildPublicOrderPayload keeps branch slug and item details', () => {
  const payload = buildPublicOrderPayload({
    store: { slug: 'pizza-demo' },
    branch: { slug: 'centro' },
    form: { name: 'Ana', phone: '600111222', address: 'Mayor 1' },
    cart: [{ id: 'prod-1', product_name: 'Pizza', qty: 2, price: 12, selectedVariant: 'Grande' }],
    total: 24,
  })

  assert.equal(payload.branch_slug, 'centro')
  assert.equal(payload.items[0].product_name, 'Pizza')
  assert.equal(payload.items[0].variant, 'Grande')
})
```

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest test_api_public_order_route.py -v
node --test frontend/tests/publicBranchCheckoutContract.test.mjs
npm.cmd run build
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add api/index.py test_api_public_order_route.py frontend/tests/publicBranchCheckoutContract.test.mjs frontend/src/modules/public-menu/hooks/useStorePublicConfig.js frontend/src/modules/public-menu/pages/PublicMenuPage.jsx frontend/src/modules/public-menu/components/CheckoutDrawer.jsx frontend/src/modules/public-menu/styles/MenuShared.jsx
git commit -m "feat: secure branch-first public storefront and checkout"
```

---

### Task 4: Apply real plan gating to tenant and branch control planes

**Files:**
- Create: `frontend/tests/planGateContract.test.mjs`
- Modify: `frontend/src/shared/hooks/usePlan.js`
- Modify: `frontend/src/shared/ui/FeatureGate.jsx`
- Modify: `frontend/src/shared/lib/planFeatures.js`
- Modify: `frontend/src/shared/lib/supabaseApi.js`
- Modify: `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
- Modify: `frontend/src/modules/branch/pages/BranchAdminPage.jsx`

- [ ] **Step 1: Write the failing plan gate test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveLimitOverride, minPlanForLimit } from '../src/shared/lib/planFeatures.js'

test('resolveLimitOverride prefers numeric feature_overrides over plan defaults', () => {
  assert.equal(resolveLimitOverride({ max_stores: 5 }, 'max_stores', 1), 5)
})

test('minPlanForLimit returns growth for max_stores over starter capacity', () => {
  assert.equal(minPlanForLimit('max_stores', 2), 'growth')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/planGateContract.test.mjs
```

Expected: FAIL because the helpers do not exist yet.

- [ ] **Step 3: Fix plan runtime helpers**

In `planFeatures.js` add:

```js
export function resolveLimitOverride(overrides, key, fallback) {
  const value = overrides?.[key]
  return typeof value === 'number' ? value : fallback
}

export function minPlanForLimit(limitKey, neededCount) {
  const ordered = Object.values(PLANS).sort((left, right) => left.sort_order - right.sort_order)
  const target = ordered.find((plan) => {
    const limit = plan.limits?.[limitKey]
    return limit === Infinity || limit === -1 || limit >= neededCount
  })
  return target?.id || 'enterprise'
}
```

In `usePlan.js` apply numeric overrides inside `canCreateMore` and `remaining`.

- [ ] **Step 4: Apply actual gates in Tenant and Branch pages**

`TenantAdminPage.jsx` must gate:

```jsx
{!loading && tab === 'customize' && (
  <FeatureGate feature={FEATURES.MENU_CUSTOM_STYLE}>
    <CustomizeTab ... />
  </FeatureGate>
)}
```

Wrap creation actions:

```jsx
<LimitGate limitKey={FEATURES.MAX_STORES} currentCount={stores.length}>
  <Btn onClick={() => setShowCreate(true)}>+ Crear tienda</Btn>
</LimitGate>
```

Also gate branch and staff creation, and stop offering unrestricted template selection in the wizard when the plan does not allow custom menu style.

`BranchAdminPage.jsx` must gate:

```jsx
{tab === 'marketing' && (
  <FeatureGate feature={FEATURES.COUPONS}>
    <MarketingTab storeId={storeId} />
  </FeatureGate>
)}

{tab === 'chatbot' && (
  <FeatureGate feature={FEATURES.CHATBOT_BASIC}>
    <ChatbotTab branchId={branchId} storeId={storeId} />
  </FeatureGate>
)}
```

Use limit gates for product and staff creation where appropriate.

- [ ] **Step 5: Align plan reads in `supabaseApi.js`**

Keep `getTenantPlan()` consistent with the runtime provider:

```js
export async function getTenantPlan(tenantId) {
  const { data } = await supabaseAuth
    .from('tenant_subscriptions')
    .select('plan_id')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()
  return data?.plan_id || 'starter'
}
```

- [ ] **Step 6: Run plan gating verification**

Run:

```powershell
node --test frontend/tests/planGateContract.test.mjs
npm.cmd run build
```

Expected: tests PASS, build PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/tests/planGateContract.test.mjs frontend/src/shared/hooks/usePlan.js frontend/src/shared/ui/FeatureGate.jsx frontend/src/shared/lib/planFeatures.js frontend/src/shared/lib/supabaseApi.js frontend/src/modules/tenant/pages/TenantAdminPage.jsx frontend/src/modules/branch/pages/BranchAdminPage.jsx
git commit -m "feat: apply real plan gating to tenant and branch panels"
```

---

### Task 5: Stabilize the owner wizard and branch personalization foundations

**Files:**
- Modify: `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
- Modify: `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
- Modify: `PROJECT_STATE.md`

- [ ] **Step 1: Write the failing wizard behavior contract test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { getRecommendedModesForNiche } from '../src/modules/tenant/lib/storeCatalog.js'

test('barberia recommends reservas as the primary mode', () => {
  const modes = getRecommendedModesForNiche('barbershop')
  assert.equal(modes[0].id, 'reservas_servicios')
})
```

If the helper does not exist yet, add it in the existing `storeCatalog.js` rather than bloating the page file further.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/storeCatalog.test.mjs
```

Expected: FAIL until the helper and wizard contract are aligned.

- [ ] **Step 3: Refactor the wizard to the approved store model**

The wizard in `TenantAdminPage.jsx` must create:

- a `store` with `niche`, `primary_mode`, `enabled_modules`, `branding_base`
- the first `branch`
- then route the owner into branch customization

Minimum payload shape:

```js
const store = await createStore({
  tenant_id: tenantId,
  name: form.name,
  slug: form.slug,
  niche: selectedNiche.id,
  primary_mode: selectedMode.id,
  enabled_modules: selectedModules,
  branding_base: {
    template_type: selectedTemplate,
    primary_color: selectedColor,
  },
})
```

Then:

```js
await createBranch({
  tenant_id: tenantId,
  store_id: store.id,
  name: branchForm.name,
  slug: branchForm.slug,
  city: branchForm.city,
  address: branchForm.address,
  phone: branchForm.phone,
  public_visible: true,
})
```

- [ ] **Step 4: Wire branch-level public customization entry points**

`BranchAdminPage.jsx` must expose a stable path into branch public customization:

```jsx
<Btn
  size="sm"
  onClick={() => setTab('config')}
>
  Personalizar página
</Btn>
```

Inside the branch config/public section, surface the existing branch-first model:

- template selection
- theme tokens
- visible categories/products
- highlighted content

This task only lays the foundation in the existing page. Do not build a full visual editor yet.

- [ ] **Step 5: Run focused verification and update memory**

Run:

```powershell
node --test frontend/tests/storeCatalog.test.mjs
npm.cmd run build
```

Then append to `PROJECT_STATE.md`:

```md
## Iteracion 2026-04-22 - implementacion base del core platform

### Implementado

- contracto SQL alineado con store-base + branch overrides
- login staff por PIN alineado con panel nuevo
- checkout público branch-first con endpoint seguro
- feature gating real en tenant y branch panels
- wizard del owner alineado con niche + primary_mode + branch bootstrap

### Validacion

- unittest backend focalizados: correcto
- node --test frontend focalizados: correcto
- npm run build en frontend: correcto
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/tenant/pages/TenantAdminPage.jsx frontend/src/modules/branch/pages/BranchAdminPage.jsx PROJECT_STATE.md
git commit -m "feat: align owner wizard and branch personalization foundation"
```

---

## Self-review

### Spec coverage

- Staff auth replacement: covered by Task 2.
- Branch-first public storefront and checkout: covered by Task 3.
- Schema and override model: covered by Task 1.
- Real plan gating: covered by Task 4.
- Owner wizard and branch-first bootstrap: covered by Task 5.

No approved-spec requirement is left without a task in this phase.

### Placeholder scan

- No `TODO`
- No `TBD`
- No “implement later”
- All verification steps include real commands
- All code steps include concrete code shapes or payload contracts

### Type consistency

- `primary_mode`, `enabled_modules`, and branch override table names are used consistently.
- `store_id` / `branch_id` are propagated consistently across staff and public branch flows.
- plan helper names are consistent between tests and implementation tasks.
