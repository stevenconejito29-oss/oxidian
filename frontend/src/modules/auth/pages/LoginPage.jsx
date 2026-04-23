import React from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'

export default function LoginPage() {
  const { isAuthenticated, loading, role, authError } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || null

  const [mode,    setMode]    = React.useState('login')
  const [email,   setEmail]   = React.useState('')
  const [password,setPassword]= React.useState('')
  const [busy,    setBusy]    = React.useState(false)
  const [error,   setError]   = React.useState('')
  const [success, setSuccess] = React.useState('')

  // Ya autenticado con rol → dejar que HomeEntry decida (verifica tiendas para tenant_owner)
  if (!loading && isAuthenticated && role && role !== 'anonymous') {
    // Si venía de una ruta protegida específica, respetarla. Si no, ir a / para que HomeEntry decida.
    const dest = from && from !== '/login' && from !== '/onboarding' ? from : '/'
    return <Navigate to={dest} replace />
  }

  // Autenticado pero con error de membresía → HomeEntry lo maneja
  if (!loading && isAuthenticated && authError) {
    return <Navigate to="/" replace />
  }

  async function handleLogin(e) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')

    const { error: err } = await supabaseAuth.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : err.message
      )
      setBusy(false)
      return
    }

    // La redirección la hace AuthProvider al resolver la membresía.
    // Mostramos feedback mientras esperamos.
    setSuccess('Verificando acceso…')

    // Fallback: si en 6s no hubo redirect, mostrar error
    setTimeout(() => {
      setBusy(false)
      setSuccess('')
      setError('No se pudo cargar tu perfil. Verifica que tu cuenta tenga un rol asignado.')
    }, 6000)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Ingresa tu correo'); return }
    setBusy(true); setError(''); setSuccess('')
    const { error: err } = await supabaseAuth.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (err) setError(err.message)
    else setSuccess(`Enlace enviado a ${email}. Revisa tu bandeja de entrada.`)
    setBusy(false)
  }

  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid var(--color-border-secondary)',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)', fontFamily: 'inherit',
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-background-tertiary)', padding: '2rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--color-background-primary)',
        borderRadius: 16, border: '0.5px solid var(--color-border-tertiary)',
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.5px' }}>Oxidian</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Panel de administración
          </div>
        </div>

        {/* Toggle modo */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-background-secondary)',
          borderRadius: 8, padding: 4, marginBottom: '1.5rem' }}>
          {[['login', 'Contraseña'], ['magic', 'Enlace mágico']].map(([m, label]) => (
            <button key={m} type="button"
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: '.15s',
                background: mode === m ? 'var(--color-background-primary)' : 'transparent',
                color: mode === m ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleMagicLink}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Correo electrónico
            </label>
            <input type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"
              style={inp} />
          </div>

          {mode === 'login' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Contraseña
              </label>
              <input type="password" value={password} required autoComplete="current-password"
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                style={inp} />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: 'var(--color-text-danger)',
              background: 'var(--color-background-danger)', borderRadius: 8,
              padding: '8px 12px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ fontSize: 13, color: 'var(--color-text-success)',
              background: 'var(--color-background-success)', borderRadius: 8,
              padding: '8px 12px', marginBottom: '1rem' }}>
              ⏳ {success}
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
            fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>
            {busy
              ? (mode === 'login' ? 'Entrando…' : 'Enviando…')
              : (mode === 'login' ? 'Entrar' : 'Enviar enlace')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: 12,
          color: 'var(--color-text-secondary)' }}>
          ¿Sin cuenta?{' '}
          <span style={{ color: 'var(--color-text-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/')}>
            Solicitar acceso
          </span>
        </div>
      </div>
    </div>
  )
}
