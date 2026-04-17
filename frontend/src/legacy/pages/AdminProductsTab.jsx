import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { normalizeSearchText } from '../lib/adminUtils'
import { CLUB_LEVEL_OPTIONS } from '../lib/adminCatalogConstants'
import { EditFormIntro, MiniPreviewCard } from './AdminFormContext'
import {
  createEmptyProductSection,
  getProductSections,
  resolveProductSection,
  slugifySectionId,
} from '../lib/productSections'
import ImageSourceField from '../components/admin/ImageSourceField'
import styles from './Admin.module.css'

const PRODUCT_ICONS = {
  strawberry: '\u{1F353}',
  search: '\u{1F50D}',
  close: '\u2715',
}

function normalizeSizeDescriptions(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      small: raw.small || '',
      medium: raw.medium || '',
      large: raw.large || '',
    }
  }

  if (typeof raw === 'string') {
    try {
      return normalizeSizeDescriptions(JSON.parse(raw))
    } catch {
      return { small: '', medium: '', large: '' }
    }
  }

  return { small: '', medium: '', large: '' }
}


// ============================================================
// PRODUCTS TAB
// ============================================================
// Categorías de producto — se configuran de forma centralizada para productos y combos.

export default function AdminProductsTab({ storeId = 'default', products, toppingCategories, toppings, settings = [], onRefresh }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState({})
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sectionsForm, setSectionsForm] = useState([])
  const [savingSections, setSavingSections] = useState(false)
  const sectionsSettingRaw = settings.find(row => row.key === 'product_sections')?.value
  const productSections = useMemo(() => getProductSections(sectionsSettingRaw), [sectionsSettingRaw])

  useEffect(() => {
    setSectionsForm(productSections)
  }, [productSections])

  function startEdit(p) {
    setEditing(p.id)
    setForm({
      ...p,
      max_quantity: p.max_quantity ?? '',
      stock_limit_enabled: Number(p.max_quantity || 0) > 0,
      size_descriptions: normalizeSizeDescriptions(p.size_descriptions),
      topping_category_ids: Array.isArray(p.topping_category_ids) ? p.topping_category_ids : [],
      allowed_topping_ids:  Array.isArray(p.allowed_topping_ids)  ? p.allowed_topping_ids  : [],
      club_only: !!p.club_only,
      club_only_level: p.club_only_level || '',
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
    })
  }
  function startNew() {
    setEditing('new')
    setForm({
      name: '', description: '', price: '', price_medium: '', price_large: '',
      discount_percent: 0, cost_production: '', image_url: '', emoji: PRODUCT_ICONS.strawberry, available: true,
      out_of_stock: false, sort_order: 0, category: 'clasicos',
      max_quantity: '', stock_limit_enabled: false,
      size_descriptions: { small: '', medium: '', large: '' },
      topping_category_ids: [], allowed_topping_ids: [],
      club_only: false, club_only_level: '',
      tags: '',
    })
  }

  function addSection() {
    setSectionsForm(current => [...current, createEmptyProductSection()])
  }

  function updateSection(index, field, value) {
    setSectionsForm(current => current.map((section, currentIndex) => (
      currentIndex === index ? { ...section, [field]: value } : section
    )))
  }

  function removeSection(index) {
    setSectionsForm(current => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function saveSections() {
    const normalized = sectionsForm
      .map((section, index) => {
        const label = String(section.label || '').trim()
        const existingId = String(section.id || '').trim()
        return {
          id: existingId || slugifySectionId(label),
          label,
          icon: String(section.icon || '').trim() || '🍰',
          sort_order: Number(section.sort_order || (index + 1) * 10),
        }
      })
      .filter(section => section.label)

    if (normalized.length === 0) {
      toast.error('Necesitas al menos una sección')
      return
    }
    if (normalized.some(section => !section.id)) {
      toast.error('Hay secciones sin identificador válido')
      return
    }
    if (new Set(normalized.map(section => section.id)).size !== normalized.length) {
      toast.error('Hay secciones repetidas')
      return
    }

    setSavingSections(true)
    const payload = { store_id: storeId, key: 'product_sections', value: JSON.stringify(normalized) }
    let error = null
    try {
      const response = storeId === 'default'
        ? await supabase.from('settings').upsert({ key: 'product_sections', value: JSON.stringify(normalized) }, { onConflict: 'key' })
        : await supabase.from('store_settings').upsert(payload, { onConflict: 'store_id,key' })
      error = response.error
    } catch (responseError) {
      error = responseError
    }
    setSavingSections(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Secciones guardadas')
    onRefresh()
  }


  // Toggle categoría de topping — si se desmarca, limpia también sus toppings de allowed_topping_ids
  function toggleToppingCategory(catId) {
    setForm(f => {
      const catIds = Array.isArray(f.topping_category_ids) ? f.topping_category_ids : []
      const isRemoving = catIds.includes(catId)
      const newCatIds = isRemoving ? catIds.filter(id => id !== catId) : [...catIds, catId]
      // Si se quita la categoría, limpiar sus toppings del allowed list
      const catToppingIds = (toppings || []).filter(t => t.category_id === catId).map(t => t.id)
      const newAllowed = isRemoving
        ? (Array.isArray(f.allowed_topping_ids) ? f.allowed_topping_ids : []).filter(id => !catToppingIds.includes(id))
        : (Array.isArray(f.allowed_topping_ids) ? f.allowed_topping_ids : [])
      return { ...f, topping_category_ids: newCatIds, allowed_topping_ids: newAllowed }
    })
  }

  // Toggle topping individual dentro de una categoría
  function toggleAllowedTopping(toppingId) {
    setForm(f => {
      const current = Array.isArray(f.allowed_topping_ids) ? f.allowed_topping_ids : []
      return {
        ...f,
        allowed_topping_ids: current.includes(toppingId)
          ? current.filter(id => id !== toppingId)
          : [...current, toppingId],
      }
    })
  }

  // Seleccionar / deseleccionar todos los toppings de una categoría
  function toggleAllInCategory(catId) {
    const catToppings = (toppings || []).filter(t => t.category_id === catId)
    const allIds = catToppings.map(t => t.id)
    setForm(f => {
      const current = Array.isArray(f.allowed_topping_ids) ? f.allowed_topping_ids : []
      const allSelected = allIds.every(id => current.includes(id))
      return {
        ...f,
        allowed_topping_ids: allSelected
          ? current.filter(id => !allIds.includes(id))   // quitar todos
          : [...current, ...allIds.filter(id => !current.includes(id))], // añadir todos
      }
    })
  }

  async function save() {
    if (!form.name) { toast.error('El nombre es obligatorio'); return }
    const parsedPrice = parseFloat(String(form.price).replace(',', '.'))
    if (!form.price || isNaN(parsedPrice)) { toast.error('El precio es obligatorio y debe ser un número'); return }
    const parsedMaxQuantity = form.stock_limit_enabled
      ? parseInt(String(form.max_quantity || '').trim(), 10)
      : null
    if (form.stock_limit_enabled && (!Number.isInteger(parsedMaxQuantity) || parsedMaxQuantity <= 0)) {
      toast.error('El límite diario debe ser un número entero mayor que 0')
      return
    }
    const {
      stock_limit_enabled: _stockLimitEnabled,
      ...persistedForm
    } = form

    const data = { ...persistedForm,
      price:                parsedPrice,
      price_medium:         form.price_medium !== '' && form.price_medium != null ? (parseFloat(String(form.price_medium).replace(',', '.')) || null) : null,
      price_large:          form.price_large  !== '' && form.price_large  != null ? (parseFloat(String(form.price_large).replace(',', '.'))  || null) : null,
      cost_production:      form.cost_production !== '' && form.cost_production != null ? (parseFloat(String(form.cost_production).replace(',', '.')) || null) : null,
      discount_percent:     parseInt(form.discount_percent) || 0,
      sort_order:           parseInt(form.sort_order) || 0,
      image_url:            form.image_url?.trim() || null,
      size_descriptions:    normalizeSizeDescriptions(form.size_descriptions),
      topping_category_ids: Array.isArray(form.topping_category_ids) ? form.topping_category_ids : [],
      allowed_topping_ids:  Array.isArray(form.allowed_topping_ids)  ? form.allowed_topping_ids  : [],
      club_only:            form.club_only === true,
      club_only_level:      form.club_only === true ? (form.club_only_level || null) : null,
      max_quantity:         form.stock_limit_enabled ? parsedMaxQuantity : null,
      tags:                 String(form.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    }
    const legacyData = { ...data }
    delete legacyData.size_descriptions
    delete legacyData.tags
    if (editing === 'new') {
      const { error } = await supabase.from('products').insert([{ ...data, store_id: storeId }])
      if (error) {
        if (/tags/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('products').insert([{ ...legacyData, store_id: storeId }])
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tags para activar catalogo modular.', {
            style: { background: '#EFF6FF', color: '#1D4ED8' },
          })
          setEditing(null); onRefresh()
          return
        }
        if (/size_descriptions/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('products').insert([{ ...legacyData, store_id: storeId }])
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tamaños para guardar las descripciones.', {
            style: { background: '#FFF7ED', color: '#9A3412' },
          })
          setEditing(null); onRefresh()
          return
        }
        toast.error(error.message); return
      }
    } else {
      const { error } = await supabase.from('products').update(data).eq('id', editing).eq('store_id', storeId)
      if (error) {
        if (/tags/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('products').update(legacyData).eq('id', editing).eq('store_id', storeId)
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tags para activar catalogo modular.', {
            style: { background: '#EFF6FF', color: '#1D4ED8' },
          })
          setEditing(null); onRefresh()
          return
        }
        if (/size_descriptions/i.test(String(error.message || ''))) {
          const fallback = await supabase.from('products').update(legacyData).eq('id', editing).eq('store_id', storeId)
          if (fallback.error) { toast.error(fallback.error.message); return }
          toast.success('Guardado ✓')
          toast('Aplica la migracion de tamaños para guardar las descripciones.', {
            style: { background: '#FFF7ED', color: '#9A3412' },
          })
          setEditing(null); onRefresh()
          return
        }
        toast.error(error.message); return
      }
    }
    toast.success('Guardado ✓'); setEditing(null); onRefresh()
  }

  async function toggleStock(id, current) {
    const { error } = await supabase.from('products').update({ out_of_stock: !current }).eq('id', id).eq('store_id', storeId)
    if (error) { toast.error(error.message); return }
    toast(current ? '✅ Disponible' : '⚠️ Marcado como agotado')
    onRefresh()
  }
  async function toggleAvailable(id, current) {
    const { error } = await supabase.from('products').update({ available: !current }).eq('id', id).eq('store_id', storeId)
    if (error) { toast.error(error.message); return }
    onRefresh()
  }
  async function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return
    const { error } = await supabase.from('products').delete().eq('id', id).eq('store_id', storeId)
    if (error) { toast.error(error.message); return }
    toast.success('Eliminado'); onRefresh()
  }

  const formCatIds     = Array.isArray(form.topping_category_ids) ? form.topping_category_ids : []
  const formAllowedIds = Array.isArray(form.allowed_topping_ids)  ? form.allowed_topping_ids  : []
  const sizeDescriptions = normalizeSizeDescriptions(form.size_descriptions)
  const assignedCats   = (toppingCategories || []).filter(c => formCatIds.includes(c.id))
  const productSummary = {
    total: products.length,
    visible: products.filter(p => p.available !== false).length,
    hidden: products.filter(p => p.available === false).length,
    out: products.filter(p => p.out_of_stock).length,
  }
  const filteredProducts = products.filter(p => {
    const q = normalizeSearchText(`${p.name} ${p.description} ${p.category}`)
    if (search && !q.includes(normalizeSearchText(search))) return false
    if (statusFilter === 'visible' && p.available === false) return false
    if (statusFilter === 'hidden' && p.available !== false) return false
    if (statusFilter === 'stock' && p.out_of_stock) return false
    if (statusFilter === 'out' && !p.out_of_stock) return false
    if (categoryFilter !== 'all' && (p.category || '') !== categoryFilter) return false
    return true
  })

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Productos</h2>
        <button className={styles.addBtn} onClick={startNew}>+ Nuevo Producto</button>
      </div>

      <div className={styles.ordersSearchBar} style={{marginBottom:16}}>
        <div className={styles.ordersSearchInputWrap}>
          <span className={styles.ordersSearchIcon}>{PRODUCT_ICONS.search}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.ordersSearchInput}
            placeholder="Buscar producto, descripcion o seccion..."
          />
          {search && <button className={styles.ordersSearchClear} onClick={() => setSearch('')}>{PRODUCT_ICONS.close}</button>}
        </div>
        <div className={styles.ordersFilterChips}>
          {[
            ['all', `Todos (${productSummary.total})`],
            ['visible', `Visibles (${productSummary.visible})`],
            ['out', `Agotados (${productSummary.out})`],
            ['hidden', `Ocultos (${productSummary.hidden})`],
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
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={styles.input}
            style={{maxWidth:220, padding:'8px 12px', background:'white'}}
          >
            <option value="all">Todas las secciones</option>
            {productSections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.formCard} style={{ marginBottom:16 }}>
        <div className={styles.sectionsFormHeader}>
          <div>
            <h3 className={styles.sectionsFormTitle}>Secciones del menú</h3>
            <p className={styles.formHint}>Se usan en productos, combos y menú para mantener el catálogo alineado.</p>
          </div>
          <div className={styles.sectionsFormActions}>
            <button type="button" className={styles.cancelBtn} onClick={addSection}>+ Sección</button>
            <button type="button" className={styles.saveBtn} onClick={saveSections} disabled={savingSections}>
              {savingSections ? 'Guardando...' : 'Guardar secciones'}
            </button>
          </div>
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {sectionsForm
            .filter(section => String(section.label || '').trim())
            .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
            .map(section => (
              <span
                key={`${section.id || section.label}-preview`}
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:6,
                  padding:'6px 11px',
                  borderRadius:999,
                  background:'#F8FAFC',
                  border:'1px solid #E2E8F0',
                  fontSize:'.74rem',
                  fontWeight:800,
                  color:'#1F2937',
                }}
              >
                <span>{section.icon || '🍰'}</span>
                <span>{section.label}</span>
              </span>
            ))}
        </div>

        <div className={styles.adminChoiceGrid}>
          {sectionsForm.map((section, index) => (
            <div key={`${section.id || 'new'}-${index}`} className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>{section.label || `Sección ${index + 1}`}</div>
                  <div className={styles.adminFieldCardMeta}>{section.id || slugifySectionId(section.label) || 'slug pendiente'}</div>
                </div>
                <span className={styles.adminFieldCardBadge}>{section.icon || '🍰'}</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre visible</label>
                <input value={section.label || ''} onChange={e => updateSection(index, 'label', e.target.value)} className={styles.input} placeholder="Ej: Frutales premium" />
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Icono</label>
                  <input value={section.icon || ''} onChange={e => updateSection(index, 'icon', e.target.value)} className={styles.input} placeholder="🍰" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Orden</label>
                  <input type="number" value={section.sort_order ?? (index + 1) * 10} onChange={e => updateSection(index, 'sort_order', e.target.value)} className={styles.input} />
                </div>
              </div>
              <div className={styles.sectionCardFooter}>
                <span className={styles.formHint}>El identificador técnico se conserva para no romper productos ya cargados.</span>
                <button type="button" className={styles.deleteBtn} onClick={() => removeSection(index)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className={styles.formCard}>
          <h3>{editing === 'new' ? 'Nuevo Producto' : 'Editar Producto'}</h3>
          <EditFormIntro
            eyebrow="Producto"
            title="Ordena primero venta, despues personalizacion"
            description="Este editor prioriza lo que impacta en conversion y margen: escaparate, precio, stock y toppings permitidos."
            chips={[
              `Seccion: ${resolveProductSection(productSections, form.category || 'clasicos').label}`,
              `Tamanos activos: ${[form.price, form.price_medium, form.price_large].filter(value => value !== '' && value != null).length || 0}`,
              `Categorias topping: ${formCatIds.length}`,
            ]}
            aside={
              <MiniPreviewCard
                emoji={form.emoji || PRODUCT_ICONS.strawberry}
                imageUrl={form.image_url}
                title={form.name || 'Producto sin nombre'}
                lines={[
                  form.price ? `Desde EUR ${Number(form.price || 0).toFixed(2)}` : 'Precio pendiente',
                  form.cost_production ? `Coste EUR ${Number(form.cost_production || 0).toFixed(2)}` : 'Sin coste cargado',
                ]}
              />
            }
          />

          {/* Info básica */}
          <div className={styles.formGroup}><label className={styles.formLabel}>Nombre *</label><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className={styles.input} placeholder="Ej: Fresa con Crema" /></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Descripción</label><textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className={styles.textarea} rows={2} /></div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Sección del menú <span className={styles.formHint}>— agrupa los productos por categoría</span></label>
            <select value={form.category || 'clasicos'} onChange={e => setForm({...form, category: e.target.value})} className={styles.input}>
              {productSections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <p className={styles.formHint} style={{marginTop:4}}>Si falta una sección, créala arriba y vuelve a seleccionarla aquí.</p>
          </div>

          {/* Imagen + Emoji */}
          <div className={styles.formGrid2}>
            <ImageSourceField
              label="Imagen"
              hint="URL externa o archivo local"
              value={form.image_url || ''}
              onChange={image_url => setForm({ ...form, image_url })}
            />
            <div className={styles.formGroup}><label className={styles.formLabel}>Emoji fallback</label><input value={form.emoji || ''} onChange={e => setForm({...form, emoji: e.target.value})} className={styles.input} style={{maxWidth:'100px'}} /></div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tags del producto <span className={styles.formHint}>— separadas por coma</span></label>
            <input value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })} className={styles.input} placeholder="premium, temporada, regalo, sin-azucar" />
          </div>

          {/* Precios */}
          <div className={styles.formSectionDivider}>💰 Precios por tamaño <span className={styles.formHint}>(vacío = no disponible)</span></div>
          <div className={styles.adminChoiceGrid} style={{marginBottom:12}}>
            <div className={styles.formGroup}><label className={styles.formLabel}>Pequeña (€) *</label><input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({...form, price: e.target.value})} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Mediana (€)</label><input type="number" step="0.01" value={form.price_medium ?? ''} onChange={e => setForm({...form, price_medium: e.target.value})} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Grande (€)</label><input type="number" step="0.01" value={form.price_large ?? ''} onChange={e => setForm({...form, price_large: e.target.value})} className={styles.input} /></div>
          </div>
          <div className={styles.adminChoiceGrid} style={{marginBottom:12}}>
            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Pequeña</div>
                  <div className={styles.adminFieldCardMeta}>Guía de venta para el tamaño base</div>
                </div>
                <span className={styles.adminFieldCardBadge}>S</span>
              </div>
              <div className={styles.formGroup} style={{marginBottom:0}}>
                <label className={styles.formLabel}>Descripción del tamaño</label>
                <input value={sizeDescriptions.small || ''} onChange={e => setForm({...form, size_descriptions:{ ...sizeDescriptions, small: e.target.value }})} className={styles.input} placeholder="Tamaño individual y más rápido" />
                <p className={styles.formHint}>Se muestra al cliente al elegir tamaño.</p>
              </div>
            </div>
            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Mediana</div>
                  <div className={styles.adminFieldCardMeta}>Ayuda a subir ticket medio</div>
                </div>
                <span className={styles.adminFieldCardBadge}>M</span>
              </div>
              <div className={styles.formGroup} style={{marginBottom:0}}>
                <label className={styles.formLabel}>Descripción del tamaño</label>
                <input value={sizeDescriptions.medium || ''} onChange={e => setForm({...form, size_descriptions:{ ...sizeDescriptions, medium: e.target.value }})} className={styles.input} placeholder="Equilibrada para compartir" />
                <p className={styles.formHint}>Úsala para orientar al cliente y diferenciar la opción intermedia.</p>
              </div>
            </div>
            <div className={styles.adminFieldCard}>
              <div className={styles.adminFieldCardHead}>
                <div>
                  <div className={styles.adminFieldCardTitle}>Grande</div>
                  <div className={styles.adminFieldCardMeta}>Versión premium del postre</div>
                </div>
                <span className={styles.adminFieldCardBadge}>L</span>
              </div>
              <div className={styles.formGroup} style={{marginBottom:0}}>
                <label className={styles.formLabel}>Descripción del tamaño</label>
                <input value={sizeDescriptions.large || ''} onChange={e => setForm({...form, size_descriptions:{ ...sizeDescriptions, large: e.target.value }})} className={styles.input} placeholder="La más completa y generosa" />
                <p className={styles.formHint}>Ideal para explicar por qué merece el precio más alto.</p>
              </div>
            </div>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}><label className={styles.formLabel}>% Descuento global</label><input type="number" min="0" max="80" value={form.discount_percent || 0} onChange={e => setForm({...form, discount_percent: e.target.value})} className={styles.input} /></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Orden</label><input type="number" value={form.sort_order || 0} onChange={e => setForm({...form, sort_order: parseInt(e.target.value)})} className={styles.input} /></div>
          </div>

          {/* Coste de producción — activa inteligencia de margen */}
          <div className={styles.formGroup} style={{background:'linear-gradient(135deg,#F0FDF4,#ECFDF5)',borderRadius:14,padding:'14px 16px',border:'1.5px solid #A7F3D0'}}>
            <label className={styles.formLabel} style={{color:'#166534'}}>
              💰 Coste de producción (€) <span className={styles.formHint}>— activa la inteligencia de margen</span>
            </label>
            <input type="number" step="0.01" min="0"
              value={form.cost_production ?? ''}
              onChange={e => setForm({...form, cost_production: e.target.value})}
              className={styles.input} placeholder="ej: 1.50 — cuánto te cuesta hacer 1 unidad"
              style={{marginTop:8}}
            />
            {form.cost_production && Number(form.price) > 0 && (() => {
              const sell = Number(form.price || 0)
              const cost = Number(form.cost_production || 0) * 1.20 // +20% merma
              const margin = sell > 0 ? ((sell - cost) / sell * 100) : 0
              const icon = margin >= 35 ? '🟢' : margin >= 20 ? '🟡' : '🔴'
              const color = margin >= 35 ? '#166534' : margin >= 20 ? '#92400E' : '#991B1B'
              const bg = margin >= 35 ? '#D1FAE5' : margin >= 20 ? '#FEF3C7' : '#FEE2E2'
              return (
                <div style={{marginTop:8,background:bg,borderRadius:10,padding:'8px 14px',fontSize:'.82rem',fontWeight:900,color}}>
                  {icon} Margen real (con 20% merma): <strong>{margin.toFixed(1)}%</strong>
                  {margin < 35 && <span style={{fontWeight:700,fontSize:'.75rem',marginLeft:8}}>— objetivo: 35%+</span>}
                </div>
              )
            })()}
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}><input type="checkbox" checked={form.available !== false} onChange={e => setForm({...form, available: e.target.checked})} /> Visible en el menú</label>
            <label className={styles.checkLabel}><input type="checkbox" checked={!!form.out_of_stock} onChange={e => setForm({...form, out_of_stock: e.target.checked})} /> 🚫 Agotado</label>
          </div>

          <div className={styles.adminFieldCard} style={{ marginBottom: 12 }}>
            <div className={styles.adminFieldCardHead}>
              <div>
                <div className={styles.adminFieldCardTitle}>Límite opcional por día</div>
                <div className={styles.adminFieldCardMeta}>Controla cupos escasos y muestra disponibilidad real en el menú.</div>
              </div>
              <span className={styles.adminFieldCardBadge}>{form.stock_limit_enabled ? `${form.max_quantity || 0}/día` : '∞'}</span>
            </div>
            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={form.stock_limit_enabled === true}
                  onChange={e => setForm({
                    ...form,
                    stock_limit_enabled: e.target.checked,
                    max_quantity: e.target.checked ? (form.max_quantity || '10') : '',
                  })}
                />
                Activar límite diario para este producto
              </label>
            </div>
            {form.stock_limit_enabled && (
              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Unidades máximas al día</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.max_quantity ?? ''}
                    onChange={e => setForm({ ...form, max_quantity: e.target.value })}
                    className={styles.input}
                    placeholder="Ej: 25"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Reflejo en el menú</label>
                  <div className={styles.formHint} style={{ marginTop: 10 }}>
                    El cliente verá las unidades restantes del día y el producto quedará bloqueado automáticamente al agotarse.
                  </div>
                </div>
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
              Solo visible para Club
            </label>
          </div>
          {form.club_only === true && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nivel mínimo del Club</label>
              <select
                value={form.club_only_level || ''}
                onChange={e => setForm({...form, club_only_level: e.target.value})}
                className={styles.input}
              >
                {CLUB_LEVEL_OPTIONS.map(level => (
                  <option key={level.id || 'all'} value={level.id}>{level.label}</option>
                ))}
              </select>
              <p className={styles.formHint} style={{marginTop:4}}>
                Si lo dejas abierto, cualquier miembro del Club podrá verlo.
              </p>
            </div>
          )}

          {/* ── Sección de Toppings ── */}
          <div className={styles.formSectionDivider}>🍫 Toppings de este producto</div>

          {/* Paso 1: seleccionar categorías */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              1. Categorías permitidas
              <span className={styles.formHint}> — activa las que aplican a este producto</span>
            </label>
            {(!toppingCategories || toppingCategories.length === 0) && (
              <p className={styles.formHint} style={{marginTop:4}}>Crea categorías de toppings primero en la pestaña Toppings.</p>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
              {(toppingCategories || []).map(cat => {
                const active = formCatIds.includes(cat.id)
                const catCount = (toppings || []).filter(t => t.category_id === cat.id).length
                return (
                  <button key={cat.id} type="button" onClick={() => toggleToppingCategory(cat.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'6px 12px', borderRadius:20, fontSize:'.78rem', fontWeight:700,
                      cursor:'pointer', border:'2px solid', transition:'all .15s',
                      background:  active ? '#1B5E3B' : '#f9fafb',
                      color:       active ? '#fff'    : '#374151',
                      borderColor: active ? '#1B5E3B' : '#d1d5db',
                      boxShadow:   active ? '0 2px 8px rgba(27,94,59,0.2)' : 'none',
                    }}>
                    {active && <span style={{fontSize:'.68rem'}}>✓</span>}
                    {cat.emoji} {cat.name}
                    <span style={{opacity:.6, fontSize:'.68rem'}}>({catCount})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paso 2: por cada categoría activa, seleccionar toppings específicos */}
          {assignedCats.length > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                2. Toppings específicos por categoría
                <span className={styles.formHint}> — deja todos activos para permitirlos todos, o desactiva los que no apliquen</span>
              </label>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
                {assignedCats.map(cat => {
                  const catToppings = (toppings || []).filter(t => t.category_id === cat.id)
                  const allIds = catToppings.map(t => t.id)
                  // Si allowed_topping_ids está vacío para esta cat = todos permitidos (modo legacy)
                  // Normalizamos: si ningún topping de esta cat está en allowed → consideramos todos activos
                  const noneExplicit = allIds.every(id => !formAllowedIds.includes(id))
                  const effectiveActive = id => noneExplicit || formAllowedIds.includes(id)
                  const allChecked = allIds.every(id => effectiveActive(id))
                  return (
                    <div key={cat.id} style={{border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
                      {/* Header categoría con toggle-todo */}
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',background:'#f8fafc',borderBottom:'1px solid #e5e7eb'}}>
                        <span style={{fontWeight:800,fontSize:'.8rem',flex:1,color:'#1B5E3B'}}>{cat.emoji} {cat.name}</span>
                        {cat.multi_select && <span style={{fontSize:'.6rem',background:'#dbeafe',color:'#1d4ed8',padding:'1px 7px',borderRadius:10,fontWeight:700}}>MULTI</span>}
                        <button type="button" onClick={() => toggleAllInCategory(cat.id)}
                          style={{fontSize:'.68rem',fontWeight:700,padding:'3px 9px',borderRadius:8,cursor:'pointer',border:'1px solid #d1d5db',background:allChecked?'#dcfce7':'#f3f4f6',color:allChecked?'#15803d':'#6b7280'}}>
                          {allChecked ? '✓ Todos' : 'Ninguno'}
                        </button>
                      </div>
                      {/* Chips de toppings */}
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'9px 11px'}}>
                        {catToppings.length === 0 && <span style={{fontSize:'.75rem',color:'#9ca3af',fontStyle:'italic'}}>Sin toppings en esta categoría</span>}
                        {catToppings.map(t => {
                          const active = effectiveActive(t.id)
                          return (
                            <button key={t.id} type="button"
                              onClick={() => {
                                // Primera vez que se toca un topping de esta cat: inicializar todos como activos primero
                                if (noneExplicit) {
                                  setForm(f => ({
                                    ...f,
                                    allowed_topping_ids: [
                                      ...(Array.isArray(f.allowed_topping_ids) ? f.allowed_topping_ids : []),
                                      ...allIds,
                                    ]
                                  }))
                                  // Luego toggle el que se clickó (quitar porque todos estaban activos)
                                  setTimeout(() => toggleAllowedTopping(t.id), 0)
                                } else {
                                  toggleAllowedTopping(t.id)
                                }
                              }}
                              style={{
                                display:'flex', alignItems:'center', gap:5,
                                padding:'5px 11px', borderRadius:20, fontSize:'.75rem', fontWeight:700,
                                cursor:'pointer', border:'1.5px solid', transition:'all .15s',
                                background:  active ? '#1B5E3B' : '#f9fafb',
                                color:       active ? '#fff'    : '#9ca3af',
                                borderColor: active ? '#1B5E3B' : '#e5e7eb',
                                textDecoration: active ? 'none' : 'line-through',
                              }}>
                              {t.image_url
                                ? <img src={t.image_url} alt="" style={{width:18,height:18,borderRadius:'50%',objectFit:'cover'}} />
                                : t.emoji ? <span style={{fontSize:'.85rem'}}>{t.emoji}</span> : null
                              }
                              {t.name}
                              {t.extra_price > 0 && <span style={{opacity:.7,fontSize:'.65rem'}}>+€{Number(t.extra_price).toFixed(2)}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setEditing(null)}>Cancelar</button>
            <button className={styles.saveBtn} onClick={save}>Guardar</button>
          </div>
        </div>
      )}

      {/* Lista de productos */}
      <div className={styles.itemsList}>
        {filteredProducts.length === 0 && <div className={styles.empty}>No hay productos con ese filtro.</div>}
        {filteredProducts.map(p => {
          const catCount = Array.isArray(p.topping_category_ids) ? p.topping_category_ids.length : 0
          return (
            <div key={p.id} className={`${styles.itemRow} ${!p.available ? styles.itemUnavailable : ''} ${p.out_of_stock ? styles.itemOutOfStock : ''}`}>
              <div className={styles.itemThumb}>{p.image_url ? <img src={p.image_url} alt={p.name} className={styles.itemThumbImg} /> : <span className={styles.itemEmoji}>{p.emoji}</span>}</div>
              <div className={styles.itemInfo}>
                <strong>{p.name}</strong>
                <span>
                  {p.category && <span style={{fontSize:'.65rem',background:'#f3f4f6',color:'#6b7280',borderRadius:4,padding:'1px 6px',marginRight:4,fontWeight:600}}>{resolveProductSection(productSections, p.category).label}</span>}
                  P:€{Number(p.price).toFixed(2)}{p.price_medium!=null&&` · M:€${Number(p.price_medium).toFixed(2)}`}{p.price_large!=null&&` · G:€${Number(p.price_large).toFixed(2)}`}
                  {p.discount_percent>0&&<span style={{color:'#DC2626',marginLeft:4}}>−{p.discount_percent}%</span>}
                  {Number(p.max_quantity || 0) > 0 && <span style={{marginLeft:4,fontSize:'.62rem',background:'#FEF3C7',color:'#92400E',border:'1px solid #FCD34D',borderRadius:10,padding:'1px 6px',fontWeight:700}}>Cupo {p.max_quantity}/día</span>}
                  {catCount > 0 && <span style={{marginLeft:4,fontSize:'.62rem',background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',borderRadius:10,padding:'1px 6px',fontWeight:700}}>🍫 {catCount} cat.</span>}
                  {p.club_only && <span style={{marginLeft:4,fontSize:'.62rem',background:'#1C3829',color:'white',border:'1px solid #2D6A4F',borderRadius:10,padding:'1px 6px',fontWeight:700}}>⭐ Club{p.club_only_level ? ` · ${p.club_only_level}` : ''}</span>}
                  {Array.isArray(p.tags) && p.tags.length > 0 && <span style={{marginLeft:4,fontSize:'.62rem',background:'#EFF6FF',color:'#1D4ED8',border:'1px solid #BFDBFE',borderRadius:10,padding:'1px 6px',fontWeight:700}}>🏷 {p.tags.slice(0, 2).join(', ')}</span>}
                  {p.out_of_stock&&<span className={styles.outStockTag}>&nbsp;· AGOTADO</span>}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button onClick={() => toggleStock(p.id, p.out_of_stock)} className={p.out_of_stock ? styles.stockOutChip : styles.stockOkChip}>{p.out_of_stock ? '🚫 Agotado' : '✅ Stock'}</button>
                <button onClick={() => toggleAvailable(p.id, p.available)} className={p.available ? styles.activeChip : styles.inactiveChip}>{p.available ? 'Activo' : 'Inactivo'}</button>
                <button onClick={() => startEdit(p)} className={styles.editBtn}>Editar</button>
                <button onClick={() => deleteProduct(p.id)} className={styles.deleteBtn}>Eliminar</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
