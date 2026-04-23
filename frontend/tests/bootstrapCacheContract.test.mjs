import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const indexHtmlPath = path.resolve(__dirname, '../index.html')

test('index.html unregisters legacy service workers before app bootstrap', () => {
  const source = readFileSync(indexHtmlPath, 'utf8')

  assert.match(source, /serviceWorker\.getRegistrations/)
  assert.match(source, /service-worker\.js/)
  assert.match(source, /window\.caches\.keys/)
  assert.match(source, /oxidian-v1/)
})
