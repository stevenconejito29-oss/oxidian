/**
 * useStoreStatus.js — CarmoCream
 * ─────────────────────────────────────────────────────────────
 * Determina si la tienda está abierta basándose en settings
 * de Supabase. Centraliza la lógica de horario que antes
 * vivía hardcodeada dentro de Menu.jsx.
 *
 * Retorna:
 *   open     — boolean: ¿está abierta la tienda ahora?
 *   isOpen() — fn para re-evaluar bajo demanda
 * ─────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react'

export function useStoreStatus(settings) {
  const isOpen = useMemo(() => {
    // Override manual desde el panel admin
    if (settings.store_open === 'true')  return true
    if (settings.store_open === 'false') return false

    // Evaluación por horario configurado
    const now    = new Date()
    const hour   = now.getHours()
    const day    = now.getDay()
    const openH  = parseInt(settings.open_hour  || '14', 10)
    const closeH = parseInt(settings.close_hour || '21', 10)
    const days   = (settings.open_days || '2,3,4,5,6,0').split(',').map(Number)

    return days.includes(day) && hour >= openH && hour < closeH
  }, [
    settings.store_open,
    settings.open_hour,
    settings.close_hour,
    settings.open_days,
  ])

  return { isOpen }
}
