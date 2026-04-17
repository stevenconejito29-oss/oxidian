import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { normalizeSearchText, parseComboSlots as parseSlots } from '../lib/adminUtils'
import { CLUB_LEVEL_OPTIONS } from '../lib/adminCatalogConstants'
import { EditFormIntro, MiniPreviewCard } from './AdminFormContext'
import { getProductSections, resolveProductSection } from '../lib/productSections'
import ImageSourceField from '../components/admin/ImageSourceField'
import styles from './Admin.module.css'

export default function AdminCombosTab({ storeId = 'default', combos, products, toppingCategories, settings = [], onRefresh }) {
  const [editing,       setEditing]       = useState(null)
  const [form,          setForm]           = useState({})
  const [expandedSlots, setExpandedSlots] = useState(new Set([0]))
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('all')
  const productSections = useMemo(
    () => getProductSections(settings.find(row => row.key === 'product_sections')?.value),
    [settings]
  )

  const availableProducts = products.filter(p => p.available && !p.out_of_stock)
  const comboSummary = {
    total: combos.length,
    available: combos.filter(c => c.available !== false).length,
    hidden: combos.filter(c => c.available === false).length,
    limited: combos.filter(c => c.max_quantity).length,
  }
  const filteredCombos = combos.filter(c => {
    const q = normalizeSearchText(`${c.name} ${c.description}`)
    if (search && !q.includes(normalizeSearchText(search))) return false
    if (statusFilter === 'available' && c.available === false) return false
    if (statusFilter === 'hidden' && c.available !== false) return false
    if (statusFilter === 'limited' && !c.max_quantity) return false
    return true
  })

  function startNew() {
    setEditing('new')
    setExpandedSlots(new Set([0]))
    setForm({
      name:'', description:'', emoji:'🎁', image_url:'',
      price:'', discount_percent:0, available:true, sort_order:0,
      max_quantity:'', limit_enabled:false,
      club_only:false, club_only_level:'',
      tags:'',
      combo_slots:[{ label:'Producto 1', allowed_product_ids:[], allowed_topping_category_ids:[] }]
    })
  }
  function startEdit(c) {
    setEditing(c.id)
    const slots = parseSlots(c.combo_slots)
    setExpandedSlots(new Set(slots.map((_,i)=>i)))
    setForm({
      ...c,
      max_quantity: c.max_quantity ?? '',
      limit_enabled: Number(c.max_quantity || 0) > 0,
      club_only: !!c.club_only,
      club_only_level: c.club_only_level || '',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
      combo_slots: slots,
    })
  }

  // slots
  function addSlot() {
    setForm(f => {
      const cur = parseSlots(f.combo_slots)
      const idx = cur.length
      setExpandedSlots(prev => new Set([...prev, idx]))
      return { ...f, combo_slots:[...cur, { label:`Producto ${idx+1}`, allowed_product_ids:[], allowed_topping_category_ids:[] }] }
    })
  }
  function removeSlot(i) {
    setForm(f => ({ ...f, combo_slots: parseSlots(f.combo_slots).filter((_,idx) => idx !== i) }))
    setExpandedSlots(prev => { const n = new Set([...prev].filter(x=>x!==i).map(x=>x>i?x-1:x)); return n })
  }
  function updateSlot(i, field, value) {
    setForm(f => ({ ...f, combo_slots: parseSlots(f.combo_slots).map((s,idx) => idx===i ? {...s,[field]:value} : s) }))
  }
  function toggleSlotProduct(slotIdx, productId) {
    const slots = parseSlots(form.combo_slots)
    const ids   = slots[slotIdx]?.allowed_product_ids || []
    updateSlot(slotIdx, 'allowed_product_ids', ids.includes(productId) ? ids.filter(id=>id!==productId) : [...ids, productId])
  }
  function toggleSlotCat(slotIdx, catId) {
    const slots = parseSlots(form.combo_slots)
    const ids   = slots[slotIdx]?.allowed_topping_category_ids || []
    updateSlot(slotIdx, 'allowed_topping_category_ids', ids.includes(catId) ? ids.filter(id=>id!==catId) : [...ids, catId])
  }
  function toggleSlotExpand(i) {
    setExpandedSlots(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  // save / delete
  async function save() {
    if (!form.name) { toast.error('Nombre obligatorio'); return }
    const parsedMaxQuantity = form.limit_enabled
      ? parseInt(String(form.max_quantity || '').trim(), 10)
      : null
    if (form.limit_enabled && (!Number.isInteger(parsedMaxQuantity) || parsedMaxQuantity <= 0)) {
      toast.error('El límite diario del combo debe ser un entero mayor que 0')
      return
    }
    const data = {
      name:             form.name,
      description:      form.description     || null,
      emoji:            form.emoji           || '🎁',
      image_url:        form.image_url?.trim() || null,
      price:            parseFloat(form.price) || 0,
      discount_percent: parseInt(form.discount_percent) || 0,
      available:        form.available !== false,
      sort_order:       parseInt(form.sort_order) || 0,
      max_quantity:     form.limit_enabled ? parsedMaxQuantity : null,
      club_only:        form.club_only === true,
      club_only_level:  form.club_only === true ? (form.club_only_level || null) : null,
      tags:             String(form.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
      combo_slots:      parseSlots(form.combo_slots),
    }
    const legacyData = { ...data }
    delete legacyData.tags
    if (editing === 'new') {
      const { error } = await supabase.from('combos').insert([{ ...data, store_id: storeId }])
      if (error) {
        if (/tags/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('combos').insert([{ ...legacyData, store_id: storeId }])
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tags para activar catalogo modular.', {
            style: { background: '#EFF6FF', color: '#1D4ED8' },
          })
          setEditing(null); onRefresh()
          return
        }
        toast.error(error.message); return
      }
    } else {
      const { error } = await supabase.from('combos').update(data).eq('id', editing).eq('store_id', storeId)
      if (error) {
        if (/tags/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('combos').update(legacyData).eq('id', editing).eq('store_id', storeId)
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tags para activar catalogo modular.', {
            style: { background: '#EFF6FF', color: '#1D4ED8' },
          })
          setEditing(null); onRefresh()
          return
        }
        toast.error(error.message); return
      }
    }
    toast.success('Guardado ✓'); setEditing(null); onRefresh()
  }
  async function deleteCombo(id) {
    if (!confirm('¿Eliminar combo?')) return
    await supabase.from('combos').delete().eq('id', id).eq('store_id', storeId)
    toast.success('Eliminado'); onRefresh()
  }
  async function toggleAvailable(id, current) {
    await supabase.from('combos').update({ available:!current }).eq('id', id).eq('store_id', storeId); onRefresh()
  }

  const formSlots = parseSlots(form.combo_slots)

  // resumen de un slot para la cabecera colapsada
  function slotSummary(slot) {
    const pIds  = slot.allowed_product_ids || []
    const cIds  = slot.allowed_topping_category_ids || []
    const pLabels = pIds.length === 0
      ? 'Todos los productos'
      : pIds.slice(0,3).map(id => {
          const p = availableProducts.find(p=>p.id===id)
          return p ? (p.emoji || p.name.slice(0,8)) : ''
        }).filter(Boolean).join(' · ') + (pIds.length > 3 ? ` +${pIds.length-3}` : '')
    const cLabel = cIds.length === 0 ? 'Todos los toppings' : `${cIds.length} cat. toppings`
    return `${pLabels} · ${cLabel}`
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Combos</h2>
        <button className={styles.addBtn} onClick={startNew}>+ Nuevo Combo</button>
      </div>

      <div className={styles.ordersSearchBar} style={{marginBottom:16}}>
        <div className={styles.ordersSearchInputWrap}>
          <span className={styles.ordersSearchIcon}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.ordersSearchInput}
            placeholder="Buscar combo..."
          />
          {search && <button className={styles.ordersSearchClear} onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className={styles.ordersFilterChips}>
          {[
            ['all', `Todos (${comboSummary.total})`],
            ['available', `Activos (${comboSummary.available})`],
            ['limited', `Limitados (${comboSummary.limited})`],
            ['hidden', `Ocultos (${comboSummary.hidden})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterChip} ${statusFilter === key ? styles.filterChipActive : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <div className={styles.formCard}>
          <h3>{editing === 'new' ? 'Nuevo Combo' : 'Editar Combo'}</h3>
          <EditFormIntro
            eyebrow="Combo"
            title="Primero define la oferta, despues la estructura"
            description="Este editor separa precio, visibilidad y slots para que el combo se entienda rapido y no deje huecos operativos."
            tone="amber"
            chips={[
              `Slots: ${formSlots.length}`,
              form.price ? `Precio fijo €${Number(form.price || 0).toFixed(2)}` : 'Precio por suma de productos',
              form.club_only ? 'Exclusivo Club' : 'Visible para todos',
            ]}
            aside={
              <MiniPreviewCard
                emoji={form.emoji || '🎁'}
                imageUrl={form.image_url}
                title={form.name || 'Combo sin nombre'}
                lines={[
                  form.description ? 'Oferta lista para escaparate' : 'Descripcion pendiente',
                  form.available !== false ? 'Disponible en menu' : 'Oculto del menu',
                ]}
              />
            }
          />

          {/* Info basica en grid compacto */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
            {/* Preview imagen/emoji */}
            <div style={{width:72,height:72,borderRadius:14,background:'#f3f4f6',border:'2px solid #e5e7eb',
              display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
              {form.image_url
                ? <img src={form.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} />
                : <span style={{fontSize:'2rem'}}>{form.emoji||'🎁'}</span>
              }
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:8,minWidth:200}}>
              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nombre *</label>
                  <input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Emoji <span className={styles.formHint}>fallback</span></label>
                  <input value={form.emoji||''} onChange={e=>setForm({...form,emoji:e.target.value})} className={styles.input} style={{maxWidth:70}} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <ImageSourceField
                  label="Imagen"
                  hint="URL externa o archivo local"
                  value={form.image_url || ''}
                  onChange={image_url => setForm({ ...form, image_url })}
                />
              </div>
            </div>
          </div>

          <div className={styles.formGroup} style={{marginTop:8}}>
            <label className={styles.formLabel}>Descripcion</label>
            <textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} className={styles.textarea} rows={2} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tags del combo <span className={styles.formHint}>- separadas por coma</span></label>
            <input value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })} className={styles.input} placeholder="regalo, lanzamiento, premium" />
          </div>

          <div className={styles.formGrid2} style={{marginTop:4}}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Precio fijo (€) <span className={styles.formHint}>- 0 = suma productos</span></label>
              <input type="number" step="0.01" value={form.price||''} onChange={e=>setForm({...form,price:e.target.value})} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>% Descuento</label>
              <input type="number" min="0" max="80" value={form.discount_percent||0} onChange={e=>setForm({...form,discount_percent:e.target.value})} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Orden</label>
              <input type="number" value={form.sort_order||0} onChange={e=>setForm({...form,sort_order:e.target.value})} className={styles.input} />
            </div>
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}><input type="checkbox" checked={form.available!==false} onChange={e=>setForm({...form,available:e.target.checked})} /> Disponible en el menu</label>
          </div>

          <div className={styles.adminFieldCard} style={{ marginBottom: 12 }}>
            <div className={styles.adminFieldCardHead}>
              <div>
                <div className={styles.adminFieldCardTitle}>Límite opcional del combo</div>
                <div className={styles.adminFieldCardMeta}>Úsalo para campañas, cupos VIP o producción diaria limitada.</div>
              </div>
              <span className={styles.adminFieldCardBadge}>{form.limit_enabled ? `${form.max_quantity || 0}/día` : '∞'}</span>
            </div>
            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={form.limit_enabled === true}
                  onChange={e => setForm({
                    ...form,
                    limit_enabled: e.target.checked,
                    max_quantity: e.target.checked ? (form.max_quantity || '10') : '',
                  })}
                />
                Activar cupo diario para este combo
              </label>
            </div>
            {form.limit_enabled && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Combos máximos por día</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.max_quantity ?? ''}
                  onChange={e => setForm({ ...form, max_quantity: e.target.value })}
                  className={styles.input}
                  placeholder="Ej: 12"
                />
              </div>
            )}
          </div>

          <div className={styles.formSectionDivider}>⭐ Reglas de club</div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.club_only === true}
                onChange={e => setForm({
                  ...form,
                  club_only: e.target.checked,
                  club_only_level: e.target.checked ? (form.club_only_level || '') : '',
                })}
              />
              Combo exclusivo del Club
            </label>
          </div>
          {form.club_only === true && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nivel minimo del Club</label>
              <select
                value={form.club_only_level || ''}
                onChange={e => setForm({...form, club_only_level: e.target.value})}
                className={styles.input}
              >
                {CLUB_LEVEL_OPTIONS.map(level => (
                  <option key={level.id || 'all'} value={level.id}>{level.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Slots */}
          <div className={styles.formSectionDivider} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>🎯 Slots del combo <span className={styles.formHint}>- cada slot = un producto que elige el cliente</span></span>
            <button onClick={addSlot} className={styles.addBtn} style={{fontSize:'.72rem',padding:'3px 10px'}}>+ Slot</button>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {formSlots.map((slot, slotIdx) => {
              const isExpanded  = expandedSlots.has(slotIdx)
              const prodCount   = (slot.allowed_product_ids||[]).length
              const catCount    = (slot.allowed_topping_category_ids||[]).length

              return (
                <div key={slotIdx} style={{border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>

                  {/* Cabecera slot siempre visible */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#f8fafc',cursor:'pointer'}}
                    onClick={() => toggleSlotExpand(slotIdx)}>
                    <span style={{fontSize:'.8rem',fontWeight:800,color:'#374151',minWidth:20}}>#{slotIdx+1}</span>
                    <input
                      value={slot.label||''}
                      onChange={e=>{e.stopPropagation();updateSlot(slotIdx,'label',e.target.value)}}
                      onClick={e=>e.stopPropagation()}
                      className={styles.input}
                      style={{flex:1,maxWidth:180,padding:'4px 8px',fontSize:'.8rem'}}
                      placeholder="Ej: Helado"
                    />
                    {/* Resumen */}
                    <span style={{flex:1,fontSize:'.68rem',color:'#9ca3af',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {prodCount > 0 ? `${prodCount} producto${prodCount!==1?'s':''}` : 'Todos'}
                      {' · '}
                      {catCount > 0 ? `${catCount} cat. topping` : 'Todos los toppings'}
                    </span>
                    <button onClick={e=>{e.stopPropagation();removeSlot(slotIdx)}} className={styles.deleteBtn} style={{padding:'2px 7px',fontSize:'.7rem'}}>✕</button>
                    <span style={{color:'#9ca3af',fontSize:'.75rem'}}>{isExpanded?'▲':'▼'}</span>
                  </div>

                  {/* Cuerpo slot expandido */}
                  {isExpanded && (
                    <div style={{padding:'12px'}}>

                      {/* Productos permitidos */}
                      <div style={{marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <span style={{fontSize:'.72rem',fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.05em'}}>
                            Productos permitidos
                          </span>
                          <span style={{fontSize:'.65rem',color: prodCount>0?'#1B5E3B':'#9ca3af',fontWeight:700,
                            background: prodCount>0?'#dcfce7':'#f3f4f6',padding:'1px 7px',borderRadius:10,
                            border:`1px solid ${prodCount>0?'#86efac':'#e5e7eb'}`}}>
                            {prodCount > 0 ? `${prodCount} seleccionado${prodCount!==1?'s':''}` : 'vacio = todos'}
                          </span>
                          {prodCount > 0 && (
                            <button onClick={() => updateSlot(slotIdx,'allowed_product_ids',[])}
                              style={{fontSize:'.65rem',color:'#dc2626',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>
                              Limpiar
                            </button>
                          )}
                        </div>
                        {productSections.filter(cat => availableProducts.some(p=>p.category===cat.id)).map(cat => (
                          <div key={cat.id} style={{marginBottom:6}}>
                            <div style={{fontSize:'.62rem',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{resolveProductSection(productSections, cat.id).label}</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                              {availableProducts.filter(p=>p.category===cat.id).map(p => {
                                const active = (slot.allowed_product_ids||[]).includes(p.id)
                                return (
                                  <button key={p.id} onClick={()=>toggleSlotProduct(slotIdx,p.id)}
                                    style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,fontSize:'.72rem',fontWeight:700,cursor:'pointer',border:'1.5px solid',transition:'all .12s',
                                      background: active?'#1B5E3B':'white',
                                      color:      active?'white':'#374151',
                                      borderColor:active?'#1B5E3B':'#d1d5db'}}>
                                    {p.image_url
                                      ? <img src={p.image_url} alt="" style={{width:15,height:15,borderRadius:3,objectFit:'cover'}} />
                                      : <span style={{fontSize:'.8rem'}}>{p.emoji}</span>}
                                    {p.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Categorias de toppings */}
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <span style={{fontSize:'.72rem',fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.05em'}}>
                            Categorias de toppings
                          </span>
                          <span style={{fontSize:'.65rem',color: catCount>0?'#1d4ed8':'#9ca3af',fontWeight:700,
                            background: catCount>0?'#dbeafe':'#f3f4f6',padding:'1px 7px',borderRadius:10,
                            border:`1px solid ${catCount>0?'#93c5fd':'#e5e7eb'}`}}>
                            {catCount > 0 ? `${catCount} seleccionada${catCount!==1?'s':''}` : 'vacio = todas'}
                          </span>
                          {catCount > 0 && (
                            <button onClick={() => updateSlot(slotIdx,'allowed_topping_category_ids',[])}
                              style={{fontSize:'.65rem',color:'#dc2626',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>
                              Limpiar
                            </button>
                          )}
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {toppingCategories.map(c => {
                            const active = (slot.allowed_topping_category_ids||[]).includes(c.id)
                            return (
                              <button key={c.id} onClick={()=>toggleSlotCat(slotIdx,c.id)}
                                style={{padding:'4px 12px',borderRadius:20,fontSize:'.72rem',fontWeight:700,cursor:'pointer',border:'1.5px solid',transition:'all .12s',
                                  background: active?'#1d4ed8':'white',
                                  color:      active?'white':'#374151',
                                  borderColor:active?'#1d4ed8':'#d1d5db'}}>
                                {c.emoji} {c.name}
                                {c.multi_select && <span style={{opacity:.6,fontSize:'.6rem',marginLeft:3}}>M</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {formSlots.length === 0 && (
              <div style={{textAlign:'center',padding:'16px',color:'#9ca3af',fontSize:'.8rem',border:'1.5px dashed #e5e7eb',borderRadius:10}}>
                Sin slots — pulsa "+ Slot" para anadir productos al combo
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setEditing(null)}>Cancelar</button>
            <button className={styles.saveBtn}   onClick={save}>Guardar</button>
          </div>
        </div>
      )}

      {/* Lista de combos */}
      <div className={styles.itemsList}>
        {filteredCombos.length === 0 && <div className={styles.empty}>No hay combos con ese filtro.</div>}
        {filteredCombos.map(c => {
          const cSlots = parseSlots(c.combo_slots)
          return (
            <div key={c.id} className={`${styles.itemRow} ${!c.available?styles.itemUnavailable:''}`}>
              <div className={styles.itemThumb}>
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className={styles.itemThumbImg} />
                  : <span className={styles.itemEmoji}>{c.emoji||'🎁'}</span>
                }
              </div>
              <div className={styles.itemInfo}>
                <strong>{c.name}</strong>
                <span style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span>€{Number(c.price).toFixed(2)}</span>
                  <span style={{fontSize:'.65rem',background:'#f3f4f6',color:'#374151',borderRadius:6,padding:'1px 6px',fontWeight:600}}>
                    {cSlots.length} slot{cSlots.length!==1?'s':''}
                  </span>
                  {Number(c.max_quantity || 0) > 0 && (
                    <span style={{fontSize:'.62rem',background:'#FEF3C7',color:'#92400E',border:'1px solid #FCD34D',borderRadius:6,padding:'1px 6px',fontWeight:700}}>
                      Cupo {c.max_quantity}/día
                    </span>
                  )}
                  {c.club_only && (
                    <span style={{fontSize:'.62rem',background:'#1C3829',color:'white',borderRadius:6,padding:'1px 6px',fontWeight:700}}>
                      ⭐ Club{c.club_only_level ? ` · ${c.club_only_level}` : ''}
                    </span>
                  )}
                  {Array.isArray(c.tags) && c.tags.length > 0 && (
                    <span style={{fontSize:'.62rem',background:'#EFF6FF',color:'#1D4ED8',borderRadius:6,padding:'1px 6px',fontWeight:700,border:'1px solid #BFDBFE'}}>
                      🏷 {c.tags.slice(0, 2).join(', ')}
                    </span>
                  )}
                  {cSlots.map((s,i) => (
                    <span key={i} style={{fontSize:'.62rem',background:'#f0fdf4',color:'#15803d',borderRadius:6,padding:'1px 6px',fontWeight:600,border:'1px solid #bbf7d0'}}>
                      {s.label||`#${i+1}`}: {(s.allowed_product_ids||[]).length > 0 ? `${(s.allowed_product_ids||[]).length}p` : '∗'}
                    </span>
                  ))}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button onClick={() => toggleAvailable(c.id, c.available)} className={c.available?styles.activeChip:styles.inactiveChip}>{c.available?'Activo':'Inactivo'}</button>
                <button onClick={() => startEdit(c)} className={styles.editBtn}>Editar</button>
                <button onClick={() => deleteCombo(c.id)} className={styles.deleteBtn}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
