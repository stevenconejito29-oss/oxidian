import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { hasOperationalSurpriseGift, normalizeGiftCadence, normalizeSurpriseGiftLevel } from '../lib/clubGift'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'
import { DEFAULT_STORE_ID, normalizeStoreId } from '../lib/currentStore'
import {
  buildStoreScopedLevelId,
  isMissingLoyaltySlug,
  isMissingStoreScope,
  normalizeLevelRecord,
  normalizeVisitorLevel,
} from '../lib/loyaltyScope'
import { loadMergedSettingsMap } from '../lib/storeSettings'
import { buildStoreBrandingSnapshot } from '../lib/adminBranding'

const EMPTY_LEVEL = {
  id: '',
  label: '',
  emoji: '⭐',
  color: '#D4AF37',
  min_orders: 0,
  reward_text: '',
  discount_percent: 0,
  active: true,
  sort_order: 0,
  badge_text: '',
  benefits_text: '',
  free_delivery: false,
  priority_delivery: false,
  free_topping: false,
  exclusive_menu: false,
  surprise_gift: false,
  surprise_gift_type: '',
  surprise_gift_item_id: '',
  surprise_gift_every_orders: 0,
  surprise_gift_note: '',
  birthday_reward_text: '',
  unlock_message: '',
}

const SOURCE_ICONS = {
  instagram: '📸',
  facebook: '👍',
  whatsapp: '💬',
  tiktok: '🎵',
  direct: '🔗',
  referral: '🌐',
}

function normalizeLevel(level) {
  const benefits = Array.isArray(level?.benefits) ? level.benefits.filter(Boolean) : []
  return normalizeSurpriseGiftLevel({
    ...EMPTY_LEVEL,
    ...level,
    benefits,
    benefits_text: benefits.join('\n'),
    free_delivery: level?.free_delivery === true,
    priority_delivery: level?.priority_delivery === true,
    free_topping: level?.free_topping === true,
    exclusive_menu: level?.exclusive_menu === true,
    surprise_gift: level?.surprise_gift === true,
    birthday_reward_text: level?.birthday_reward_text || '',
    unlock_message: level?.unlock_message || '',
  })
}

export default function AdminLoyaltyTab({ storeId = DEFAULT_STORE_ID }) {
  const activeStoreId = normalizeStoreId(storeId)
  const { isPhone } = useResponsiveAdminLayout()
  const [levels, setLevels] = useState([])
  const [catalogProducts, setCatalogProducts] = useState([])
  const [visitors, setVisitors] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('levels')
  const [vsLoading, setVsLoading] = useState(false)
  const [vsSearch, setVsSearch] = useState('')
  const [brand, setBrand] = useState(() => buildStoreBrandingSnapshot({}, null, activeStoreId))

  useEffect(() => {
    loadLevels()
    loadCatalog()
    loadVisitors()
    loadMergedSettingsMap(activeStoreId, supabase)
      .then(settingsMap => setBrand(buildStoreBrandingSnapshot(settingsMap, null, activeStoreId)))
      .catch(() => setBrand(buildStoreBrandingSnapshot({}, null, activeStoreId)))
  }, [activeStoreId])

  useEffect(() => {
    if (tab === 'visitors' || tab === 'stats') loadVisitors()
  }, [activeStoreId, tab])

  async function loadLevels() {
    const variants = [
      { scoped: true },
      { scoped: false },
    ]

    for (const variant of variants) {
      let query = supabase
        .from('loyalty_rewards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('min_orders', { ascending: true })

      if (variant.scoped) query = query.eq('store_id', activeStoreId)

      const { data, error } = await query
      if (error) {
        if (isMissingStoreScope(error) || isMissingLoyaltySlug(error)) continue
        toast.error(`Error cargando niveles: ${error.message}`)
        return
      }

      setLevels(
        (data || [])
          .map(level => normalizeLevelRecord(level, activeStoreId))
          .filter(Boolean)
          .map(normalizeLevel)
      )
      return
    }
  }

  async function loadCatalog() {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, emoji, available, out_of_stock')
      .eq('store_id', activeStoreId)
      .order('name')

    setCatalogProducts((products || []).filter(item => item.available !== false))
  }

  async function loadVisitors() {
    setVsLoading(true)
    let response = await supabase
      .from('visitors')
      .select('*')
      .eq('store_id', activeStoreId)
      .order('last_seen', { ascending: false })
      .limit(300)

    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase
        .from('visitors')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(300)
    }

    if (response.error) toast.error(`Error cargando miembros: ${response.error.message}`)
    setVisitors((response.data || []).map(visitor => ({ ...visitor, level: normalizeVisitorLevel(visitor.level) })))
    setVsLoading(false)
  }

  async function saveLevel() {
    if (!editing?.id?.trim()) return toast.error('El slug del nivel es obligatorio')
    if (!editing?.label?.trim()) return toast.error('El nombre del nivel es obligatorio')
    if (editing?.surprise_gift === true) {
      if (editing.surprise_gift_type !== 'product') return toast.error('El regalo sorpresa operativo debe ser un producto')
      if (!editing.surprise_gift_item_id) return toast.error('Selecciona el item del regalo sorpresa')
      if (normalizeGiftCadence(editing.surprise_gift_every_orders) <= 0) return toast.error('Define cada cuántos pedidos se activa el regalo sorpresa')
    }

    setSaving(true)

    try {
      const benefits = String(editing.benefits_text || '')
        .split('\n')
        .map(v => v.trim())
        .filter(Boolean)

      const payload = {
        id: buildStoreScopedLevelId(activeStoreId, editing.id.toLowerCase().trim()),
        slug: editing.id.toLowerCase().trim(),
        store_id: activeStoreId,
        label: editing.label.trim(),
        emoji: editing.emoji || '⭐',
        color: editing.color || '#6B7280',
        min_orders: Number(editing.min_orders) || 0,
        reward_text: editing.reward_text || '',
        discount_percent: Number(editing.discount_percent) || 0,
        active: editing.active !== false,
        sort_order: Number(editing.sort_order) || 0,
        badge_text: String(editing.badge_text || '').trim() || null,
        benefits,
        free_delivery: editing.free_delivery === true,
        priority_delivery: editing.priority_delivery === true,
        free_topping: editing.free_topping === true,
        exclusive_menu: editing.exclusive_menu === true,
        surprise_gift: editing.surprise_gift === true,
        surprise_gift_type: editing.surprise_gift === true ? editing.surprise_gift_type || null : null,
        surprise_gift_item_id: editing.surprise_gift === true ? editing.surprise_gift_item_id || null : null,
        surprise_gift_every_orders: editing.surprise_gift === true ? normalizeGiftCadence(editing.surprise_gift_every_orders) : 0,
        surprise_gift_note: editing.surprise_gift === true ? String(editing.surprise_gift_note || '').trim() || null : null,
        birthday_reward_text: String(editing.birthday_reward_text || '').trim() || null,
        unlock_message: String(editing.unlock_message || '').trim() || null,
      }

      if (editing._isNew) {
        let { error } = await supabase.from('loyalty_rewards').insert([payload])
        if (error && (isMissingStoreScope(error) || isMissingLoyaltySlug(error))) {
          const { store_id, slug, ...legacyPayload } = payload
          ;({ error } = await supabase.from('loyalty_rewards').insert([legacyPayload]))
        }
        if (error) throw error
        toast.success('Nivel creado')
      } else {
        let response = await supabase
          .from('loyalty_rewards')
          .update(payload)
          .eq('id', editing._dbId || editing.db_id || editing._originalId || editing.id)
          .eq('store_id', activeStoreId)

        if (response.error && (isMissingStoreScope(response.error) || isMissingLoyaltySlug(response.error))) {
          const { store_id, slug, ...legacyPayload } = payload
          response = await supabase
            .from('loyalty_rewards')
            .update(legacyPayload)
            .eq('id', editing._dbId || editing.db_id || editing._originalId || editing.id)
        }
        if (response.error) throw response.error
        toast.success('Nivel actualizado')
      }

      setEditing(null)
      loadLevels()
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el nivel')
    }

    setSaving(false)
  }

  async function deleteLevel(id) {
    if (!window.confirm(`Eliminar el nivel "${id}"?`)) return
    let response = await supabase.from('loyalty_rewards').delete().eq('store_id', activeStoreId).eq('id', id)
    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase.from('loyalty_rewards').delete().eq('id', id)
    }
    if (response.error) return toast.error(response.error.message)
    toast.success('Nivel eliminado')
    loadLevels()
  }

  async function toggleLevelActive(level) {
    let response = await supabase
      .from('loyalty_rewards')
      .update({ active: !level.active })
      .eq('id', level.db_id || level.id)
      .eq('store_id', activeStoreId)

    if (response.error && isMissingStoreScope(response.error)) {
      response = await supabase
        .from('loyalty_rewards')
        .update({ active: !level.active })
        .eq('id', level.db_id || level.id)
    }

    if (response.error) return toast.error(response.error.message)
    loadLevels()
  }

  const instagramCount = visitors.filter(v => v.source === 'instagram').length
  const withOrders = visitors.filter(v => (v.order_count || 0) > 0).length
  const totalSpent = visitors.reduce((sum, v) => sum + Number(v.total_spent || 0), 0)

  const filteredVisitors = useMemo(() => {
    const q = vsSearch.trim().toLowerCase()
    if (!q) return visitors
    return visitors.filter(v => {
      const haystack = `${v.phone || ''} ${v.visitor_id || ''} ${v.level || ''} ${v.source || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [visitors, vsSearch])

  const levelStats = useMemo(() => (
    levels.map(level => ({
      ...level,
      count: visitors.filter(v => v.level === level.id).length,
    }))
  ), [levels, visitors])

  const giftSourceOptions = useMemo(() => ({
    product: catalogProducts,
  }), [catalogProducts])

  const editingGiftOptions = editing?.surprise_gift_type
    ? giftSourceOptions[editing.surprise_gift_type] || []
    : []

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", color: '#1C3829', maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>Club de {brand.businessName}</h2>
          <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: '4px 0 0', fontWeight: 600 }}>
            {visitors.length} miembros · {instagramCount} via Instagram · {withOrders} con pedidos · EUR {totalSpent.toFixed(2)} acumulados
          </p>
        </div>

        {tab === 'levels' && (
          <button
            onClick={() => setEditing({ ...EMPTY_LEVEL, _isNew: true })}
            style={{ padding: '9px 18px', background: '#2D6A4F', color: 'white', border: 'none', borderRadius: 10, fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Nuevo nivel
          </button>
        )}

        {tab !== 'levels' && (
          <button
            onClick={loadVisitors}
            style={{ padding: '9px 14px', background: '#F3F4F6', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Actualizar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F3F4F6', borderRadius: 12, padding: 4 }}>
        {[
          ['levels', 'Niveles'],
          ['visitors', 'Miembros'],
          ['stats', 'Estadisticas'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: '0.78rem',
              background: tab === id ? '#2D6A4F' : 'transparent',
              color: tab === id ? 'white' : '#6B7280',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'levels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {levels.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '0.82rem' }}>
              Sin niveles. Aplica la migracion nueva del Club en Supabase.
            </div>
          )}

          {levels.map(level => (
            <div
              key={level.id}
              style={{
                background: 'white',
                border: `1.5px solid ${level.active ? `${level.color}44` : '#E5E7EB'}`,
                borderLeft: `4px solid ${level.color}`,
                borderRadius: 14,
                overflow: 'hidden',
                opacity: level.active ? 1 : 0.55,
                boxShadow: '0 2px 8px rgba(28,56,41,0.05)',
              }}
            >
              {/* Franja — previa del gradiente en HSL */}
              {/^#[0-9A-Fa-f]{3,6}$/.test(level.color || '') && (() => {
                const hx=level.color.replace('#',''), full=hx.length===3?hx.split('').map(c=>c+c).join(''):hx
                const r=parseInt(full.slice(0,2),16),g=parseInt(full.slice(2,4),16),b=parseInt(full.slice(4,6),16)
                const rn=r/255,gn=g/255,bn=b/255,mx=Math.max(rn,gn,bn),mn=Math.min(rn,gn,bn),ll=(mx+mn)/2
                let hh=0;if(mx!==mn){const d=mx-mn;switch(mx){case rn:hh=((gn-bn)/d+(gn<bn?6:0))/6;break;case gn:hh=((bn-rn)/d+2)/6;break;default:hh=((rn-gn)/d+4)/6}}
                const hue=hh*360,isY=hue>=45&&hue<=90,isC=hue>=155&&hue<=210
                const [lD,,lL]=isY?[18,26,33]:isC?[20,29,37]:[22,35,46]
                const h2r=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}
                const toHex=(H,S,L)=>{H/=360;S/=100;L/=100;const q=L<0.5?L*(1+S):L+S-L*S,p=2*L-q;return '#'+[h2r(p,q,H+1/3),h2r(p,q,H),h2r(p,q,H-1/3)].map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('')}
                return <div style={{ height: 4, background: `linear-gradient(90deg, ${toHex(hue,92,lD)}, ${toHex(hue,92,lL)})` }} />
              })()}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px' }}>
                <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{level.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#1C3829' }}>{level.label}</span>
                    <span style={{ fontSize: '0.62rem', color: '#9CA3AF', fontWeight: 600 }}>id: {level.id}</span>
                    {level.badge_text && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#8B1A35', background: '#FDE8EF', padding: '2px 8px', borderRadius: 50 }}>
                        {level.badge_text}
                      </span>
                    )}
                    {level.discount_percent > 0 && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: 'white', background: '#2D6A4F', padding: '2px 8px', borderRadius: 50 }}>
                        -{level.discount_percent}%
                      </span>
                    )}
                    {level.free_delivery && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: 50 }}>
                        Delivery gratis
                      </span>
                    )}
                    {level.priority_delivery && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 50 }}>
                        Prioridad
                      </span>
                    )}
                    {level.free_topping && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#7C3AED', background: '#F3E8FF', padding: '2px 8px', borderRadius: 50 }}>
                        Topping gratis
                      </span>
                    )}
                    {level.exclusive_menu && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#0F766E', background: '#CCFBF1', padding: '2px 8px', borderRadius: 50 }}>
                        Menu exclusivo
                      </span>
                    )}
                    {level.surprise_gift && (
                      <span style={{ fontSize: '0.60rem', fontWeight: 900, color: '#BE123C', background: '#FFE4E6', padding: '2px 8px', borderRadius: 50 }}>
                        Regalo sorpresa
                      </span>
                    )}
                    {!level.active && <span style={{ fontSize: '0.60rem', color: '#9CA3AF', fontWeight: 700 }}>INACTIVO</span>}
                  </div>

                  <p style={{ fontSize: '0.70rem', color: '#6B7280', margin: 0, fontWeight: 500 }}>
                    Desde {level.min_orders} pedido{level.min_orders !== 1 ? 's' : ''} · {level.reward_text}
                  </p>

                  {level.surprise_gift && (
                    <div style={{ marginTop: 8, fontSize: '0.66rem', fontWeight: 700, color: '#9F1239', background: '#FFF1F2', border: '1px solid #FBCFE8', padding: '7px 10px', borderRadius: 10 }}>
                      {hasOperationalSurpriseGift(level)
                        ? `Regalo producto cada ${level.surprise_gift_every_orders} pedido${level.surprise_gift_every_orders !== 1 ? 's' : ''}`
                        : 'Regalo sorpresa activado pero sin configuración operativa completa'}
                    </div>
                  )}

                  {(level.unlock_message || level.birthday_reward_text) && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {level.unlock_message && (
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#7A1F43', background: '#FFF1F2', border: '1px solid #FBCFE8', padding: '7px 10px', borderRadius: 10 }}>
                          {level.unlock_message}
                        </div>
                      )}
                      {level.birthday_reward_text && (
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '7px 10px', borderRadius: 10 }}>
                          Cumpleanos: {level.birthday_reward_text}
                        </div>
                      )}
                    </div>
                  )}

                  {level.benefits?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {level.benefits.map(benefit => (
                        <span key={benefit} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#2D6A4F', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: 50 }}>
                          {benefit}
                        </span>
                      ))}
                    </div>
                  )}
                  </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleLevelActive(level)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}
                    title={level.active ? 'Desactivar' : 'Activar'}
                  >
                    {level.active ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setEditing({ ...normalizeLevel(level), _originalId: level.id, _dbId: level.db_id || level.id })}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 700 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteLevel(level.db_id || level.id)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}
                  >
                    X
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'visitors' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Miembros', value: visitors.length, color: '#2D6A4F', bg: '#D8F3DC' },
              { label: 'Instagram', value: instagramCount, color: '#C13584', bg: '#FCE4F1' },
              { label: 'Con pedidos', value: withOrders, color: '#1D4ED8', bg: '#DBEAFE' },
              { label: 'EUR Total', value: totalSpent.toFixed(0), color: '#D97706', bg: '#FEF3C7' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '0.60rem', fontWeight: 700, color: item.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem' }}>🔍</span>
            <input
              value={vsSearch}
              onChange={e => setVsSearch(e.target.value)}
              placeholder="Buscar por telefono, ID, nivel o canal..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: 'white', color: '#1C3829' }}
            />
          </div>

          {vsLoading && <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem', padding: 20 }}>Cargando miembros...</p>}

          {!vsLoading && filteredVisitors.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem', padding: 24 }}>
              {vsSearch ? 'Sin resultados' : 'Aun no hay miembros registrados'}
            </p>
          )}

          {!vsLoading && filteredVisitors.map(visitor => {
            const level = levels.find(item => item.id === visitor.level)
            const levelColor = level?.color || '#6B7280'

            return (
              <div key={visitor.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', borderRadius: 12, border: '1.5px solid #F3F4F6', marginBottom: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{SOURCE_ICONS[visitor.source] || '🔗'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1C3829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {visitor.phone || `${visitor.visitor_id?.slice(0, 14)}...`}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#6B7280', fontWeight: 500 }}>
                    {visitor.source} · {visitor.visit_count || 1} visitas · {visitor.order_count || 0} pedidos
                    {Number(visitor.total_spent || 0) > 0 && ` · EUR ${Number(visitor.total_spent).toFixed(2)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, background: `${levelColor}22`, color: levelColor, border: `1px solid ${levelColor}44`, padding: '2px 8px', borderRadius: 50, whiteSpace: 'nowrap' }}>
                    {visitor.level || 'hierro'}
                  </span>
                  <span style={{ fontSize: '0.60rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {visitor.last_seen ? new Date(visitor.last_seen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '-'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Distribucion por nivel
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {levelStats.map(level => {
              const pct = visitors.length ? Math.round((level.count / visitors.length) * 100) : 0
              return (
                <div key={level.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #F3F4F6', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1C3829' }}>
                      {level.emoji} {level.label}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: level.color || '#6B7280' }}>
                      {level.count} miembros · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 50, background: '#F3F4F6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 50, width: `${pct}%`, background: level.color || '#6B7280', transition: 'width 1s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <div
          onClick={e => e.target === e.currentTarget && setEditing(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: '#FFFBF5', borderRadius: '24px 24px 0 0', borderTop: '3px solid #E8607A', padding: '22px 20px calc(22px + env(safe-area-inset-bottom,0px))', maxHeight: '90dvh', overflowY: 'auto', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 50, margin: '0 auto 16px' }} />
            <h3 style={{ fontWeight: 900, fontSize: '1.1rem', margin: '0 0 18px', color: '#1C3829' }}>
              {editing._isNew ? 'Nuevo nivel' : `Editar: ${editing.label}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editing._isNew && (
                <div>
                  <label style={labelStyle}>Slug unico</label>
                  <input
                    placeholder="ej: plata_vip"
                    value={editing.id}
                    onChange={e => setEditing(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    style={inputStyle}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '80px 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Emoji</label>
                  <input value={editing.emoji} maxLength={4} onChange={e => setEditing(prev => ({ ...prev, emoji: e.target.value }))} style={{ ...inputStyle, textAlign: 'center', fontSize: '1.6rem', padding: '8px' }} />
                </div>
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input placeholder="Ej: Plata VIP" value={editing.label} onChange={e => setEditing(prev => ({ ...prev, label: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Color del nivel · define la cabecera del menú para este nivel</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="color" value={editing.color} onChange={e => setEditing(prev => ({ ...prev, color: e.target.value }))} style={{ width: 44, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }} />
                  <input value={editing.color} onChange={e => setEditing(prev => ({ ...prev, color: e.target.value }))} placeholder="#D4AF37" style={{ ...inputStyle, padding: '8px 10px', fontFamily: 'monospace' }} />
                </div>
                {/* Preview del gradiente — misma lógica HSL que el menú real */}
                {/^#[0-9A-Fa-f]{3,6}$/.test(editing.color || '') && (() => {
                  const hx = (editing.color).replace('#','')
                  const full = hx.length===3 ? hx.split('').map(c=>c+c).join('') : hx
                  const r=parseInt(full.slice(0,2),16), g=parseInt(full.slice(2,4),16), b=parseInt(full.slice(4,6),16)
                  // HSL conversion inline
                  const rn=r/255, gn=g/255, bn=b/255
                  const mx=Math.max(rn,gn,bn), mn=Math.min(rn,gn,bn), ll=(mx+mn)/2
                  let hh=0; if(mx!==mn){const d=mx-mn; switch(mx){case rn:hh=((gn-bn)/d+(gn<bn?6:0))/6;break;case gn:hh=((bn-rn)/d+2)/6;break;default:hh=((rn-gn)/d+4)/6}}
                  const hue=hh*360
                  const isY=hue>=45&&hue<=90, isC=hue>=155&&hue<=210
                  const h2r=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}
                  const toHex=(H,S,L)=>{H/=360;S/=100;L/=100;const q=L<0.5?L*(1+S):L+S-L*S,p=2*L-q;return '#'+[h2r(p,q,H+1/3),h2r(p,q,H),h2r(p,q,H-1/3)].map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('')}
                  // maxVividL: baja desde 65 hasta cumplir ratio de contraste vs blanco
                  // preview simple: color → blanco (igual que el menú real)
                  return (
                    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', marginBottom: 4 }}>
                      <div style={{
                        height: 68, position:'relative',
                        background: `linear-gradient(to bottom, ${editing.color} 0%, #ffffff 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px',
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.80)', border: '2px solid rgba(255,255,255,0.90)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.90)', marginBottom: 5, width: '60%',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
                          <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.70)', width: '40%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {[0.85, 0.70, 0.55].map((op, i) => (
                            <div key={i} style={{ height: 22, width: 48, borderRadius: 11, background: `rgba(255,255,255,${op})`, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#6B7280', padding: '5px 10px', background: '#F9FAFB', textAlign: 'center', letterSpacing: '.04em' }}>
                        Vista previa del header · color → blanco
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div>
                <label style={labelStyle}>Pedidos mínimos</label>
                <input type="number" min={0} value={editing.min_orders} onChange={e => setEditing(prev => ({ ...prev, min_orders: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Orden visual</label>
                  <input type="number" min={0} value={editing.sort_order} onChange={e => setEditing(prev => ({ ...prev, sort_order: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Badge corto</label>
                  <input placeholder="VIP, Elite, Ahorro" value={editing.badge_text || ''} onChange={e => setEditing(prev => ({ ...prev, badge_text: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Texto principal</label>
                <input placeholder="Ej: 10% siempre + acceso prioritario" value={editing.reward_text} onChange={e => setEditing(prev => ({ ...prev, reward_text: e.target.value }))} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Beneficios visibles, una linea por item</label>
                <textarea rows={4} placeholder={'5% automatico\nDelivery gratis\nPrioridad de entrega'} value={editing.benefits_text || ''} onChange={e => setEditing(prev => ({ ...prev, benefits_text: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Descuento automatico %</label>
                <input type="number" min={0} max={100} value={editing.discount_percent} onChange={e => setEditing(prev => ({ ...prev, discount_percent: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10 }}>
                <label style={checkboxStyle}>
                  <input type="checkbox" checked={editing.free_delivery === true} onChange={e => setEditing(prev => ({ ...prev, free_delivery: e.target.checked }))} />
                  Delivery gratis
                </label>
                <label style={checkboxStyle}>
                  <input type="checkbox" checked={editing.priority_delivery === true} onChange={e => setEditing(prev => ({ ...prev, priority_delivery: e.target.checked }))} />
                  Prioridad de entrega
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10 }}>
                <label style={checkboxStyle}>
                  <input type="checkbox" checked={editing.free_topping === true} onChange={e => setEditing(prev => ({ ...prev, free_topping: e.target.checked }))} />
                  Topping gratis
                </label>
                <label style={checkboxStyle}>
                  <input type="checkbox" checked={editing.exclusive_menu === true} onChange={e => setEditing(prev => ({ ...prev, exclusive_menu: e.target.checked }))} />
                  Menu exclusivo
                </label>
              </div>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  checked={editing.surprise_gift === true}
                  onChange={e => setEditing(prev => ({
                    ...prev,
                    surprise_gift: e.target.checked,
                    surprise_gift_type: e.target.checked ? prev.surprise_gift_type : '',
                    surprise_gift_item_id: e.target.checked ? prev.surprise_gift_item_id : '',
                    surprise_gift_every_orders: e.target.checked ? prev.surprise_gift_every_orders : 0,
                    surprise_gift_note: e.target.checked ? prev.surprise_gift_note : '',
                  }))}
                />
                Regalo sorpresa en pedidos seleccionados
              </label>

              {editing.surprise_gift === true && (
                <div style={{ display: 'grid', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#FFF1F2', border: '1.5px solid #FBCFE8' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Tipo de regalo</label>
                      <select
                        value={editing.surprise_gift_type || ''}
                        onChange={e => setEditing(prev => ({ ...prev, surprise_gift_type: e.target.value, surprise_gift_item_id: '' }))}
                        style={inputStyle}
                      >
                        <option value="">Selecciona</option>
                        <option value="product">Producto</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Cada cuantos pedidos</label>
                      <input
                        type="number"
                        min={1}
                        value={editing.surprise_gift_every_orders || ''}
                        onChange={e => setEditing(prev => ({ ...prev, surprise_gift_every_orders: e.target.value }))}
                        placeholder="Ej: 5"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Item del regalo</label>
                    <select
                      value={editing.surprise_gift_item_id || ''}
                      onChange={e => setEditing(prev => ({ ...prev, surprise_gift_item_id: e.target.value }))}
                      style={inputStyle}
                      disabled={!editing.surprise_gift_type}
                    >
                      <option value="">{editing.surprise_gift_type ? 'Selecciona un item' : 'Elige primero el tipo'}</option>
                      {editingGiftOptions.map(item => (
                        <option key={item.id} value={item.id}>
                          {(item.emoji || '🍓')} {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Nota operativa del regalo</label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Entregar con cuchara rosa y pegatina VIP"
                      value={editing.surprise_gift_note || ''}
                      onChange={e => setEditing(prev => ({ ...prev, surprise_gift_note: e.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ fontSize: '0.68rem', color: '#9F1239', fontWeight: 700, lineHeight: 1.5 }}>
                    El regalo se añadirá al pedido solo cuando el cliente alcance la cadencia configurada y el producto siga disponible.
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Premio de cumpleanos</label>
                <input placeholder="Ej: Mini bowl gratis en tu semana especial" value={editing.birthday_reward_text || ''} onChange={e => setEditing(prev => ({ ...prev, birthday_reward_text: e.target.value }))} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Mensaje de desbloqueo</label>
                <textarea rows={3} placeholder="Ej: Ya eres VIP del Club. Tus pedidos entran con prioridad." value={editing.unlock_message || ''} onChange={e => setEditing(prev => ({ ...prev, unlock_message: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <label style={checkboxStyle}>
                <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing(prev => ({ ...prev, active: e.target.checked }))} />
                Nivel activo
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={saveLevel} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#2D6A4F', color: 'white', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar nivel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  fontSize: '0.62rem',
  fontWeight: 900,
  color: '#6B7280',
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1.5px solid #E5E7EB',
  fontFamily: 'inherit',
  fontSize: '0.88rem',
  outline: 'none',
  boxSizing: 'border-box',
  background: 'white',
  color: '#1C3829',
}

const checkboxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  fontSize: '0.84rem',
  fontWeight: 700,
  color: '#1C3829',
}
