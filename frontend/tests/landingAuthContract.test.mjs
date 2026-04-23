import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const landingPath = path.resolve(__dirname, '../src/modules/admin/pages/LandingPage.jsx')

test('landing initializes its hooks before redirecting authenticated users', () => {
  const source = readFileSync(landingPath, 'utf8')
  const firstStateIndex = source.indexOf('const [form, setForm]')
  const redirectIndex = source.indexOf("if (!loading && isAuthenticated && role !== 'anonymous')")

  assert.notEqual(firstStateIndex, -1)
  assert.notEqual(redirectIndex, -1)
  assert.equal(firstStateIndex < redirectIndex, true)
})
