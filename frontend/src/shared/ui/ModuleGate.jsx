import { useStoreModules } from '../hooks/useStoreModules'

/**
 * ModuleGate — Renderiza children solo si el módulo está activo.
 * Uso:
 *   <ModuleGate module="mod_appointments">
 *     <AgendaPanel />
 *   </ModuleGate>
 *   <ModuleGate module="mod_tables" fallback={<p>Activa el módulo de mesas</p>}>
 *     <MesasPanel />
 *   </ModuleGate>
 */
export function ModuleGate({ module: moduleId, fallback = null, children }) {
  const { isEnabled, loading } = useStoreModules()
  if (loading) return null
  return isEnabled(moduleId) ? children : fallback
}
