import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dsPath = path.resolve(__dirname, '../src/shared/ui/OxidianDS.jsx')
const globalsPath = path.resolve(__dirname, '../src/styles/globals.css')

test('OxidianDS supports the branch admin button and card contract', () => {
  const source = readFileSync(dsPath, 'utf8')

  assert.match(source, /variant='primary'/)
  assert.match(source, /success:/)
  assert.match(source, /blue:/)
  assert.match(source, /purple:/)
  assert.match(source, /full\b/)
  assert.match(source, /sx\b/)
  assert.match(source, /title\b/)
  assert.match(source, /action\b/)
  assert.match(source, /accent\b/)
  assert.match(source, /sub\b/)
})

test('globals define success feedback colors used by auth screens', () => {
  const source = readFileSync(globalsPath, 'utf8')

  assert.match(source, /--color-text-success:/)
  assert.match(source, /--color-background-success:/)
})
