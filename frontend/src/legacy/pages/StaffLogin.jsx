import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import styles from './StaffLogin.module.css'
import { usePWAInstall } from '../lib/usePWAInstall'
import { useResolvedStoreId } from '../lib/currentStore'
import { loadPublicMergedSettingsMap } from '../lib/storeSettings'
import { buildStoreBrandingSnapshot } from '../lib/adminBranding'
import { requestAppLogin } from '../lib/appAuthApi'

// ── Rate limiting en memoria (max 5 intentos / 5 min por usuario) ──────────
const ATTEMPTS = {}
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 5 * 60 * 1000

function isLocked(key) {
  const a = ATTEMPTS[key]
  if (!a) return false
  if (a.count >= MAX_ATTEMPTS) {
    if (Date.now() - a.firstAt < LOCKOUT_MS) return true
    delete ATTEMPTS[key]
  }
  return false
}
function registerAttempt(key) {
  if (!ATTEMPTS[key]) ATTEMPTS[key] = { count: 0, firstAt: Date.now() }
  ATTEMPTS[key].count++
}
function clearAttempts(key) { delete ATTEMPTS[key] }

export default function StaffLogin({ onLogin, role }) {
  // Desestructuramos el nuevo flag storeIdReady para no disparar queries prematuros
  const { storeId, storeIdReady } = useResolvedStoreId()
  const [brandName, setBrandName] = useState('Mi tienda')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const passRef = useRef(null)
  const { showButton, showIOSHint, setShowIOSHint, install, getButtonLabel } = usePWAInstall()

  useEffect(() => { setUsername(''); setPassword('') }, [])

  useEffect(() => {
    // ── ARREGLO BUG 3: esperar a que el storeId esté resuelto antes de
    // hacer cualquier query a Supabase. Sin este guard, se disparaban
    // requests con storeId='default' sin sesión → 401 en consola.
    if (!storeIdReady) return

    let active = true
    loadPublicMergedSettingsMap(storeId, supabase)
      .then(settingsMap => {
        if (!active) return
        setBrandName(buildStoreBrandingSnapshot(settingsMap, null, storeId).businessName || 'Mi tienda')
      })
      .catch(() => {
        if (active) setBrandName('Mi tienda')
      })
    return () => { active = false }
  }, [storeId, storeIdReady])

  async function login() {
    const u = username.trim().toLowerCase()
    const p = password.trim()
    if (!u || !p) { toast.error('Introduce usuario y contraseña'); return }

    const lockKey = `${role}:${u}`
    if (isLocked(lockKey)) {
      toast.error('Demasiados intentos. Espera 5 minutos.')
      return
    }

    setLoading(true)
    try {
      const session = await requestAppLogin({
        scope: 'staff',
        storeId,
        username: u,
        password: p,
        role,
      })
      clearAttempts(lockKey)
      setLoading(false)
      onLogin(session)
    } catch {
      registerAttempt(lockKey)
      setLoading(false)
      toast.error('Credenciales incorrectas')
    }
  }

  const icon  = role === 'cocina' ? '👨‍🍳' : '🛵'
  const label = role === 'cocina' ? 'Cocina' : 'Repartidor'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>{icon}</div>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.sub}>{brandName} · Acceso de staff</p>
        <input
          className={styles.input}
          placeholder="Usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && passRef.current?.focus()}
          autoCapitalize="none" autoCorrect="off" autoComplete="username"
        />
        <input
          ref={passRef}
          className={styles.input}
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && login()}
          autoComplete="current-password"
        />
        <button className={styles.btn} onClick={login} disabled={loading}>
          {loading ? <span className={styles.spin} /> : `Entrar como ${label}`}
        </button>
        {showButton && (
          <button className={styles.installBtn} onClick={install}>
            📲 {getButtonLabel()}
          </button>
        )}
        {showIOSHint && (
          <div className={styles.iosHint}>
            <p>En Safari: toca <strong>Compartir 📤</strong> → <strong>Añadir a inicio</strong></p>
            <button className={styles.iosHintClose} onClick={() => setShowIOSHint(false)}>✕ Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}
