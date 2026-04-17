import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  DEFAULT_REVIEW_SETTINGS,
  deleteReview,
  fetchReviewSettings,
  fetchReviews,
  setReviewApproved,
} from '../lib/reviewUtils'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'
import { DEFAULT_STORE_ID } from '../lib/currentStore'
import { upsertScopedSetting } from '../lib/storeSettings'

const STARS = count => '★'.repeat(count) + '☆'.repeat(Math.max(0, 5 - count))
const REVIEW_SETTING_LABELS = {
  review_request_message: 'Mensaje de solicitud por WhatsApp',
  review_reward_percent: 'Descuento del cupon (%)',
  review_public_limit: 'Resenas publicas en el menu',
}

function getReadableError(error) {
  const text = String(error?.message || error?.details || '').trim()
  if (!text) return 'Error desconocido con la base de datos.'
  if (/row-level security|permission denied|violates row-level security/i.test(text)) {
    return 'Supabase esta bloqueando reviews por RLS. Aplica la migracion SQL nueva de reviews para el panel admin.'
  }
  return text
}

export default function AdminReviewsTab({ storeId = DEFAULT_STORE_ID }) {
  const { isPhone } = useResponsiveAdminLayout()
  const [reviews, setReviews] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState({ pending: 0, approved: 0, total: 0 })
  const [errorText, setErrorText] = useState('')
  const [reviewSettings, setReviewSettings] = useState(DEFAULT_REVIEW_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)

  const loadCounts = useCallback(async () => {
    const rows = await fetchReviews({ limit: 500, storeId })
    const approved = rows.filter(item => item.approved).length
    setCounts({
      total: rows.length,
      approved,
      pending: Math.max(0, rows.length - approved),
    })
  }, [storeId])

  const loadSettings = useCallback(async () => {
    try {
      const next = await fetchReviewSettings(storeId)
      setReviewSettings(next)
    } catch {}
  }, [storeId])

  const load = useCallback(async () => {
    setLoading(true)
    setErrorText('')

    try {
      const approved = filter === 'all' ? undefined : filter === 'approved'
      const rows = await fetchReviews({ approved, limit: 200, storeId })
      setReviews(rows)
      await Promise.all([loadCounts(), loadSettings()])
    } catch (error) {
      setReviews([])
      setCounts({ pending: 0, approved: 0, total: 0 })
      setErrorText(getReadableError(error))
    }

    setLoading(false)
  }, [filter, loadCounts, loadSettings, storeId])

  useEffect(() => {
    load()
  }, [load])

  async function updateReviewStatus(id, approved) {
    try {
      await setReviewApproved(id, approved, storeId)
      toast.success(approved ? 'Resena aprobada y publicada' : 'Resena retirada del menu')
      load()
    } catch (error) {
      const message = getReadableError(error)
      setErrorText(message)
      toast.error(message)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      await Promise.all(
        Object.entries(reviewSettings).map(([key, value]) =>
          upsertScopedSetting(key, value, storeId)
        )
      )
      toast.success('Ajustes de resenas guardados')
    } catch (error) {
      toast.error(getReadableError(error))
    }
    setSavingSettings(false)
  }

  async function removeReview(review) {
    if (!window.confirm(`Eliminar la resena del pedido #${review.order_number || '-'}?`)) return

    try {
      await deleteReview(review.id, storeId)
      toast.success('Resena eliminada')
      load()
    } catch (error) {
      const message = getReadableError(error)
      setErrorText(message)
      toast.error(message)
    }
  }

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return reviews

    return reviews.filter(review => {
      const haystack = `${review.customer_name || review.author_name || ''} ${review.customer_phone || ''} ${review.order_number || ''} ${review.text || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [reviews, search])

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0
    return reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
  }, [reviews])

  const approvedPreviewCount = Number(reviewSettings.review_public_limit || 3) || 3

  return (
    <div style={{ fontFamily: "'Nunito',sans-serif" }}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        <div style={{ padding: '16px 18px', borderRadius: 18, background: 'linear-gradient(135deg,#fff7ed,#ffffff)', border: '1.5px solid #fed7aa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#1C3829' }}>Resenas de clientes</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#6B7280', lineHeight: 1.5 }}>
                Ajusta el mensaje de solicitud, el incentivo y cuantas resenas se muestran en el menu sin tocar el flujo principal.
              </p>
            </div>
            <button onClick={load} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 800 }}>
              Recargar
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[
            { label: 'Pendientes', value: counts.pending, bg: '#FEF3C7', color: '#92400E' },
            { label: 'Aprobadas', value: counts.approved, bg: '#DCFCE7', color: '#166534' },
            { label: 'Media', value: reviews.length ? averageRating.toFixed(1) : '0.0', bg: '#E0F2FE', color: '#075985' },
            { label: 'Menu', value: approvedPreviewCount, bg: '#F3E8FF', color: '#7C3AED' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: item.color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 18, border: '1.5px solid #E5E7EB', padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.74rem', fontWeight: 900, color: '#374151' }}>{REVIEW_SETTING_LABELS.review_request_message}</label>
              <textarea
                rows={6}
                value={reviewSettings.review_request_message || ''}
                onChange={event => setReviewSettings(current => ({ ...current, review_request_message: event.target.value }))}
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E5E7EB', padding: 12, fontFamily: 'inherit', fontSize: '0.84rem', color: '#1C3829', resize: 'vertical' }}
              />
              <div style={{ marginTop: 8, fontSize: '0.68rem', color: '#6B7280', lineHeight: 1.5 }}>
                Variables: {'{{nombre}}'}, {'{{numero}}'}, {'{{url}}'}, {'{{descuento}}'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.74rem', fontWeight: 900, color: '#374151' }}>{REVIEW_SETTING_LABELS.review_reward_percent}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reviewSettings.review_reward_percent || ''}
                  onChange={event => setReviewSettings(current => ({ ...current, review_reward_percent: event.target.value }))}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontFamily: 'inherit', fontSize: '0.84rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.74rem', fontWeight: 900, color: '#374151' }}>{REVIEW_SETTING_LABELS.review_public_limit}</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={reviewSettings.review_public_limit || ''}
                  onChange={event => setReviewSettings(current => ({ ...current, review_public_limit: event.target.value }))}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontFamily: 'inherit', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', lineHeight: 1.5 }}>
                Curioso pero util: ahora el admin controla el incentivo y la cantidad de prueba social que ve el cliente en el menu.
              </div>
              <button onClick={saveSettings} disabled={savingSettings} style={{ padding: '10px 16px', border: 'none', borderRadius: 12, background: '#1C3829', color: 'white', fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer', opacity: savingSettings ? 0.65 : 1 }}>
                {savingSettings ? 'Guardando...' : 'Guardar ajustes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { id: 'pending', label: 'Pendientes' },
          { id: 'approved', label: 'Aprobadas' },
          { id: 'all', label: 'Todas' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 50,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: '0.78rem',
              background: filter === item.id ? '#1C3829' : '#F3F4F6',
              color: filter === item.id ? 'white' : '#374151',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por cliente, pedido, telefono o texto..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontFamily: 'inherit', fontSize: '0.84rem', color: '#1C3829', background: 'white' }}
        />
      </div>

      {errorText && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 14, background: '#FFF1F2', border: '1.5px solid #F4A7B9', color: '#9F1239', fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.45 }}>
          {errorText}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Cargando resenas...</div>
      ) : filteredReviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>★</div>
          <div style={{ fontWeight: 700 }}>
            {errorText ? 'El panel no puede leer reviews hasta corregir Supabase.' : search ? 'No hay resenas para esa busqueda' : 'No hay resenas en este filtro'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredReviews.map(review => (
            <div key={review.id} style={{ background: review.approved ? '#F0FDF4' : 'white', border: `1.5px solid ${review.approved ? '#86EFAC' : '#E5E7EB'}`, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: review.approved ? '#DCFCE7' : '#FFF3E4', color: review.approved ? '#166534' : '#E8607A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0 }}>
                    {(review.customer_name || review.author_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1C3829' }}>
                      {review.customer_name || review.author_name || 'Cliente anonimo'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>
                      Pedido #{review.order_number || '-'}
                      {review.customer_phone && ` · ${review.customer_phone}`}
                      {review.created_at && ` · ${new Date(review.created_at).toLocaleDateString('es-ES')}`}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#F59E0B', fontSize: '1rem', letterSpacing: 2 }}>{STARS(review.rating || 5)}</div>
                  <div style={{ fontSize: '0.60rem', fontWeight: 800, marginTop: 4, color: review.approved ? '#166534' : '#92400E', background: review.approved ? '#DCFCE7' : '#FEF3C7', padding: '2px 8px', borderRadius: 20 }}>
                    {review.approved ? 'Publicada' : 'Pendiente'}
                  </div>
                </div>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', fontWeight: 500, color: '#374151', lineHeight: 1.6, background: '#F9FAFB', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                "{review.text || 'Sin comentario'}"
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                {!review.approved && (
                  <button onClick={() => updateReviewStatus(review.id, true)} style={{ flex: 2, padding: '10px', borderRadius: 12, background: 'linear-gradient(135deg,#2D6A4F,#40916C)', color: 'white', border: 'none', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Aprobar y publicar
                  </button>
                )}
                <button onClick={() => updateReviewStatus(review.id, false)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#FEE2E2', color: '#DC2626', border: '1.5px solid #FECACA', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {review.approved ? 'Retirar' : 'Dejar pendiente'}
                </button>
                <button onClick={() => removeReview(review)} style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#111827', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
