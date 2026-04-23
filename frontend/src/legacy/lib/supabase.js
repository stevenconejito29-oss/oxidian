// src/lib/supabase.js
// Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env
import { createClient } from '@supabase/supabase-js'
import { readCurrentSupabaseAccessToken } from './appSession'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const SUPABASE_CONFIG_ERROR = 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el build del frontend.'

function createThrowingClient(message) {
  const fail = () => {
    throw new Error(message)
  }

  const handler = {
    get() {
      return new Proxy(fail, handler)
    },
    apply() {
      fail()
    },
  }

  return new Proxy(fail, handler)
}

if (!isSupabaseConfigured) {
  console.error('⚠️  Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

// Cliente para auth nativo de Supabase: login, magic link, session persistence.
export const supabaseAuth = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 8,
        },
      },
    })
  : createThrowingClient(SUPABASE_CONFIG_ERROR)

// Cliente scoped para datos legacy/mixtos: toma el bearer desde appSession.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      accessToken: async () => readCurrentSupabaseAccessToken(supabaseKey),
      realtime: {
        params: {
          eventsPerSecond: 8,
        },
      },
    })
  : createThrowingClient(SUPABASE_CONFIG_ERROR)
