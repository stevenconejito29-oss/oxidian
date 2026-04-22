# Admin Dashboard Phase 1 Design

Date: 2026-04-20
Scope: Super Admin + Tenant Owner/Admin redesign and functional hardening
Status: Draft for user review

## Goal

Redesign and harden the Phase 1 backoffice for the Oxidian SaaS platform without breaking the current role hierarchy or the visual direction already introduced in the repo.

Phase 1 focuses on:

- `super_admin` as the platform control plane
- `tenant_owner` and `tenant_admin` as the business control plane

Phase 1 does not fully redesign `store_admin` or `branch_manager` views. Those stay stable and only receive compatibility work needed to support the new structure above them.

## Why this order

The current repo already contains better visuals, but the hierarchy is still uneven:

- `SuperAdminPage` has partial platform controls, duplicated UI primitives, and weak separation between tenant governance, owner accounts, plans, and pipeline.
- `TenantAdminPage` is ahead visually, but still mixes overview, creation flows, staffing, and storefront customization without a strong information hierarchy.
- `BranchAdminPage` is operationally useful but still too CRUD-heavy to define the design direction for the whole backoffice.
- `AuthProvider` still depends on the legacy Supabase client, which is risky for any broader panel rewrite.

Starting with the top two layers reduces permission errors, duplicated logic, and rework in lower panels.

## Product principles

The redesign must follow these principles:

1. One control plane per role level.
2. Platform actions and tenant actions must not be mixed.
3. Visual consistency must come from shared design primitives, not page-local inline components.
4. Every primary view must answer three questions quickly:
   - what needs attention
   - what can I act on next
   - what changed recently
5. New UI must preserve the visual language already introduced by Claude:
   - light, dense, modern admin layout
   - restrained neutral palette
   - strong card borders over heavy shadows
   - bold KPI surfaces
   - clear action rows and quick links

## Current code constraints

The implementation must respect the current app structure:

- Router tree is centered in `frontend/src/core/router/AppRouter.jsx`
- Layout shell is `frontend/src/core/app/DashboardLayout.jsx`
- Shared UI primitives are in `frontend/src/shared/ui/OxidianDS.jsx`
- Direct data access is in `frontend/src/shared/lib/supabaseApi.js`
- Role and membership state is in `frontend/src/core/providers/AuthProvider.jsx`

Known hard constraint:

- `AuthProvider` must be aligned with the canonical Supabase client before broader panel work relies on it.

## Phase 1 information architecture

### Super Admin

`SuperAdminPage` becomes the platform control plane with six top-level work areas:

1. `overview`
   Platform KPIs, risks, pending onboarding, recent tenant activity, quick actions.
2. `tenants`
   Create, edit, suspend, inspect tenant health and ownership state.
3. `owners`
   Create owner/admin accounts, pause/reactivate access, reset credentials, inspect tenant assignment.
4. `plans`
   Assign plan, inspect limits, expose feature overrides, identify quota or plan mismatch.
5. `pipeline`
   Review leads, approve onboarding, send invites, track funnel state.
6. `stores`
   Global visibility into stores and branches across tenants for audit and support.

### Tenant Owner / Tenant Admin

`TenantAdminPage` becomes the tenant business control plane with five top-level work areas:

1. `overview`
   Business KPIs, plan status, active stores, active branches, staff count, orders today.
2. `stores`
   Create and manage stores, storefront status, template choice, business profile.
3. `branches`
   Create and manage branches per store, operational entry points, access links.
4. `staff`
   Create and manage staff scoped to tenant, store, or branch.
5. `customize`
   Storefront style, menu presentation, modules and channel-facing customization.

## Functional requirements

### Super Admin functional requirements

Phase 1 must support these platform flows:

- Create a tenant and its owner account from one guided flow.
- Detect tenants without an active owner.
- Detect tenants without an active plan or with inconsistent plan state.
- Change tenant plan from the admin panel.
- Review pipeline leads and trigger invite flow through backend.
- Audit stores and branches without switching role context.
- See platform-level alerts such as hidden stores, inactive branches, or chatbot-disabled branches.

### Tenant functional requirements

Phase 1 must support these tenant flows:

- Create a store with a guided setup path.
- Create branches scoped to a selected store.
- Create staff with correct scope and role restrictions.
- Pause and reactivate staff access.
- See plan status and limits before trying to create more entities.
- Change storefront/menu style without mixing platform-level responsibilities.

## UX structure per page

### Super Admin page structure

The page should follow this order:

1. Top KPI strip with platform metrics.
2. Primary action rail:
   - create tenant
   - create owner account
   - review pending leads
   - review plans
3. Main work surface:
   - active tab view
   - tab-level filters and search
   - density-optimized cards or tables
4. Side intelligence blocks in overview:
   - tenants needing action
   - pending onboarding
   - recent activity

The `owners` tab must be explicit in the navigation and not hidden behind tenant management.

### Tenant page structure

The page should follow this order:

1. KPI strip with plan and business metrics.
2. Plan awareness banner if limits are relevant.
3. Action rail:
   - create store
   - add branch
   - create staff
   - customize storefront
4. Active work surface with one responsibility per tab.

The tenant page should feel like a business cockpit, not a raw admin CRUD page.

## Visual and component strategy

The redesign must consolidate around shared components instead of per-page inline primitives.

### Required component direction

- Use `DashboardLayout` as the canonical shell.
- Expand `OxidianDS` if needed for missing shared primitives.
- Reduce page-local duplicates of:
  - `Btn`
  - `Alert`
  - `Badge`
  - `TabBar`
  - `Modal`
  - `StatCard`

### Visual direction to keep

- Neutral backgrounds with strong borders.
- Minimal accent colors used only for state and hierarchy.
- Bold numbers in KPI blocks.
- Compact but readable cards and lists.
- Useful density over decorative spacing.

## Data and logic contracts

### Auth contract

Before broader UI logic depends on role context, `AuthProvider` must use the canonical shared Supabase client instead of the legacy one.

Expected outcome:

- membership resolution remains based on `user_memberships`
- `tenantId`, `storeId`, `branchId`, and `role` remain the source of truth
- `PlanProvider` continues to sit under `AuthProvider` in the router tree

### Super Admin data contract

`SuperAdminPage` should rely on:

- `listTenants`
- `createTenant`
- `updateTenant`
- `listOwnerAccounts`
- `createOwnerAccount`
- `updateOwnerAccount`
- `getSuperAdminStats`
- `listStores`
- `listBranches`
- `listLandingRequests`
- `updateLandingRequest`
- `inviteLandingRequest`

If a page needs a new aggregate or list shape, add it in `supabaseApi.js` instead of embedding ad hoc page queries.

### Tenant data contract

`TenantAdminPage` should rely on:

- `getTenantDashboard`
- `getTenantPlan`
- `listStores`
- `createStore`
- `updateStore`
- `listBranches`
- `createBranch`
- `updateBranch`
- `listMemberships`
- `createStaffAccount`
- `updateStaffAccount`

## File-level implementation targets

Phase 1 is expected to touch at least these files:

- `frontend/src/core/providers/AuthProvider.jsx`
- `frontend/src/core/app/DashboardLayout.jsx`
- `frontend/src/shared/ui/OxidianDS.jsx`
- `frontend/src/shared/lib/supabaseApi.js`
- `frontend/src/modules/admin/pages/SuperAdminPage.jsx`
- `frontend/src/modules/tenant/pages/TenantAdminPage.jsx`

Compatibility-only review may also touch:

- `frontend/src/core/router/AppRouter.jsx`
- `frontend/src/modules/branch/pages/BranchAdminPage.jsx`

## Out of scope for Phase 1

These items are explicitly not part of this phase:

- full Branch Admin redesign
- Kitchen and Riders redesign
- public menu redesign beyond compatibility needs
- schema changes not required by already-planned functionality
- new billing engine or subscription backend rewrite

## Acceptance criteria

Phase 1 will be considered complete when:

1. `SuperAdminPage` clearly exposes tenants, owners, plans, pipeline, and store audit as first-class views.
2. Super admin can create tenant-owner structures from the panel without hidden steps.
3. `TenantAdminPage` is clearly separated into overview, stores, branches, staff, and customization.
4. Shared visual primitives replace duplicated inline UI patterns across the two pages.
5. `AuthProvider` is aligned with the canonical Supabase client and does not rely on the legacy auth client for membership loading.
6. Existing branch-level operational routes remain functional after the phase.

## Risks

- The current worktree already contains pending local modifications in shared files. Any implementation must merge carefully instead of overwriting them.
- `SuperAdminPage` currently mixes local UI primitives and partial business logic. Refactor scope must stay bounded.
- If RLS or backend endpoints are inconsistent, the redesign can expose hidden data-contract problems. Those should be fixed at the source, not patched in the UI.

## Recommended implementation order

1. Align auth base and shared UI primitives.
2. Refactor `SuperAdminPage` into stable sections and shared components.
3. Refactor `TenantAdminPage` onto the same shared system.
4. Verify router, navigation state, and plan-aware messaging.
5. Run build and role-path smoke checks.
