// AdminFinanceTab.jsx — Oxidian
// Sistema Semáforo Financiero v2: costes inline, ranking productos, alertas, PC-optimized

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import styles from './Admin.module.css'
import { enrichProductsFromStock } from '../lib/catalogInsights'
import { buildProductSalesMap, getEffectiveProductCost, getProductMarginSnapshot } from '../lib/adminMetrics'
import { useResponsiveAdminLayout } from '../lib/useResponsiveAdminLayout'
import { DEFAULT_STORE_ID, normalizeStoreId } from '../lib/currentStore'

// ─────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────
const MERMA          = 0.20
const MARGIN_RED     = 0.35
const MARGIN_YELLOW  = 0.50
const STATIC_DAYS    = 7   // días sin venta → producto "estático"

const COST_CATS = [
  { key:'ingredientes', icon:'🥛', label:'Ingredientes' },
  { key:'packaging',    icon:'📦', label:'Packaging'    },
  { key:'reparto',      icon:'🛵', label:'Reparto'      },
  { key:'nomina',       icon:'👤', label:'Nómina'       },
  { key:'local',        icon:'🏠', label:'Local'        },
  { key:'marketing',    icon:'📢', label:'Marketing'    },
  { key:'otro',         icon:'📝', label:'Otro'         },
]

const euro = n  => `€${Number(n||0).toFixed(2)}`
const pct  = n  => `${Number(n||0).toFixed(1)}%`
const fmt  = d  => new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'})
function today() { return new Date().toISOString().slice(0,10) }

function isMissingStoreScope(error) {
  return /column .*store_id.* does not exist|schema cache/i.test(String(error?.message || ''))
}

// ─────────────────────────────────────────────────────────────
//  SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────

function SemaforoBar({ margin }) {
  const pctVal = margin * 100
  let color, bg, label, tip
  if (margin >= MARGIN_YELLOW) {
    color='#166534'; bg='linear-gradient(135deg,#D1FAE5,#A7F3D0)'; label='RENTABLE'; tip=`Margen del ${pct(pctVal)} — ¡Negocio sano!`
  } else if (margin >= MARGIN_RED) {
    color='#92400E'; bg='linear-gradient(135deg,#FEF3C7,#FDE68A)'; label='ATENCIÓN'; tip=`Margen del ${pct(pctVal)} — Por debajo del objetivo 50%`
  } else {
    color='#991B1B'; bg='linear-gradient(135deg,#FEE2E2,#FECACA)'; label='⚠️ ALERTA'; tip=`Margen del ${pct(pctVal)} — Por debajo del mínimo 35%. Revisa costes urgente.`
  }
  const bullets = margin >= MARGIN_YELLOW ? '🟢🟢🟢' : margin >= MARGIN_RED ? '🟡🟡⚫' : '🔴⚫⚫'
  return (
    <div style={{ background:bg, borderRadius:16, padding:'16px 22px', display:'flex', alignItems:'center', gap:16, border:`1.5px solid ${color}25` }}>
      <div style={{ fontSize:28, lineHeight:1 }}>{bullets}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
          <span style={{ fontSize:'1.6rem', fontWeight:900, color, lineHeight:1 }}>{label}</span>
          <span style={{ fontSize:'1.1rem', fontWeight:700, color, opacity:.8 }}>{pct(pctVal)} margen neto</span>
        </div>
        <div style={{ fontSize:'.78rem', color, opacity:.7, marginTop:3 }}>{tip}</div>
      </div>
      {/* Mini barra visual */}
      <div style={{ width:120, flexShrink:0 }}>
        <div style={{ background:'rgba(0,0,0,.1)', borderRadius:99, height:10, overflow:'hidden' }}>
          <div style={{ width:`${Math.min(100,pctVal)}%`, background:color, height:'100%', borderRadius:99, transition:'width .8s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem', color, opacity:.6, marginTop:3 }}>
          <span>0%</span><span>35%</span><span>50%</span><span>100%</span>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, color='#1C3829', bg='#F9FAFB', accent=false }) {
  return (
    <div style={{
      background:bg, borderRadius:13, padding:'13px 16px',
      border: accent ? `2px solid ${color}30` : '1px solid #F3F4F6',
    }}>
      <div style={{ fontSize:'.68rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.07em', color, opacity:.55, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize: accent?'1.7rem':'1.25rem', fontWeight:900, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'.7rem', color, opacity:.5, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// Barra de coste categoría
function CostBar({ icon, label, amount, total, color }) {
  const { isPhone } = useResponsiveAdminLayout()
  const w = total > 0 ? Math.min(100,(amount/total)*100) : 0
  if (amount === 0) return null
  return (
    <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : '140px 1fr 80px', gap:10, alignItems:'center', marginBottom:8 }}>
      <span style={{ fontSize:'.8rem', fontWeight:700, color:'#374151' }}>{icon} {label}</span>
      <div style={{ background:'#F3F4F6', borderRadius:99, height:8, overflow:'hidden' }}>
        <div style={{ width:`${w}%`, background:color, height:'100%', borderRadius:99, transition:'width .6s' }} />
      </div>
      <span style={{ fontSize:'.8rem', fontWeight:800, color, textAlign:'right' }}>{euro(amount)} <span style={{ color:'#9CA3AF', fontWeight:500, fontSize:'.7rem' }}>({pct(w)})</span></span>
    </div>
  )
}

// ─── FILA DE PRODUCTO CON RANKING ─────────────────────────────────────────────
function ProductRow({ rank, product, salesLast7, onEditCost }) {
  const { sell, rawCost, costWithWaste: costM, margin, unitProfit: profit, costSource } = getProductMarginSnapshot(product, MERMA)
  const minPrice = rawCost > 0 ? (costM / (1 - MARGIN_RED)).toFixed(2) : null
  const isVisible = product.available !== false
  const isSellable = isVisible && !product.out_of_stock

  const hasNoCost = !rawCost
  const isStatic  = isSellable && salesLast7 === 0
  const isHighM   = margin !== null && margin >= MARGIN_YELLOW && isSellable

  let semColor, semBg
  if (margin === null)           { semColor='#6B7280'; semBg='#F3F4F6' }
  else if (margin >= MARGIN_YELLOW) { semColor='#166534'; semBg='#D1FAE5' }
  else if (margin >= MARGIN_RED)    { semColor='#92400E'; semBg='#FEF3C7' }
  else                              { semColor='#991B1B'; semBg='#FEE2E2' }

  const rankColors = ['#C8A000','#9CA3AF','#B45309']
  const rankEmoji  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  return (
    <tr style={{ borderBottom:'1px solid #F3F4F6', background: rank<=3 ? '#FAFFF7' : 'white' }}>
      {/* Rank */}
      <td style={{ padding:'9px 10px', textAlign:'center', fontSize:'.85rem', fontWeight:900, color: rankColors[rank-1]||'#9CA3AF' }}>
        {rankEmoji}
      </td>
      {/* Nombre + badges */}
      <td style={{ padding:'9px 10px' }}>
        <div style={{ fontWeight:700, fontSize:'.85rem', color:'#1C3829' }}>{product.name}</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:3 }}>
          {!isVisible && <span style={{ background:'#FEE2E2', color:'#991B1B', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>INACTIVO</span>}
          {product.out_of_stock && <span style={{ background:'#FFF4ED', color:'#C05621', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>AGOTADO</span>}
          {isStatic && <span style={{ background:'#FEF3C7', color:'#92400E', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>⚠️ SIN VENTAS 7d</span>}
          {isHighM  && <span style={{ background:'#D1FAE5', color:'#166534', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>📣 PROMOCIONAR</span>}
          {hasNoCost && <span style={{ background:'#F3F4F6', color:'#6B7280', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>Sin coste</span>}
          {!hasNoCost && costSource === 'stock' && <span style={{ background:'#DBEAFE', color:'#1D4ED8', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:4 }}>Coste stock</span>}
        </div>
      </td>
      {/* PVP */}
      <td style={{ padding:'9px 10px', fontWeight:800, color:'#166534', fontSize:'.88rem' }}>{euro(sell)}</td>
      {/* Coste + editar */}
      <td style={{ padding:'9px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:'.83rem', color: hasNoCost?'#D1D5DB':'#374151' }}>
            {hasNoCost ? '—' : euro(rawCost)}
          </span>
          <button onClick={() => onEditCost(product)} style={{
            background:'none', border:'1px solid #E5E7EB', borderRadius:6,
            padding:'2px 7px', cursor:'pointer', fontSize:'.7rem', color:'#6B7280', lineHeight:1.4,
          }}>✏️</button>
        </div>
        {!hasNoCost && <div style={{ fontSize:'.7rem', color:'#9CA3AF', marginTop:1 }}>+merma: {euro(costM)} {costSource === 'stock' ? '· stock' : '· manual'}</div>}
      </td>
      {/* Ganancia unitaria */}
      <td style={{ padding:'9px 10px', fontWeight:800, fontSize:'.85rem', color: profit>=0?'#166534':'#991B1B' }}>
        {profit !== null ? euro(profit) : '—'}
      </td>
      {/* Margen % */}
      <td style={{ padding:'9px 10px' }}>
        <span style={{ background:semBg, color:semColor, fontWeight:900, fontSize:'.82rem', borderRadius:8, padding:'3px 10px', whiteSpace:'nowrap' }}>
          {margin !== null ? pct(margin*100) : '—'}
        </span>
      </td>
      {/* Precio mínimo recomendado */}
      <td style={{ padding:'9px 10px', fontSize:'.78rem', color:'#6B7280' }}>
        {minPrice ? <span title="PVP mínimo para 35% de margen">≥ €{minPrice}</span> : '—'}
      </td>
      {/* Ventas 7d */}
      <td style={{ padding:'9px 10px', textAlign:'center', fontSize:'.83rem', color: salesLast7>0?'#166534':'#9CA3AF', fontWeight: salesLast7>0?700:400 }}>
        {salesLast7 > 0 ? salesLast7 : '—'}
      </td>
    </tr>
  )
}

// ─── MODAL EDITAR COSTE ────────────────────────────────────────────────────────
function CostModal({ product, storeId, onClose, onSave }) {
  const { isPhone } = useResponsiveAdminLayout()
  const [cost, setCost] = useState(String(product.cost_production || ''))
  const [saving, setSaving] = useState(false)
  const sell    = Number(product.price || 0)
  const costM   = parseFloat(cost||0) * (1 + MERMA)
  const margin  = sell > 0 ? ((sell - costM) / sell) * 100 : 0
  const minPVP  = parseFloat(cost||0) > 0 ? (costM / (1 - MARGIN_RED)).toFixed(2) : null

  async function save() {
    const val = parseFloat(cost)
    if (isNaN(val) || val < 0) { toast.error('Coste inválido'); return }
    setSaving(true)
    const { error } = await supabase.from('products').update({ cost_production: val }).eq('id', product.id).eq('store_id', storeId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Coste actualizado ✓`)
    onSave(); onClose()
  }

  const mColor = margin>=50?'#166534':margin>=35?'#92400E':'#991B1B'
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white',borderRadius:20,padding:28,maxWidth:400,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h3 style={{ fontWeight:900,margin:0,fontSize:'1.1rem' }}>✏️ Coste de producción</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'#9CA3AF' }}>✕</button>
        </div>
        <div style={{ background:'#F9FAFB',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'.82rem',display:'flex',justifyContent:'space-between' }}>
          <span style={{ color:'#6B7280' }}>Producto</span>
          <strong>{product.name}</strong>
        </div>
        <div style={{ background:'#F9FAFB',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'.82rem',display:'flex',justifyContent:'space-between' }}>
          <span style={{ color:'#6B7280' }}>PVP actual</span>
          <strong style={{ color:'#166534' }}>{euro(product.price)}</strong>
        </div>
        <label style={{ fontSize:'.82rem',fontWeight:700,display:'block',marginBottom:6,color:'#374151' }}>Coste real por unidad (€)</label>
        <input type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)}
          autoFocus
          style={{ width:'100%',padding:'11px 14px',border:'2px solid #E5E7EB',borderRadius:10,fontSize:'1rem',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16 }}
          placeholder="ej: 2.50" onKeyDown={e=>e.key==='Enter'&&save()} />
        {parseFloat(cost||0) > 0 && (
          <div style={{ background:'#F0FDF4',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:'.82rem',display:'grid',gridTemplateColumns:isPhone ? '1fr' : '1fr 1fr',gap:'6px 12px' }}>
            <span style={{ color:'#6B7280' }}>Coste con merma (20%)</span><strong>{euro(costM)}</strong>
            <span style={{ color:'#6B7280' }}>Ganancia unitaria</span><strong style={{ color:mColor }}>{euro(Number(product.price||0) - costM)}</strong>
            <span style={{ color:'#6B7280' }}>Margen estimado</span><strong style={{ color:mColor }}>{pct(margin)}</strong>
            {minPVP && <><span style={{ color:'#6B7280' }}>PVP mínimo (35%)</span><strong>€{minPVP}</strong></>}
          </div>
        )}
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:'10px',border:'2px solid #E5E7EB',background:'white',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:700 }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ flex:2,padding:'10px',background:'#1C3829',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:900 }}>
            {saving?'Guardando…':'💾 Guardar coste'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL REGISTRAR GASTO RÁPIDO ─────────────────────────────────────────────
function QuickExpenseModal({ storeId, onClose, onSave }) {
  const { isPhone } = useResponsiveAdminLayout()
  const [form, setForm] = useState({ concept:'', amount:'', category:'ingredientes', notes:'' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  async function save() {
    if (!form.concept.trim()) { toast.error('Concepto requerido'); return }
    const val = parseFloat(form.amount)
    if (isNaN(val)||val<=0) { toast.error('Importe inválido'); return }
    setSaving(true)
    const { error } = await supabase.from('cash_entries').insert({
      date: today(), type:'gasto', concept:form.concept.trim(),
      amount:val, category:form.category, notes:form.notes.trim()||null, store_id: storeId,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Gasto registrado ✓')
    onSave(); onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white',borderRadius:20,padding:28,maxWidth:420,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <h3 style={{ fontWeight:900,margin:0,fontSize:'1.1rem' }}>➕ Registrar gasto</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'#9CA3AF' }}>✕</button>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isPhone ? '1fr' : '1fr 1fr',gap:12,marginBottom:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:'.78rem',fontWeight:700,color:'#374151',display:'block',marginBottom:5 }}>Concepto *</label>
            <input value={form.concept} onChange={set('concept')} placeholder="ej: Fresas del mercado"
              style={{ width:'100%',padding:'9px 12px',border:'2px solid #E5E7EB',borderRadius:9,fontFamily:'inherit',boxSizing:'border-box',fontSize:'.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize:'.78rem',fontWeight:700,color:'#374151',display:'block',marginBottom:5 }}>Importe (€) *</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} placeholder="0.00"
              style={{ width:'100%',padding:'9px 12px',border:'2px solid #E5E7EB',borderRadius:9,fontFamily:'inherit',boxSizing:'border-box',fontSize:'.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize:'.78rem',fontWeight:700,color:'#374151',display:'block',marginBottom:5 }}>Categoría</label>
            <select value={form.category} onChange={set('category')}
              style={{ width:'100%',padding:'9px 12px',border:'2px solid #E5E7EB',borderRadius:9,fontFamily:'inherit',fontSize:'.88rem',background:'white' }}>
              {COST_CATS.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:'.78rem',fontWeight:700,color:'#374151',display:'block',marginBottom:5 }}>Notas</label>
            <input value={form.notes} onChange={set('notes')} placeholder="Opcional"
              style={{ width:'100%',padding:'9px 12px',border:'2px solid #E5E7EB',borderRadius:9,fontFamily:'inherit',boxSizing:'border-box',fontSize:'.9rem' }} />
          </div>
        </div>
        <div style={{ display:'flex',gap:10,marginTop:8 }}>
          <button onClick={onClose} style={{ flex:1,padding:'10px',border:'2px solid #E5E7EB',background:'white',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:700 }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ flex:2,padding:'10px',background:'#DC2626',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:900 }}>
            {saving?'Guardando…':'💸 Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function AdminFinanceTab({ storeId = DEFAULT_STORE_ID }) {
  const activeStoreId = normalizeStoreId(storeId)
  const { isPhone, isCompact } = useResponsiveAdminLayout()
  const [products,    setProducts]    = useState([])
  const [salesData,   setSalesData]   = useState([])
  const [cashEntries, setCashEntries] = useState([])
  const [orders,      setOrders]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [period,      setPeriod]      = useState('month')
  const [editProd,    setEditProd]    = useState(null)
  const [showExpense, setShowExpense] = useState(false)
  const [sortBy,      setSortBy]      = useState('margin') // 'margin'|'profit'|'name'

  const load = useCallback(async () => {
    setLoading(true)
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate()-30)
    try {
      const salesQuery = await supabase
        .from('daily_sales_summary')
        .select('*')
        .eq('store_id', activeStoreId)
        .order('date',{ascending:false})
        .limit(90)

      const [
        { data: prods },
        { data: stockItems },
        stockLinksRes,
        { data: cash },
        { data: ords },
      ] = await Promise.all([
        supabase.from('products').select('id,name,price,cost_production,available,out_of_stock,sort_order,max_quantity').eq('store_id', activeStoreId).order('sort_order'),
        supabase.from('stock_items').select('id, product_id, quantity, unit, cost_per_unit, deleted_at').eq('store_id', activeStoreId),
        supabase.from('stock_item_products').select('stock_item_id, product_id').eq('store_id', activeStoreId),
        supabase.from('cash_entries').select('*').eq('store_id', activeStoreId).order('date',{ascending:false}).limit(500),
        supabase.from('orders').select('id,status,created_at,items,total').eq('store_id', activeStoreId).gte('created_at', thirtyAgo.toISOString()).limit(1000),
      ])
      if (prods) setProducts(enrichProductsFromStock(prods, stockItems || [], stockLinksRes?.data || [], ords || []))
      setSalesData(salesQuery.error && isMissingStoreScope(salesQuery.error) ? [] : (salesQuery.data || []))
      if (cash)  setCashEntries(cash)
      if (ords)  setOrders(ords)
    } catch(e) {
      console.error('[Finance] load error:', e)
    }
    setLoading(false)
  }, [activeStoreId])

  useEffect(() => { load() }, [load])

  // ── Filtro por período ────────────────────────────────────────────────────
  const { filteredSales, filteredCash } = useMemo(() => {
    const now = new Date()
    const filter = arr => arr.filter(e => {
      const d = new Date((e.date||e.created_at?.slice(0,10)||'')+'T00:00:00')
      if (period==='today') return (e.date||e.created_at?.slice(0,10)) === today()
      if (period==='week')  { const w=new Date(now); w.setDate(w.getDate()-7);  return d>=w }
      if (period==='month') { const m=new Date(now); m.setDate(m.getDate()-30); return d>=m }
      return true
    })
    return { filteredSales: filter(salesData), filteredCash: filter(cashEntries) }
  }, [salesData, cashEntries, period])

  // ── KPIs globales ─────────────────────────────────────────────────────────
  // Fallback: si daily_sales_summary está vacío, calculamos desde orders.total
  const revenueFromOrders = useMemo(() => {
    const now = new Date()
    return orders.filter(o => {
      if (o.status === 'cancelled') return false
      const d = new Date(o.created_at)
      if (period==='today') return o.created_at?.slice(0,10) === today()
      if (period==='week')  { const w=new Date(now); w.setDate(w.getDate()-7); return d>=w }
      if (period==='month') { const m=new Date(now); m.setDate(m.getDate()-30); return d>=m }
      return true
    }).reduce((s, o) => s + Number(o.total || 0), 0)
  }, [orders, period])

  const totalRevenue = filteredSales.length > 0
    ? filteredSales.reduce((s,r)=>s+Number(r.confirmed_revenue||0),0)
    : revenueFromOrders
  const ordersFromSummary = filteredSales.reduce((s,r)=>s+Number(r.orders_count||0),0)
  const totalOrders  = ordersFromSummary > 0 ? ordersFromSummary : orders.filter(o=>o.status!=='cancelled').length
  const avgTicket    = totalOrders>0 ? totalRevenue/totalOrders : 0

  const expByCat = useMemo(()=>{
    const m={}; COST_CATS.forEach(c=>m[c.key]=0)
    filteredCash.filter(e=>e.type==='gasto').forEach(e=>{ const k=e.category||'otro'; m[k]=(m[k]||0)+Number(e.amount||0) })
    return m
  },[filteredCash])

  const totalExp      = Object.values(expByCat).reduce((s,v)=>s+v,0)
  const ingredWithM   = expByCat.ingredientes * (1+MERMA)
  const totalRealCost = totalExp + (ingredWithM - expByCat.ingredientes)
  const grossProfit   = totalRevenue - totalRealCost
  const marginPct     = totalRevenue>0 ? grossProfit/totalRevenue : 0

  // Detectar si ningún producto tiene coste configurado
  const noCostProducts = products.length > 0 && products.every(p => !getEffectiveProductCost(p))

  // Punto de equilibrio diario (cuánto necesitas vender al día)
  const periodDays   = period==='today'?1 : period==='week'?7 : 30
  const breakeven    = totalRealCost>0 ? totalRealCost/periodDays : 0

  // Proyección de fin de mes
  const dayOfMonth   = new Date().getDate()
  const daysInMonth  = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
  const dailyRevAvg  = period==='month' && dayOfMonth > 0 ? totalRevenue / dayOfMonth : 0
  const projectedRev = dailyRevAvg * daysInMonth
  const projectedProfit = projectedRev * marginPct

  // Tendencia de margen últimos 14 días (de daily_sales_summary + cash_entries por fecha)
  const marginTrend = useMemo(() => {
    return salesData.slice(0,14).reverse().map(row => {
      const rev = Number(row.confirmed_revenue||0)
      // costes del mismo día desde cash_entries
      const dayCost = cashEntries.filter(e=>e.date===row.date&&e.type==='gasto').reduce((s,e)=>s+Number(e.amount||0),0)
      const m = rev > 0 && dayCost > 0 ? (rev - dayCost) / rev : null
      return { date: row.date, margin: m, rev }
    })
  }, [salesData, cashEntries])

  // ── Ventas últimos 7 días por producto (de orders.items) ─────────────────
  const salesByProduct = useMemo(() => buildProductSalesMap(orders, 7), [orders])

  // ── Productos con ranking ─────────────────────────────────────────────────
  const rankedProducts = useMemo(()=>{
    const withCalc = products.map(p=>{
      const { margin, unitProfit: profit } = getProductMarginSnapshot(p, MERMA)
      const sold7  = salesByProduct[p.id] || 0
      return {...p, marginPct:margin, unitProfit:profit, sold7}
    })
    return [...withCalc].sort((a,b)=>{
      if (sortBy==='margin') return (b.marginPct||0)-(a.marginPct||0)
      if (sortBy==='profit') return (b.unitProfit||0)-(a.unitProfit||0)
      return a.name.localeCompare(b.name)
    })
  },[products, salesByProduct, sortBy])

  const PERIOD_OPTS = [['today','Hoy'],['week','7 días'],['month','30 días']]

  if (loading) return (
    <div style={{ padding:60,textAlign:'center',color:'#9CA3AF',fontSize:'1rem' }}>
      <div style={{ fontSize:32,marginBottom:12 }}>📊</div>Cargando datos financieros…
    </div>
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'16px 0', fontFamily:'inherit' }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h2 style={{ margin:0, fontSize:'1.15rem', fontWeight:900, color:'#1C3829' }}>🚦 Semáforo Financiero</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {/* Período */}
          <div style={{ display:'flex', gap:4, background:'#F3F4F6', borderRadius:10, padding:3 }}>
            {PERIOD_OPTS.map(([v,l])=>(
              <button key={v} onClick={()=>setPeriod(v)} style={{
                padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                background:period===v?'#1C3829':'transparent', color:period===v?'white':'#374151', fontWeight:800, fontSize:'.8rem',
              }}>{l}</button>
            ))}
          </div>
          {/* Registrar gasto rápido */}
          <button onClick={()=>setShowExpense(true)} style={{
            padding:'7px 14px', background:'#DC2626', color:'white', border:'none', borderRadius:10,
            cursor:'pointer', fontWeight:800, fontSize:'.82rem', fontFamily:'inherit',
          }}>💸 Registrar gasto</button>
          <button onClick={load} style={{
            padding:'7px 10px', background:'#F3F4F6', border:'none', borderRadius:10,
            cursor:'pointer', fontSize:'.9rem',
          }} title="Recargar">🔄</button>
        </div>
      </div>

      {/* Aviso sin costes configurados */}
      {noCostProducts && (
        <div style={{ background:'#FEF3C7', border:'1.5px solid #FDE68A', borderRadius:12, padding:'12px 16px', marginBottom:12, fontSize:'.82rem', color:'#92400E' }}>
          <strong>⚠️ El semáforo no es fiable hasta configurar costes.</strong> En el ranking de productos (abajo), pulsa ✏️ en cada uno para introducir su coste de producción.
        </div>
      )}

      {/* ── SEMÁFORO ── */}
      <div style={{ marginBottom:16 }}>
        <SemaforoBar margin={marginPct} />
      </div>

      {/* ── KPIs — grid PC: 6 columnas ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:16 }}>
        <KPI label="Ingresos" value={euro(totalRevenue)} bg='#D1FAE5' color='#166534' accent />
        <KPI label="Costes reales" value={euro(totalRealCost)} bg='#FEE2E2' color='#991B1B' accent />
        <KPI label="Beneficio bruto" value={euro(grossProfit)} bg={grossProfit>=0?'#DCFCE7':'#FEE2E2'} color={grossProfit>=0?'#166534':'#991B1B'} accent />
        <KPI label="Margen neto" value={pct(marginPct*100)} sub="(objetivo ≥50%)" bg='#FEF3C7' color='#92400E' />
        <KPI label="Pedidos" value={totalOrders} sub={`Ticket medio ${euro(avgTicket)}`} />
        <KPI label={`Break-even / día`} value={euro(breakeven)} sub="Ventas mínimas diarias" />
      </div>

      {/* ── PROYECCIÓN + TENDENCIA ── */}
      {period === 'month' && projectedRev > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:isCompact ? '1fr' : '1fr 2fr', gap:12, marginBottom:16 }}>
          {/* Proyección */}
          <div style={{ background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border:'1.5px solid #BFDBFE', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.07em', color:'#1D4ED8', marginBottom:8 }}>🔮 Proyección a fin de mes</div>
            <div style={{ display:'grid', gridTemplateColumns:isPhone ? '1fr' : '1fr 1fr', gap:'6px 16px', fontSize:'.83rem' }}>
              <span style={{ color:'#6B7280' }}>Día actual</span><strong>{dayOfMonth}/{daysInMonth}</strong>
              <span style={{ color:'#6B7280' }}>Ingresos proyectados</span><strong style={{ color:'#1D4ED8' }}>{euro(projectedRev)}</strong>
              <span style={{ color:'#6B7280' }}>Beneficio estimado</span><strong style={{ color: projectedProfit>0?'#166534':'#991B1B' }}>{euro(projectedProfit)}</strong>
              <span style={{ color:'#6B7280' }}>Media diaria</span><strong>{euro(dailyRevAvg)}/día</strong>
            </div>
          </div>
          {/* Tendencia margen 14d */}
          {marginTrend.some(r=>r.margin!==null) && (
            <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:14, padding:'14px 18px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.07em', color:'#9CA3AF', marginBottom:10 }}>📈 Tendencia margen — 14 días</div>
              <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:56 }}>
                {marginTrend.map((r,i) => {
                  const h = r.margin !== null ? Math.max(4, r.margin*100) : 0
                  const c = r.margin === null ? '#E5E7EB' : r.margin>=0.50?'#166534':r.margin>=0.35?'#F59E0B':'#DC2626'
                  return (
                    <div key={i} title={r.date + (r.margin!==null?` — ${pct(r.margin*100)}`:' — sin datos')} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <div style={{ width:'100%', borderRadius:'3px 3px 0 0', height:`${h}%`, maxHeight:52, background:c, transition:'height .4s', minHeight:4 }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:8, fontSize:'.7rem' }}>
                <span>🟢 ≥50%</span><span>🟡 35–50%</span><span>🔴 &lt;35%</span><span style={{ color:'#D1D5DB' }}>⬛ Sin datos</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LAYOUT 2 COLUMNAS: costes izq | tabla productos dcha ── */}
      <div style={{ display:'grid', gridTemplateColumns:isCompact ? '1fr' : '300px 1fr', gap:14, marginBottom:14 }}>

        {/* PANEL COSTES */}
        <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:16, padding:'16px 18px', display:'flex', flexDirection:'column', gap:0 }}>
          <h3 style={{ fontWeight:900, fontSize:'.92rem', color:'#1C3829', marginBottom:14, margin:0, paddingBottom:12, borderBottom:'1px solid #F3F4F6' }}>
            🔍 Costes del período
          </h3>
          <div style={{ flex:1, paddingTop:12 }}>
            {COST_CATS.map(cat=>{
              const amt = cat.key==='ingredientes' ? expByCat.ingredientes*(1+MERMA) : expByCat[cat.key]||0
              return <CostBar key={cat.key} icon={cat.icon} label={cat.key==='ingredientes'?'Ingredientes+merma':cat.label}
                amount={amt} total={totalRealCost} color={cat.key==='ingredientes'?'#DC2626':'#2D6A4F'} />
            })}
            {totalRealCost===0 && <p style={{ color:'#9CA3AF',fontSize:'.8rem',textAlign:'center',padding:'16px 0' }}>Sin costes. Usa "Registrar gasto" 👆</p>}
          </div>
          <div style={{ borderTop:'2px dashed #E5E7EB', marginTop:12, paddingTop:12 }}>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.82rem',fontWeight:900,color:'#374151',marginBottom:4 }}>
              <span>Total costes</span><span>{euro(totalRealCost)}</span>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.88rem',fontWeight:900,color:grossProfit>=0?'#166534':'#991B1B' }}>
              <span>Beneficio bruto</span><span>{euro(grossProfit)}</span>
            </div>
          </div>
        </div>

        {/* TABLA PRODUCTOS */}
        <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:16, overflow:'hidden' }}>
          {/* Cabecera tabla */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0, fontWeight:900, fontSize:'.92rem', color:'#1C3829' }}>🍓 Ranking de rentabilidad</h3>
            <div style={{ display:'flex', gap:4 }}>
              <span style={{ fontSize:'.72rem', color:'#9CA3AF', alignSelf:'center', marginRight:4 }}>Ordenar:</span>
              {[['margin','Margen'],['profit','Ganancia'],['name','Nombre']].map(([v,l])=>(
                <button key={v} onClick={()=>setSortBy(v)} style={{
                  padding:'4px 10px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background:sortBy===v?'#1C3829':'#F3F4F6', color:sortBy===v?'white':'#374151',
                  fontWeight:700, fontSize:'.75rem',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['#','Producto','PVP','Coste','Ganancia/u','Margen','PVP mín','Ventas 7d'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'.7rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', color:'#9CA3AF', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedProducts.map((p,i)=>(
                  <ProductRow key={p.id} rank={i+1} product={p} salesLast7={p.sold7} onEditCost={setEditProd} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Leyenda badges */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid #F3F4F6', display:'flex', gap:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:'.7rem', color:'#166534', background:'#D1FAE5', padding:'2px 8px', borderRadius:4, fontWeight:700 }}>📣 PROMOCIONAR = margen alto + activo</span>
            <span style={{ fontSize:'.7rem', color:'#92400E', background:'#FEF3C7', padding:'2px 8px', borderRadius:4, fontWeight:700 }}>⚠️ SIN VENTAS 7d = producto estático</span>
          </div>
        </div>
      </div>

      {/* ── TENDENCIA 14 DÍAS ── */}
      <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:'1px solid #F3F4F6' }}>
          <h3 style={{ margin:0, fontWeight:900, fontSize:'.92rem', color:'#1C3829' }}>📅 Tendencia — Últimos 14 días</h3>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Fecha','Pedidos','Entregados','Ingresos','Ticket medio'].map(h=>(
                  <th key={h} style={{ padding:'7px 14px', textAlign:'left', fontSize:'.7rem', fontWeight:900, textTransform:'uppercase', letterSpacing:'.06em', color:'#9CA3AF' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesData.slice(0,14).map(row=>(
                <tr key={row.date} style={{ borderBottom:'1px solid #F3F4F6', background:row.date===today()?'#F0FDF4':'white' }}>
                  <td style={{ padding:'8px 14px', fontWeight:row.date===today()?900:400 }}>
                    {fmt(row.date)}
                    {row.date===today()&&<span style={{ marginLeft:6,background:'#D1FAE5',color:'#166534',padding:'1px 6px',borderRadius:5,fontSize:'.65rem',fontWeight:900 }}>HOY</span>}
                  </td>
                  <td style={{ padding:'8px 14px' }}>{row.orders_count}</td>
                  <td style={{ padding:'8px 14px',color:'#166534' }}>{row.delivered_count}</td>
                  <td style={{ padding:'8px 14px',fontWeight:700,color:'#166534' }}>{euro(row.confirmed_revenue)}</td>
                  <td style={{ padding:'8px 14px',color:'#6B7280' }}>{euro(row.avg_ticket)}</td>
                </tr>
              ))}
              {salesData.length===0&&<tr><td colSpan={5} style={{ padding:24,textAlign:'center',color:'#9CA3AF' }}>Sin datos de ventas aún</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODALES ── */}
      {editProd    && <CostModal product={editProd} storeId={activeStoreId} onClose={()=>setEditProd(null)} onSave={load} />}
      {showExpense && <QuickExpenseModal storeId={activeStoreId} onClose={()=>setShowExpense(false)} onSave={load} />}
    </div>
  )
}
