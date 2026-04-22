/**
 * useMenuData.js — Oxidian
 * ─────────────────────────────────────────────────────────────
 * Re-exporta useRealtimeProducts con el mismo API público que
 * antes para que Menu.jsx no necesite cambios de import.
 * Ahora el menú reacciona instantáneamente cuando el Admin
 * cambia un stock o precio desde el panel.
 * ─────────────────────────────────────────────────────────────
 */
export { useRealtimeProducts as useMenuData } from './useRealtimeProducts'
