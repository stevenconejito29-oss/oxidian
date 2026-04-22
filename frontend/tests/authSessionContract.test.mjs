import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMembershipFromStored,
  buildSessionFromStored,
  isPendingApprovalUser,
} from '../src/core/providers/authState.js'

test('buildSessionFromStored returns null without access token', () => {
  assert.equal(buildSessionFromStored(null), null)
  assert.equal(buildSessionFromStored({}), null)
})

test('buildMembershipFromStored only accepts stored sessions with session_membership.role', () => {
  assert.equal(
    buildMembershipFromStored({ supabase_access_token: 'token-only' }),
    null,
  )

  assert.deepEqual(
    buildMembershipFromStored({
      session_membership: {
        role: 'branch_manager',
        tenant_id: 'tenant-1',
        store_id: 'store-1',
        branch_id: 'branch-1',
      },
    }),
    {
      role: 'branch_manager',
      tenant_id: 'tenant-1',
      store_id: 'store-1',
      branch_id: 'branch-1',
      is_active: true,
      metadata: {},
    },
  )
})

test('isPendingApprovalUser detects pending approval from Supabase user metadata', () => {
  assert.equal(isPendingApprovalUser(null), false)
  assert.equal(isPendingApprovalUser({ user_metadata: {} }), false)
  assert.equal(
    isPendingApprovalUser({ user_metadata: { pending_approval: true } }),
    true,
  )
  assert.equal(
    isPendingApprovalUser({ app_metadata: { pending_approval: true } }),
    true,
  )
})
