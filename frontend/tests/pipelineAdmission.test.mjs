import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getLeadStatusAfterActivation,
  getOwnerInviteRedirectPath,
} from '../src/modules/admin/lib/pipelineAdmission.js'

test('getOwnerInviteRedirectPath points invited owners to the real login route', () => {
  assert.equal(
    getOwnerInviteRedirectPath('https://oxidian.example'),
    'https://oxidian.example/login'
  )
})

test('getOwnerInviteRedirectPath falls back to the app login route without origin', () => {
  assert.equal(getOwnerInviteRedirectPath(), '/login')
})

test('getLeadStatusAfterActivation moves admitted leads into onboarding', () => {
  assert.equal(
    getLeadStatusAfterActivation({ hasOwnerAccess: true }),
    'onboarding'
  )
})
