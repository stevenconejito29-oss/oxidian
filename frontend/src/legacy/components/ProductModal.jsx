/**
 * ProductModal.jsx — CarmoCream v9
 * Jerarquía clara: producto → tamaño → toppings → cantidad → añadir
 * Secciones numeradas con iconos, toppings con precio destacado
 */
import React, { useMemo, useState } from 'react'
import styles from './ProductModal.module.css'
import { StockBadge } from './ScarcityEngine'

/* ── Helpers ── */
const SIZE_DATA = {
  small:  { label: 'Pequeño',  shortLabel: 'S',  description: 'Tamaño individual' },
  medium: { label: 'Mediano',  shortLabel: 'M',  description: 'Perfecto para compartir' },
  large:  { label: 'Grande',   shortLabel: 'L',  description: 'El más generoso' },
}

function getSizeDescription(product, size) {
  const fallback = SIZE_DATA[size]?.description || ''
  const raw = product?.size_descriptions

  if (!raw) return fallback

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed?.[size] || fallback
    } catch {
      return fallback
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw?.[size] || fallback
  }

  return fallback
}

function getProductPrice(product, size) {
  const d = 1 - (product.discount_percent || 0) / 100
  if (size === 'large'  && product.price_large  != null) return Number(product.price_large)  * d
  if (size === 'medium' && product.price_medium != null) return Number(product.price_medium) * d
  return Number(product.price || 0) * d
}

function fmt(v) {
  return `€${Number(v || 0).toFixed(2)}`
}

export default function ProductModal({ product, categories, onAdd, onClose, editMode, initialItem, loyaltyLevel }) {

  const availableSizes = useMemo(() => [
    'small',
    ...(product.price_medium != null ? ['medium'] : []),
    ...(product.price_large  != null ? ['large']  : []),
  ], [product])

  const [selectedSize,     setSelectedSize]     = useState(initialItem?.size     || availableSizes[0])
  const [selectedToppings, setSelectedToppings] = useState(initialItem?.toppings || {})
  const [quantity,         setQuantity]         = useState(initialItem?.qty      || 1)

  const requiredCategories = useMemo(() => categories.filter(cat => {
    const available = (cat.toppings || []).filter(t => t.available && !t.coming_soon && !t.out_of_stock)
    return cat.required && available.length > 0
  }), [categories])

  const missingRequiredCount = useMemo(() => requiredCategories.filter(cat => {
    if (cat.multi_select) {
      return !Array.isArray(selectedToppings[cat.id]) || selectedToppings[cat.id].length === 0
    }
    return !selectedToppings[cat.id]
  }).length, [requiredCategories, selectedToppings])

  /* Precio extra por toppings */
  const toppingsExtraRaw = useMemo(() => {
    return Object.values(selectedToppings).flat().filter(Boolean).reduce((sum, name) => {
      for (const cat of categories) {
        const t = cat.toppings?.find(t => t.name === name)
        if (t) return sum + Number(t.extra_price || 0)
      }
      return sum
    }, 0)
  }, [categories, selectedToppings])

  const freeToppingCredit = useMemo(() => {
    if (loyaltyLevel?.free_topping !== true) return 0

    let maxExtra = 0
    Object.values(selectedToppings).flat().filter(Boolean).forEach(name => {
      for (const cat of categories) {
        const topping = cat.toppings?.find(t => t.name === name)
        if (topping) maxExtra = Math.max(maxExtra, Number(topping.extra_price || 0))
      }
    })
    return maxExtra
  }, [categories, loyaltyLevel?.free_topping, selectedToppings])

  const toppingsExtra = Math.max(0, toppingsExtraRaw - freeToppingCredit)
  const unitPrice  = getProductPrice(product, selectedSize) + toppingsExtra
  const totalPrice = unitPrice * quantity

  function isSelected(catId, name, isMulti) {
    if (isMulti) return Array.isArray(selectedToppings[catId]) && selectedToppings[catId].includes(name)
    return selectedToppings[catId] === name
  }

  function toggleTopping(cat, name) {
    const isMulti = Boolean(cat.multi_select)
    const max     = Number(cat.max_selections || 0)
    setSelectedToppings(cur => {
      if (isMulti) {
        const prev = Array.isArray(cur[cat.id]) ? cur[cat.id] : []
        if (prev.includes(name)) return { ...cur, [cat.id]: prev.filter(v => v !== name) }
        if (max > 0 && prev.length >= max) return cur
        return { ...cur, [cat.id]: [...prev, name] }
      }
      return { ...cur, [cat.id]: cur[cat.id] === name ? null : name }
    })
  }

  function handleSubmit() {
    if (missingRequiredCount > 0) return
    const maxQty = Number(product.remaining_today)
    const safeQty = Number.isFinite(maxQty) && maxQty > 0 ? Math.min(quantity, maxQty) : quantity

    onAdd({
      id: product.id,
      product_name: product.name,
      emoji: product.emoji,
      image_url: product.image_url || null,
      size: selectedSize,
      price: unitPrice,
      qty: safeQty,
      toppings: selectedToppings,
      isCombo: false,
      club_free_topping_discount: freeToppingCredit > 0 ? freeToppingCredit : null,
      max_quantity: product.max_quantity || null,
      sold_today: product.sold_today || 0,
      remaining_today: product.remaining_today ?? null,
    })
  }

  /* ── Bloque de pasos visibles ── */
  let stepIndex = 1

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={product.name}>

        <div className={styles.handle} />

        {/* ════ CABECERA DEL PRODUCTO ════ */}
        <header className={styles.header}>
          <div className={styles.headerMediaWrap}>
            {product.image_url
              ? <img className={styles.headerMedia} src={product.image_url} alt={product.name} />
              : <div className={styles.headerEmoji}>{product.emoji || '🍨'}</div>
            }
          </div>

          <div className={styles.headerBody}>
            {/* Categoría / tipo */}
            <p className={styles.kicker}>
              {product.category ? String(product.category).toUpperCase() : 'POSTRE'}
            </p>
            <h2 className={styles.title}>{product.name}</h2>
            {product.description && <p className={styles.description}>{product.description}</p>}

            {/* Precio base visible ya en la cabecera */}
            <div className={styles.headerPrice}>
              <span className={styles.headerPriceValue}>{fmt(getProductPrice(product, selectedSize))}</span>
              {availableSizes.length > 1 && (
                <span className={styles.headerPriceHint}>tamaño {SIZE_DATA[selectedSize]?.label}</span>
              )}
            </div>

            <div className={styles.stockBadgeWrap}>
              <StockBadge
                productName={product.name}
                outOfStock={product.out_of_stock}
                lowStock={product.low_stock}
                remainingToday={product.remaining_today}
              />
            </div>
          </div>

          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        {/* ════ CUERPO SCROLLABLE ════ */}
        <div className={styles.body}>
          {missingRequiredCount > 0 && (
            <div className={styles.inlineNotice}>
              Completa {missingRequiredCount} {missingRequiredCount === 1 ? 'selección obligatoria' : 'selecciones obligatorias'} antes de añadir.
            </div>
          )}
          {product.has_daily_limit && Number(product.remaining_today) > 0 && (
            <div className={styles.inlineNotice}>
              Limite del dia activo: quedan {product.remaining_today} unidad{Number(product.remaining_today) === 1 ? '' : 'es'} disponibles.
            </div>
          )}
          {freeToppingCredit > 0 && (
            <div className={`${styles.inlineNotice} ${styles.clubNotice}`}>
              Club activo: se descuenta el topping extra mas caro de este producto.
            </div>
          )}

          {/* ── PASO 1: TAMAÑO ── */}
          {availableSizes.length > 1 && (() => {
            const idx = stepIndex++
            return (
              <section className={styles.block}>
                <div className={styles.blockHead}>
                  <div className={styles.stepBadge}>{idx}</div>
                  <div className={styles.blockHeadText}>
                    <h3 className={styles.blockTitle}>Elige el tamaño</h3>
                    <p className={styles.blockSubtitle}>Selecciona una opción</p>
                  </div>
                  <span className={styles.requiredTag}>Obligatorio</span>
                </div>

                <div className={styles.sizeGrid}>
                  {availableSizes.map(size => {
                    const sData     = SIZE_DATA[size]
                    const sPrice    = getProductPrice(product, size)
                    const isActive  = selectedSize === size
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`${styles.sizeButton} ${isActive ? styles.sizeButtonActive : ''}`}
                        onClick={() => setSelectedSize(size)}
                      >
                        <span className={styles.sizeMeta}>
                          <span className={styles.sizeName}>{sData.label}</span>
                          <span className={styles.sizeDesc}>{getSizeDescription(product, size)}</span>
                        </span>
                        <span className={styles.sizePrice}>{fmt(sPrice)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })()}

          {/* ── PASOS: TOPPINGS por categoría ── */}
          {categories.map(cat => {
            const available = (cat.toppings || []).filter(
              t => t.available && !t.coming_soon && !t.out_of_stock
            )
            if (available.length === 0) return null

            const isMulti   = Boolean(cat.multi_select)
            const maxSel    = Number(cat.max_selections || 0)
            const selCount  = isMulti && Array.isArray(selectedToppings[cat.id])
              ? selectedToppings[cat.id].length : 0
            const isRequired = cat.required
            const idx = stepIndex++

            return (
              <section key={cat.id} className={styles.block}>
                <div className={styles.blockHead}>
                  <div className={styles.stepBadge}>{idx}</div>
                  <div className={styles.blockHeadText}>
                    <h3 className={styles.blockTitle}>{cat.name}</h3>
                    <p className={styles.blockSubtitle}>
                      {isMulti
                        ? maxSel > 0
                          ? `Elige hasta ${maxSel} · ${selCount}/${maxSel} seleccionados`
                          : 'Puedes elegir varios'
                        : 'Elige una opción'}
                    </p>
                  </div>
                  {isRequired
                    ? <span className={styles.requiredTag}>Obligatorio</span>
                    : <span className={styles.optionalTag}>Opcional</span>
                  }
                </div>

                <div className={styles.toppingList}>
                  {available.map(topping => {
                    const active    = isSelected(cat.id, topping.name, isMulti)
                    const hasExtra  = Number(topping.extra_price || 0) > 0
                    const hasThumb  = topping.image_url || topping.emoji

                    return (
                      <button
                        key={topping.id}
                        type="button"
                        className={`${styles.toppingRow} ${active ? styles.toppingRowActive : ''}`}
                        onClick={() => toggleTopping(cat, topping.name)}
                      >
                        {/* Miniatura */}
                        {hasThumb && (
                          <div className={styles.toppingThumb}>
                            {topping.image_url
                              ? <img src={topping.image_url} alt="" className={styles.toppingThumbImg} />
                              : <span className={styles.toppingThumbEmoji}>{topping.emoji}</span>
                            }
                          </div>
                        )}

                        {/* Nombre + descripción */}
                        <div className={styles.toppingInfo}>
                          <span className={styles.toppingName}>{topping.name}</span>
                          {topping.description && (
                            <span className={styles.toppingDesc}>{topping.description}</span>
                          )}
                        </div>

                        {/* Precio extra */}
                        <span className={`${styles.toppingPrice} ${hasExtra ? styles.toppingPriceExtra : ''}`}>
                          {hasExtra ? `+${fmt(topping.extra_price)}` : 'Gratis'}
                        </span>

                        {/* Check / circle */}
                        <span className={`${styles.toppingCheck} ${active ? styles.toppingCheckActive : ''}`}>
                          {isMulti ? (active ? '✓' : '') : (active ? '●' : '')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

        </div>

        {/* ════ PIE: CANTIDAD + AÑADIR ════ */}
        <footer className={styles.footer}>
          {/* Selector de cantidad */}
          <div className={styles.qtyModule}>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              aria-label="Restar"
            >−</button>
            <span className={styles.qtyValue} aria-live="polite">{quantity}</span>
            <button
              type="button"
              className={styles.qtyBtn}
              onClick={() => setQuantity(q => {
                const limit = Number(product.remaining_today)
                if (Number.isFinite(limit) && limit > 0) return Math.min(limit, q + 1)
                return q + 1
              })}
              aria-label="Sumar"
            >+</button>
          </div>

          {/* Botón principal */}
          <button
            type="button"
            data-testid="product-modal-submit"
            className={styles.confirmButton}
            onClick={handleSubmit}
            disabled={missingRequiredCount > 0}
          >
            <span className={styles.confirmLabel}>
              {editMode ? 'Actualizar' : 'Añadir al pedido'}
            </span>
            <span className={styles.confirmPrice}>{fmt(totalPrice)}</span>
          </button>
        </footer>

      </section>
    </div>
  )
}
