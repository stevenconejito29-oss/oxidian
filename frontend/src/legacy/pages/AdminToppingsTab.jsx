import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { normalizeSearchText } from '../lib/adminUtils'
import { EditFormIntro, MiniPreviewCard } from './AdminFormContext'
import ImageSourceField from '../components/admin/ImageSourceField'
import styles from './Admin.module.css'

function ToppingsTab({ storeId = 'default', toppings, categories, onRefresh }) {
  // editing: null | 'newCat' | {type:'cat',id} | 'newTopping' | {type:'topping',id}
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState({})
  // collapsed: set of category IDs that are folded
  const [collapsed, setCollapsed] = useState(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // ── helpers status ───────────────────────────────────────────────────────
  function getToppingStatus(t) {
    if (t.out_of_stock) return 'out_of_stock'
    if (t.coming_soon)  return 'coming_soon'
    if (!t.available)   return 'unavailable'
    return 'available'
  }
  const STATUS_CFG = {
    available:    { label:'✅ Activo',       bg:'#dcfce7', color:'#15803d', border:'#86efac' },
    out_of_stock: { label:'🚫 Agotado',      bg:'#fee2e2', color:'#dc2626', border:'#fca5a5' },
    coming_soon:  { label:'🕐 Próximamente', bg:'#fef9c3', color:'#a16207', border:'#fde047' },
    unavailable:  { label:'🔒 Oculto',       bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db' },
  }
  function statusFromForm(f) {
    if (f.out_of_stock)                               return 'out_of_stock'
    if (f.coming_soon)                                return 'coming_soon'
    if (!f.available && !f.out_of_stock && !f.coming_soon) return 'unavailable'
    return 'available'
  }
  function applyStatus(status) {
    return {
      available:    status === 'available',
      out_of_stock: status === 'out_of_stock',
      coming_soon:  status === 'coming_soon',
    }
  }

  // ── quick toggle disponible ↔ agotado desde la lista ────────────────────
  async function quickToggle(t) {
    const next = getToppingStatus(t) === 'out_of_stock'
      ? { available:true,  out_of_stock:false, coming_soon:false }
      : { available:false, out_of_stock:true,  coming_soon:false }
    const { error } = await supabase.from('toppings').update(next).eq('id', t.id).eq('store_id', storeId)
    if (error) { toast.error(error.message); return }
    onRefresh()
  }

  // ── topping CRUD ─────────────────────────────────────────────────────────
  function openNewTopping(catId) {
    setEditing({ type:'newTopping', catId })
    setForm({ name:'', emoji:'', image_url:'', extra_price:0,
              available:true, coming_soon:false, out_of_stock:false,
              sort_order:0, category_id: catId })
  }
  function openEditTopping(t) {
    setEditing({ type:'topping', id:t.id })
    setForm({ ...t })
  }
  async function saveTopping() {
    if (!form.name) { toast.error('Nombre obligatorio'); return }
    const data = {
      name:        form.name,
      emoji:       form.emoji?.trim()     || null,
      image_url:   form.image_url?.trim() || null,
      extra_price: parseFloat(form.extra_price) || 0,
      sort_order:  parseInt(form.sort_order)    || 0,
      category_id: form.category_id || null,
      ...applyStatus(statusFromForm(form)),
    }
    if (editing?.type === 'newTopping') {
      const { error } = await supabase.from('toppings').insert([{ ...data, store_id: storeId }])
      if (error) { toast.error(error.message); return }
    } else {
      const { error } = await supabase.from('toppings').update(data).eq('id', editing.id).eq('store_id', storeId)
      if (error) { toast.error(error.message); return }
    }
    toast.success('Guardado ✓'); setEditing(null); onRefresh()
  }
  async function deleteTopping(id) {
    if (!confirm('¿Eliminar topping?')) return
    await supabase.from('toppings').delete().eq('id', id).eq('store_id', storeId)
    toast.success('Eliminado'); onRefresh()
  }

  // ── categoría CRUD ───────────────────────────────────────────────────────
  function openNewCat() {
    setEditing({ type:'newCat' })
    setForm({ name:'', emoji:'', sort_order:0, multi_select:false, max_selections:0 })
  }
  function openEditCat(cat) {
    setEditing({ type:'cat', id:cat.id })
    setForm({ ...cat })
  }
  async function saveCat() {
    if (!form.name) { toast.error('Nombre obligatorio'); return }
    const data = {
      name:           form.name,
      emoji:          form.emoji?.trim() || null,
      sort_order:     parseInt(form.sort_order)    || 0,
      multi_select:   !!form.multi_select,
      max_selections: parseInt(form.max_selections) || 0,
    }
    if (editing?.type === 'newCat') {
      const { error } = await supabase.from('topping_categories').insert([{ ...data, store_id: storeId }])
      if (error) { toast.error(error.message); return }
    } else {
      const { error } = await supabase.from('topping_categories').update(data).eq('id', editing.id).eq('store_id', storeId)
      if (error) { toast.error(error.message); return }
    }
    toast.success('Categoría guardada ✓'); setEditing(null); onRefresh()
  }
  async function deleteCat(id) {
    if (!confirm('¿Eliminar categoría? Los toppings quedarán sin categoría.')) return
    await supabase.from('topping_categories').delete().eq('id', id).eq('store_id', storeId)
    toast.success('Eliminada'); onRefresh()
  }
  // fix: catForm never used standalone — reuse form
  const catForm = form

  function toggleCollapse(id) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const matchesToppingFilter = (t) => {
    const q = normalizeSearchText(`${t.name} ${t.emoji}`)
    const matchesSearch = !search || q.includes(normalizeSearchText(search))
    const st = getToppingStatus(t)
    const matchesStatus = statusFilter === 'all' || st === statusFilter
    return matchesSearch && matchesStatus
  }

  const grouped       = categories.map(cat => ({ ...cat, items: toppings.filter(t => t.category_id === cat.id).filter(matchesToppingFilter) })).filter(cat => cat.items.length > 0 || !search)
  const uncategorized = toppings.filter(t => !t.category_id).filter(matchesToppingFilter)
  const toppingSummary = {
    total: toppings.length,
    available: toppings.filter(t => getToppingStatus(t) === 'available').length,
    out: toppings.filter(t => getToppingStatus(t) === 'out_of_stock').length,
    hidden: toppings.filter(t => getToppingStatus(t) === 'unavailable').length,
  }

  // ── inline form para topping ─────────────────────────────────────────────
  function ToppingInlineForm({ onCancel }) {
    const isNew = editing?.type === 'newTopping'
    return (
      <div className={styles.adminFieldCard} style={{borderColor:'#86EFAC',background:'linear-gradient(145deg,#F0FDF4,#ECFDF5)',margin:'6px 0'}}>
        <EditFormIntro
          eyebrow="Topping"
          title="Decide rapido si suma ticket o solo personaliza"
          description="Aqui importa que quede clara su categoria, el impacto en precio y su disponibilidad real para cocina."
          tone="green"
          chips={[
            form.category_id ? 'Con categoria' : 'Sin categoria',
            Number(form.extra_price || 0) > 0 ? `Extra €${Number(form.extra_price || 0).toFixed(2)}` : 'Sin sobreprecio',
            STATUS_CFG[statusFromForm(form)]?.label || 'Activo',
          ]}
          aside={
            <MiniPreviewCard
              emoji={form.emoji || '🍫'}
              imageUrl={form.image_url}
              title={form.name || 'Topping sin nombre'}
              lines={[form.category_id ? 'Listo para producto y combo' : 'Pendiente de ubicar']}
            />
          }
        />
        {/* Fila 1: imagen preview + nombre + emoji + precio */}
        <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
          {/* Preview imagen/emoji */}
          <div style={{width:44,height:44,borderRadius:'50%',background:'#C8F0D8',border:'2px solid #52B788',
            display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
            {form.image_url
              ? <img src={form.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} />
              : <span style={{fontSize:'1.3rem'}}>{form.emoji||'🍫'}</span>
            }
          </div>
          <div style={{flex:'2 1 140px',minWidth:100}}>
            <label className={styles.formLabel}>Nombre *</label>
            <input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}
              className={styles.input} placeholder="Ej: Leche condensada" autoFocus />
          </div>
          <div style={{flex:'0 0 70px'}}>
            <label className={styles.formLabel}>Emoji</label>
            <input value={form.emoji||''} onChange={e=>setForm({...form,emoji:e.target.value})}
              className={styles.input} style={{textAlign:'center'}} placeholder="🍫" />
          </div>
          <div style={{flex:'0 0 90px'}}>
            <label className={styles.formLabel}>Precio extra</label>
            <input type="number" step="0.01" min="0" value={form.extra_price||0}
              onChange={e=>setForm({...form,extra_price:e.target.value})} className={styles.input} />
          </div>
          <div style={{flex:'0 0 70px'}}>
            <label className={styles.formLabel}>Orden</label>
            <input type="number" value={form.sort_order||0}
              onChange={e=>setForm({...form,sort_order:e.target.value})} className={styles.input} />
          </div>
        </div>

        {/* Fila 2: URL imagen + cambiar categoría */}
        <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          <div style={{flex:'3 1 200px'}}>
            <ImageSourceField
              label="Imagen"
              hint="URL externa o archivo local"
              value={form.image_url || ''}
              onChange={image_url => setForm({ ...form, image_url })}
            />
          </div>
          <div style={{flex:'1 1 140px'}}>
            <label className={styles.formLabel}>Categoría</label>
            <select value={form.category_id||''} onChange={e=>setForm({...form,category_id:e.target.value||null})} className={styles.input}>
              <option value="">Sin categoría</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Fila 3: estado como chips compactos */}
        <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
          <span className={styles.formLabel} style={{marginBottom:0}}>Estado:</span>
          {[
            { v:'available',    l:'✅ Activo' },
            { v:'out_of_stock', l:'🚫 Agotado' },
            { v:'coming_soon',  l:'🕐 Pronto' },
            { v:'unavailable',  l:'🔒 Oculto' },
          ].map(opt => {
            const current = statusFromForm(form) === opt.v ||
              (opt.v === 'unavailable' && !form.available && !form.out_of_stock && !form.coming_soon)
            const isActive = opt.v === 'unavailable'
              ? (!form.available && !form.out_of_stock && !form.coming_soon)
              : statusFromForm(form) === opt.v
            return (
              <button key={opt.v} type="button" onClick={() => {
                if (opt.v === 'unavailable') setForm({...form,available:false,out_of_stock:false,coming_soon:false})
                else setForm({...form,...applyStatus(opt.v)})
              }} style={{
                padding:'4px 10px', borderRadius:20, fontSize:'.72rem', fontWeight:700, cursor:'pointer', border:'1.5px solid',
                background: isActive ? STATUS_CFG[opt.v].bg : 'white',
                color:      isActive ? STATUS_CFG[opt.v].color : '#6b7280',
                borderColor:isActive ? STATUS_CFG[opt.v].border : '#e5e7eb',
              }}>
                {opt.l}
              </button>
            )
          })}
          <div style={{flex:1}} />
          <button className={styles.cancelBtn} onClick={onCancel} style={{padding:'5px 12px'}}>Cancelar</button>
          <button className={styles.saveBtn}   onClick={saveTopping} style={{padding:'5px 16px'}}>
            {isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  // ── inline form para categoría ───────────────────────────────────────────
  function CatInlineForm({ onCancel }) {
    return (
      <div className={styles.adminFieldCard} style={{borderColor:'#93C5FD',background:'linear-gradient(145deg,#EFF6FF,#DBEAFE)',marginBottom:10}}>
        <EditFormIntro
          eyebrow="Categoria de toppings"
          title="Define la regla de eleccion"
          description="Esta categoria controla como el cliente selecciona extras en producto y combo: una opcion, varias o sin limite."
          tone="blue"
          chips={[
            form.multi_select ? 'Multi seleccion' : 'Seleccion simple',
            Number(form.max_selections || 0) > 0 ? `Max ${Number(form.max_selections)}` : 'Sin limite',
          ]}
          aside={
            <MiniPreviewCard
              emoji={form.emoji || '🍦'}
              title={form.name || 'Categoria sin nombre'}
              lines={[form.multi_select ? 'Permite varias elecciones' : 'Una eleccion por cliente']}
            />
          }
        />
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:'0 0 56px'}}>
            <label className={styles.formLabel}>Emoji</label>
            <input value={form.emoji||''} onChange={e=>setForm({...form,emoji:e.target.value})}
              className={styles.input} style={{textAlign:'center'}} placeholder="🍦" autoFocus />
          </div>
          <div style={{flex:'2 1 160px'}}>
            <label className={styles.formLabel}>Nombre *</label>
            <input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}
              className={styles.input} placeholder="Ej: Cremas" />
          </div>
          <div style={{flex:'0 0 70px'}}>
            <label className={styles.formLabel}>Orden</label>
            <input type="number" value={form.sort_order||0}
              onChange={e=>setForm({...form,sort_order:e.target.value})} className={styles.input} />
          </div>
          <div style={{flex:'0 0 100px'}}>
            <label className={styles.formLabel}>Máx. selec.</label>
            <input type="number" min="0" value={form.max_selections||0}
              onChange={e=>setForm({...form,max_selections:e.target.value})} className={styles.input} />
          </div>
          {/* multi_select toggle */}
          <button type="button" onClick={()=>setForm({...form,multi_select:!form.multi_select})}
            style={{height:42,padding:'0 12px',borderRadius:8,border:'1.5px solid',cursor:'pointer',fontSize:'.75rem',fontWeight:700,
              background: form.multi_select ? '#dbeafe' : 'white',
              color:      form.multi_select ? '#1d4ed8' : '#6b7280',
              borderColor:form.multi_select ? '#93c5fd' : '#d1d5db',
            }}>
            {form.multi_select ? '✓ Multi' : 'Multi'}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel} style={{height:42,padding:'0 12px'}}>Cancelar</button>
          <button className={styles.saveBtn}   onClick={saveCat}  style={{height:42,padding:'0 14px'}}>
            {editing?.type === 'newCat' ? 'Crear' : 'Guardar'}
          </button>
        </div>
        <p className={styles.formHint} style={{marginTop:6}}>
          Multi-selección: el cliente puede elegir varios toppings. Máx. selec. = 0 significa sin límite.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Toppings</h2>
        <div style={{display:'flex',gap:8}}>
          <button className={styles.addBtn}
            style={{background:'#e0f2fe',color:'#0369a1',border:'1px solid #bae6fd'}}
            onClick={openNewCat}>
            + Categoría
          </button>
          <button className={styles.addBtn} onClick={() => openNewTopping(categories[0]?.id || null)}>
            + Topping
          </button>
        </div>
      </div>

      <div className={styles.ordersSearchBar} style={{marginBottom:16}}>
        <div className={styles.ordersSearchInputWrap}>
          <span className={styles.ordersSearchIcon}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.ordersSearchInput}
            placeholder="Buscar topping o emoji..."
          />
          {search && <button className={styles.ordersSearchClear} onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className={styles.ordersFilterChips}>
          {[
            ['all', `Todos (${toppingSummary.total})`],
            ['available', `Activos (${toppingSummary.available})`],
            ['out_of_stock', `Agotados (${toppingSummary.out})`],
            ['unavailable', `Ocultos (${toppingSummary.hidden})`],
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

      {/* Form nueva categoría (global, fuera de grupos) */}
      {editing?.type === 'newCat' && (
        <CatInlineForm onCancel={() => setEditing(null)} />
      )}

      {/* Form nuevo topping sin categoría */}
      {editing?.type === 'newTopping' && !editing.catId && (
        <ToppingInlineForm onCancel={() => setEditing(null)} />
      )}

      {/* ── Grupos por categoría ── */}
      {grouped.map(cat => {
        const isOpen   = !collapsed.has(cat.id)
        const editingCat    = editing?.type === 'cat'       && editing.id === cat.id
        const editingNewTop = editing?.type === 'newTopping' && editing.catId === cat.id
        const avail = cat.items.filter(t => getToppingStatus(t) === 'available').length
        const total = cat.items.length

        return (
          <div key={cat.id} style={{marginBottom:16,border:'1.5px solid #e5e7eb',borderRadius:12,overflow:'hidden'}}>

            {/* Cabecera categoría */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
              background: editingCat ? '#f0f9ff' : '#f8fafc',
              borderBottom: isOpen ? '1.5px solid #e5e7eb' : 'none',
              cursor:'pointer'}}
              onClick={() => !editingCat && toggleCollapse(cat.id)}>
              <span style={{fontSize:'1.1rem'}}>{cat.emoji||'📂'}</span>
              <strong style={{flex:1,fontSize:'.88rem'}}>{cat.name}</strong>
              <span style={{fontSize:'.65rem',color:'#6b7280',fontWeight:600}}>
                {avail}/{total} disponibles
              </span>
              {cat.multi_select && (
                <span style={{fontSize:'.6rem',background:'#dbeafe',color:'#1d4ed8',padding:'2px 7px',borderRadius:10,fontWeight:700,border:'1px solid #bfdbfe'}}>
                  MULTI{cat.max_selections > 0 ? ` ≤${cat.max_selections}` : ''}
                </span>
              )}
              {/* Acciones categoría — detener propagación */}
              <button onClick={e=>{e.stopPropagation(); openEditCat(cat)}} className={styles.editBtn} style={{fontSize:'.68rem',padding:'2px 8px'}}>Editar</button>
              <button onClick={e=>{e.stopPropagation(); deleteCat(cat.id)}} className={styles.deleteBtn} style={{fontSize:'.68rem',padding:'2px 7px'}}>✕</button>
              <span style={{color:'#9ca3af',fontSize:'.8rem',marginLeft:2}}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Form editar categoría inline */}
            {editingCat && (
              <div style={{padding:'10px 12px',borderBottom:'1.5px solid #e5e7eb',background:'#f0f9ff'}}>
                <CatInlineForm onCancel={() => setEditing(null)} />
              </div>
            )}

            {/* Lista de toppings */}
            {isOpen && (
              <div>
                {cat.items.map(t => {
                  const isEditingThis = editing?.type === 'topping' && editing.id === t.id
                  const st = getToppingStatus(t)
                  const cfg = STATUS_CFG[st]
                  return (
                    <div key={t.id}>
                      {isEditingThis ? (
                        <div style={{padding:'8px 12px',background:'#f0fdf4'}}>
                          <ToppingInlineForm onCancel={() => setEditing(null)} />
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
                          borderBottom:'1px solid #f3f4f6',
                          background: st==='unavailable'||st==='out_of_stock' ? '#fafafa' : 'white',
                          opacity: st==='unavailable' ? 0.6 : 1}}>
                          {/* Thumb */}
                          <div style={{width:36,height:36,borderRadius:'50%',background:'#f3f4f6',
                            display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                            {t.image_url
                              ? <img src={t.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                              : <span style={{fontSize:'1.2rem'}}>{t.emoji||'🍫'}</span>
                            }
                          </div>
                          {/* Info */}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:'.85rem',color:'#111827'}}>{t.name}</div>
                            <div style={{display:'flex',gap:6,alignItems:'center',marginTop:1}}>
                              <span style={{fontSize:'.72rem',fontWeight:600,color:'#6b7280'}}>
                                {t.extra_price > 0 ? `+€${Number(t.extra_price).toFixed(2)}` : 'Gratis'}
                              </span>
                              <span style={{fontSize:'.62rem',fontWeight:700,padding:'1px 7px',borderRadius:20,
                                background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`}}>
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                          {/* Acciones */}
                          <button onClick={() => quickToggle(t)}
                            title={st==='out_of_stock'?'Marcar disponible':'Marcar agotado'}
                            style={{padding:'3px 9px',borderRadius:8,fontSize:'.68rem',fontWeight:700,cursor:'pointer',border:'1.5px solid',
                              background: st==='out_of_stock'?'#dcfce7':'#fee2e2',
                              color:      st==='out_of_stock'?'#15803d':'#dc2626',
                              borderColor:st==='out_of_stock'?'#86efac':'#fca5a5'}}>
                            {st==='out_of_stock'?'↩ Reponer':'🚫 Agotar'}
                          </button>
                          <button onClick={() => openEditTopping(t)} className={styles.editBtn} style={{fontSize:'.7rem',padding:'3px 9px'}}>Editar</button>
                          <button onClick={() => deleteTopping(t.id)} className={styles.deleteBtn} style={{fontSize:'.7rem',padding:'3px 7px'}}>✕</button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Form nuevo topping en esta categoría */}
                {editingNewTop && (
                  <div style={{padding:'8px 12px',background:'#f0fdf4',borderTop:'1px solid #dcfce7'}}>
                    <ToppingInlineForm onCancel={() => setEditing(null)} />
                  </div>
                )}

                {/* Botón añadir topping en esta categoría */}
                {!editingNewTop && (
                  <button onClick={e=>{e.stopPropagation(); openNewTopping(cat.id)}}
                    style={{width:'100%',padding:'8px',border:'none',borderTop:'1px dashed #e5e7eb',
                      background:'#fafafa',color:'#6b7280',fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}>
                    + Añadir topping en {cat.name}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Sin categoría */}
      {uncategorized.length > 0 && (
        <div style={{marginBottom:16,border:'1.5px solid #e5e7eb',borderRadius:12,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#f8fafc',borderBottom:'1.5px solid #e5e7eb'}}>
            <strong style={{flex:1,color:'#6b7280',fontSize:'.88rem'}}>Sin categoría</strong>
            <span style={{fontSize:'.65rem',color:'#9ca3af',fontWeight:600}}>{uncategorized.length} topping{uncategorized.length!==1?'s':''}</span>
          </div>
          <div className={styles.itemsList}>
            {uncategorized.map(t => {
              const isEditingThis = editing?.type === 'topping' && editing.id === t.id
              const st = getToppingStatus(t); const cfg = STATUS_CFG[st]
              return (
                <div key={t.id}>
                  {isEditingThis ? (
                    <div style={{padding:'8px 12px',background:'#f0fdf4'}}>
                      <ToppingInlineForm onCancel={() => setEditing(null)} />
                    </div>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid #f3f4f6',background:'white'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                        {t.image_url ? <img src={t.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'1.2rem'}}>{t.emoji||'🍫'}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:'.85rem'}}>{t.name}</div>
                        <span style={{fontSize:'.72rem',color:'#6b7280',fontWeight:600}}>{t.extra_price>0?`+€${Number(t.extra_price).toFixed(2)}`:'Gratis'}</span>
                        <span style={{marginLeft:6,fontSize:'.62rem',fontWeight:700,padding:'1px 7px',borderRadius:20,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>{cfg.label}</span>
                      </div>
                      <button onClick={() => quickToggle(t)} style={{padding:'3px 9px',borderRadius:8,fontSize:'.68rem',fontWeight:700,cursor:'pointer',border:'1.5px solid',background:st==='out_of_stock'?'#dcfce7':'#fee2e2',color:st==='out_of_stock'?'#15803d':'#dc2626',borderColor:st==='out_of_stock'?'#86efac':'#fca5a5'}}>
                        {st==='out_of_stock'?'↩ Reponer':'🚫 Agotar'}
                      </button>
                      <button onClick={() => openEditTopping(t)} className={styles.editBtn} style={{fontSize:'.7rem',padding:'3px 9px'}}>Editar</button>
                      <button onClick={() => deleteTopping(t.id)} className={styles.deleteBtn} style={{fontSize:'.7rem'}}>✕</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {grouped.length === 0 && uncategorized.length === 0 && (
        <div className={styles.empty}>No hay toppings con ese filtro.</div>
      )}
    </div>
  )
}

// ============================================================
// COMBOS TAB
// ============================================================

export default ToppingsTab
