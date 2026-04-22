// Acceso web siempre permitido. El admin de tienda es un panel web.
export function isDesktopAdminRuntime() {
  if (typeof window === 'undefined') return false
  return window.oxidianDesktopAdmin?.allowed === true
}

export function isWebAdminOverrideEnabled() {
  return true // Acceso web siempre activo
}

export function canOpenAdminPanel() {
  return true // El panel de tienda siempre accesible desde el navegador
}

export function getDesktopAdminMeta() {
  if (typeof window === 'undefined') return null
  return window.oxidianDesktopAdmin || null
}
