// Exporta ambos clientes para que los módulos nuevos puedan elegir el correcto:
// - supabase      → cliente legacy con appSession bearer (compatibilidad)
// - supabaseAuth  → cliente nativo Supabase Auth (login, sesión, magic link)
export { supabase, supabaseAuth } from '../../legacy/lib/supabase'
