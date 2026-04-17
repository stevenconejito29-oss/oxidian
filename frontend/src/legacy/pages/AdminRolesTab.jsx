import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import styles from './Admin.module.css'
import { DEFAULT_STORE_ID, normalizeStoreId } from '../lib/currentStore'

const EMOJIS = ['👤', '👩‍💼', '👨‍💼', '🧑‍💼', '⭐', '🎯', '🔑', '👑']

const ALL_PERMS = [
  { key: 'orders', icon: '📋', label: 'Ver y gestionar pedidos' },
  { key: 'products', icon: '🍓', label: 'Editar productos y precios' },
  { key: 'toppings', icon: '🍫', label: 'Gestionar toppings' },
  { key: 'combos', icon: '🎁', label: 'Gestionar combos' },
  { key: 'stats', icon: '📊', label: 'Ver estadisticas' },
  { key: 'insights', icon: '🧠', label: 'Ver inteligencia de negocio' },
  { key: 'coupons', icon: '🎟️', label: 'Crear cupones y afiliados' },
  { key: 'staff', icon: '👥', label: 'Gestionar staff' },
  { key: 'wasettings', icon: '💬', label: 'Configurar WhatsApp y AI' },
  { key: 'settings', icon: '⚙️', label: 'Editar ajustes generales' },
  { key: 'finance', icon: '🚦', label: 'Ver semaforo financiero', sensitive: true },
  { key: 'caja', icon: '💵', label: 'Ver contabilidad y caja', sensitive: true },
]

function safeParsePerms(raw) {
  if (Array.isArray(raw)) return raw
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function sha256(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export default function AdminRolesTab({
  storeId = DEFAULT_STORE_ID,
  title = 'Admins y accesos',
  description = 'Gestiona administradores secundarios y sus permisos dentro de esta tienda.',
  infoMessage = 'El administrador principal de la tienda conserva el control total. Usa esta vista para delegar accesos sin abrir permisos de mas.',
}) {
  const activeStoreId = normalizeStoreId(storeId)
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    avatar: '👤',
    permissions: ['orders', 'products', 'stats'],
  })

  useEffect(() => {
    loadAdmins()
  }, [activeStoreId])

  async function loadAdmins() {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .eq('role', 'admin')
      .eq('store_id', activeStoreId)
      .order('created_at')

    if (error) {
      console.error('[AdminRoles] load error:', error)
      toast.error(`Error al cargar admins: ${error.message}`)
    } else {
      setAdmins(data || [])
    }
    setLoading(false)
  }

  function openCreate() {
    setForm({
      name: '',
      username: '',
      password: '',
      avatar: '👤',
      permissions: ['orders', 'products', 'stats'],
    })
    setModal('create')
  }

  function openEdit(admin) {
    setForm({
      name: admin.name || '',
      username: admin.username || '',
      password: '',
      avatar: admin.avatar_emoji || '👤',
      permissions: safeParsePerms(admin.permissions),
    })
    setModal({ edit: admin })
  }

  function togglePerm(key) {
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter(item => item !== key)
        : [...current.permissions, key],
    }))
  }

  async function save() {
    if (!form.name.trim() || !form.username.trim()) {
      toast.error('Nombre y usuario requeridos')
      return
    }

    const isCreate = modal === 'create'
    if (isCreate && !form.password.trim()) {
      toast.error('Contrasena requerida')
      return
    }
    if (form.password && form.password.length < 6) {
      toast.error('Contrasena minimo 6 caracteres')
      return
    }

    setSaving(true)

    if (isCreate) {
      const { data: existing } = await supabase
        .from('staff_users')
        .select('id')
        .eq('store_id', activeStoreId)
        .eq('username', form.username.trim().toLowerCase())
        .maybeSingle()

      if (existing) {
        toast.error('Ese usuario ya existe')
        setSaving(false)
        return
      }
    }

    const payload = {
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      role: 'admin',
      avatar_emoji: form.avatar,
      permissions: form.permissions,
      active: true,
      store_id: activeStoreId,
    }

    if (form.password) {
      payload.password_hash = await sha256(form.password)
    }

    let error
    if (isCreate) {
      ;({ error } = await supabase.from('staff_users').insert(payload))
    } else {
      ;({ error } = await supabase
        .from('staff_users')
        .update(payload)
        .eq('id', modal.edit.id)
        .eq('store_id', activeStoreId))
    }

    setSaving(false)

    if (error) {
      console.error('[AdminRoles] save error:', error)
      toast.error(`Error: ${error.message || 'Intentalo de nuevo'}`)
      return
    }

    toast.success(isCreate ? 'Admin creado' : 'Admin actualizado')
    setModal(null)
    loadAdmins()
  }

  async function toggleActive(admin) {
    const { error } = await supabase
      .from('staff_users')
      .update({ active: !admin.active })
      .eq('id', admin.id)
      .eq('store_id', activeStoreId)

    if (error) {
      toast.error(`No pude actualizar el estado: ${error.message}`)
      return
    }

    loadAdmins()
  }

  async function deleteAdmin(admin) {
    if (!window.confirm(`Eliminar admin "${admin.name}"? Esta accion no se puede deshacer.`)) return

    const { error } = await supabase
      .from('staff_users')
      .delete()
      .eq('id', admin.id)
      .eq('store_id', activeStoreId)

    if (error) {
      toast.error(`No pude eliminarlo: ${error.message}`)
      return
    }

    toast.success('Admin eliminado')
    loadAdmins()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: '#1C3829' }}>{title}</h2>
          <p style={{ margin: '3px 0 0', fontSize: '.78rem', color: '#6B7280' }}>{description}</p>
        </div>
        <button onClick={openCreate} className={styles.btnPrimary}>+ Nuevo admin</button>
      </div>

      <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: '.82rem', color: '#1D4ED8', fontWeight: 700 }}>
        {infoMessage}
      </div>

      {admins.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: '.9rem' }}>
          Sin admins secundarios en esta tienda.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {admins.map(admin => {
          const permissions = safeParsePerms(admin.permissions)
          return (
            <div key={admin.id} style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ fontSize: 36, flexShrink: 0 }}>{admin.avatar_emoji || '👤'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: '.95rem', color: '#1C3829' }}>{admin.name}</span>
                  <span style={{ fontSize: '.72rem', color: '#6B7280', fontWeight: 600 }}>@{admin.username}</span>
                  <span style={{
                    fontSize: '.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: admin.active ? '#D1FAE5' : '#FEE2E2',
                    color: admin.active ? '#166534' : '#991B1B',
                  }}>
                    {admin.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ALL_PERMS.filter(item => permissions.includes(item.key)).map(item => (
                    <span key={item.key} style={{ fontSize: '.68rem', background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                      {item.icon} {item.label}
                    </span>
                  ))}
                  {permissions.length === 0 && <span style={{ fontSize: '.75rem', color: '#9CA3AF' }}>Sin permisos asignados</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(admin)} style={{ padding: '6px 12px', border: '1.5px solid #E5E7EB', background: 'white', borderRadius: 9, cursor: 'pointer', fontSize: '.78rem', fontWeight: 700, fontFamily: 'inherit' }}>Editar</button>
                <button onClick={() => toggleActive(admin)} style={{ padding: '6px 12px', border: '1.5px solid #E5E7EB', background: 'white', borderRadius: 9, cursor: 'pointer', fontSize: '.78rem', fontWeight: 700, fontFamily: 'inherit' }}>
                  {admin.active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => deleteAdmin(admin)} style={{ padding: '6px 10px', border: '1.5px solid #FECACA', background: '#FFF5F5', borderRadius: 9, cursor: 'pointer', fontSize: '.78rem', color: '#DC2626', fontWeight: 700, fontFamily: 'inherit' }}>Eliminar</button>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={event => event.target === event.currentTarget && setModal(null)}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: 26, maxWidth: 520, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontWeight: 900, margin: 0 }}>{modal === 'create' ? 'Nuevo admin' : 'Editar admin'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9CA3AF' }}>×</button>
            </div>

            <div className={styles.adminFieldGrid} style={{ marginBottom: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', marginBottom: 5 }}>Nombre *</label>
                <input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Ej: Maria"
                  style={{ width: '100%', padding: '9px 12px', border: '2px solid #E5E7EB', borderRadius: 9, fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '.9rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', marginBottom: 5 }}>Usuario *</label>
                <input
                  value={form.username}
                  onChange={event => setForm(current => ({ ...current, username: event.target.value }))}
                  placeholder="Ej: maria"
                  style={{ width: '100%', padding: '9px 12px', border: '2px solid #E5E7EB', borderRadius: 9, fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '.9rem' }}
                  autoCapitalize="none"
                />
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', marginBottom: 5 }}>
                  {modal === 'create' ? 'Contrasena *' : 'Nueva contrasena'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                  placeholder={modal === 'create' ? 'Minimo 6 caracteres' : 'Dejar vacio para no cambiar'}
                  style={{ width: '100%', padding: '9px 12px', border: '2px solid #E5E7EB', borderRadius: 9, fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '.9rem' }}
                />
              </div>
            </div>

            <div className={styles.adminModalSection} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', marginBottom: 8 }}>Avatar</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setForm(current => ({ ...current, avatar: emoji }))}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 9,
                      border: `2px solid ${form.avatar === emoji ? '#1C3829' : '#E5E7EB'}`,
                      background: form.avatar === emoji ? '#D8F3DC' : '#F9FAFB',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.adminModalSection} style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', marginBottom: 8 }}>Permisos</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {ALL_PERMS.map(permission => (
                  <label
                    key={permission.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      background: form.permissions.includes(permission.key)
                        ? (permission.sensitive ? '#FEF3C7' : '#F0FDF4')
                        : '#F9FAFB',
                      border: `1.5px solid ${form.permissions.includes(permission.key)
                        ? (permission.sensitive ? '#FDE68A' : '#86EFAC')
                        : '#E5E7EB'}`,
                      fontSize: '.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission.key)}
                      onChange={() => togglePerm(permission.key)}
                      style={{ accentColor: '#1C3829', width: 15, height: 15 }}
                    />
                    <span>{permission.icon} {permission.label}</span>
                    {permission.sensitive && <span style={{ fontSize: '.65rem', color: '#92400E', marginLeft: 'auto' }}>sensible</span>}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', border: '2px solid #E5E7EB', background: 'white', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', background: '#1C3829', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 }}>
                {saving ? 'Guardando...' : modal === 'create' ? 'Crear admin' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
