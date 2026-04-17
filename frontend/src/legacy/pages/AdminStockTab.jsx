// AdminStockTab.jsx — CarmoCream v2.0
// Stock con ingredientes compartidos entre múltiples productos
// Soft-delete con deleted_at (sin columna 'active')

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import styles from './Admin.module.css'
import { buildStoreBrandingSnapshot, buildUrgentPromoCopies } from '../lib/adminBranding'
import { loadMergedSettingsMap } from '../lib/storeSettings'

const euro = n => `€${Number(n||0).toFixed(2)}`
const UNITS = ['kg','g','L','ml','ud','bolsa','caja','bote']
const CATS  = ['ingrediente','packaging','bebida','otro']

async function syncProductStockAvailability(productIds = [], storeId = 'default') {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return

  const { data: stockItems } = await supabase.from('stock_items').select('id, quantity, product_id, deleted_at').eq('store_id', storeId)
  let links = []
  try {
    const { data } = await supabase.from('stock_item_products').select('stock_item_id, product_id').eq('store_id', storeId).in('product_id', ids)
    links = data || []
  } catch (_) {
    links = []
  }

  const activeItems = (stockItems || []).filter(item => !item.deleted_at)

  for (const productId of ids) {
    const linkedItemIds = new Set(
      (links || [])
        .filter(link => link.product_id === productId)
        .map(link => link.stock_item_id)
    )

    activeItems.forEach(item => {
      if (item.product_id === productId) linkedItemIds.add(item.id)
    })

    const relatedItems = activeItems.filter(item => linkedItemIds.has(item.id))
    const isOutOfStock = relatedItems.some(item => Number(item.quantity || 0) <= 0)
    await supabase.from('products').update({ available: true, out_of_stock: isOutOfStock }).eq('id', productId).eq('store_id', storeId)
  }
}
const CAT_ICON = { ingrediente:'🥛', packaging:'📦', bebida:'🧃', otro:'📝' }

function daysLeft(expiryDate) {
  if (!expiryDate) return null
  const now = new Date(); now.setHours(0,0,0,0)
  const exp = new Date(expiryDate + 'T00:00:00')
  if (Number.isNaN(exp.getTime())) return null
  return Math.round((exp - now) / 86400000)
}

function statusOf(days) {
  if (days == null) return { label:'SIN CADUCIDAD', color:'#1D4ED8', bg:'#DBEAFE', dot:'🔵', sort:5 }
  if (days < 0)   return { label:'CADUCADO',            color:'#991B1B', bg:'#FEE2E2', dot:'🔴', sort:0 }
  if (days === 0) return { label:'CADUCA HOY',           color:'#991B1B', bg:'#FEE2E2', dot:'🔴', sort:1 }
  if (days <= 2)  return { label:`${days}d — URGENTE`,   color:'#C2410C', bg:'#FED7AA', dot:'🟠', sort:2 }
  if (days <= 4)  return { label:`${days}d — PRÓXIMO`,   color:'#92400E', bg:'#FEF3C7', dot:'🟡', sort:3 }
  return                 { label:`${days} días`,          color:'#166534', bg:'#D1FAE5', dot:'🟢', sort:4 }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL AÑADIR / EDITAR — Con multi-producto
// ─────────────────────────────────────────────────────────────────────────────
function StockModal({ item, products, linkedProductIds, onClose, onSave, storeId = 'default' }) {
  const isEdit   = !!item?.id
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)

  const [form, setForm] = useState({
    name:          item?.name          || '',
    category:      item?.category      || 'ingrediente',
    quantity:      item?.quantity      || '',
    unit:          item?.unit          || 'kg',
    cost_per_unit: item?.cost_per_unit || '',
    purchase_date: item?.purchase_date || new Date().toISOString().slice(0,10),
    has_expiry_date: item?.expiry_date ? true : !item?.id,
    expiry_date:   item?.expiry_date   || tomorrow.toISOString().slice(0,10),
    alert_days:    item?.alert_days    || 2,
    notes:         item?.notes         || '',
  })
  // IDs de productos vinculados a ESTE stock_item
  const [selectedProductIds, setSelectedProductIds] = useState(linkedProductIds || [])
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const days = form.has_expiry_date ? daysLeft(form.expiry_date) : null
  const st   = statusOf(days)

  function toggleProduct(pid) {
    setSelectedProductIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    )
  }

  async function save() {
    if (!form.name.trim())  { toast.error('Nombre requerido'); return }
    if (form.has_expiry_date && !form.expiry_date)  { toast.error('Fecha de caducidad requerida'); return }
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty < 0) { toast.error('Cantidad inválida'); return }
    setSaving(true)

    const payload = {
      ...form,
      quantity:      qty,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      alert_days:    form.has_expiry_date ? (parseInt(form.alert_days) || 2) : null,
      expiry_date:   form.has_expiry_date ? form.expiry_date : null,
      // product_id: primer producto seleccionado (compatibilidad hacia atrás)
      product_id:    selectedProductIds[0] || null,
      store_id:      storeId,
      updated_at:    new Date().toISOString(),
    }
    delete payload.has_expiry_date

    let stockItemId = item?.id
    if (isEdit) {
      const { error } = await supabase.from('stock_items').update(payload).eq('id', item.id).eq('store_id', storeId)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('stock_items').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      stockItemId = data.id
    }

    // Sincronizar relaciones many-to-many en stock_item_products (si la tabla existe)
    try {
      await supabase.from('stock_item_products').delete().eq('stock_item_id', stockItemId).eq('store_id', storeId)
      if (selectedProductIds.length > 0) {
        await supabase.from('stock_item_products').insert(
          selectedProductIds.map(pid => ({ stock_item_id: stockItemId, product_id: pid, store_id: storeId }))
        )
      }
    } catch (_) {
      // La tabla stock_item_products puede no existir aún — ignorar silenciosamente
    }

    // ── Auto-gestión de visibilidad en tienda según cantidad ──
    const affectedProductIds = [...new Set([...(linkedProductIds || []), ...selectedProductIds])]
    if (affectedProductIds.length > 0) {
      const prevQty = item?.quantity ?? null
      const newQty  = qty

      // Si la cantidad es 0 → marcarlos como agotados en tienda
      if (newQty === 0) {
        await syncProductStockAvailability(affectedProductIds, storeId)
        const names = products.filter(p => affectedProductIds.includes(p.id)).map(p => p.name)
        toast(`⚠️ Cantidad 0: ${names.join(', ')} marcado${names.length !== 1 ? 's' : ''} como agotado${names.length !== 1 ? 's' : ''} en tienda`, {
          duration: 7000,
          style: { background: '#FEE2E2', color: '#991B1B', fontWeight: 700 }
        })
      }
      // Si se repone desde 0 → volver a marcar disponibles
      else if (prevQty === 0 && newQty > 0) {
        await syncProductStockAvailability(affectedProductIds, storeId)
        const names = products.filter(p => affectedProductIds.includes(p.id)).map(p => p.name)
        toast.success(`✅ Stock repuesto: ${names.join(', ')} disponible${names.length !== 1 ? 's' : ''} de nuevo`, {
          duration: 5000
        })
      }
    }

    setSaving(false)
    toast.success(isEdit ? 'Stock actualizado ✓' : 'Artículo añadido ✓')
    onSave()
    onClose()
  }

  const inp = { width:'100%', padding:'9px 12px', border:'2px solid #E5E7EB', borderRadius:9, fontFamily:'inherit', boxSizing:'border-box', fontSize:'.88rem' }
  const lbl = t => <label style={{ fontSize:'.75rem', fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>{t}</label>

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white',borderRadius:20,padding:24,maxWidth:500,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,.25)',maxHeight:'92vh',overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <h3 style={{ fontWeight:900,margin:0,fontSize:'1.05rem' }}>
            {isEdit ? '✏️ Editar stock' : '➕ Añadir al stock'}
          </h3>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'#9CA3AF' }}>✕</button>
        </div>

        {/* Campos básicos */}
        <div className={styles.adminFieldGrid}>
          <div style={{ gridColumn:'1/-1' }}>
            {lbl('Nombre del artículo *')}
            <input value={form.name} onChange={set('name')} placeholder="ej: Fresas frescas" style={inp} autoFocus />
          </div>
          <div>
            {lbl('Categoría')}
            <select value={form.category} onChange={set('category')} style={inp}>
              {CATS.map(c => <option key={c} value={c}>{CAT_ICON[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            {lbl('Control de caducidad')}
            <label style={{ ...inp, display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:'#F9FAFB' }}>
              <input
                type="checkbox"
                checked={form.has_expiry_date}
                onChange={e => setForm(f => ({
                  ...f,
                  has_expiry_date: e.target.checked,
                  expiry_date: e.target.checked ? (f.expiry_date || tomorrow.toISOString().slice(0,10)) : '',
                }))}
              />
              <span style={{ fontSize:'.82rem', fontWeight:700, color:'#374151' }}>
                {form.has_expiry_date ? 'Este articulo si caduca' : 'Este articulo no tiene fecha de vencimiento'}
              </span>
            </label>
          </div>
          <div>
            {lbl('Cantidad *')}
            <input type="number" step="0.01" min="0" value={form.quantity} onChange={set('quantity')} placeholder="0" style={inp} />
          </div>
          <div>
            {lbl('Unidad')}
            <select value={form.unit} onChange={set('unit')} style={inp}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            {lbl('Coste por unidad (€)')}
            <input type="number" step="0.01" min="0" value={form.cost_per_unit} onChange={set('cost_per_unit')} placeholder="0.00" style={inp} />
          </div>
          <div>
            {lbl('Fecha de compra')}
            <input type="date" value={form.purchase_date} onChange={set('purchase_date')} style={inp} />
          </div>
          {form.has_expiry_date ? (
            <>
              <div>
                {lbl('Alerta (días antes caducidad)')}
                <input type="number" min="0" max="14" value={form.alert_days} onChange={set('alert_days')} style={inp} />
              </div>
              <div>
                {lbl('Fecha de caducidad *')}
                <input type="date" value={form.expiry_date} onChange={set('expiry_date')} style={inp} />
              </div>
            </>
          ) : (
            <div style={{ gridColumn:'span 2', background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:10, padding:'10px 12px', fontSize:'.78rem', color:'#1D4ED8', fontWeight:700 }}>
              Este articulo quedara marcado como sin caducidad. El sistema seguira usandolo para stock, disponibilidad y control de coste.
            </div>
          )}
          <div style={{ gridColumn:'1/-1' }}>
            {lbl('Notas')}
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Compra, proveedor, incidencia o detalle útil para caja y reposición"
              className={styles.textarea}
              style={{ ...inp, minHeight: 92, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* ── Productos vinculados — MULTI-SELECCIÓN ── */}
        <div style={{ marginTop:14, background:'#F0FDF4', borderRadius:12, padding:'12px 14px', border:'1.5px solid #A7F3D0' }}>
          <div style={{ fontWeight:800, fontSize:'.8rem', color:'#166534', marginBottom:8 }}>
            🔗 Productos vinculados a este stock
            <span style={{ fontWeight:500, fontSize:'.72rem', marginLeft:6, color:'#6B7280' }}>
              — varios productos pueden compartir el mismo stock
            </span>
          </div>
          {products.length === 0 ? (
            <p style={{ fontSize:'.75rem', color:'#9CA3AF', margin:0 }}>Sin productos disponibles</p>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {products.map(p => {
                const sel = selectedProductIds.includes(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                    style={{
                      padding:'5px 12px', borderRadius:20, fontSize:'.75rem', fontWeight:700,
                      cursor:'pointer', border:'1.5px solid', transition:'all .15s',
                      background:   sel ? '#1C3829' : 'white',
                      color:        sel ? 'white'   : '#374151',
                      borderColor:  sel ? '#1C3829' : '#D1D5DB',
                      boxShadow:    sel ? '0 2px 8px rgba(28,56,41,.2)' : 'none',
                    }}>
                    {sel && <span style={{ marginRight:4, fontSize:'.65rem' }}>✓</span>}
                    {p.name}
                  </button>
                )
              })}
            </div>
          )}
          {selectedProductIds.length > 0 && (
            <p style={{ margin:'8px 0 0', fontSize:'.7rem', color:'#166534', fontWeight:700 }}>
              {selectedProductIds.length} producto{selectedProductIds.length !== 1 ? 's' : ''} vinculado{selectedProductIds.length !== 1 ? 's' : ''}
              {selectedProductIds.length > 1 && ' — ingrediente compartido'}
            </p>
          )}
        </div>

        {/* Preview estado */}
        {form.has_expiry_date && form.expiry_date ? (
          <div style={{ marginTop:12, background:st.bg, borderRadius:10, padding:'10px 14px', fontSize:'.82rem', color:st.color, fontWeight:700 }}>
            {st.dot} Estado: <strong>{st.label}</strong>
            {days <= 4 && days >= 0 && (
              <span style={{ marginLeft:8, fontWeight:400 }}>— Considera una promoción para no perder este stock.</span>
            )}
          </div>
        ) : (
          <div style={{ marginTop:12, background:'#EFF6FF', borderRadius:10, padding:'10px 14px', fontSize:'.82rem', color:'#1D4ED8', fontWeight:700 }}>
            🔵 Estado: <strong>Sin caducidad</strong> — se controlara por cantidad y coste, no por fecha.
          </div>
        )}

        {/* Acciones */}
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'10px', border:'2px solid #E5E7EB', background:'white', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex:2, padding:'10px', background:'#1C3829', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontWeight:900 }}>
            {saving ? 'Guardando…' : isEdit ? '💾 Actualizar' : '➕ Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL REPOSICIÓN RÁPIDA
// ─────────────────────────────────────────────────────────────────────────────
function RestockModal({ item, onClose, onSet }) {
  const [qty, setQty] = useState(String(item.quantity || ''))
  const [saving, setSaving] = useState(false)
  const inp = { width:'100%', padding:'14px 16px', border:'2px solid #E5E7EB', borderRadius:12,
    fontFamily:'inherit', fontSize:'1.4rem', fontWeight:900, textAlign:'center',
    color:'#1C3829', outline:'none', boxSizing:'border-box' }

  async function confirm() {
    setSaving(true)
    await onSet(item.id, qty)
    setSaving(false)
  }

  const presets = item.unit === 'kg' || item.unit === 'L'
    ? [0.5, 1, 2, 5, 10, 20]
    : item.unit === 'ud' || item.unit === 'bolsa' || item.unit === 'caja' || item.unit === 'bote'
    ? [1, 5, 10, 20, 50, 100]
    : [0.25, 0.5, 1, 2, 5, 10]

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:3000,display:'flex',
      alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white',borderRadius:24,padding:26,maxWidth:360,width:'100%',
        boxShadow:'0 24px 72px rgba(0,0,0,.28)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div>
            <div style={{ fontWeight:900,fontSize:'1rem',color:'#1C3829' }}>🔄 Reponer stock</div>
            <div style={{ fontSize:'.78rem',color:'#6B7280',marginTop:3 }}>{item.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.3rem',cursor:'pointer',color:'#9CA3AF' }}>✕</button>
        </div>

        {/* Input cantidad */}
        <div style={{ position:'relative',marginBottom:14 }}>
          <input
            type="number" step="0.01" min="0"
            value={qty} onChange={e => setQty(e.target.value)}
            onFocus={e => e.target.select()}
            style={inp} autoFocus
            onKeyDown={e => e.key === 'Enter' && confirm()}
          />
          <span style={{ position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',
            fontSize:'.85rem',fontWeight:800,color:'#9CA3AF' }}>{item.unit}</span>
        </div>

        {/* Presets rápidos */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:7,marginBottom:18 }}>
          {presets.map(v => (
            <button key={v} onClick={() => setQty(String(v))}
              style={{ padding:'6px 13px',borderRadius:20,border:`2px solid ${String(qty)===String(v)?'#1C3829':'#E5E7EB'}`,
                background:String(qty)===String(v)?'#1C3829':'white',
                color:String(qty)===String(v)?'white':'#374151',
                fontWeight:800,fontSize:'.8rem',cursor:'pointer',fontFamily:'inherit' }}>
              {v} {item.unit}
            </button>
          ))}
        </div>

        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:'12px',border:'2px solid #E5E7EB',
            background:'white',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontWeight:700 }}>
            Cancelar
          </button>
          <button onClick={confirm} disabled={saving} style={{ flex:2,padding:'12px',
            background:saving?'#9CA3AF':'#1C3829',color:'white',border:'none',borderRadius:12,
            cursor:'pointer',fontFamily:'inherit',fontWeight:900,fontSize:'.95rem' }}>
            {saving ? '…' : `✅ Confirmar ${qty || 0} ${item.unit}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL PROMOCIÓN URGENTE
// ─────────────────────────────────────────────────────────────────────────────
function PromoModal({ item, onClose, brand }) {
  const days = daysLeft(item.expiry_date)
  const copies = buildUrgentPromoCopies(item, brand)
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white',borderRadius:20,padding:24,maxWidth:440,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h3 style={{ margin:0,fontWeight:900,fontSize:'1rem' }}>📣 Promoción de urgencia</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'#9CA3AF' }}>✕</button>
        </div>
        <div style={{ background:'#FEE2E2',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'.82rem',color:'#991B1B',fontWeight:700 }}>
          ⚠️ <strong>{item.name}</strong> — {days <= 0 ? 'CADUCADO/HOY' : `caduca en ${days} día${days !== 1 ? 's' : ''}`}. ¡Hay que moverlo!
        </div>
        <p style={{ fontSize:'.78rem',color:'#6B7280',marginBottom:10 }}>Elige un copy y publ�calo en el canal comercial que use esta tienda:</p>
        {copies.map((c, i) => (
          <div key={i} style={{ background:'#F9FAFB',borderRadius:10,padding:'11px 13px',marginBottom:10,fontSize:'.83rem',lineHeight:1.55,color:'#374151',position:'relative' }}>
            {c}
            <button onClick={() => { navigator.clipboard.writeText(c); toast.success('Copiado 📋') }}
              style={{ position:'absolute',top:8,right:8,background:'#1C3829',color:'white',border:'none',borderRadius:6,padding:'3px 9px',fontSize:'.68rem',fontWeight:800,cursor:'pointer' }}>
              Copiar
            </button>
          </div>
        ))}
        <button onClick={onClose}
          style={{ width:'100%',padding:'10px',background:'#1C3829',color:'white',border:'none',borderRadius:12,fontWeight:900,cursor:'pointer',fontFamily:'inherit',marginTop:6 }}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminStockTab({ storeId = 'default' }) {
  const [items,            setItems]            = useState([])
  const [products,         setProducts]         = useState([])
  const [itemProductLinks, setItemProductLinks] = useState({})
  const [loading,          setLoading]          = useState(true)
  const [modal,            setModal]            = useState(null)
  const [promoItem,        setPromoItem]        = useState(null)
  const [filter,           setFilter]           = useState('all')
  // inline qty editing: { id, value }
  const [editingQty,       setEditingQty]       = useState(null)
  // restock quick modal
  const [restockItem,      setRestockItem]      = useState(null)
  const [brand,            setBrand]            = useState(() => buildStoreBrandingSnapshot({}, null, storeId))

  // ── Carga de datos ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stockRes, prodsRes, settingsMap] = await Promise.all([
        supabase.from('stock_items').select('*').eq('store_id', storeId).order('expiry_date'),
        supabase.from('products').select('id,name').eq('store_id', storeId).order('name'),
        loadMergedSettingsMap(storeId, supabase).catch(() => ({})),
      ])
      setBrand(buildStoreBrandingSnapshot(settingsMap, null, storeId))

      // Soft-delete: excluir items con deleted_at
      if (stockRes.data) {
        setItems(stockRes.data.filter(i => !i.deleted_at))
      }
      if (prodsRes.data) setProducts(prodsRes.data)

      // Cargar relaciones many-to-many (tabla stock_item_products)
      try {
        const { data: links } = await supabase
          .from('stock_item_products')
          .select('stock_item_id, product_id')
          .eq('store_id', storeId)

        if (links) {
          const map = {}
          for (const l of links) {
            if (!map[l.stock_item_id]) map[l.stock_item_id] = []
            map[l.stock_item_id].push(l.product_id)
          }
          setItemProductLinks(map)
        }
      } catch (_) {
        // Tabla aún no existe — construir mapa desde product_id simple
        const map = {}
        if (stockRes.data) {
          for (const i of stockRes.data) {
            if (i.product_id) map[i.id] = [i.product_id]
          }
        }
        setItemProductLinks(map)
      }

    } catch (e) {
      console.error('[Stock] Error cargando:', e.message)
      // Intentar cargar solo productos como fallback
      const { data: prods } = await supabase.from('products').select('id,name').eq('store_id', storeId).order('name')
      if (prods) setProducts(prods)
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  // ── Real-time: actualizar stock cuando cambia en Supabase ─────────────────
  useEffect(() => {
    const channel = supabase
      .channel('stock-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items', filter: `store_id=eq.${storeId}` }, () => {
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_item_products', filter: `store_id=eq.${storeId}` }, () => {
        load()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  // ── Acciones ──────────────────────────────────────────────────────────────
  async function deleteItem(id) {
    if (!confirm('¿Eliminar este artículo del stock?')) return

    // Antes de eliminar: dejar productos vinculados disponibles si estaban agotados por este stock
    const item = items.find(i => i.id === id)
    const linkedIds = item ? (itemProductLinks[id] || (item.product_id ? [item.product_id] : [])) : []

    const { error } = await supabase.from('stock_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', storeId)
    // Fallback: borrado físico si deleted_at no existe en la tabla
    if (error) await supabase.from('stock_items').delete().eq('id', id).eq('store_id', storeId)
    // Limpiar relaciones many-to-many
    try { await supabase.from('stock_item_products').delete().eq('stock_item_id', id).eq('store_id', storeId) } catch (_) {}
    await syncProductStockAvailability(linkedIds, storeId)
    toast.success('Eliminado')
    load()
  }

  // ── Establecer cantidad exacta (inline edit o restock modal) ─────────────
  async function setQtyDirect(id, newQtyRaw) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newQty = Math.max(0, parseFloat(String(newQtyRaw).replace(',', '.')) || 0)
    const prevQty = Number(item.quantity)

    await supabase.from('stock_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', storeId)

    const linkedIds = itemProductLinks[id] || (item.product_id ? [item.product_id] : [])

    if (newQty === 0 && prevQty > 0 && linkedIds.length > 0) {
      await syncProductStockAvailability(linkedIds, storeId)
      const names = products.filter(p => linkedIds.includes(p.id)).map(p => p.name).join(', ')
      toast(`⚠️ Sin stock · Marcado como agotado: ${names}`, {
        duration: 7000, style: { background:'#FEE2E2', color:'#991B1B', fontWeight:700 }
      })
    } else if (newQty > 0 && prevQty === 0 && linkedIds.length > 0) {
      await syncProductStockAvailability(linkedIds, storeId)
      const names = products.filter(p => linkedIds.includes(p.id)).map(p => p.name).join(', ')
      toast.success(`✅ Repuesto · Disponible otra vez: ${names}`, { duration: 5000 })
    }

    setEditingQty(null)
    setRestockItem(null)
    load()
  }

  async function updateQty(id, delta) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newQty = Math.max(0, Number(item.quantity) + delta)

    await supabase.from('stock_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', storeId)

    // ── Marcar como agotados cuando el stock llega a 0 ──
    if (newQty === 0) {
      const linkedIds = itemProductLinks[id] || (item.product_id ? [item.product_id] : [])
      if (linkedIds.length > 0) {
        await syncProductStockAvailability(linkedIds, storeId)
        const linkedNames = products.filter(p => linkedIds.includes(p.id)).map(p => p.name).join(', ')
        toast(`⚠️ Sin stock: "${item.name}" · Marcado como agotado en tienda: ${linkedNames}`, {
          duration: 8000,
          style: { background: '#FEE2E2', color: '#991B1B', fontWeight: 700 }
        })
      }
    }

    // ── Quitar estado agotado cuando se repone stock (de 0 a >0) ──
    if (newQty > 0 && Number(item.quantity) === 0) {
      const linkedIds = itemProductLinks[id] || (item.product_id ? [item.product_id] : [])
      if (linkedIds.length > 0) {
        await syncProductStockAvailability(linkedIds, storeId)
        const linkedNames = products.filter(p => linkedIds.includes(p.id)).map(p => p.name).join(', ')
        toast.success(`✅ Stock repuesto: "${item.name}" · Disponible de nuevo en tienda: ${linkedNames}`, {
          duration: 6000
        })
      }
    }

    load()
  }

  // ── Derivaciones ─────────────────────────────────────────────────────────
  const enriched = useMemo(() => items.map(item => {
    const d = daysLeft(item.expiry_date)
    // Obtener todos los productos vinculados (multi o simple)
    const linkedIds   = itemProductLinks[item.id] || (item.product_id ? [item.product_id] : [])
    const linkedProds = products.filter(p => linkedIds.includes(p.id))
    return {
      ...item,
      days:        d,
      status:      statusOf(d),
      linkedProds, // array de productos vinculados
    }
  }).sort((a, b) => {
    const dayA = a.days == null ? Number.POSITIVE_INFINITY : a.days
    const dayB = b.days == null ? Number.POSITIVE_INFINITY : b.days
    return a.status.sort - b.status.sort || dayA - dayB
  }), [items, products, itemProductLinks])

  const urgent  = enriched.filter(i => i.days != null && i.days <= parseInt(i.alert_days || 2, 10))
  const expired = enriched.filter(i => i.days < 0)
  const noExpiry = enriched.filter(i => i.days == null)
  const inventoryValue = enriched.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost_per_unit || 0)), 0)

  const filtered = useMemo(() => {
    if (filter === 'urgent')  return enriched.filter(i => i.days != null && i.days >= 0 && i.days <= i.alert_days)
    if (filter === 'expired') return enriched.filter(i => i.days < 0)
    if (filter === 'ok')      return enriched.filter(i => i.days == null || i.days > i.alert_days)
    if (filter === 'noexpiry') return noExpiry
    return enriched
  }, [enriched, filter, noExpiry])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding:60, textAlign:'center', color:'#9CA3AF' }}>📦 Cargando stock…</div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'16px 0', fontFamily:'inherit' }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10 }}>
        <div>
          <h2 style={{ margin:0,fontSize:'1.15rem',fontWeight:900,color:'#1C3829' }}>📦 Gestión de Stock</h2>
          <p style={{ margin:'2px 0 0',fontSize:'.76rem',color:'#6B7280' }}>
            Cantidad real, coste, caducidad opcional y vínculo a productos en una sola vista.
          </p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={load}
            style={{ padding:'7px 10px',background:'#F3F4F6',border:'none',borderRadius:10,cursor:'pointer',fontSize:'.9rem' }}
            title="Recargar">🔄
          </button>
          <button onClick={() => setModal('add')}
            style={{ padding:'8px 16px',background:'#1C3829',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontWeight:900,fontSize:'.85rem',fontFamily:'inherit' }}>
            ➕ Añadir al stock
          </button>
        </div>
      </div>

      {/* ── ALERTAS URGENTES ── */}
      {urgent.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,#FFF7ED,#FEE2E2)',border:'2px solid #FCA5A5',borderRadius:14,padding:'14px 18px',marginBottom:14 }}>
          <div style={{ fontWeight:900,color:'#991B1B',fontSize:'.88rem',marginBottom:8 }}>
            🚨{expired.length > 0 && ` ${expired.length} artículo${expired.length !== 1 ? 's' : ''} CADUCADO${expired.length !== 1 ? 'S' : ''} ·`}
            {' '}{urgent.filter(i => i.days >= 0).length} próximo{urgent.filter(i => i.days >= 0).length !== 1 ? 's' : ''} a caducar
          </div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
            {urgent.map(item => (
              <div key={item.id}
                style={{ background:'white',borderRadius:10,padding:'8px 12px',display:'flex',alignItems:'center',gap:10,border:`1.5px solid ${item.status.color}40` }}>
                <span style={{ fontSize:'1.1rem' }}>{item.status.dot}</span>
                <div>
                  <div style={{ fontWeight:800,fontSize:'.82rem',color:'#1C3829' }}>{item.name}</div>
                  <div style={{ fontSize:'.72rem',color:item.status.color,fontWeight:700 }}>
                    {item.status.label} · {item.quantity} {item.unit}
                    {item.linkedProds.length > 0 && (
                      <span style={{ color:'#6B7280',fontWeight:600 }}>
                        {' '}· {item.linkedProds.map(p => p.name).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setPromoItem(item)}
                  style={{ background:'#DC2626',color:'white',border:'none',borderRadius:7,padding:'4px 10px',fontSize:'.72rem',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>
                  📣 Promo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:14 }}>
        {[
          { label:'Total artículos',   value: enriched.length,                                      bg:'#F9FAFB', color:'#374151' },
          { label:'💶 Valor stock',    value: euro(inventoryValue),                                  bg:'#EDE9FE', color:'#7C3AED' },
          { label:'🟡 Próximos',       value: urgent.filter(i => i.days >= 0).length,               bg:'#FEF3C7', color:'#92400E' },
          { label:'🔴 Caducados',      value: expired.length,                                        bg:'#FEE2E2', color:'#991B1B' },
          { label:'🔵 Sin caducidad',  value: noExpiry.length,                                       bg:'#DBEAFE', color:'#1D4ED8' },
        ].map(k => (
          <div key={k.label} style={{ background:k.bg,borderRadius:12,padding:'12px 14px',border:'1px solid rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:'.68rem',fontWeight:900,textTransform:'uppercase',letterSpacing:'.07em',color:k.color,opacity:.6,marginBottom:3 }}>{k.label}</div>
            <div style={{ fontSize:typeof k.value === 'string' && k.value.includes('€') ? '1.35rem' : '1.7rem',fontWeight:900,color:k.color,lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display:'flex',gap:6,marginBottom:12,flexWrap:'wrap' }}>
        {[
          ['all',     '📋 Todos',         enriched.length],
          ['urgent',  '🟡 Próximos',      urgent.filter(i => i.days >= 0).length],
          ['expired', '🔴 Caducados',     expired.length],
          ['noexpiry','🔵 Sin caducidad', noExpiry.length],
          ['ok',      '🟢 En control',    enriched.filter(i => i.days == null || i.days > i.alert_days).length],
        ].map(([k, l, c]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit',
            background: filter === k ? '#1C3829' : '#F3F4F6',
            color:      filter === k ? 'white'   : '#374151',
            fontWeight:800, fontSize:'.8rem', display:'flex', alignItems:'center', gap:5,
          }}>
            {l}
            <span style={{
              background: filter === k ? 'rgba(255,255,255,.25)' : '#E5E7EB',
              color:      filter === k ? 'white' : '#6B7280',
              borderRadius:20, padding:'0 6px', fontSize:'.7rem', fontWeight:900,
            }}>{c}</span>
          </button>
        ))}
      </div>

      {/* ── TABLA DE STOCK ── */}
      <div style={{ background:'white',border:'1px solid #E5E7EB',borderRadius:16,overflow:'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:48,textAlign:'center',color:'#9CA3AF' }}>
            <div style={{ fontSize:40,marginBottom:10 }}>📦</div>
            <div style={{ fontWeight:700,marginBottom:6 }}>Sin artículos en esta categoría</div>
            <button onClick={() => setModal('add')}
              style={{ padding:'8px 20px',background:'#1C3829',color:'white',border:'none',borderRadius:10,fontWeight:900,cursor:'pointer',fontFamily:'inherit' }}>
              ➕ Añadir primer artículo
            </button>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'.83rem' }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['Estado','Artículo','Stock y coste','Productos vinculados','Acciones'].map(h => (
                    <th key={h} style={{ padding:'9px 12px',textAlign:'left',fontSize:'.68rem',fontWeight:900,textTransform:'uppercase',letterSpacing:'.06em',color:'#9CA3AF',whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const inventoryAmount = Number(item.quantity || 0) * Number(item.cost_per_unit || 0)
                  const purchaseLabel = item.purchase_date
                    ? new Date(item.purchase_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
                    : 'Sin compra'
                  const expiryLabel = item.expiry_date
                    ? new Date(item.expiry_date + 'T00:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
                    : 'Sin caducidad'
                  return (
                  <tr key={item.id} style={{
                    borderBottom:'1px solid #F3F4F6',
                    background: item.days != null && item.days < 0 ? '#FFF5F5' : item.days != null && item.days <= item.alert_days ? '#FFFBEB' : 'white',
                  }}>

                    {/* Estado */}
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{
                        background:item.status.bg, color:item.status.color,
                        fontWeight:800, fontSize:'.75rem', borderRadius:8,
                        padding:'3px 10px', whiteSpace:'nowrap',
                      }}>
                        {item.status.dot} {item.status.label}
                      </span>
                    </td>

                    {/* Nombre */}
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:700,color:'#1C3829' }}>{item.name}</div>
                      <div style={{ fontSize:'.7rem',color:'#9CA3AF' }}>{CAT_ICON[item.category]} {item.category}</div>
                      {item.notes && <div style={{ fontSize:'.68rem',color:'#9CA3AF',marginTop:1,fontStyle:'italic' }}>{item.notes}</div>}
                    </td>

                    {/* Cantidad y coste */}
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                        <button onClick={() => updateQty(item.id, -1)}
                          style={{ width:26,height:26,borderRadius:7,border:'1.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0 }}>−</button>
                        <span style={{ fontWeight:800,minWidth:52,textAlign:'center',fontSize:'.85rem' }}>{item.quantity} {item.unit}</span>
                        <button onClick={() => updateQty(item.id, 1)}
                          style={{ width:26,height:26,borderRadius:7,border:'1.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0 }}>+</button>
                      </div>
                      <button onClick={() => setRestockItem(item)}
                        style={{ marginTop:5,padding:'3px 10px',background:'#EFF6FF',color:'#1D4ED8',border:'1.5px solid #BFDBFE',borderRadius:7,fontSize:'.68rem',fontWeight:800,cursor:'pointer',fontFamily:'inherit',width:'100%' }}
                        title="Establecer cantidad exacta">
                        🔄 Reponer
                      </button>
                      {Number(item.quantity) === 0 && (
                        <div style={{ fontSize:'.67rem',color:'#991B1B',fontWeight:700,marginTop:3 }}>⚠️ Sin stock</div>
                      )}
                      <div style={{ marginTop:6, display:'grid', gap:3 }}>
                        <div style={{ fontSize:'.68rem', color:'#6B7280' }}>
                          Compra: <strong style={{ color:'#374151' }}>{purchaseLabel}</strong>
                        </div>
                        <div style={{ fontSize:'.68rem', color:item.status.color, fontWeight:700 }}>
                          Control: {expiryLabel}
                        </div>
                        <div style={{ fontSize:'.68rem', color:'#6B7280' }}>
                          Coste unitario: <strong style={{ color:'#374151' }}>{item.cost_per_unit > 0 ? `${euro(item.cost_per_unit)}/${item.unit}` : 'Sin coste'}</strong>
                        </div>
                        <div style={{ fontSize:'.72rem', color:'#7C3AED', fontWeight:800 }}>
                          Valor actual: {inventoryAmount > 0 ? euro(inventoryAmount) : '—'}
                        </div>
                      </div>
                    </td>

                    {/* Productos vinculados — MULTI */}
                    <td style={{ padding:'10px 12px' }}>
                      {item.linkedProds.length === 0 ? (
                        <span style={{ color:'#D1D5DB',fontSize:'.75rem' }}>—</span>
                      ) : (
                        <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
                          {item.linkedProds.map(p => (
                            <span key={p.id} style={{
                              background: item.linkedProds.length > 1 ? '#DBEAFE' : '#D1FAE5',
                              color:      item.linkedProds.length > 1 ? '#1D4ED8' : '#166534',
                              fontSize:'.72rem', fontWeight:800,
                              padding:'2px 8px', borderRadius:6, whiteSpace:'nowrap',
                            }}>
                              {item.linkedProds.length > 1 ? '🔀' : '🔗'} {p.name}
                            </span>
                          ))}
                          {item.linkedProds.length > 1 && (
                            <span style={{ fontSize:'.65rem',color:'#6B7280',alignSelf:'center',fontWeight:600 }}>
                              compartido
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex',gap:5,flexWrap:'nowrap' }}>
                        {item.days != null && item.days <= item.alert_days && item.days >= 0 && (
                          <button onClick={() => setPromoItem(item)}
                            style={{ background:'#DC2626',color:'white',border:'none',borderRadius:7,padding:'4px 9px',fontSize:'.7rem',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>
                            📣
                          </button>
                        )}
                        <button onClick={() => setModal(item)}
                          style={{ background:'#F3F4F6',border:'none',borderRadius:7,padding:'4px 9px',fontSize:'.7rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                          ✏️
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          style={{ background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:7,padding:'4px 9px',fontSize:'.7rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── INFO PANEL ── */}
      <div style={{ marginTop:12,background:'#F0FDF4',borderRadius:12,padding:'12px 16px',fontSize:'.75rem',color:'#166534',lineHeight:1.7 }}>
        <strong>💡 Cómo funciona el sistema de stock:</strong>
        <ul style={{ margin:'6px 0 0',paddingLeft:16 }}>
          <li><strong>🔴 Cantidad = 0:</strong> los productos vinculados se desactivan automáticamente en la tienda al instante.</li>
          <li><strong>🟢 Reposición:</strong> cuando subes la cantidad desde 0, los productos vinculados se reactivan solos.</li>
          <li><strong>🔀 Ingrediente compartido:</strong> un artículo puede vincularse a varios productos simultáneamente (ej: las fresas para 3 recetas).</li>
          <li><strong>💶 Coste e inventario:</strong> la cantidad por coste por unidad alimenta la lectura económica del negocio.</li>
          <li><strong>🔵 Sin caducidad:</strong> si un artículo no vence, se controla por stock y coste sin forzar una fecha falsa.</li>
          <li>Los artículos eliminados se ocultan con soft-delete y no afectan al historial.</li>
        </ul>
      </div>

      {/* ── MODALES ── */}
      {modal && (
        <StockModal
          item={modal === 'add' ? null : modal}
          products={products}
          linkedProductIds={
            modal === 'add'
              ? []
              : (itemProductLinks[modal.id] || (modal.product_id ? [modal.product_id] : []))
          }
          onClose={() => setModal(null)}
          onSave={load}
          storeId={storeId}
        />
      )}
      {promoItem && (
        <PromoModal item={promoItem} brand={brand} onClose={() => setPromoItem(null)} />
      )}
      {restockItem && (
        <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onSet={setQtyDirect} />
      )}
    </div>
  )
}

