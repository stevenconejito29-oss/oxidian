function getDesktopBridge() {
  if (typeof window === 'undefined') return null
  return window.oxidianDesktopAdmin || null
}

export function isDesktopChatbotRuntimeAvailable() {
  const bridge = getDesktopBridge()
  return typeof bridge?.getChatbotRuntimeStatus === 'function'
}

export function getDesktopRuntimeConfig() {
  const bridge = getDesktopBridge()
  return bridge?.runtimeConfig || null
}

export async function loadDesktopRuntimeConfig() {
  const bridge = getDesktopBridge()
  if (!bridge?.loadRuntimeConfig) return null
  return bridge.loadRuntimeConfig()
}

export async function saveDesktopRuntimeConfig(payload) {
  const bridge = getDesktopBridge()
  if (!bridge?.saveRuntimeConfig) return null
  return bridge.saveRuntimeConfig(payload)
}

export async function getDesktopChatbotRuntimeStatus() {
  const bridge = getDesktopBridge()
  if (!bridge?.getChatbotRuntimeStatus) return null
  return bridge.getChatbotRuntimeStatus()
}

export async function startDesktopChatbotRuntime() {
  const bridge = getDesktopBridge()
  if (!bridge?.startChatbotRuntime) return null
  return bridge.startChatbotRuntime()
}

export async function restartDesktopChatbotRuntime() {
  const bridge = getDesktopBridge()
  if (!bridge?.restartChatbotRuntime) return null
  return bridge.restartChatbotRuntime()
}

export async function stopDesktopChatbotRuntime() {
  const bridge = getDesktopBridge()
  if (!bridge?.stopChatbotRuntime) return null
  return bridge.stopChatbotRuntime()
}

export async function loadDesktopChatbotRuntimeEnv() {
  const bridge = getDesktopBridge()
  if (!bridge?.loadChatbotRuntimeEnv) return null
  return bridge.loadChatbotRuntimeEnv()
}

export async function saveDesktopChatbotRuntimeEnv(payload) {
  const bridge = getDesktopBridge()
  if (!bridge?.saveChatbotRuntimeEnv) return null
  return bridge.saveChatbotRuntimeEnv(payload)
}

export async function openDesktopChatbotRuntimePath(target) {
  const bridge = getDesktopBridge()
  if (!bridge?.openChatbotRuntimePath) return null
  return bridge.openChatbotRuntimePath(target)
}

export function subscribeDesktopChatbotRuntime(callback) {
  const bridge = getDesktopBridge()
  if (!bridge?.onChatbotRuntimeUpdated) return () => {}
  return bridge.onChatbotRuntimeUpdated(callback)
}
