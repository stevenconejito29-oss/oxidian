import test from 'node:test'
import assert from 'node:assert/strict'

import {
  countLandingRequestsByStatus,
  getPendingLandingRequests,
} from '../src/modules/admin/lib/superAdminPipeline.js'

test('getPendingLandingRequests returns only pending leads and respects the limit', () => {
  const leads = [
    null,
    { id: '1', status: 'pending' },
    { id: '2', status: 'converted' },
    { id: '3', status: 'pending' },
    { id: '4', status: 'pending' },
  ]

  const result = getPendingLandingRequests(leads, 2)

  assert.deepEqual(result.map((lead) => lead.id), ['1', '3'])
})

test('countLandingRequestsByStatus ignores null entries', () => {
  const counts = countLandingRequestsByStatus([
    null,
    { status: 'pending' },
    { status: 'pending' },
    { status: 'converted' },
  ])

  assert.deepEqual(counts, {
    pending: 2,
    converted: 1,
  })
})
