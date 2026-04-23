import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const staffLoginPath = path.resolve(__dirname, '../src/modules/auth/pages/StaffLoginPage.jsx')
const checkoutPath = path.resolve(__dirname, '../src/modules/public-menu/components/CheckoutDrawer.jsx')
const storeConfigPath = path.resolve(__dirname, '../src/modules/public-menu/hooks/useStorePublicConfig.js')
const appSessionPath = path.resolve(__dirname, '../src/legacy/lib/appSession.js')

test('staff login page uses backend pin login and redirects with branch scope', () => {
  const source = readFileSync(staffLoginPath, 'utf8')

  assert.match(source, /buildBackendUrl\('\/public\/staff\/login'\)/)
  assert.match(source, /session_membership/)
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
  assert.match(source, /customer_phone/)
})

test('public store config uses the canonical Supabase client and staff routes resolve branch sessions', () => {
  const storeConfigSource = readFileSync(storeConfigPath, 'utf8')
  const appSessionSource = readFileSync(appSessionPath, 'utf8')

  assert.match(storeConfigSource, /shared\/supabase\/client/)
  assert.equal(appSessionSource.includes('/\\/branch\\/kitchen'), true)
  assert.equal(appSessionSource.includes('/\\/branch\\/riders'), true)
  assert.equal(appSessionSource.includes('/\\/branch\\/admin'), true)
})
