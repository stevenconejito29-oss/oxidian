import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const supabasePath = path.resolve(__dirname, '../src/legacy/lib/supabase.js')
const mainPath = path.resolve(__dirname, '../src/main.jsx')

test('supabase bootstrap is guarded when VITE credentials are missing', () => {
  const source = readFileSync(supabasePath, 'utf8')

  assert.match(source, /isSupabaseConfigured/)
  assert.match(source, /SUPABASE_CONFIG_ERROR/)
  assert.match(source, /createThrowingClient/)
})

test('main renders a visible configuration error instead of a white screen', () => {
  const source = readFileSync(mainPath, 'utf8')

  assert.match(source, /ConfigErrorScreen/)
  assert.match(source, /isSupabaseConfigured \?/)
  assert.match(source, /Configuracion incompleta/)
})
