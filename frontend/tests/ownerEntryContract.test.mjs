import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const landingPath = path.resolve(__dirname, '../src/modules/admin/pages/LandingPage.jsx')
const loginPath = path.resolve(__dirname, '../src/modules/auth/pages/LoginPage.jsx')

test('landing handles already-existing owner accounts as a successful submission state', () => {
  const source = readFileSync(landingPath, 'utf8')

  assert.match(source, /owner_account_exists/)
  assert.match(source, /Ya existia una cuenta con ese correo/)
  assert.match(source, /Ir al login/)
})

test('login page routes unauthenticated users back to the public landing', () => {
  const source = readFileSync(loginPath, 'utf8')

  assert.match(source, /navigate\('\/'\)/)
  assert.doesNotMatch(source, /navigate\('\/onboarding'\)/)
})
