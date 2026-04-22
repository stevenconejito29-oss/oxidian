// Pedidos.jsx — Oxidian
// Sesión en localStorage con TTL 8h
// (sessionStorage se borra en iOS Safari al volver desde otra app)

import React, { useState, useEffect } from 'react'
import StaffLogin from './StaffLogin'
import PedidosContent from './PedidosContent'
import StaffPWARequired from './StaffPWARequired'
import { sendStaffOfflineBeacon, setStaffOnlineState, startStaffHeartbeat, stopStaffHeartbeat } from '../lib/staffPresence'

const SESSION_KEY = 'oxidian_staff_kitchen'
const SESSION_TTL = 8 * 60 * 60 * 1000

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data._ts && Date.now() - data._ts > SESSION_TTL) {
      sendStaffOfflineBeacon(data.id, data.store_id)
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    if (data.role && data.role !== 'cocina') {
      sendStaffOfflineBeacon(data.id, data.store_id)
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return data
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export default function Pedidos() {
  const [session, setSession] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setSession(loadSession())
    setChecked(true)
  }, [])

  useEffect(() => {
    if (!session?.id) return undefined

    // Marcar online y arrancar heartbeat — garantiza last_seen actualizado
    setStaffOnlineState(session.id, true, session.store_id).catch(() => {})
    const stopHeartbeat = startStaffHeartbeat(session.id, session.store_id)

    const markOffline = () => {
      stopHeartbeat()
      sendStaffOfflineBeacon(session.id, session.store_id)
    }
    window.addEventListener('pagehide', markOffline)
    window.addEventListener('beforeunload', markOffline)

    return () => {
      stopStaffHeartbeat(session.id)
      sendStaffOfflineBeacon(session.id, session.store_id)
      window.removeEventListener('pagehide', markOffline)
      window.removeEventListener('beforeunload', markOffline)
    }
  }, [session?.id, session?.store_id])

  function handleLogin(data) {
    const withTs = { ...data, _ts: Date.now() }
    localStorage.setItem(SESSION_KEY, JSON.stringify(withTs))
    setSession(withTs)
  }

  async function logout() {
    await setStaffOnlineState(session?.id, false, session?.store_id)
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (!checked) return null

  return (
    <StaffPWARequired role="cocina">
      {!session ? (
        <StaffLogin role="cocina" onLogin={handleLogin} />
      ) : (
        <PedidosContent session={session} onLogout={logout} />
      )}
    </StaffPWARequired>
  )
}
