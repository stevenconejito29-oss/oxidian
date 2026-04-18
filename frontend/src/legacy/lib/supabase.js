// src/lib/supabase.js
// Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env
import { createClient } from '@supabase/supabase-js'
import { readCurrentSupabaseAccessToken } from './appSession'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️  Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

// Cliente para auth nativo de Supabase: login, magic link, session persistence.
export const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 8,
    },
  },
})

// Cliente scoped para datos legacy/mixtos: toma el bearer desde appSession.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => readCurrentSupabaseAccessToken(supabaseKey),
  realtime: {
    params: {
      eventsPerSecond: 8,
    },
  },
})
