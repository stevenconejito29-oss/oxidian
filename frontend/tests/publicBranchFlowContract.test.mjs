import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dashboardLayoutPath = path.resolve(__dirname, '../src/core/app/DashboardLayout.jsx')
const staffLoginPath = path.resolve(__dirname, '../src/modules/auth/pages/StaffLoginPage.jsx')
const kitchenPath = path.resolve(__dirname, '../src/modules/branch/pages/BranchKitchenPage.jsx')
const ridersPath = path.resolve(__dirname, '../src/modules/branch/pages/BranchRidersPage.jsx')
const branchAdminPath = path.resolve(__dirname, '../src/modules/branch/pages/BranchAdminPage.jsx')
const checkoutPath = path.resolve(__dirname, '../src/modules/public-menu/components/CheckoutDrawer.jsx')
const storeConfigPath = path.resolve(__dirname, '../src/modules/public-menu/hooks/useStorePublicConfig.js')
const tenantAdminPath = path.resolve(__dirname, '../src/modules/tenant/pages/TenantAdminPage.jsx')
const appSessionPath = path.resolve(__dirname, '../src/legacy/lib/appSession.js')

test('staff login page uses backend pin login and redirects with branch scope', () => {
  const source = readFileSync(staffLoginPath, 'utf8')

  assert.match(source, /buildBackendUrl\('\/public\/staff\/login'\)/)
  assert.match(source, /session_membership/)
  assert.match(source, /const membership = session\?\.session_membership \|\| \{\}/)
  assert.match(source, /const resolvedRole = session\?\.role \|\| membership\.role/)
  assert.match(source, /store_id/)
  assert.match(source, /branch_id/)
  assert.match(source, /\/branch\/\$\{dest\}\?\$\{query\.toString\(\)\}/)
})

test('checkout drawer sends public orders through backend with branch id and cart actions', () => {
  const source = readFileSync(checkoutPath, 'utf8')

  assert.match(source, /buildBackendUrl\('\/public\/orders'\)/)
  assert.match(source, /branch_id: branch\.id/)
  assert.match(source, /onUpdateQty/)
  assert.match(source, /onRemoveItem/)
  assert.match(source, /item\.line_id/)
  assert.match(source, /customer_phone/)
})

test('public store config uses the canonical Supabase client and staff routes resolve branch sessions', () => {
  const storeConfigSource = readFileSync(storeConfigPath, 'utf8')
  const appSessionSource = readFileSync(appSessionPath, 'utf8')

  assert.match(storeConfigSource, /shared\/supabase\/client/)
  assert.match(storeConfigSource, /from\('combos'\)/)
  assert.match(storeConfigSource, /__combos__/)
  assert.equal(appSessionSource.includes('/\\/branch\\/kitchen'), true)
  assert.equal(appSessionSource.includes('/\\/branch\\/riders'), true)
  assert.equal(appSessionSource.includes('/\\/branch\\/admin'), true)
})

test('branch operational pages resolve scope from auth state and branch admin gates premium modules', () => {
  const kitchenSource = readFileSync(kitchenPath, 'utf8')
  const ridersSource = readFileSync(ridersPath, 'utf8')
  const branchAdminSource = readFileSync(branchAdminPath, 'utf8')

  assert.match(kitchenSource, /useAuth\(\)/)
  assert.match(kitchenSource, /params\.get\('branch_id'\)\s*\|\|\s*params\.get\('branch'\)\s*\|\|\s*authBranchId/)
  assert.match(ridersSource, /useAuth\(\)/)
  assert.match(ridersSource, /params\.get\('branch_id'\)\s*\|\|\s*params\.get\('branch'\)\s*\|\|\s*authBranchId/)
  assert.match(branchAdminSource, /FeatureGate/)
  assert.match(branchAdminSource, /FEATURES\.COUPONS/)
  assert.match(branchAdminSource, /FEATURES\.CHATBOT_BASIC/)
  assert.match(branchAdminSource, /getChatbotDownloadUrl/)
})

test('branch admin exposes operational tabs for combos, inventory and cash with role-scoped access', () => {
  const branchAdminSource = readFileSync(branchAdminPath, 'utf8')
  const dashboardSource = readFileSync(dashboardLayoutPath, 'utf8')

  assert.match(branchAdminSource, /id:'combos'/)
  assert.match(branchAdminSource, /id:'inventory'/)
  assert.match(branchAdminSource, /id:'finance'/)
  assert.match(branchAdminSource, /ROLE_TAB_ACCESS/)
  assert.match(branchAdminSource, /cashier:\s*\['dashboard','orders','finance'\]/)
  assert.match(branchAdminSource, /store_operator:\s*\['dashboard','products','combos','inventory','orders'\]/)
  assert.match(branchAdminSource, /db\.from\('combos'\)/)
  assert.match(branchAdminSource, /db\.from\('stock_items'\)/)
  assert.match(branchAdminSource, /db\.from\('cash_entries'\)/)
  assert.match(dashboardSource, /#combos/)
  assert.match(dashboardSource, /#inventory/)
  assert.match(dashboardSource, /#finance/)
})

test('branch product management supports advanced catalog fields consumed by the public menu', () => {
  const branchAdminSource = readFileSync(branchAdminPath, 'utf8')

  assert.match(branchAdminSource, /compare_price/)
  assert.match(branchAdminSource, /image_url/)
  assert.match(branchAdminSource, /has_variants/)
  assert.match(branchAdminSource, /variants/)
  assert.match(branchAdminSource, /modifiers/)
  assert.match(branchAdminSource, /track_stock/)
  assert.match(branchAdminSource, /stock_quantity/)
})

test('dashboard and tenant admin expose the scoped navigation and plan gates', () => {
  const dashboardSource = readFileSync(dashboardLayoutPath, 'utf8')
  const tenantAdminSource = readFileSync(tenantAdminPath, 'utf8')

  assert.match(dashboardSource, /store_admin:/)
  assert.match(dashboardSource, /branch_manager:/)
  assert.match(dashboardSource, /cashier:/)
  assert.doesNotMatch(dashboardSource, /#owners/)
  assert.doesNotMatch(dashboardSource, /#affiliates/)
  assert.match(tenantAdminSource, /<LimitGate limitKey=\{FEATURES\.MAX_STORES\} currentCount=\{stores\.length\}>/)
  assert.match(tenantAdminSource, /<LimitGate limitKey=\{FEATURES\.MAX_BRANCHES\} currentCount=\{storeBranches\.length\}>/)
  assert.match(tenantAdminSource, /<LimitGate limitKey=\{FEATURES\.MAX_STAFF\} currentCount=\{accounts\.length\}>/)
  assert.match(tenantAdminSource, /<FeatureGate feature=\{FEATURES\.MENU_CUSTOM_STYLE\}>/)
})
