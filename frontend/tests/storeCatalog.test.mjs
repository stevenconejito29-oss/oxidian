import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createStorePayload,
  getAvailableMenuStyles,
  getNicheDefinition,
} from '../src/modules/tenant/lib/storeCatalog.js'

test('restaurant payload keeps canonical business type and template', () => {
  const payload = createStorePayload({
    name: 'Carmo Cream',
    slug: 'carmo-cream',
    nicheId: 'restaurant',
    city: 'Madrid',
  })

  assert.equal(payload.business_type, 'food')
  assert.equal(payload.niche, 'restaurant')
  assert.equal(payload.template_id, 'delivery')
})

test('barbershop payload keeps booking template for service flows', () => {
  const payload = createStorePayload({
    name: 'Barber HQ',
    slug: 'barber-hq',
    nicheId: 'barbershop',
  })

  assert.equal(payload.business_type, 'beauty')
  assert.equal(payload.template_id, 'booking')
})

test('available menu styles only expose templates supported by the public menu router', () => {
  const styles = getAvailableMenuStyles().map((style) => style.id)

  assert.deepEqual(styles, ['delivery', 'vitrina', 'portfolio', 'minimal', 'booking', 'express'])
  assert.equal(styles.includes('despensa'), false)
})

test('supported niches map to stable metadata', () => {
  const niche = getNicheDefinition('minimarket')

  assert.equal(niche.id, 'minimarket')
  assert.equal(niche.businessType, 'retail')
  assert.equal(niche.templateId, 'minimal')
  assert.equal(niche.recommendedMenuStyleId, 'minimal')
})
