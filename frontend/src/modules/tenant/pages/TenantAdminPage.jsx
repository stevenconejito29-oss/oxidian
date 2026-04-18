import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAuth } from '../../../shared/supabase/client'
import { useAuth } from '../../../core/providers/AuthProvider'

// ─── Estilos inline reutilizables ───────────────────────────────
const S = {
  shell: { maxWidth: 900, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' },
  hero: { marginBottom: 28 },
  eyebrow: { fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' },
  title: { fontSize: 24, fontWeight: 500, margin: '0 0 8px', color: 'var(--color-text-primary)' },
  desc: { fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 },
  signals: { display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' },
  signal: { fontSize: 12, color: 'var(--color-text-secondary)' },
  signalVal: { fontWeight: 500, color: 'var(--color-text-primary)', marginLeft: 4 },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24,
    borderBottom: '0.5px solid var(--color-border-tertiary)', paddingBottom: 8 },
  tab: (active) => ({
    padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
    border: active ? 'none' : '1px solid var(--color-border-secondary)',
    background: active ? 'var(--color-text-primary)' : 'transparent',
    color: active ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
    fontFamily: 'inherit', transition: '.15s',
  }),
  card: { padding: '16px', borderRadius: 10, border: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-primary)', marginBottom: 10 },
  cardDark: { padding: '16px', borderRadius: 10, background: 'var(--color-background-secondary)', marginBottom: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 },
  inp: { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  btnPrimary: { padding: '9px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
    fontFamily: 'inherit', fontWeight: 500 },
  btnGhost: { padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
    border: '1px solid var(--color-border-secondary)', background: 'transparent',
    color: 'var(--color-text-secondary)', fontFamily: 'inherit' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  badge: (color) => ({ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
    background: color + '20', color: color }),
  notice: (tone) => ({
    padding: '10px 14px', borderRadius: 8, fontSize: 13,
    background: tone === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
    color: tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)',
    marginBottom: 12,
  }),
}

const NICHOS = [
  { id: 'barbershop', label: 'Barberia / Estetica', icon: '✂' },
  { id: 'fastfood',   label: 'Comida Rapida',       icon: '🍔' },
  { id: 'restaurant', label: 'Restaurante',          icon: '🍽' },
  { id: 'minimarket', label: 'Tienda de Barrio',     icon: '🛒' },
  { id: 'clothing',   label: 'Ropa / Moda',          icon: '👗' },
  { id: 'universal',  label: 'Otro negocio',         icon: '⚙' },
]

const PALETTES = [
  { primary: '#C0392B', surface: '#FEF9F0', label: 'Caramelo' },
  { primary: '#2D6A4F', surface: '#F0FFF4', label: 'Bosque' },
  { primary: '#1a1a2e', surface: '#F5F5FF', label: 'Noche' },
  { primary: '#E76F51', surface: '#FFF8F5', label: 'Coral' },
  { primary: '#6C3483', surface: '#F9F0FF', label: 'Violeta' },
  { primary: '#0077B6', surface: '#EFF8FF', label: 'Oceano' },
]

// ─── Tab: Resumen ────────────────────────────────────────────────
function TabResumen({ stores, branches, subInfo, navigate }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Plan activo',  value: subInfo?.plan_id ?? 'growth' },
          { label: 'Tiendas',      value: String(stores.length) },
          { label: 'Sedes totales',value: String(branches.length) },
        ].map(m => (
          <div key={m.label} style={S.cardDark}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{m.value}</div>
          </div>
        ))}
      </div>
      {stores.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Aun no tienes tiendas</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Crea tu primera tienda y configura todos los modulos que necesitas.
          </div>
          <button style={S.btnPrimary} onClick={() => navigate('/onboarding')}>
            Crear primera tienda
          </button>
        </div>
      ) : stores.map(s => {
        const storeBranches = branches.filter(b => b.store_id === s.id)
        return (
          <div key={s.id} style={S.card}>
            <div style={S.row}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {s.niche ?? s.business_type} &middot; {s.city ?? 'Sin ciudad'} &middot; {s.status}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {storeBranches.length} sede{storeBranches.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={S.btnGhost} onClick={() => window.open(`/s/${s.slug ?? s.id}/menu`)}>
                  Ver menu
                </button>
                <button style={S.btnPrimary} onClick={() => navigate('/branch/admin')}>
                  Administrar
                </button>
              </div>
            </div>
          </div>
        )
      })}
      <button style={{ ...S.btnGhost, marginTop: 6 }} onClick={() => navigate('/onboarding')}>
        + Crear otra tienda
      </button>
    </div>
  )
}

// ─── Tab: Crear tienda ───────────────────────────────────────────
function TabCrearTienda({ tenantId, onCreated }) {
  const [step, setStep] = React.useState(1)
  const [nicho, setNicho] = React.useState('')
  const [form, setForm] = React.useState({ name: '', slug: '', city: '' })
  const [palette, setPalette] = React.useState(PALETTES[0])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const patch = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function create() {
    setSaving(true); setError('')
    try {
      const { data: store, error: se } = await supabaseAuth
        .from('stores')
        .insert({
          id: form.slug, slug: form.slug, name: form.name,
          tenant_id: tenantId, niche: nicho,
          business_type: nicho === 'universal' ? 'other' : 'food',
          city: form.city, status: 'active', public_visible: true,
          theme_tokens: { primary: palette.primary, surface: palette.surface },
        })
        .select().single()
      if (se) throw se

      await supabaseAuth.rpc('apply_niche_preset', {
        p_store_id: store.id, p_tenant_id: tenantId, p_niche_id: nicho
      })

      setStep(1); setNicho(''); setForm({ name: '', slug: '', city: '' })
      onCreated(store)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 540 }}>
      {error && <div style={S.notice('error')}>{error}</div>}

      {/* Paso 1: Nicho */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
          1. Tipo de negocio {nicho && <span style={S.badge('#16a34a')}>seleccionado</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {NICHOS.map(n => (
            <button key={n.id} type="button" onClick={() => setNicho(n.id)}
              style={{ padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                fontFamily: 'inherit',
                border: nicho === n.id ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                background: nicho === n.id ? 'var(--color-background-secondary)' : 'var(--color-background-primary)' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{n.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)' }}>{n.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Paso 2: Info */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>2. Datos de la tienda</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[['Nombre de la tienda', 'name', 'Panaderia La Masa', true],
            ['URL / slug', 'slug', 'panaderia-la-masa', true],
            ['Ciudad', 'city', 'Medellin', false],
          ].map(([label, key, ph, req]) => (
            <div key={key}>
              <label style={S.label}>{label}{req ? ' *' : ''}</label>
              <input style={S.inp} required={req} placeholder={ph} value={form[key]}
                onChange={e => {
                  const v = key === 'slug'
                    ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                    : e.target.value
                  if (key === 'name' && !form.slug) {
                    patch('slug', v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
                  }
                  patch(key, v)
                }} />
              {key === 'slug' && form.slug && (
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                  Menu publico: /s/{form.slug}/menu
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Paso 3: Colores */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>3. Paleta de colores</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PALETTES.map(p => (
            <button key={p.label} type="button" onClick={() => setPalette(p)}
              style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12,
                border: palette.label === p.label ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.primary }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button style={S.btnPrimary} disabled={!nicho || !form.name || !form.slug || saving}
        onClick={create}>
        {saving ? 'Creando tienda...' : 'Crear tienda'}
      </button>
    </div>
  )
}

// ─── Tab: Sedes y Staff ──────────────────────────────────────────
function TabSedes({ tenantId, stores, branches, onRefresh }) {
  const [selectedStore, setSelectedStore] = React.useState(stores[0]?.id ?? null)
  const [branchForm, setBranchForm] = React.useState({ name: 'Sede Principal', address: '', city: '', phone: '' })
  const [staffForm, setStaffForm] = React.useState({ name: '', role: 'cashier', pin: '' })
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [copied, setCopied] = React.useState(null)

  const storeBranches = branches.filter(b => b.store_id === selectedStore)
  const currentStore = stores.find(s => s.id === selectedStore)

  async function createBranch(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { data: store } = await supabaseAuth.from('stores')
        .select('tenant_id').eq('id', selectedStore).single()
      const slugBase = branchForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await supabaseAuth.from('branches').insert({
        tenant_id: store.tenant_id, store_id: selectedStore,
        slug: slugBase + '-' + Date.now().toString(36),
        name: branchForm.name, address: branchForm.address,
        city: branchForm.city, phone: branchForm.phone,
        status: 'active', is_primary: storeBranches.length === 0, public_visible: true,
      })
      setBranchForm({ name: 'Sede Principal', address: '', city: '', phone: '' })
      onRefresh()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function createStaff(branchId, storeSlug, branchSlug) {
    if (!staffForm.name || !staffForm.pin) { setError('Nombre y PIN son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const { data: store } = await supabaseAuth.from('stores')
        .select('tenant_id').eq('id', selectedStore).single()
      await supabaseAuth.from('staff_users').insert({
        store_id: selectedStore, tenant_id: store.tenant_id, branch_id: branchId,
        name: staffForm.name, role: staffForm.role, pin: staffForm.pin, is_active: true,
      })
      setStaffForm({ name: '', role: 'cashier', pin: '' })
      onRefresh()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function copy(id, text) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (stores.length === 0) return (
    <div style={{ ...S.card, textAlign: 'center', padding: '2rem' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Primero crea una tienda para poder agregar sedes.
      </div>
    </div>
  )

  return (
    <div>
      {error && <div style={S.notice('error')}>{error}</div>}
      {/* Selector de tienda */}
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Tienda</label>
        <select style={S.inp} value={selectedStore ?? ''}
          onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Sedes de la tienda seleccionada */}
      {storeBranches.map(b => {
        const storeSlug = currentStore?.slug ?? currentStore?.id ?? selectedStore
        const loginUrl = `${window.location.origin}/s/${storeSlug}/${b.slug}/login`
        return (
          <div key={b.id} style={S.card}>
            <div style={S.row}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {b.city ?? '—'} · {b.address ?? 'Sin direccion'} · {b.status}
                </div>
              </div>
              <button style={S.btnGhost} onClick={() => copy(b.id, loginUrl)}>
                {copied === b.id ? '✓ Copiado' : 'Link staff'}
              </button>
            </div>
            <div style={{ marginTop: 8, padding: '6px 10px',
              background: 'var(--color-background-secondary)', borderRadius: 6 }}>
              <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{loginUrl}</code>
            </div>
            {/* Staff de esta sede */}
            <StaffDeSede branchId={b.id} storeId={selectedStore}
              storeSlug={storeSlug} branchSlug={b.slug} />
          </div>
        )
      })}

      {/* Crear sede */}
      <div style={{ ...S.cardDark, marginTop: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>
          + Crear nueva sede en {currentStore?.name}
        </div>
        <form onSubmit={createBranch}>
          <div style={S.grid2}>
            {[['Nombre de la sede', 'name', true], ['Ciudad', 'city', false],
              ['Direccion', 'address', false], ['Telefono', 'phone', false]].map(([label, key, req]) => (
              <div key={key}>
                <label style={S.label}>{label}{req ? ' *' : ''}</label>
                <input style={S.inp} required={req} value={branchForm[key]}
                  onChange={e => setBranchForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button style={{ ...S.btnPrimary, marginTop: 12 }} type="submit" disabled={saving}>
            {saving ? 'Creando...' : 'Crear sede'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StaffDeSede({ branchId, storeId, storeSlug, branchSlug }) {
  const [staff, setStaff] = React.useState([])
  const [form, setForm] = React.useState({ name: '', role: 'cashier', pin: '' })
  const [saving, setSaving] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    supabaseAuth.from('staff_users').select('id,name,role,pin,is_active')
      .eq('branch_id', branchId).order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [branchId])

  async function addStaff(e) {
    e.preventDefault(); setSaving(true)
    try {
      const { data: store } = await supabaseAuth.from('stores')
        .select('tenant_id').eq('id', storeId).single()
      await supabaseAuth.from('staff_users').insert({
        store_id: storeId, tenant_id: store.tenant_id, branch_id: branchId,
        name: form.name, role: form.role, pin: form.pin, is_active: true,
      })
      setStaff(p => [...p, { ...form, id: Date.now(), is_active: true }])
      setForm({ name: '', role: 'cashier', pin: '' })
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const loginUrl = `${window.location.origin}/s/${storeSlug}/${branchSlug}/login`
  const ROLES = ['cashier', 'kitchen', 'rider', 'branch_manager']
  const ROLE_ICONS = { kitchen: '🍳', rider: '🛵', cashier: '💳', branch_manager: '⚙' }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          Staff de esta sede ({staff.length})
        </div>
        <button style={{ ...S.btnGhost, fontSize: 11, padding: '4px 10px' }}
          onClick={() => setOpen(o => !o)}>
          {open ? 'Cerrar' : '+ Agregar'}
        </button>
      </div>
      {staff.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 }}>
          <span>{ROLE_ICONS[s.role] ?? '👤'}</span>
          <span style={{ flex: 1 }}>{s.name}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{s.role}</span>
          <span style={{ ...S.badge(s.is_active ? '#16a34a' : '#9ca3af') }}>
            {s.is_active ? 'activo' : 'pausado'}
          </span>
        </div>
      ))}
      {open && (
        <form onSubmit={addStaff} style={{ marginTop: 10, padding: '12px',
          background: 'var(--color-background-primary)', borderRadius: 8,
          border: '0.5px solid var(--color-border-secondary)' }}>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input style={S.inp} required value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Camila Ruiz" />
            </div>
            <div>
              <label style={S.label}>Rol</label>
              <select style={S.inp} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>PIN (4-8 digitos) *</label>
              <input style={S.inp} type="password" inputMode="numeric" maxLength={8} required
                value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} placeholder="1234" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button style={S.btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            El empleado entra en: <code>{loginUrl}</code>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Tab: Personalizar tienda ────────────────────────────────────
function TabPersonalizar({ stores, onRefresh }) {
  const [selectedStore, setSelectedStore] = React.useState(stores[0]?.id ?? null)
  const [form, setForm] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [ok, setOk] = React.useState(false)

  const store = stores.find(s => s.id === selectedStore)

  React.useEffect(() => {
    if (!store) return
    const tokens = store.theme_tokens ?? {}
    setForm({
      name: store.name, city: store.city ?? '',
      primary: tokens.primary ?? '#C0392B', surface: tokens.surface ?? '#FEF9F0',
      font_display: tokens.font_display ?? 'Pacifico', font_body: tokens.font_body ?? 'Nunito',
      tagline: store.notes ?? '',
    })
  }, [selectedStore, stores])

  async function save(e) {
    e.preventDefault(); setSaving(true); setOk(false)
    try {
      await supabaseAuth.from('stores').update({
        name: form.name, city: form.city, notes: form.tagline,
        theme_tokens: { primary: form.primary, surface: form.surface,
          font_display: form.font_display, font_body: form.font_body },
      }).eq('id', selectedStore)
      setOk(true); onRefresh()
      setTimeout(() => setOk(false), 3000)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  if (!store || !form) return <div style={S.card}>Selecciona una tienda</div>

  const FONTS_DISPLAY = ['Pacifico', 'Playfair Display', 'Montserrat', 'Syne', 'DM Sans']
  const FONTS_BODY    = ['Nunito', 'Lato', 'Raleway', 'Open Sans', 'Inter']

  return (
    <div style={{ maxWidth: 540 }}>
      {stores.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Tienda a editar</label>
          <select style={S.inp} value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Preview de color */}
      <div style={{ marginBottom: 16, padding: '14px', borderRadius: 10, background: form.surface,
        border: '3px solid ' + form.primary }}>
        <div style={{ color: form.primary, fontFamily: form.font_display, fontSize: 20, fontWeight: 500 }}>
          {form.name || 'Tu tienda'}
        </div>
        <div style={{ color: '#666', fontFamily: form.font_body, fontSize: 13, marginTop: 4 }}>
          {form.tagline || 'Tu slogan aqui'}
        </div>
      </div>

      <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
        {ok && <div style={S.notice('success')}>Cambios guardados correctamente</div>}

        <div>
          <label style={S.label}>Nombre de la tienda *</label>
          <input style={S.inp} required value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label style={S.label}>Ciudad</label>
          <input style={S.inp} value={form.city}
            onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
        </div>
        <div>
          <label style={S.label}>Slogan / tagline</label>
          <input style={S.inp} value={form.tagline}
            onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
            placeholder="Hechos con amor..." />
        </div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Color principal</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.primary}
                onChange={e => setForm(p => ({ ...p, primary: e.target.value }))}
                style={{ width: 40, height: 36, borderRadius: 6, border: 'none', cursor: 'pointer' }} />
              <input style={{ ...S.inp, flex: 1 }} value={form.primary}
                onChange={e => setForm(p => ({ ...p, primary: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={S.label}>Color de fondo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.surface}
                onChange={e => setForm(p => ({ ...p, surface: e.target.value }))}
                style={{ width: 40, height: 36, borderRadius: 6, border: 'none', cursor: 'pointer' }} />
              <input style={{ ...S.inp, flex: 1 }} value={form.surface}
                onChange={e => setForm(p => ({ ...p, surface: e.target.value }))} />
            </div>
          </div>
        </div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Fuente de titulos</label>
            <select style={S.inp} value={form.font_display}
              onChange={e => setForm(p => ({ ...p, font_display: e.target.value }))}>
              {FONTS_DISPLAY.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Fuente de texto</label>
            <select style={S.inp} value={form.font_body}
              onChange={e => setForm(p => ({ ...p, font_body: e.target.value }))}>
              {FONTS_BODY.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={S.label}>URL del menu publico</label>
          <div style={{ ...S.inp, background: 'var(--color-background-secondary)',
            fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'default' }}>
            {window.location.origin}/s/{store.slug ?? store.id}/menu
          </div>
        </div>
        <button style={S.btnPrimary} type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────
export default function TenantAdminPage() {
  const { tenantId, role } = useAuth()
  const navigate = useNavigate()
  const [stores, setStores]   = React.useState([])
  const [branches, setBranches] = React.useState([])
  const [subInfo, setSubInfo] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState('resumen')

  const TABS = [
    { id: 'resumen',      label: 'Resumen' },
    { id: 'crear',        label: 'Crear tienda' },
    { id: 'sedes',        label: 'Sedes y staff' },
    { id: 'personalizar', label: 'Personalizar' },
  ]

  async function load() {
    if (!tenantId) return
    const [{ data: s }, { data: b }, { data: sub }] = await Promise.all([
      supabaseAuth.from('stores').select('*').eq('tenant_id', tenantId).order('name'),
      supabaseAuth.from('branches').select('id,name,slug,city,status,store_id,stores(name,slug)')
        .eq('tenant_id', tenantId).order('name'),
      supabaseAuth.from('tenant_subscriptions').select('plan_id,status')
        .eq('tenant_id', tenantId).maybeSingle(),
    ])
    setStores(s ?? [])
    setBranches(b ?? [])
    setSubInfo(sub)
    setLoading(false)
  }

  React.useEffect(() => { load() }, [tenantId])

  if (!tenantId) return (
    <div style={S.shell}>
      <div style={{ ...S.notice('error'), padding: '16px' }}>
        Tu cuenta no tiene un tenant asignado. Contacta con el administrador
        o <a href="/onboarding" style={{ color: 'inherit' }}>configura tu tienda aqui</a>.
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ ...S.shell, color: 'var(--color-text-secondary)', fontSize: 14 }}>
      Cargando...
    </div>
  )

  return (
    <div style={S.shell}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.eyebrow}>Panel del dueno &middot; {role}</div>
        <h1 style={S.title}>Mis tiendas</h1>
        <p style={S.desc}>Crea y personaliza tus tiendas, gestiona sedes y asigna staff con links unicos.</p>
        <div style={S.signals}>
          {[['Plan', subInfo?.plan_id ?? 'growth'],
            ['Tiendas', stores.length],
            ['Sedes', branches.length]].map(([k, v]) => (
            <span key={k} style={S.signal}>{k}: <strong style={S.signalVal}>{v}</strong></span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} type="button" style={S.tab(tab === t.id)}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'resumen'      && <TabResumen stores={stores} branches={branches} subInfo={subInfo} navigate={navigate} />}
      {tab === 'crear'        && <TabCrearTienda tenantId={tenantId} onCreated={() => { load(); setTab('resumen') }} />}
      {tab === 'sedes'        && <TabSedes tenantId={tenantId} stores={stores} branches={branches} onRefresh={load} />}
      {tab === 'personalizar' && <TabPersonalizar stores={stores} onRefresh={load} />}
    </div>
  )
}
