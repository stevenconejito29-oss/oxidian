import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { DEFAULT_STORE_ID, normalizeStoreId } from '../lib/currentStore'

const EMPTY_COUPON = {
  id: '',
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '10',
  min_order_amount: '0',
  max_uses: '',
  expires_at: '',
  active: true,
  used_count: 0,
}

function normalizeDraft(coupon = {}) {
  return {
    ...EMPTY_COUPON,
    ...coupon,
    code: String(coupon.code || '').trim().toUpperCase(),
    description: String(coupon.description || '').trim(),
    discount_type: coupon.discount_type === 'fixed' ? 'fixed' : 'percent',
    discount_value: String(coupon.discount_value ?? EMPTY_COUPON.discount_value),
    min_order_amount: String(coupon.min_order_amount ?? EMPTY_COUPON.min_order_amount),
    max_uses: coupon.max_uses == null ? '' : String(coupon.max_uses),
    expires_at: coupon.expires_at ? toDateTimeLocalValue(coupon.expires_at) : '',
    active: coupon.active !== false,
    used_count: Number(coupon.used_count || 0),
  }
}

function toDateTimeLocalValue(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset()
  const local = new Date(parsed.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIsoOrNull(value) {
  if (!String(value || '').trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function SummaryCard({ label, value, hint, tone, bg }) {
  return (
    <div style={{ background: bg, border: `1px solid ${tone}22`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: tone, opacity: .78 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.26rem', fontWeight: 900, color: tone, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: '.72rem', color: tone, opacity: .68, marginTop: 4 }}>
        {hint}
      </div>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7280' }}>
        {label}
      </span>
      {children}
      {hint ? <span style={{ fontSize: '.72rem', color: '#6B7280', lineHeight: 1.5 }}>{hint}</span> : null}
    </label>
  )
}

export default function AdminCouponsTab({ storeId = DEFAULT_STORE_ID, coupons = [], onRefresh }) {
  const activeStoreId = normalizeStoreId(storeId)
  const [draft, setDraft] = useState(EMPTY_COUPON)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => {
    const activeCoupons = coupons.filter(coupon => coupon.active !== false)
    const expiredCoupons = coupons.filter(coupon => coupon.expires_at && new Date(coupon.expires_at) < new Date())
    const totalUses = coupons.reduce((sum, coupon) => sum + Number(coupon.used_count || 0), 0)
    return {
      total: coupons.length,
      active: activeCoupons.length,
      expired: expiredCoupons.length,
      uses: totalUses,
    }
  }, [coupons])

  function resetDraft() {
    setDraft(EMPTY_COUPON)
  }

  function startEdit(coupon) {
    setDraft(normalizeDraft(coupon))
  }

  async function handleSave() {
    const code = String(draft.code || '').trim().toUpperCase()
    if (!code) {
      toast.error('El codigo del cupon es obligatorio')
      return
    }

    const discountValue = Number.parseFloat(String(draft.discount_value || '').replace(',', '.'))
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      toast.error('Define un descuento valido')
      return
    }

    if (draft.discount_type === 'percent' && discountValue > 100) {
      toast.error('El descuento porcentual no puede superar 100')
      return
    }

    const minOrderAmount = Number.parseFloat(String(draft.min_order_amount || '').replace(',', '.'))
    const parsedMaxUses = String(draft.max_uses || '').trim()
    const maxUses = parsedMaxUses ? Number.parseInt(parsedMaxUses, 10) : null

    if (parsedMaxUses && (!Number.isInteger(maxUses) || maxUses < 1)) {
      toast.error('El limite de usos debe ser un entero positivo')
      return
    }

    setSaving(true)
    try {
      const payload = {
        store_id: activeStoreId,
        code,
        description: String(draft.description || '').trim(),
        discount_type: draft.discount_type === 'fixed' ? 'fixed' : 'percent',
        discount_value: discountValue,
        min_order_amount: Number.isFinite(minOrderAmount) ? Math.max(0, minOrderAmount) : 0,
        max_uses: maxUses,
        expires_at: toIsoOrNull(draft.expires_at),
        active: draft.active !== false,
      }

      if (draft.id) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', draft.id)
          .eq('store_id', activeStoreId)

        if (error) throw error
        toast.success('Cupon actualizado')
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert([{ ...payload, used_count: 0 }])

        if (error) throw error
        toast.success('Cupon creado')
      }

      resetDraft()
      await onRefresh?.()
    } catch (error) {
      toast.error(error.message || 'No pude guardar el cupon')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(coupon) {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ active: coupon.active === false })
        .eq('id', coupon.id)
        .eq('store_id', activeStoreId)

      if (error) throw error
      toast.success(coupon.active === false ? 'Cupon activado' : 'Cupon pausado')
      await onRefresh?.()
    } catch (error) {
      toast.error(error.message || 'No pude cambiar el estado del cupon')
    }
  }

  async function handleDelete(coupon) {
    if (!window.confirm(`Eliminar el cupon ${coupon.code}?`)) return

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', coupon.id)
        .eq('store_id', activeStoreId)

      if (error) throw error
      toast.success('Cupon eliminado')
      if (draft.id === coupon.id) resetDraft()
      await onRefresh?.()
    } catch (error) {
      toast.error(error.message || 'No pude eliminar el cupon')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <SummaryCard label="Cupones" value={summary.total} hint="Registrados en esta tienda" tone="#1D4ED8" bg="#EFF6FF" />
        <SummaryCard label="Activos" value={summary.active} hint="Aplicables desde carrito" tone="#166534" bg="#ECFDF5" />
        <SummaryCard label="Caducados" value={summary.expired} hint="Requieren revision" tone="#B45309" bg="#FFF7ED" />
        <SummaryCard label="Usos" value={summary.uses} hint="Canjes acumulados" tone="#7C3AED" bg="#F3E8FF" />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <section style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: 18, padding: '16px 18px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '.74rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7280' }}>
                Editor
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1C3829', marginTop: 4 }}>
                {draft.id ? `Editar ${draft.code}` : 'Nuevo cupon'}
              </div>
            </div>
            {draft.id ? (
              <button
                type="button"
                onClick={resetDraft}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#4B5563', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Codigo" hint="Se aplica en el carrito tal cual, en mayusculas.">
              <input value={draft.code} onChange={event => setDraft(current => ({ ...current, code: event.target.value.toUpperCase() }))} style={inputStyle} placeholder="QA10" />
            </Field>

            <Field label="Descripcion">
              <input value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} style={inputStyle} placeholder="Descuento para lanzamiento" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tipo">
                <select value={draft.discount_type} onChange={event => setDraft(current => ({ ...current, discount_type: event.target.value }))} style={inputStyle}>
                  <option value="percent">Porcentaje</option>
                  <option value="fixed">Importe fijo</option>
                </select>
              </Field>

              <Field label={draft.discount_type === 'percent' ? 'Descuento %' : 'Descuento EUR'}>
                <input value={draft.discount_value} onChange={event => setDraft(current => ({ ...current, discount_value: event.target.value }))} style={inputStyle} inputMode="decimal" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Pedido minimo EUR">
                <input value={draft.min_order_amount} onChange={event => setDraft(current => ({ ...current, min_order_amount: event.target.value }))} style={inputStyle} inputMode="decimal" />
              </Field>

              <Field label="Max usos" hint="Vacio = ilimitado">
                <input value={draft.max_uses} onChange={event => setDraft(current => ({ ...current, max_uses: event.target.value }))} style={inputStyle} inputMode="numeric" />
              </Field>
            </div>

            <Field label="Caduca en">
              <input type="datetime-local" value={draft.expires_at} onChange={event => setDraft(current => ({ ...current, expires_at: event.target.value }))} style={inputStyle} />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: '#1C3829' }}>
              <input type="checkbox" checked={draft.active !== false} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))} />
              <span>Cupon activo</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '11px 14px', borderRadius: 12, border: 'none', background: '#1C3829', color: 'white', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Guardando...' : draft.id ? 'Guardar cambios' : 'Crear cupon'}
          </button>
        </section>

        <section style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: 18, padding: '16px 18px', display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: '.74rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7280' }}>
              Cupones activos por tienda
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1C3829', marginTop: 4 }}>
              Promociones listas para vender
            </div>
          </div>

          {coupons.length === 0 ? (
            <div style={{ borderRadius: 14, border: '1.5px dashed #D1D5DB', padding: '18px 16px', color: '#6B7280', fontWeight: 700 }}>
              Esta tienda aun no tiene cupones. Crea uno para activar descuentos desde el carrito.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {coupons.map(coupon => {
                const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
                return (
                  <article key={coupon.id} style={{ borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '12px 14px', background: expired ? '#FFF7ED' : 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, color: '#1C3829', fontSize: '.92rem' }}>{coupon.code}</span>
                          <span style={{ fontSize: '.64rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', padding: '3px 8px', borderRadius: 999, background: coupon.active === false ? '#F3F4F6' : '#DCFCE7', color: coupon.active === false ? '#6B7280' : '#166534' }}>
                            {coupon.active === false ? 'Pausado' : 'Activo'}
                          </span>
                          {expired ? (
                            <span style={{ fontSize: '.64rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', padding: '3px 8px', borderRadius: 999, background: '#FED7AA', color: '#9A3412' }}>
                              Caducado
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '.8rem', color: '#4B5563', marginTop: 6, fontWeight: 700 }}>
                          {coupon.description || 'Sin descripcion'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={chipStyle}>
                            {coupon.discount_type === 'percent'
                              ? `-${Number(coupon.discount_value || 0)}%`
                              : `-EUR ${Number(coupon.discount_value || 0).toFixed(2)}`}
                          </span>
                          <span style={chipStyle}>Min EUR {Number(coupon.min_order_amount || 0).toFixed(2)}</span>
                          <span style={chipStyle}>
                            {coupon.max_uses ? `${coupon.used_count || 0}/${coupon.max_uses} usos` : `${coupon.used_count || 0} usos`}
                          </span>
                          <span style={chipStyle}>
                            {coupon.expires_at ? `Caduca ${new Date(coupon.expires_at).toLocaleString('es-ES')}` : 'Sin caducidad'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleToggle(coupon)} style={secondaryButtonStyle}>
                          {coupon.active === false ? 'Activar' : 'Pausar'}
                        </button>
                        <button type="button" onClick={() => startEdit(coupon)} style={secondaryButtonStyle}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDelete(coupon)} style={dangerButtonStyle}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1.5px solid #E5E7EB',
  background: 'white',
  color: '#1C3829',
  fontFamily: 'inherit',
  fontSize: '.88rem',
  fontWeight: 700,
  boxSizing: 'border-box',
}

const chipStyle = {
  fontSize: '.68rem',
  fontWeight: 800,
  color: '#4B5563',
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: 999,
  padding: '4px 8px',
}

const secondaryButtonStyle = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1.5px solid #E5E7EB',
  background: '#F9FAFB',
  color: '#374151',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const dangerButtonStyle = {
  ...secondaryButtonStyle,
  border: '1.5px solid #FECACA',
  background: '#FEF2F2',
  color: '#B91C1C',
}
