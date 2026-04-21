import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildBackendUrl,
  resolveBackendBase,
} from '../src/shared/lib/backendBase.js'

test('resolveBackendBase prefers explicit backend URL and trims trailing slash', () => {
  assert.equal(
    resolveBackendBase({ explicitBase: 'https://api.example.com/' }),
    'https://api.example.com'
  )
})

test('resolveBackendBase uses same-origin api backend in production when no explicit URL exists', () => {
  assert.equal(
    resolveBackendBase({ explicitBase: '', dev: false }),
    '/api/backend'
  )
})

test('resolveBackendBase stays empty in dev so Vite proxy can handle backend routes', () => {
  assert.equal(
    resolveBackendBase({ explicitBase: '', dev: true }),
    ''
  )
})

test('buildBackendUrl prefixes backend base and preserves leading slash', () => {
  assert.equal(
    buildBackendUrl('/tenant/stores', { explicitBase: '', dev: false }),
    '/api/backend/tenant/stores'
  )
})
