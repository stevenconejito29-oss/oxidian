# Admin Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Super Admin and Tenant backoffice surfaces on a shared shell and shared logic foundation without breaking current routing, role scope, or branch-level compatibility.

**Architecture:** First align auth and shared UI primitives so the two high-level panels stop depending on legacy client state and page-local components. Then refactor `SuperAdminPage` and `TenantAdminPage` around extracted, testable model helpers plus shared design-system blocks, finishing with router and build verification.

**Tech Stack:** React 18, Vite, React Router, Supabase JS, node:test, PowerShell, Vercel-style frontend build

---

## File map

### Create

- `frontend/src/core/providers/authMembership.js`
  Responsibility: pure helpers for membership priority and session-safe membership selection.
- `frontend/tests/authMembership.test.mjs`
  Responsibility: verify role priority and membership selection behavior.
- `frontend/src/modules/admin/lib/superAdminModel.js`
  Responsibility: derive Super Admin KPI cards, alerts, and quick actions from raw API data.
- `frontend/tests/superAdminModel.test.mjs`
  Responsibility: verify tenant-owner-plan alert shaping and KPI derivation.
- `frontend/src/modules/tenant/lib/tenantAdminModel.js`
  Responsibility: derive Tenant dashboard summary, store and branch quick actions, and plan banners.
- `frontend/tests/tenantAdminModel.test.mjs`
  Responsibility: verify tenant-level derived state and limit/banner behavior.

### Modify

- `frontend/src/core/providers/AuthProvider.jsx`
  Replace legacy Supabase client import with canonical client, use extracted membership helper.
- `frontend/src/shared/ui/OxidianDS.jsx`
  Add the missing shared admin primitives needed by both top-level panels.
- `frontend/src/core/app/DashboardLayout.jsx`
  Tighten nav structure, mobile behavior, and active-state support for the rewritten pages.
- `frontend/src/shared/lib/supabaseApi.js`
  Add or normalize the exact data access methods needed by Super Admin and Tenant pages.
- `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
  Refactor around shared UI blocks and extracted model helpers.
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
  Refactor around shared UI blocks and extracted model helpers.
- `frontend/src/core/router/AppRouter.jsx`
  Compatibility-only route check after auth changes.
- `PROJECT_STATE.md`
  Append implementation outcomes once code lands.

---

### Task 1: Align membership resolution with the canonical Supabase client

**Files:**
- Create: `frontend/src/core/providers/authMembership.js`
- Create: `frontend/tests/authMembership.test.mjs`
- Modify: `frontend/src/core/providers/AuthProvider.jsx`

- [ ] **Step 1: Write the failing membership helper test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  pickHighestPriorityMembership,
  ROLE_PRIORITY,
} from '../src/core/providers/authMembership.js'

test('pickHighestPriorityMembership returns the highest-privilege active membership', () => {
  const membership = pickHighestPriorityMembership([
    { role: 'cashier', is_active: true, tenant_id: 't1' },
    { role: 'tenant_admin', is_active: true, tenant_id: 't1' },
    { role: 'branch_manager', is_active: true, tenant_id: 't1' },
  ])

  assert.equal(ROLE_PRIORITY[0], 'super_admin')
  assert.equal(membership.role, 'tenant_admin')
})

test('pickHighestPriorityMembership ignores inactive rows and unknown roles', () => {
  const membership = pickHighestPriorityMembership([
    { role: 'unknown_role', is_active: true },
    { role: 'store_admin', is_active: false },
    { role: 'branch_manager', is_active: true, branch_id: 'b1' },
  ])

  assert.equal(membership.role, 'branch_manager')
  assert.equal(membership.branch_id, 'b1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/authMembership.test.mjs
```

Expected: FAIL because `authMembership.js` does not exist yet.

- [ ] **Step 3: Write the minimal membership helper**

```js
export const ROLE_PRIORITY = [
  'super_admin',
  'tenant_owner',
  'tenant_admin',
  'store_admin',
  'store_operator',
  'branch_manager',
  'cashier',
  'kitchen',
  'rider',
]

export function pickHighestPriorityMembership(rows) {
  const activeRows = Array.isArray(rows)
    ? rows.filter((row) => row && row.is_active !== false)
    : []

  if (!activeRows.length) return null

  const sorted = [...activeRows].sort((left, right) => {
    const leftIndex = ROLE_PRIORITY.indexOf(left.role)
    const rightIndex = ROLE_PRIORITY.indexOf(right.role)
    const safeLeft = leftIndex === -1 ? 99 : leftIndex
    const safeRight = rightIndex === -1 ? 99 : rightIndex
    return safeLeft - safeRight
  })

  return sorted[0] || null
}
```

- [ ] **Step 4: Update `AuthProvider` to use canonical client + helper**

```js
import { supabaseAuth } from '../../shared/supabase/client'
import { pickHighestPriorityMembership } from './authMembership'

// ...

const { data, error } = await supabaseAuth
  .from('user_memberships')
  .select('role, tenant_id, store_id, branch_id, is_active, metadata')
  .eq('user_id', userId)
  .eq('is_active', true)

// ...

const winner = pickHighestPriorityMembership(data)
setMembership(winner)
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
node --test frontend/tests/authMembership.test.mjs
```

Expected: PASS with 2 passing tests.

- [ ] **Step 6: Run a focused build smoke check**

Run:

```powershell
npm.cmd run build
```

Workdir:

```text
<repo-root>\frontend
```

Expected: Vite build completes successfully.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/core/providers/authMembership.js frontend/tests/authMembership.test.mjs frontend/src/core/providers/AuthProvider.jsx
git commit -m "refactor: align auth provider with canonical membership resolution"
```

---

### Task 2: Expand shared admin UI primitives and stabilize layout behavior

**Files:**
- Modify: `frontend/src/shared/ui/OxidianDS.jsx`
- Modify: `frontend/src/core/app/DashboardLayout.jsx`

- [ ] **Step 1: Write the failing layout behavior test as a pure nav config check**

Create a small pure helper inside `DashboardLayout.jsx` or a colocated export that can be tested without a browser. The first test should target nav visibility and active state inputs.

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { getDashboardNavItems } from '../src/core/app/DashboardLayout.jsx'

test('super admin nav exposes owners and plans explicitly', () => {
  const items = getDashboardNavItems('super_admin').map((item) => item.tab)
  assert.ok(items.includes('owners'))
  assert.ok(items.includes('plans'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/dashboardLayout.test.mjs
```

Expected: FAIL because the exported helper and test file do not exist yet.

- [ ] **Step 3: Add shared primitives to `OxidianDS`**

Add only what both top-level pages need:

```js
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:20,flexWrap:'wrap'}}>
      <div>
        {eyebrow && <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--color-text-secondary)',marginBottom:6}}>{eyebrow}</div>}
        <h1 style={{margin:0,fontSize:28,fontWeight:800,letterSpacing:'-1px'}}>{title}</h1>
        {subtitle && <p style={{margin:'6px 0 0',fontSize:13,color:'var(--color-text-secondary)'}}>{subtitle}</p>}
      </div>
      {actions && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{actions}</div>}
    </div>
  )
}

export function ActionRail({ items }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={item.onClick} style={{textAlign:'left',padding:'14px 16px',borderRadius:12,border:'1px solid var(--color-border-tertiary)',background:'var(--color-background-primary)',cursor:'pointer'}}>
          <div style={{fontSize:20,marginBottom:8}}>{item.icon}</div>
          <div style={{fontSize:13,fontWeight:700}}>{item.label}</div>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',marginTop:4}}>{item.description}</div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Export nav helper and improve responsive collapse in `DashboardLayout`**

```js
export function getDashboardNavItems(role) {
  return NAV_BY_ROLE[role] || []
}

React.useEffect(() => {
  function syncViewport() {
    setCollapsed(window.innerWidth < 640)
  }

  syncViewport()
  window.addEventListener('resize', syncViewport)
  return () => window.removeEventListener('resize', syncViewport)
}, [])
```

- [ ] **Step 5: Write the nav helper test file**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { getDashboardNavItems } from '../src/core/app/dashboardNav.js'

test('super admin nav exposes owners and plans explicitly', () => {
  const items = getDashboardNavItems('super_admin').map((item) => item.tab)
  assert.ok(items.includes('owners'))
  assert.ok(items.includes('plans'))
})

test('tenant owner nav keeps business-facing sections', () => {
  const items = getDashboardNavItems('tenant_owner').map((item) => item.tab)
  assert.deepEqual(items, ['overview', 'stores', 'branches', 'staff', 'customize'])
})
```

If extracting to `dashboardNav.js` is cleaner than exporting from `DashboardLayout.jsx`, do that and update imports accordingly.

- [ ] **Step 6: Run tests and build**

Run:

```powershell
node --test frontend/tests/dashboardLayout.test.mjs
npm.cmd run build
```

Workdir:

```text
<repo-root>\frontend
```

Expected: nav tests pass, build stays green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/OxidianDS.jsx frontend/src/core/app/DashboardLayout.jsx frontend/src/core/app/dashboardNav.js frontend/tests/dashboardLayout.test.mjs
git commit -m "refactor: unify admin shell primitives and navigation"
```

---

### Task 3: Refactor Super Admin into a platform control plane

**Files:**
- Create: `frontend/src/modules/admin/lib/superAdminModel.js`
- Create: `frontend/tests/superAdminModel.test.mjs`
- Modify: `frontend/src/shared/lib/supabaseApi.js`
- Modify: `frontend/src/modules/admin/pages/SuperAdminPage.jsx`

- [ ] **Step 1: Write the failing Super Admin model tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSuperAdminSummary,
  buildSuperAdminAlerts,
} from '../src/modules/admin/lib/superAdminModel.js'

test('buildSuperAdminSummary derives platform counts and mrr', () => {
  const summary = buildSuperAdminSummary({
    stats: { tenants: 3, stores: 8, branches: 11, members: 14 },
    tenants: [{ monthly_fee: 29 }, { monthly_fee: 79 }, { monthly_fee: 0 }],
    owners: [],
    leads: [],
  })

  assert.equal(summary.kpis[0].value, 3)
  assert.equal(summary.kpis[4].value, '€108')
})

test('buildSuperAdminAlerts flags tenants without owners or plans', () => {
  const alerts = buildSuperAdminAlerts({
    tenants: [
      { id: 't1', name: 'Alpha', plan_id: 'growth' },
      { id: 't2', name: 'Beta', plan_id: null },
    ],
    owners: [{ tenant_id: 't1', is_active: true }],
    stores: [],
    branches: [],
  })

  assert.ok(alerts.some((alert) => alert.kind === 'missing_owner'))
  assert.ok(alerts.some((alert) => alert.kind === 'missing_plan'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/superAdminModel.test.mjs
```

Expected: FAIL because the model helper does not exist yet.

- [ ] **Step 3: Implement the minimal Super Admin model helper**

```js
export function formatEuro(value) {
  return `€${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
}

export function buildSuperAdminSummary({ stats, tenants, owners, leads }) {
  const mrr = (tenants || []).reduce((sum, tenant) => sum + Number(tenant.monthly_fee || 0), 0)
  return {
    kpis: [
      { id: 'tenants', label: 'Tenants activos', value: stats?.tenants || 0, icon: '🏢' },
      { id: 'stores', label: 'Tiendas', value: stats?.stores || 0, icon: '🏪' },
      { id: 'branches', label: 'Sedes', value: stats?.branches || 0, icon: '📍' },
      { id: 'owners', label: 'Dueños/Admins', value: (owners || []).length, icon: '👤' },
      { id: 'mrr', label: 'MRR estimado', value: formatEuro(mrr), icon: '💶' },
      { id: 'pipeline', label: 'Leads', value: (leads || []).length, icon: '📋' },
    ],
  }
}

export function buildSuperAdminAlerts({ tenants, owners, stores, branches }) {
  const activeOwnerTenantIds = new Set((owners || []).filter((row) => row.is_active).map((row) => row.tenant_id))
  const alerts = []

  for (const tenant of tenants || []) {
    if (!activeOwnerTenantIds.has(tenant.id)) {
      alerts.push({ kind: 'missing_owner', tenantId: tenant.id, label: `${tenant.name} sin dueño activo` })
    }
    if (!tenant.plan_id) {
      alerts.push({ kind: 'missing_plan', tenantId: tenant.id, label: `${tenant.name} sin plan activo` })
    }
  }

  for (const store of stores || []) {
    if (store.public_visible === false) {
      alerts.push({ kind: 'hidden_store', storeId: store.id, label: `${store.name} oculta` })
    }
  }

  for (const branch of branches || []) {
    if (branch.chatbot_authorized === false) {
      alerts.push({ kind: 'chatbot_off', branchId: branch.id, label: `${branch.name} sin chatbot autorizado` })
    }
  }

  return alerts
}
```

- [ ] **Step 4: Normalize Super Admin data access in `supabaseApi.js`**

Make sure these functions are exported and stable:

```js
export async function listLandingRequests() {
  const { data, error } = await supabaseAuth
    .from('landing_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
```

Also make `listTenants()` return enough tenant shape for `plan_id` if the page depends on it, either directly or via joined subscription data.

- [ ] **Step 5: Refactor `SuperAdminPage.jsx` to use shared page primitives**

The page should follow this structure:

```jsx
<DashboardLayout activeTab={tab} onTabChange={setTab} title="Super Admin" subtitle="Oxidian Platform">
  <PageHeader
    eyebrow="Platform Control"
    title="Super Admin"
    subtitle="Gobierno de tenants, dueños, planes y onboarding"
    actions={[
      <Btn key="tenant" onClick={() => setTab('tenants')}>+ Tenant</Btn>,
      <Btn key="owner" variant="ghost" onClick={() => setTab('owners')}>Crear dueño</Btn>,
    ]}
  />

  <StatGrid items={summary.kpis} />
  <ActionRail items={quickActions} />
  <TabBar tabs={tabs} active={tab} onChange={setTab} />

  {tab === 'overview' && <OverviewTab summary={summary} alerts={alerts} />}
  {tab === 'tenants' && <TenantsTab />}
  {tab === 'owners' && <OwnersTab />}
  {tab === 'plans' && <PlansTab />}
  {tab === 'pipeline' && <PipelineTab />}
  {tab === 'stores' && <StoresTab />}
</DashboardLayout>
```

Required page changes:

- add explicit `owners` tab
- move tenant-owner creation into obvious primary flows
- make overview show alerts, pending onboarding, and recent tenants
- keep backend invite path for pipeline

- [ ] **Step 6: Run model tests and build**

Run:

```powershell
node --test frontend/tests/superAdminModel.test.mjs
npm.cmd run build
```

Workdir:

```text
<repo-root>\frontend
```

Expected: tests pass, Vite build passes, no JSX/import regressions.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/admin/lib/superAdminModel.js frontend/tests/superAdminModel.test.mjs frontend/src/shared/lib/supabaseApi.js frontend/src/modules/admin/pages/SuperAdminPage.jsx
git commit -m "feat: rebuild super admin as platform control plane"
```

---

### Task 4: Refactor Tenant Admin into a business control plane

**Files:**
- Create: `frontend/src/modules/tenant/lib/tenantAdminModel.js`
- Create: `frontend/tests/tenantAdminModel.test.mjs`
- Modify: `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`
- Modify: `frontend/src/shared/lib/supabaseApi.js`

- [ ] **Step 1: Write the failing Tenant Admin model tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTenantSummary,
  buildTenantPlanBanner,
} from '../src/modules/tenant/lib/tenantAdminModel.js'

test('buildTenantSummary derives counts and quick actions from tenant data', () => {
  const summary = buildTenantSummary({
    planId: 'growth',
    dashboard: { orders_today: 7 },
    stores: [{ id: 's1' }, { id: 's2' }],
    branches: [{ id: 'b1' }],
    accounts: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
  })

  assert.equal(summary.kpis[0].value, 'growth')
  assert.equal(summary.kpis[1].value, 2)
  assert.equal(summary.kpis[4].value, 7)
})

test('buildTenantPlanBanner warns when the tenant reaches a limit', () => {
  const banner = buildTenantPlanBanner({
    planId: 'starter',
    storesCount: 1,
    branchesCount: 1,
    accountsCount: 3,
  })

  assert.equal(banner.tone, 'warn')
  assert.match(banner.message, /límite/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test frontend/tests/tenantAdminModel.test.mjs
```

Expected: FAIL because the model helper does not exist yet.

- [ ] **Step 3: Implement the minimal Tenant Admin model helper**

```js
import { planLimit } from '../../../shared/lib/planFeatures.js'

export function buildTenantSummary({ planId, dashboard, stores, branches, accounts }) {
  return {
    kpis: [
      { id: 'plan', label: 'Plan', value: planId, icon: '💎' },
      { id: 'stores', label: 'Tiendas', value: (stores || []).length, icon: '🏪' },
      { id: 'branches', label: 'Sedes', value: (branches || []).length, icon: '📍' },
      { id: 'staff', label: 'Staff', value: (accounts || []).length, icon: '👥' },
      { id: 'orders', label: 'Pedidos hoy', value: dashboard?.orders_today || 0, icon: '📦' },
    ],
  }
}

export function buildTenantPlanBanner({ planId, storesCount, branchesCount, accountsCount }) {
  const maxStores = planLimit(planId, 'max_stores')
  const maxBranches = planLimit(planId, 'max_branches')
  const maxStaff = planLimit(planId, 'max_staff')

  if (storesCount >= maxStores || branchesCount >= maxBranches || accountsCount >= maxStaff) {
    return {
      tone: 'warn',
      message: 'Has alcanzado un límite del plan actual. Revisa tiendas, sedes o staff antes de seguir creando.',
    }
  }

  return {
    tone: 'info',
    message: 'Tu panel muestra el estado actual del plan y la capacidad disponible.',
  }
}
```

- [ ] **Step 4: Refactor `TenantAdminPage.jsx` around shared primitives**

Reshape the page to:

```jsx
<DashboardLayout activeTab={tab} onTabChange={setTab} title="Panel del negocio" subtitle={<PlanBadge />}>
  <PageHeader
    eyebrow="Business Control"
    title="Panel del negocio"
    subtitle="Tiendas, sedes, equipo y presencia digital"
    actions={[
      <Btn key="store" onClick={() => setTab('stores')}>+ Tienda</Btn>,
      <Btn key="branch" variant="ghost" onClick={() => setTab('branches')}>+ Sede</Btn>,
    ]}
  />

  {planBanner && <Alert type={planBanner.tone}>{planBanner.message}</Alert>}
  <StatGrid items={summary.kpis} />
  <ActionRail items={quickActions} />
  <TabBar tabs={tabs} active={tab} onChange={setTab} />

  {tab === 'overview' && <OverviewTab ... />}
  {tab === 'stores' && <StoresTab ... />}
  {tab === 'branches' && <BranchesTab ... />}
  {tab === 'staff' && <StaffTab ... />}
  {tab === 'customize' && <CustomizeTab ... />}
</DashboardLayout>
```

Required page changes:

- keep the existing store and branch creation flows
- surface plan state near the top
- preserve `AdminStoreCustomizationPanel`
- make the action rail business-oriented instead of generic
- remove page-local duplicates of `Btn`, `Alert`, `Badge`, and `StatCard` when shared primitives exist

- [ ] **Step 5: Normalize tenant page data dependencies in `supabaseApi.js` if needed**

Only add missing page helpers or normalize current return shapes. Keep the existing backend-calling functions for staff management intact.

```js
export async function getTenantPlan(tenantId) {
  const { data } = await supabaseAuth
    .from('tenant_subscriptions')
    .select('plan_id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return data?.plan_id || 'growth'
}
```

- [ ] **Step 6: Run model tests and build**

Run:

```powershell
node --test frontend/tests/tenantAdminModel.test.mjs
npm.cmd run build
```

Workdir:

```text
<repo-root>\frontend
```

Expected: tests pass and build stays green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/tenant/lib/tenantAdminModel.js frontend/tests/tenantAdminModel.test.mjs frontend/src/modules/tenant/pages/TenantAdminPage.jsx frontend/src/shared/lib/supabaseApi.js
git commit -m "feat: rebuild tenant admin as business control plane"
```

---

### Task 5: Compatibility verification and project memory update

**Files:**
- Modify: `frontend/src/core/router/AppRouter.jsx`
- Modify: `frontend/src/modules/branch/pages/BranchAdminPage.jsx`
- Modify: `PROJECT_STATE.md`

- [ ] **Step 1: Verify protected routes still match the role hierarchy**

Review and normalize route access only if needed:

```jsx
<ProtectedRoute roles={['super_admin']}>
  <SuperAdminPage />
</ProtectedRoute>

<ProtectedRoute roles={['super_admin', 'tenant_owner', 'tenant_admin', 'store_admin']}>
  <TenantAdminPage />
</ProtectedRoute>
```

Do not widen scope beyond the existing design.

- [ ] **Step 2: Perform branch compatibility-only review**

If Super Admin or Tenant refactors require tab/nav compatibility changes, keep them minimal:

```jsx
{tab === 'marketing' && <MarketingTab storeId={storeId} />}
{tab === 'chatbot' && <ChatbotTab branchId={branchId} storeId={storeId} />}
```

Do not redesign `BranchAdminPage` in this phase.

- [ ] **Step 3: Run the full lightweight verification set**

Run:

```powershell
node --test frontend/tests/authMembership.test.mjs frontend/tests/dashboardLayout.test.mjs frontend/tests/superAdminModel.test.mjs frontend/tests/tenantAdminModel.test.mjs
npm.cmd run build
```

Workdir:

```text
<repo-root>\frontend
```

Expected:

- all node tests PASS
- Vite build PASS

- [ ] **Step 4: Update project memory**

Append the implementation outcome to `PROJECT_STATE.md` with:

```md
## Iteracion 2026-04-20 - implementacion de Fase 1 de paneles admin

### Implementado

- AuthProvider alineado con cliente canonico
- SuperAdminPage refactorizado como control plane de plataforma
- TenantAdminPage refactorizado como control plane del negocio
- OxidianDS y DashboardLayout consolidados como base visual compartida

### Validacion

- node --test ... : correcto
- npm run build en frontend: correcto
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/router/AppRouter.jsx frontend/src/modules/branch/pages/BranchAdminPage.jsx PROJECT_STATE.md
git commit -m "chore: verify admin phase 1 compatibility and document results"
```

---

## Self-review

### Spec coverage

- Auth base alignment: covered by Task 1.
- Shared visual primitives: covered by Task 2.
- Super Admin restructure: covered by Task 3.
- Tenant restructure: covered by Task 4.
- Routing and branch compatibility: covered by Task 5.

No spec gaps remain for Phase 1.

### Placeholder scan

- No `TODO`
- No `TBD`
- No unresolved helper names without a defining task
- All test and build commands are concrete

### Type consistency

- Membership helper names are consistent between Task 1 tests and implementation.
- `buildSuperAdminSummary` and `buildSuperAdminAlerts` are consistent between Task 3 tests and implementation.
- `buildTenantSummary` and `buildTenantPlanBanner` are consistent between Task 4 tests and implementation.
