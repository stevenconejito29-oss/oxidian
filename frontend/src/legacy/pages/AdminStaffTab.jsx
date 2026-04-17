// AdminStaffTab.jsx — CarmoCream
// Auto-asignación: en cada tick del poll (12 s) se llama a runAutoAssign()
// que asigna todos los pedidos sin staff al miembro online con menos carga.
// Al conectarse un cocinero/repartidor, PedidosContent/RepartidorContent
// también llaman a runAutoAssign({ role }) para asignación inmediata.

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { runAutoAssign } from '../lib/autoAssign'
import styles from './Admin.module.css'
import { EditFormIntro, MiniPreviewCard } from './AdminFormContext'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'

const STAFF_ICONS = {
  person: '\u{1F464}',
  cook: '\u{1F468}\u200D\u{1F373}',
  cookAlt: '\u{1F469}\u200D\u{1F373}',
  rider: '\u{1F6F5}',
  bike: '\u{1F6B4}',
  boy: '\u{1F466}',
  girl: '\u{1F467}',
  adult: '\u{1F9D1}',
  man: '\u{1F468}',
  woman: '\u{1F469}',
  star: '\u2B50',
  target: '\u{1F3AF}',
  alert: '\u26A0\uFE0F',
  chart: '\u{1F4CA}',
  group: '\u{1F465}',
  edit: '\u270F\uFE0F',
  lock: '\u{1F512}',
  unlock: '\u{1F513}',
  trash: '\u{1F5D1}\uFE0F',
  close: '\u2715',
  bolt: '\u26A1',
};
const ROLE_LABELS = { cocina: `${STAFF_ICONS.cook} Cocina`, repartidor: `${STAFF_ICONS.rider} Repartidor` }
const ROLE_COLORS = { cocina: '#1D4ED8', repartidor: '#059669' }
const EMOJIS = [STAFF_ICONS.person, STAFF_ICONS.cook, STAFF_ICONS.cookAlt, STAFF_ICONS.rider, STAFF_ICONS.bike, STAFF_ICONS.boy, STAFF_ICONS.girl, STAFF_ICONS.adult, STAFF_ICONS.man, STAFF_ICONS.woman, STAFF_ICONS.star, STAFF_ICONS.target]

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

function isOnline(user) {
  return user.active && user.is_online === true
}

function lastSeenLabel(user) {
  if (!user.last_login) return 'Sin acceso'
  const mins = Math.floor((Date.now() - new Date(user.last_login)) / 60000)
  if (mins < 2)  return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `Hace ${h}h`
  return new Date(user.last_login).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
}

export default function AdminStaffTab({ storeId = 'default' }) {
  const { isPhone, isCompact } = useResponsiveAdminLayout()
  const [staff,     setStaff]     = useState([])
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState({ name:'', username:'', password:'', role:'cocina', avatar_emoji:'👤', phone:'', active:true })
  const [saving,    setSaving]    = useState(false)
  const [viewMode,  setViewMode]  = useState('staff')   // 'staff' | 'workload'
  const [assigning, setAssigning] = useState(null)

  const load = useCallback(async () => {
    const [{ data: scopedStaff }, { data: ordersData }] = await Promise.all([
      supabase.from('staff_users').select('*').eq('store_id', storeId).order('role').order('name'),
      supabase.from('orders')
        .select('id, order_number, status, assigned_cook_id, assigned_cook_name, assigned_rider_id, assigned_rider_name, customer_name, total, created_at')
        .eq('store_id', storeId)
        .in('status', ['pending','preparing','ready','delivering'])
        .order('created_at', { ascending: true }),
    ])
    if (scopedStaff) setStaff(scopedStaff)
    if (ordersData) setOrders(ordersData)
    setLoading(false)

    // Auto-asignar en cada tick — silencioso
    runAutoAssign({ storeId }).catch(console.error)
  }, [storeId])

  useEffect(() => {
    load()
    const iv = setInterval(load, 12000)
    return () => clearInterval(iv)
  }, [load])

  // ── Carga ───────────────────────────────────────────────────
  function cookLoad(userId) {
    return orders.filter(o => o.assigned_cook_id === userId && ['pending','preparing','ready'].includes(o.status)).length
  }
  function riderLoad(userId) {
    return orders.filter(o => o.assigned_rider_id === userId && o.status === 'delivering').length
  }

  // ── Asignación manual ───────────────────────────────────────
  async function autoAssignOrder(order) {
    setAssigning(order.id)
    const updates = {}
    const onlineCooks  = staff.filter(s => s.role === 'cocina'      && isOnline(s))
    const onlineRiders = staff.filter(s => s.role === 'repartidor'  && isOnline(s))
    const allCooks     = staff.filter(s => s.role === 'cocina'      && s.active)
    const allRiders    = staff.filter(s => s.role === 'repartidor'  && s.active)

    if (!order.assigned_cook_id) {
      const pool = onlineCooks.length ? onlineCooks : allCooks
      if (pool.length) {
        const best = pool.reduce((m, u) => cookLoad(u.id) < cookLoad(m.id) ? u : m, pool[0])
        updates.assigned_cook_id = best.id; updates.assigned_cook_name = best.name
      }
    }
    if (!order.assigned_rider_id && ['ready','delivering'].includes(order.status)) {
      const pool = onlineRiders.length ? onlineRiders : allRiders
      if (pool.length) {
        const best = pool.reduce((m, u) => riderLoad(u.id) < riderLoad(m.id) ? u : m, pool[0])
        updates.assigned_rider_id = best.id; updates.assigned_rider_name = best.name
      }
    }
    if (!Object.keys(updates).length) {
      toast.error('No hay staff disponible'); setAssigning(null); return
    }
    await supabase.from('orders').update(updates).eq('id', order.id).eq('store_id', storeId)
    const parts = [updates.assigned_cook_name, updates.assigned_rider_name].filter(Boolean)
    toast.success(`Asignado → ${parts.join(' · ')}`)
    setAssigning(null)
    load()
  }

  async function manualAssign(orderId, userId, userName, role) {
    const fid   = role === 'cocina' ? 'assigned_cook_id'   : 'assigned_rider_id'
    const fname = role === 'cocina' ? 'assigned_cook_name' : 'assigned_rider_name'
    const { error } = await supabase.from('orders').update({ [fid]: userId, [fname]: userName }).eq('id', orderId).eq('store_id', storeId)
    if (error) { toast.error(error.message); return }
    toast.success(`${userName} asignado`); load()
  }

  async function unassign(orderId, role) {
    const fid   = role === 'cocina' ? 'assigned_cook_id'   : 'assigned_rider_id'
    const fname = role === 'cocina' ? 'assigned_cook_name' : 'assigned_rider_name'
    await supabase.from('orders').update({ [fid]: null, [fname]: null }).eq('id', orderId).eq('store_id', storeId)
    toast.success('Asignación eliminada'); load()
  }

  // ── CRUD staff ──────────────────────────────────────────────
  function openNew() {
    setForm({ name:'', username:'', password:'', role:'cocina', avatar_emoji:'👤', phone:'', active:true })
    setModal({ mode:'new' })
  }
  function openEdit(u) {
    setForm({ name:u.name, username:u.username, password:'', role:u.role, avatar_emoji:u.avatar_emoji||'👤', phone:u.phone||'', active:u.active })
    setModal({ mode:'edit', user:u })
  }
  async function save() {
    if (!form.name.trim())     { toast.error('Nombre requerido'); return }
    if (!form.username.trim()) { toast.error('Usuario requerido'); return }
    if (modal.mode === 'new' && !form.password.trim()) { toast.error('Contraseña requerida'); return }
    setSaving(true)
    const normalizedUsername = form.username.trim().toLowerCase()
    const duplicate = staff.find(u => u.username === normalizedUsername && (!modal.user || u.id !== modal.user.id))
    if (duplicate) {
      toast.error('Ese usuario ya existe')
      setSaving(false)
      return
    }
    const payload = {
      name: form.name.trim(), username: normalizedUsername,
      role: form.role, avatar_emoji: form.avatar_emoji,
      phone: form.phone.trim() || null, active: form.active,
    }
    if (form.password.trim()) payload.password_hash = await sha256(form.password.trim())
    if (modal.mode === 'new') {
      const { error } = await supabase.from('staff_users').insert({ ...payload, store_id: storeId })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Usuario creado ✓')
    } else {
      const { error } = await supabase.from('staff_users').update(payload).eq('id', modal.user.id).eq('store_id', storeId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Actualizado ✓')
    }
    setSaving(false); setModal(null); load()
  }
  async function toggleActive(u) {
    await supabase.from('staff_users').update({ active: !u.active }).eq('id', u.id).eq('store_id', storeId)
    toast.success(u.active ? 'Desactivado' : 'Activado'); load()
  }
  async function deleteUser(u) {
    if (!window.confirm(`¿Eliminar a ${u.name}?`)) return
    await supabase.from('staff_users').delete().eq('id', u.id).eq('store_id', storeId)
    toast.success('Eliminado'); load()
  }

  const cooks      = staff.filter(s => s.role === 'cocina')
  const deliverers = staff.filter(s => s.role === 'repartidor')
  const nOnlineCooks  = cooks.filter(isOnline).length
  const nOnlineRiders = deliverers.filter(isOnline).length

  const unassignedCook  = orders.filter(o => !o.assigned_cook_id  && ['pending','preparing'].includes(o.status))
  const unassignedRider = orders.filter(o => !o.assigned_rider_id && o.status === 'ready')

  return (
    <div style={{ padding:'20px 0' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h2 className={styles.sectionTitle}>{STAFF_ICONS.group} Gestion de Staff</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setViewMode(v => v==='staff'?'workload':'staff')} style={{
            padding:'8px 14px', border:'2px solid #FFE8CC', borderRadius:10,
            background: viewMode==='workload' ? '#2D6A4F' : '#FFF8EE',
            color: viewMode==='workload' ? 'white' : '#4A7A5A',
            fontSize:'.8rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer',
          }}>
            {viewMode==='workload' ? `${STAFF_ICONS.group} Ver staff` : `${STAFF_ICONS.chart} Ver carga`}
          </button>
          <button className={styles.refreshBtn} onClick={load}>Actualizar</button>
          <button className={styles.addBtn} onClick={openNew}>+ Nuevo</button>
        </div>
      </div>

      {/* Banner auto-asignación */}
      <div style={{
        background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:12,
        padding:'10px 16px', marginBottom:14,
        fontSize:'.76rem', fontWeight:700, color:'#166534',
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
      }}>
        <span>{STAFF_ICONS.bolt} Auto-asignacion activa (cada 12 s)</span>
        <span style={{ color:'#9CA3AF' }}>|</span>
        {nOnlineCooks === 0 && nOnlineRiders === 0
          ? <span style={{ color:'#C05621' }}>{STAFF_ICONS.alert} Ningun staff online - pedidos en cola</span>
          : <>
              {nOnlineCooks > 0  && <span>{STAFF_ICONS.cook} {nOnlineCooks} cocinero{nOnlineCooks>1?'s':''} online</span>}
              {nOnlineCooks > 0 && nOnlineRiders > 0 && <span style={{ color:'#9CA3AF' }}>|</span>}
              {nOnlineRiders > 0 && <span>{STAFF_ICONS.rider} {nOnlineRiders} repartidor{nOnlineRiders>1?'es':''} online</span>}
            </>

        }
      </div>

      {/* Alerta pedidos en cola */}
      {(unassignedCook.length > 0 || unassignedRider.length > 0) && (
        <div style={{
          background:'#FFF4ED', border:'2px solid #FED7AA', borderRadius:14,
          padding:'14px 18px', marginBottom:16,
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
        }}>
          <span style={{ fontSize:'1.3rem' }}>{STAFF_ICONS.alert}</span>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:900, fontSize:'.88rem', color:'#C05621', marginBottom:4 }}>
              Pedidos esperando staff online
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {unassignedCook.length  > 0 && <span style={{ fontSize:'.76rem', fontWeight:700, color:'#1D4ED8' }}>{STAFF_ICONS.cook} {unassignedCook.length} sin cocinero</span>}
              {unassignedRider.length > 0 && <span style={{ fontSize:'.76rem', fontWeight:700, color:'#059669' }}>{STAFF_ICONS.rider} {unassignedRider.length} sin repartidor</span>}
            </div>
          </div>
          <button onClick={async () => {
            const n = await runAutoAssign({ storeId })
            if (n > 0) { toast.success(`${n} pedidos asignados ✓`); load() }
            else toast.error('Sin staff online disponible')
          }} style={{
            padding:'9px 16px', background:'linear-gradient(135deg,#2D6A4F,#40916C)',
            color:'white', border:'none', borderRadius:10,
            fontSize:'.8rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap',
          }}>
            {STAFF_ICONS.bolt} Asignar ahora
          </button>
        </div>
      )}

      {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> :
        viewMode === 'staff' ? (
          <>
            {/* KPIs online */}
            <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : '1fr 1fr', gap:10, marginBottom:20 }}>
              <KpiCard color='#1D4ED8' bg='#EFF6FF' border='#BFDBFE' icon={STAFF_ICONS.cook} label='Cocina'
                online={nOnlineCooks} total={cooks.length}
                names={cooks.filter(isOnline).map(u => u.name.split(' ')[0]).join(', ')||'Ninguno online'} />
              <KpiCard color='#059669' bg='#F0FDF4' border='#86EFAC' icon={STAFF_ICONS.rider} label='Repartidores'
                online={nOnlineRiders} total={deliverers.length}
                names={deliverers.filter(isOnline).map(u => u.name.split(' ')[0]).join(', ')||'Ninguno online'} />
            </div>

            <StaffSection title={`${STAFF_ICONS.cook} Cocina`} color={ROLE_COLORS.cocina} users={cooks}
              getLoad={cookLoad} isOnline={isOnline} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteUser} isPhone={isPhone} />
            <div style={{ marginTop:20 }}>
              <StaffSection title={`${STAFF_ICONS.rider} Repartidores`} color={ROLE_COLORS.repartidor} users={deliverers}
                getLoad={riderLoad} isOnline={isOnline} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteUser} isPhone={isPhone} />
            </div>
          </>
        ) : (
          <WorkloadView
            cooks={cooks} deliverers={deliverers} orders={orders}
            cookLoad={cookLoad} riderLoad={riderLoad} isOnline={isOnline}
            onAutoAssign={autoAssignOrder} onManualAssign={manualAssign}
            onUnassign={unassign} assigning={assigning} staff={staff} isPhone={isPhone} isCompact={isCompact}
          />
        )
      }

      {/* Modal CRUD */}
      {modal && (
        <div className={styles.modalOverlay} onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{modal.mode==='new' ? 'Nuevo usuario' : `Editar ${modal.user?.name}`}</h3>
              <button className={styles.modalClose} onClick={() => setModal(null)}>{STAFF_ICONS.close}</button>
            </div>
            <div className={`${styles.modalBody} ${styles.adminFormShell}`}>
              <EditFormIntro
                eyebrow="Usuario de operación"
                title={form.role === 'cocina' ? 'Perfil orientado a preparación y checks de pedido' : 'Perfil orientado a reparto, contacto y entrega'}
                description={form.role === 'cocina'
                  ? 'Este usuario entra en autoasignación de cocina cuando está online. Lo importante aquí es identidad clara, acceso rápido y disponibilidad real.'
                  : 'Este usuario entra en autoasignación de reparto cuando está online. Necesita acceso simple, teléfono útil y presencia clara en pedidos.'}
                tone={form.role === 'cocina' ? 'blue' : 'green'}
                chips={[
                  modal.mode === 'new' ? 'Alta nueva' : 'Edición existente',
                  form.active ? 'Activo' : 'Inactivo',
                  form.role === 'cocina' ? 'Autoasignación cocina' : 'Autoasignación reparto',
                ]}
                aside={<MiniPreviewCard emoji={form.avatar_emoji || '👤'} title={form.name || 'Usuario sin nombre'} lines={[form.username ? `@${form.username}` : 'Usuario pendiente', form.phone || 'Sin teléfono']} />}
              />
              <FormField label="Avatar">
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f=>({...f,avatar_emoji:e}))} style={{
                      fontSize:'1.4rem', padding:'4px 6px', borderRadius:8, cursor:'pointer',
                      background: form.avatar_emoji===e ? '#2D6A4F22' : 'transparent',
                      border: form.avatar_emoji===e ? '2px solid #2D6A4F' : '2px solid transparent',
                    }}>{e}</button>
                  ))}
                </div>
              </FormField>
              <FormField label="Rol *">
                <div style={{ display:'flex', gap:8 }}>
                  {['cocina','repartidor'].map(r => (
                    <button key={r} onClick={() => setForm(f=>({...f,role:r}))} style={{
                      padding:'8px 16px', borderRadius:10, border:'2px solid',
                      borderColor: form.role===r ? ROLE_COLORS[r] : '#E5E7EB',
                      background:  form.role===r ? ROLE_COLORS[r]+'22' : 'transparent',
                      color:       form.role===r ? ROLE_COLORS[r] : '#6B7280',
                      fontWeight:800, fontSize:'.82rem', fontFamily:'inherit', cursor:'pointer',
                    }}>{ROLE_LABELS[r]}</button>
                  ))}
                </div>
              </FormField>
              <FormField label="Nombre *">
                <input className={styles.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ej: María García"/>
              </FormField>
              <FormField label="Usuario *">
                <input className={styles.input} value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value.toLowerCase()}))} placeholder="ej: maria" autoCapitalize="none"/>
              </FormField>
              <FormField label={modal.mode==='new' ? 'Contraseña *' : 'Contraseña (vacía = no cambiar)'}>
                <input className={styles.input} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="••••••••"/>
              </FormField>
              <FormField label="Teléfono (opcional)">
                <input className={styles.input} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="612345678"/>
              </FormField>
              <FormField label="Estado">
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:700, fontSize:'.84rem' }}>
                  <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/>
                  {form.active ? 'Activo' : 'Inactivo'}
                </label>
              </FormField>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button onClick={() => setModal(null)} style={{ flex:1, padding:'11px', borderRadius:10, border:'2px solid #E5E7EB', background:'white', fontWeight:800, fontFamily:'inherit', cursor:'pointer', fontSize:'.84rem' }}>Cancelar</button>
                <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2D6A4F,#40916C)', color:'white', fontWeight:900, fontFamily:'inherit', cursor:'pointer', fontSize:'.88rem' }}>
                  {saving ? 'Guardando…' : modal.mode==='new' ? 'Crear usuario' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────

function KpiCard({ color, bg, border, icon, label, online, total, names }) {
  return (
    <div style={{ background: bg, border:`1.5px solid ${border}`, borderRadius:14, padding:'14px 16px' }}>
      <p style={{ fontSize:'.68rem', fontWeight:900, color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>{icon} {label}</p>
      <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
        <span style={{ fontFamily:'Pacifico,cursive', fontSize:'1.8rem', color }}>{online}</span>
        <span style={{ fontSize:'.72rem', color:'#6B7280', fontWeight:700 }}>/ {total} online</span>
      </div>
      <div style={{ fontSize:'.7rem', color, fontWeight:700, marginTop:4, opacity:.8 }}>{names}</div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div className={styles.formGroup} style={{ marginBottom:0 }}>
      <label className={styles.formLabel} style={{ marginBottom:0 }}>{label}</label>
      {children}
    </div>
  )
}

function StaffSection({ title, color, users, getLoad, isOnline, onEdit, onToggle, onDelete, isPhone }) {
  const online = users.filter(isOnline).length
  return (
    <div>
      <h3 style={{ fontFamily:'Pacifico,cursive', fontSize:'.95rem', color, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
        {title}
        <span style={{ background:'#F3F4F6', color:'#6B7280', fontSize:'.65rem', fontWeight:900, padding:'2px 8px', borderRadius:20 }}>{users.length}</span>
        {online > 0 && <span style={{ background:'#DCFCE7', color:'#16A34A', fontSize:'.65rem', fontWeight:900, padding:'2px 8px', borderRadius:20 }}>{online} online</span>}
      </h3>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {users.map(u => (
          <StaffCard key={u.id} user={u} load={getLoad(u.id)} online={isOnline(u)}
            onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} lastSeen={lastSeenLabel(u)} isPhone={isPhone} />
        ))}
        {users.length === 0 && <p style={{ color:'#9CA3AF', fontSize:'.8rem', fontWeight:600 }}>Sin miembros — añade uno con el botón +</p>}
      </div>
    </div>
  )
}

function StaffCard({ user, load, online, lastSeen, onEdit, onToggle, onDelete, isPhone }) {
  const dotColor = !user.active ? '#9CA3AF' : online ? '#16A34A' : '#F59E0B'
  return (
    <div style={{
      background: !user.active ? '#F9FAFB' : 'white',
      border:`1.5px solid ${!user.active ? '#E5E7EB' : online ? '#86EFAC' : '#FFE8CC'}`,
      borderRadius:14, padding:'12px 16px',
      display:'flex', flexDirection:isPhone ? 'column' : 'row', alignItems:isPhone ? 'stretch' : 'center', gap:12, position:'relative',
      opacity: !user.active ? 0.6 : 1,
    }}>
      <div style={{ position:'absolute', top:10, right:10, width:9, height:9, borderRadius:'50%',
        background: dotColor, boxShadow: online ? `0 0 0 3px ${dotColor}33` : 'none' }} />
      <span style={{ fontSize:'1.8rem', flexShrink:0 }}>{user.avatar_emoji || STAFF_ICONS.person}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:900, fontSize:'.9rem', color:'#1C3829' }}>{user.name}</div>
        <div style={{ fontSize:'.72rem', color:'#6B7280', fontWeight:600 }}>@{user.username}{user.phone ? ` - ${user.phone}` : ''}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
          <span style={{
            fontSize:'.6rem', fontWeight:900, padding:'1px 7px', borderRadius:10,
            background: !user.active ? '#F3F4F6' : online ? '#DCFCE7' : '#FEF3C7',
            color:      !user.active ? '#9CA3AF' : online ? '#16A34A' : '#D97706',
          }}>{!user.active ? 'Inactivo' : online ? 'Online' : 'Offline'}</span>
          <span style={{ fontSize:'.62rem', color:'#9CA3AF', fontWeight:600 }}>{lastSeen}</span>
        </div>
        {user.active && (
          <div style={{ marginTop:6 }}>
            <div style={{ height:4, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:3,
                width:`${Math.min((load/5)*100,100)}%`,
                background: load===0 ? '#86EFAC' : load<3 ? '#FCD34D' : '#F87171',
                transition:'width .3s',
              }}/>
            </div>
            <span style={{ fontSize:'.6rem', color:'#9CA3AF', fontWeight:700 }}>{load} pedido{load!==1?'s':''} activos</span>
          </div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:isPhone ? 'row' : 'column', gap:5, alignSelf:isPhone ? 'flex-start' : 'stretch' }}>
        <button onClick={() => onEdit(user)} style={btnStyle('#EFF6FF','#1D4ED8')}>{STAFF_ICONS.edit}</button>
        <button onClick={() => onToggle(user)} style={btnStyle('#FEF3C7','#D97706')}>{user.active ? STAFF_ICONS.lock : STAFF_ICONS.unlock}</button>
        <button onClick={() => onDelete(user)} style={btnStyle('#FEE2E2','#DC2626')}>{STAFF_ICONS.trash}</button>
      </div>
    </div>
  )
}

function btnStyle(bg, color) {
  return { background: bg, border:'none', borderRadius:8, padding:'6px 8px', cursor:'pointer', fontSize:'.8rem', color }
}

function WorkloadView({ cooks, deliverers, orders, cookLoad, riderLoad, isOnline, onAutoAssign, onManualAssign, onUnassign, assigning, isPhone, isCompact }) {
  const [expandAssign, setExpandAssign] = useState(null)

  const STATUS_COLOR = { pending:'#C05621', preparing:'#1D4ED8', ready:'#7C3AED', delivering:'#059669' }
  const STATUS_LABEL = { pending:'Nuevo', preparing:'Preparando', ready:'Listo', delivering:'En camino' }

  return (
    <div>
      {/* Barras de carga */}
      {[
        { title:`${STAFF_ICONS.cook} Carga Cocina`, users:cooks, getLoad:cookLoad, color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
        { title:`${STAFF_ICONS.rider} Carga Repartidores`, users:deliverers, getLoad:riderLoad, color:'#059669', bg:'#F0FDF4', border:'#86EFAC' },
      ].map(({ title, users, getLoad, color, bg, border }) => (
        <div key={title} style={{ marginBottom:20 }}>
          <h3 style={{ fontFamily:'Pacifico,cursive', fontSize:'.9rem', color, marginBottom:10 }}>{title}</h3>
          {users.filter(u=>u.active).length === 0
            ? <p style={{ color:'#9CA3AF', fontSize:'.8rem' }}>Sin personal activo</p>
            : users.filter(u=>u.active)
                .map(u => ({ ...u, load:getLoad(u.id), online:isOnline(u) }))
                .sort((a,b) => a.load - b.load)
                .map(u => (
                  <div key={u.id} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'10px 14px', marginBottom:6, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:'1.2rem' }}>{u.avatar_emoji||'👤'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontWeight:800, fontSize:'.84rem', color:'#1C3829' }}>{u.name}</span>
                          {u.online
                            ? <span style={{ fontSize:'.58rem', fontWeight:900, color:'#16A34A', background:'#DCFCE7', padding:'1px 6px', borderRadius:10 }}>🟢</span>
                            : <span style={{ fontSize:'.58rem', fontWeight:900, color:'#9CA3AF', background:'#F3F4F6', padding:'1px 6px', borderRadius:10 }}>⚪ Offline</span>
                          }
                        </div>
                        <span style={{ fontSize:'.72rem', fontWeight:900, color: u.load===0?'#16A34A':u.load<3?'#D97706':'#DC2626' }}>
                          {u.load} pedido{u.load!==1?'s':''}
                        </span>
                      </div>
                      <div style={{ height:5, background:'#E5E7EB', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:3, transition:'width .4s',
                          width:`${Math.min((u.load/5)*100,100)}%`,
                          background: u.load===0?'#86EFAC':`linear-gradient(90deg,${color}88,${color})`,
                        }}/>
                      </div>
                    </div>
                  </div>
                ))
          }
        </div>
      ))}

      {/* Pedidos activos */}
      <h3 style={{ fontFamily:'Pacifico,cursive', fontSize:'.9rem', color:'#2D6A4F', marginBottom:12 }}>📋 Pedidos activos</h3>
      {orders.length === 0
        ? <p style={{ color:'#9CA3AF', fontSize:'.8rem' }}>Sin pedidos activos</p>
        : orders.map(order => (
          <div key={order.id} style={{
            background:'white', borderRadius:14, padding:'13px 16px', marginBottom:10,
            border:`1.5px solid #FFE8CC`, borderLeft:`4px solid ${STATUS_COLOR[order.status]||'#9CA3AF'}`,
            boxShadow:'0 2px 8px rgba(0,0,0,.06)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, gap:10, flexWrap:'wrap' }}>
              <div>
                <span style={{ fontWeight:900, fontSize:'.92rem', color:'#1C3829' }}>#{order.order_number}</span>
                <span style={{
                  marginLeft:8, fontSize:'.65rem', fontWeight:900, padding:'2px 8px', borderRadius:20,
                  background: (STATUS_COLOR[order.status]||'#9CA3AF')+'22',
                  color: STATUS_COLOR[order.status]||'#9CA3AF',
                }}>{STATUS_LABEL[order.status]||order.status}</span>
                <div style={{ fontSize:'.76rem', color:'#6B7280', marginTop:2 }}>
                  {order.customer_name} · €{Number(order.total||0).toFixed(2)}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button onClick={() => onAutoAssign(order)} disabled={assigning===order.id} style={{
                  padding:'5px 11px', background:'#2D6A4F', color:'white', border:'none',
                  borderRadius:8, fontSize:'.7rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer',
                  opacity: assigning===order.id ? .6 : 1,
                }}>{assigning===order.id ? '…' : '⚡ Auto'}</button>
                <button onClick={() => setExpandAssign(expandAssign===order.id ? null : order.id)} style={{
                  padding:'5px 11px', background: expandAssign===order.id ? '#FFE8CC' : '#FFF8EE',
                  color:'#4A7A5A', border:'1.5px solid #FFE8CC', borderRadius:8,
                  fontSize:'.7rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer',
                }}>{expandAssign===order.id ? '✕' : '✏️ Manual'}</button>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {order.assigned_cook_name
                ? <AssignTag label={order.assigned_cook_name} icon="👨‍🍳" color="#1D4ED8" onRemove={() => onUnassign(order.id,'cocina')}/>
                : <EmptyAssign icon="👨‍🍳" label="Sin cocinero"/>
              }
              {['ready','delivering'].includes(order.status) && (
                order.assigned_rider_name
                  ? <AssignTag label={order.assigned_rider_name} icon="🛵" color="#059669" onRemove={() => onUnassign(order.id,'repartidor')}/>
                  : <EmptyAssign icon="🛵" label="Sin repartidor"/>
              )}
            </div>

            {expandAssign === order.id && (
              <div style={{ marginTop:12, padding:'12px', background:'#FFF8EE', borderRadius:10, border:'1.5px solid #FFE8CC' }}>
                {[
                  { role:'cocina', label:'👨‍🍳 Cocinero', users:cooks, color:'#1D4ED8', currentId: order.assigned_cook_id },
                  { role:'repartidor', label:'🛵 Repartidor', users:deliverers, color:'#059669', currentId: order.assigned_rider_id },
                ].map(({ role, label, users, color, currentId }) => (
                  <div key={role} style={{ marginBottom:10 }}>
                    <p style={{ fontSize:'.72rem', fontWeight:800, color, marginBottom:5 }}>{label}</p>
                    <div style={{ display:'grid', gridTemplateColumns:isCompact ? '1fr' : 'repeat(auto-fit,minmax(160px,1fr))', gap:6 }}>
                      {users.filter(u=>u.active).map(u => (
                        <button key={u.id} onClick={() => { onManualAssign(order.id,u.id,u.name,role); setExpandAssign(null) }} style={{
                          padding:'5px 12px', borderRadius:8, border:'2px solid',
                          borderColor: currentId===u.id ? color : color+'44',
                          background:  currentId===u.id ? color : color+'11',
                          color:       currentId===u.id ? 'white' : color,
                          fontSize:'.72rem', fontWeight:800, fontFamily:'inherit', cursor:'pointer',
                        }}>
                          {u.avatar_emoji} {u.name.split(' ')[0]}
                          {isOnline(u) && <span style={{ marginLeft:4, fontSize:'.55rem' }}>🟢</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      }
    </div>
  )
}

function AssignTag({ label, icon, color, onRemove }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      background: color+'15', border:`1.5px solid ${color}44`,
      color, borderRadius:8, padding:'3px 8px',
      fontSize:'.7rem', fontWeight:800,
    }}>
      {icon} {label}
      <button onClick={onRemove} style={{ background:'none', border:'none', color: color+'99', cursor:'pointer', fontSize:'.65rem', padding:0, marginLeft:2, fontWeight:900 }}>✕</button>
    </span>
  )
}

function EmptyAssign({ icon, label }) {
  return (
    <span style={{
      fontSize:'.7rem', color:'#9CA3AF', fontWeight:700,
      padding:'3px 8px', background:'#F9FAFB',
      borderRadius:8, border:'1.5px dashed #E5E7EB',
    }}>{icon} {label}</span>
  )
}
