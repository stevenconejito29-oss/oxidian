// src/lib/useSettings.js — CarmoCream v2
// Settings en tiempo real. Caché por storeId (Map) para soporte multi-tienda.
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { DEFAULT_STORE_ID, normalizeStoreId, resolveConfiguredStoreId, shouldUseLocalPreviewDefaults } from './currentStore'
import { DEFAULT_STORE_CONFIG, applyStoreTheme, loadStoreConfig, mergeStoreConfigWithSettings } from './storeConfig'
import { loadPublicMergedSettingsMap } from './storeSettings'
import { PUBLIC_STORE_SETTING_KEYS } from './storeConfigVisibility'

const cacheByStore = new Map() // storeId → merged settings

function getUrlStoreId() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('store')
    if (fromQuery) return normalizeStoreId(fromQuery)
    const m = window.location.pathname.match(/^\/s\/([^/]+)/)
    if (m?.[1]) return normalizeStoreId(m[1])
    return null
  } catch { return null }
}

async function reloadAndBroadcast(storeId) {
  if (shouldUseLocalPreviewDefaults(storeId)) {
    const mergedDefault = mergeStoreConfigWithSettings({}, DEFAULT_STORE_CONFIG)
    cacheByStore.set(storeId, mergedDefault)
    applyStoreTheme(mergedDefault)
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: mergedDefault }))
    return
  }

  const map = await loadPublicMergedSettingsMap(storeId, supabase).catch(async () => {
    const { data } = await supabase.from('settings').select('key, value').in('key', PUBLIC_STORE_SETTING_KEYS)
    return data ? Object.fromEntries(data.map(r => [r.key, r.value])) : {}
  })
  const storeConfig = await loadStoreConfig(storeId, supabase, { visibility: 'public' }).catch(() => null)
  const merged = mergeStoreConfigWithSettings(map, storeConfig)
  cacheByStore.set(storeId, merged)
  applyStoreTheme(merged)
  window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }))
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    const s = normalizeStoreId(getUrlStoreId() || DEFAULT_STORE_ID)
    return cacheByStore.get(s) || (shouldUseLocalPreviewDefaults(s) ? DEFAULT_STORE_CONFIG : {})
  })
  const [loading, setLoading] = useState(() => {
    const s = normalizeStoreId(getUrlStoreId() || DEFAULT_STORE_ID)
    if (shouldUseLocalPreviewDefaults(s)) return false
    return !cacheByStore.has(s)
  })
  // Referencia al canal activo para poder destruirlo al cambiar de tienda
  const channelRef = useRef(null)
  const activeStoreRef = useRef(DEFAULT_STORE_ID)

  useEffect(() => {
    const urlStore = normalizeStoreId(getUrlStoreId() || DEFAULT_STORE_ID)
    if (shouldUseLocalPreviewDefaults(urlStore)) {
      const mergedDefault = mergeStoreConfigWithSettings({}, DEFAULT_STORE_CONFIG)
      cacheByStore.set(urlStore, mergedDefault)
      setSettings(mergedDefault)
      applyStoreTheme(mergedDefault)
      setLoading(false)
      return undefined
    }

    if (cacheByStore.has(urlStore)) {
      setSettings(cacheByStore.get(urlStore))
      setLoading(false)
    }

    async function load() {
      const storeId = normalizeStoreId(
        await resolveConfiguredStoreId(supabase).catch(() => DEFAULT_STORE_ID)
      )

      // Si cambió la tienda, destruir el canal anterior antes de crear uno nuevo
      if (activeStoreRef.current !== storeId && channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      activeStoreRef.current = storeId

      const map = await loadPublicMergedSettingsMap(storeId, supabase).catch(async () => {
        const { data } = await supabase.from('settings').select('key, value').in('key', PUBLIC_STORE_SETTING_KEYS)
        return data ? Object.fromEntries(data.map(r => [r.key, r.value])) : {}
      })
      const storeConfig = await loadStoreConfig(storeId, supabase, { visibility: 'public' }).catch(() => null)
      const merged = mergeStoreConfigWithSettings(map, storeConfig)
      cacheByStore.set(storeId, merged)
      setSettings(merged)
      applyStoreTheme(merged)
      setLoading(false)

      // Crear canal solo si no existe ya para esta tienda
      if (!channelRef.current) {
        channelRef.current = supabase
          .channel(`settings-realtime-${storeId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () =>
            reloadAndBroadcast(activeStoreRef.current)
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, payload => {
            const sid = normalizeStoreId(payload?.new?.store_id || payload?.old?.store_id || activeStoreRef.current)
            if (sid === activeStoreRef.current) reloadAndBroadcast(sid)
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'config_tienda' }, () =>
            reloadAndBroadcast(activeStoreRef.current)
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, payload => {
            const sid = normalizeStoreId(payload?.new?.id || payload?.old?.id || activeStoreRef.current)
            if (sid === activeStoreRef.current) reloadAndBroadcast(sid)
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'store_process_profiles' }, payload => {
            const sid = normalizeStoreId(payload?.new?.store_id || payload?.old?.store_id || activeStoreRef.current)
            if (sid === activeStoreRef.current) reloadAndBroadcast(sid)
          })
          .subscribe()
      }
    }
    load()

    function onUpdate(e) { setSettings(e.detail) }
    window.addEventListener('settings-updated', onUpdate)

    return () => {
      window.removeEventListener('settings-updated', onUpdate)
      // Destruir canal al desmontar el componente
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  return { settings, loading }
}
