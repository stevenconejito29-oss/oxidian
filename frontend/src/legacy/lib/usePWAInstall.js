import { useEffect, useState } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.navigator.standalone === true) return true
  return false
}

function detectWebView() {
  const ua = navigator.userAgent
  const inApp = /instagram|fbav|fban|fblc|facebook|twitter|snapchat|tiktok|linkedin|pinterest|whatsapp|line|wechat|micromessenger/i.test(ua)
  const androidWV = /android/i.test(ua) && /wv\b|webview/i.test(ua)
  const iosWV = isIOS() && !/safari/i.test(ua) && /applewebkit/i.test(ua)
  return { isWebView: inApp || androidWV || iosWV }
}

function openInNativeBrowser() {
  const url = window.location.href
  if (isIOS()) {
    window.location.href = url.replace(/^https?/, 'x-safari-https')
    return
  }

  const intentUrl =
    'intent://' +
    url.replace(/^https?:\/\//, '') +
    '#Intent;scheme=https;package=com.android.chrome;end'
  window.location.href = intentUrl
}

export function usePWAInstall({ enabled = true } = {}) {
  const [installEvt, setInstallEvt] = useState(() => (enabled ? window.__pwaInstallEvt || null : null))
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => (enabled ? isInStandaloneMode() : false))

  useEffect(() => {
    if (!enabled) {
      setInstallEvt(null)
      setShowIOSHint(false)
      setIsInstalled(false)
      return undefined
    }

    if (isInStandaloneMode()) {
      setIsInstalled(true)
      return undefined
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const onMediaChange = event => {
      if (event.matches) setIsInstalled(true)
    }
    const onReady = () => setInstallEvt(window.__pwaInstallEvt || null)
    const onInstalled = () => {
      setInstallEvt(null)
      setIsInstalled(true)
    }

    if (window.__pwaInstallEvt && !installEvt) setInstallEvt(window.__pwaInstallEvt)

    mediaQuery.addEventListener('change', onMediaChange)
    window.addEventListener('pwainstallready', onReady)
    window.addEventListener('pwainstalled', onInstalled)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      mediaQuery.removeEventListener('change', onMediaChange)
      window.removeEventListener('pwainstallready', onReady)
      window.removeEventListener('pwainstalled', onInstalled)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [enabled, installEvt])

  const { isWebView } = detectWebView()
  const onIOS = isIOS()

  function install() {
    if (!enabled) return

    if (onIOS && !isWebView && !installEvt) {
      setShowIOSHint(true)
      return
    }

    if (isWebView) {
      try {
        openInNativeBrowser()
      } catch {}
      return
    }

    if (installEvt) {
      installEvt.prompt()
      installEvt.userChoice.then(choice => {
        window.__pwaInstallEvt = null
        setInstallEvt(null)
        if (choice.outcome === 'accepted') setIsInstalled(true)
      })
    }
  }

  return {
    showButton: enabled && !isInstalled,
    showIOSHint,
    setShowIOSHint,
    install,
    isWebView,
    isIOS: onIOS,
    isInstalled,
    getButtonLabel: () => (isWebView ? (onIOS ? 'Abrir en Safari' : 'Abrir en Chrome') : 'Instalar'),
    getBarText: () => (
      isWebView
        ? (onIOS ? 'Abrir en Safari para instalar' : 'Abrir en Chrome para instalar')
        : 'Guarda CarmoCream en tu movil'
    ),
  }
}
