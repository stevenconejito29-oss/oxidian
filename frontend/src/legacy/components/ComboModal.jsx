import React, { useMemo, useState } from 'react'
import styles from './ComboModal.module.css'

const SIZE_LABELS = {
  small: 'Pequeno',
  medium: 'Mediano',
  large: 'Grande',
}

function fmt(v) {
  return `\u20AC${Number(v || 0).toFixed(2)}`
}

function getProductPrice(product, size) {
  const d = 1 - (product.discount_percent || 0) / 100
  if (size === 'large' && product.price_large != null) return Number(product.price_large) * d
  if (size === 'medium' && product.price_medium != null) return Number(product.price_medium) * d
  return Number(product.price || 0) * d
}

function getComboSlots(combo) {
  try {
    if (!combo.combo_slots) return []
    if (Array.isArray(combo.combo_slots)) return combo.combo_slots
    if (typeof combo.combo_slots === 'string') return JSON.parse(combo.combo_slots)
    if (typeof combo.combo_slots === 'object') return Object.values(combo.combo_slots)
    return []
  } catch {
    return []
  }
}

function flattenToppings(obj) {
  if (!obj) return []
  return Object.values(obj).flat().filter(v => v && typeof v === 'string' && v !== 'null')
}

function isCategoryComplete(cat, toppings) {
  if (!cat.required) return true
  if (cat.multi_select) {
    return Array.isArray(toppings?.[cat.id]) && toppings[cat.id].length > 0
  }
  return Boolean(toppings?.[cat.id])
}

export default function ComboModal({
  combo,
  products,
  categories,
  onAdd,
  onClose,
  editMode,
  initialItem,
  hideExtraPrices,
  loyaltyLevel,
}) {
  const slots = useMemo(() => getComboSlots(combo), [combo])
  const slotCount = slots.length || combo.max_items || 2

  const [step, setStep] = useState(0)
  const [config, setConfig] = useState(() => {
    if (editMode && initialItem?.combo_items) {
      return initialItem.combo_items.map(item => ({
        product: products.find(p => p.id === item.productId) || null,
        size: item.size || 'small',
        toppings: item.toppings_raw || {},
      }))
    }
    return Array.from({ length: slotCount }, () => ({
      product: null,
      size: 'small',
      toppings: {},
    }))
  })

  function getProductsForSlot(i) {
    const ids = slots[i]?.allowed_product_ids || []
    return ids.length > 0 ? products.filter(p => ids.includes(p.id)) : products
  }

  function getCategoriesForSlot(i) {
    const slot = slots[i]
    const selectedProduct = config[i]?.product
    const allowedCategoryIds = slot?.allowed_topping_category_ids || []

    let cats = allowedCategoryIds.length > 0
      ? categories.filter(c => allowedCategoryIds.includes(c.id))
      : [...categories]

    const productCategoryIds = Array.isArray(selectedProduct?.topping_category_ids)
      ? selectedProduct.topping_category_ids
      : null
    const allowedToppingIds = Array.isArray(selectedProduct?.allowed_topping_ids)
      ? selectedProduct.allowed_topping_ids
      : []

    if (productCategoryIds) {
      cats = cats.filter(c => productCategoryIds.includes(c.id))
    }

    if (allowedToppingIds.length > 0) {
      cats = cats
        .map(c => ({
          ...c,
          toppings: (c.toppings || []).filter(t => allowedToppingIds.includes(t.id)),
        }))
        .filter(c => c.toppings.length > 0)
    }

    return cats
  }

  function getSizes(product) {
    if (!product) return ['small']
    return [
      'small',
      ...(product.price_medium != null ? ['medium'] : []),
      ...(product.price_large != null ? ['large'] : []),
    ]
  }

  function selectProduct(index, product) {
    setConfig(cur => {
      const next = [...cur]
      next[index] = {
        product,
        size: getSizes(product)[0],
        toppings: {},
      }
      return next
    })
  }

  function selectSize(index, size) {
    setConfig(cur => {
      const next = [...cur]
      next[index] = { ...next[index], size }
      return next
    })
  }

  function toggleTopping(index, cat, name) {
    const isMulti = Boolean(cat.multi_select)
    const max = Number(cat.max_selections || 0)

    setConfig(cur => {
      const next = [...cur]
      const currentToppings = next[index].toppings || {}

      if (isMulti) {
        const prev = Array.isArray(currentToppings[cat.id]) ? currentToppings[cat.id] : []
        if (prev.includes(name)) {
          next[index] = {
            ...next[index],
            toppings: { ...currentToppings, [cat.id]: prev.filter(v => v !== name) },
          }
        } else if (max > 0 && prev.length >= max) {
          return cur
        } else {
          next[index] = {
            ...next[index],
            toppings: { ...currentToppings, [cat.id]: [...prev, name] },
          }
        }
      } else {
        next[index] = {
          ...next[index],
          toppings: { ...currentToppings, [cat.id]: currentToppings[cat.id] === name ? null : name },
        }
      }

      return next
    })
  }

  function isToppingSelected(index, catId, name, isMulti) {
    const toppings = config[index]?.toppings || {}
    if (isMulti) return Array.isArray(toppings[catId]) && toppings[catId].includes(name)
    return toppings[catId] === name
  }

  const completedSteps = config.filter(slot => slot.product).length
  const allComplete = completedSteps === slotCount
  const isSummaryStep = step >= slotCount
  const slotCfg = !isSummaryStep ? config[step] : null
  const slotLabel = slots[step]?.label || `Producto ${step + 1}`
  const slotProducts = !isSummaryStep ? getProductsForSlot(step) : []
  const slotCategories = !isSummaryStep && slotCfg?.product ? getCategoriesForSlot(step) : []
  const sizes = !isSummaryStep ? getSizes(slotCfg?.product) : []
  const hasSizes = sizes.length > 1
  const requiredCategoriesComplete = slotCategories.every(cat => isCategoryComplete(cat, slotCfg?.toppings))
  const canAdvanceStep = Boolean(slotCfg?.product) && requiredCategoriesComplete

  const totalPrice = useMemo(() => {
    const extra = config.reduce((sum, slot) => {
      const slotExtras = Object.values(slot.toppings || {}).flat().filter(Boolean).reduce((acc, name) => {
        for (const cat of categories) {
          const topping = cat.toppings?.find(t => t.name === name)
          if (topping) return acc + Number(topping.extra_price || 0)
        }
        return acc
      }, 0)

      if (loyaltyLevel?.free_topping !== true) return sum + slotExtras

      const bestFree = Object.values(slot.toppings || {}).flat().filter(Boolean).reduce((max, name) => {
        for (const cat of categories) {
          const topping = cat.toppings?.find(t => t.name === name)
          if (topping) return Math.max(max, Number(topping.extra_price || 0))
        }
        return max
      }, 0)

      return sum + Math.max(0, slotExtras - bestFree)
    }, 0)

    if (combo.price && Number(combo.price) > 0) return Number(combo.price) + extra

    return config.reduce((sum, slot) => {
      if (!slot.product) return sum
      return sum + getProductPrice(slot.product, slot.size)
    }, 0) + extra
  }, [categories, combo.price, config])

  function handleSubmit() {
    if (!allComplete) return

    onAdd({
      isCombo: true,
      comboId: combo.id,
      product_name: combo.name,
      emoji: combo.emoji || '🎁',
      image_url: combo.image_url || null,
      price: totalPrice,
      qty: editMode && initialItem?.qty ? initialItem.qty : 1,
      max_quantity: combo.max_quantity || null,
      sold_today: combo.sold_today || 0,
      remaining_today: combo.remaining_today ?? null,
      combo_items: config.map(slot => ({
        productId: slot.product.id,
        productName: slot.product.name,
        size: slot.size,
        emoji: slot.product.emoji || '🍨',
        toppings: flattenToppings(slot.toppings),
        toppings_raw: slot.toppings,
        club_free_topping_discount: loyaltyLevel?.free_topping === true
          ? Object.values(slot.toppings || {}).flat().filter(Boolean).reduce((max, name) => {
              for (const cat of categories) {
                const topping = cat.toppings?.find(t => t.name === name)
                if (topping) return Math.max(max, Number(topping.extra_price || 0))
              }
              return max
            }, 0) || null
          : null,
      })),
    })
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={combo.name}>
        <div className={styles.handle} />

        <header className={styles.header}>
          <div className={styles.headerMedia}>
            {combo.image_url
              ? <img className={styles.headerImg} src={combo.image_url} alt={combo.name} />
              : <div className={styles.headerEmoji}>{combo.emoji || '🎁'}</div>}
          </div>

          <div className={styles.headerContent}>
            <p className={styles.kicker}>Combo personalizado</p>
            <h2 className={styles.title}>{combo.name}</h2>
            <p className={styles.description}>
              Elige {slotCount} {slotCount === 1 ? 'producto' : 'productos'} con un flujo claro y sin sorpresas.
            </p>
            {loyaltyLevel?.free_topping === true && (
              <div className={styles.clubNotice}>
                Club activo: se descuenta el topping extra mas caro de cada producto del combo.
              </div>
            )}

            <div className={styles.headerMeta}>
              <span className={styles.headerMetaPill}>{slotCount} pasos</span>
              <span className={styles.headerMetaPrice}>{fmt(totalPrice)}</span>
            </div>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className={styles.progressWrap}>
          {Array.from({ length: slotCount }, (_, index) => {
            const isDone = Boolean(config[index]?.product)
            const isActive = index === step && !isSummaryStep
            return (
              <button
                key={index}
                type="button"
                className={`${styles.progressStep} ${isActive ? styles.progressStepActive : ''} ${isDone ? styles.progressStepDone : ''}`}
                onClick={() => setStep(index)}
              >
                <span className={styles.progressStepNum}>{isDone ? '✓' : index + 1}</span>
                <span className={styles.progressStepText}>
                  {config[index]?.product?.name || slots[index]?.label || `Paso ${index + 1}`}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className={`${styles.progressStep} ${isSummaryStep ? styles.progressStepActive : ''} ${allComplete ? styles.progressStepDone : styles.progressStepDisabled}`}
            disabled={!allComplete}
            onClick={() => allComplete && setStep(slotCount)}
          >
            <span className={styles.progressStepNum}>{allComplete ? '✓' : slotCount + 1}</span>
            <span className={styles.progressStepText}>Resumen</span>
          </button>
        </div>

        <div className={styles.body}>
          {!isSummaryStep && (
            <div className={styles.panel}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <div>
                    <p className={styles.sectionEyebrow}>Paso {step + 1}</p>
                    <h3 className={styles.sectionTitle}>Elige {slotLabel}</h3>
                  </div>
                  {slotCfg?.product && (
                    <button type="button" className={styles.linkBtn} onClick={() => selectProduct(step, slotCfg.product)}>
                      Cambiar
                    </button>
                  )}
                </div>

                <div className={styles.productList}>
                  {slotProducts.map(product => {
                    const selected = slotCfg?.product?.id === product.id
                    const disabled = !product.available || product.out_of_stock

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`${styles.productRow} ${selected ? styles.productRowSelected : ''} ${disabled ? styles.productRowDisabled : ''}`}
                        disabled={disabled}
                        onClick={() => selectProduct(step, product)}
                      >
                        <div className={styles.productThumb}>
                          {product.image_url
                            ? <img src={product.image_url} alt="" className={styles.productThumbImg} />
                            : <span className={styles.productThumbEmoji}>{product.emoji || '🍨'}</span>}
                        </div>

                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{product.name}</span>
                          {product.description && <span className={styles.productDesc}>{product.description}</span>}
                        </div>

                        <div className={styles.productRight}>
                          {!hideExtraPrices && (
                            <span className={styles.productPrice}>{fmt(getProductPrice(product, 'small'))}</span>
                          )}
                          <span className={`${styles.checkBadge} ${selected ? styles.checkBadgeOn : ''}`}>
                            {selected ? '✓' : ''}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {slotCfg?.product && hasSizes && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHead}>
                    <div>
                      <p className={styles.sectionEyebrow}>Tamano</p>
                      <h3 className={styles.sectionTitle}>Ajusta el tamano</h3>
                    </div>
                    <span className={styles.sectionHint}>Opcional segun producto</span>
                  </div>

                  <div className={styles.sizeGrid}>
                    {sizes.map(size => {
                      const selected = slotCfg.size === size
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`${styles.sizeChip} ${selected ? styles.sizeChipSelected : ''}`}
                          onClick={() => selectSize(step, size)}
                        >
                          <span className={styles.sizeChipLabel}>{SIZE_LABELS[size]}</span>
                          {!hideExtraPrices && (
                            <span className={styles.sizeChipPrice}>{fmt(getProductPrice(slotCfg.product, size))}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {slotCfg?.product && slotCategories.map(cat => {
                const available = (cat.toppings || []).filter(t => t.available && !t.coming_soon && !t.out_of_stock)
                if (available.length === 0) return null

                const isMulti = Boolean(cat.multi_select)
                const maxSelections = Number(cat.max_selections || 0)
                const selectedCount = isMulti && Array.isArray(slotCfg?.toppings?.[cat.id])
                  ? slotCfg.toppings[cat.id].length
                  : 0

                return (
                  <section key={cat.id} className={styles.sectionCard}>
                    <div className={styles.sectionHead}>
                      <div>
                        <p className={styles.sectionEyebrow}>{cat.required ? 'Obligatorio' : 'Opcional'}</p>
                        <h3 className={styles.sectionTitle}>{cat.name}</h3>
                      </div>
                      <div className={styles.sectionTags}>
                        {isMulti && maxSelections > 0 && (
                          <span className={styles.counterTag}>{selectedCount}/{maxSelections}</span>
                        )}
                        <span className={`${styles.stateTag} ${cat.required ? styles.stateTagRequired : styles.stateTagOptional}`}>
                          {cat.required ? 'Elegir' : 'Si quieres'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.toppingList}>
                      {available.map(topping => {
                        const active = isToppingSelected(step, cat.id, topping.name, isMulti)
                        const hasExtra = Number(topping.extra_price || 0) > 0

                        return (
                          <button
                            key={topping.id}
                            type="button"
                            className={`${styles.toppingRow} ${active ? styles.toppingRowActive : ''}`}
                            onClick={() => toggleTopping(step, cat, topping.name)}
                          >
                            {(topping.image_url || topping.emoji) && (
                              <div className={styles.toppingThumb}>
                                {topping.image_url
                                  ? <img src={topping.image_url} alt="" className={styles.toppingThumbImg} />
                                  : <span className={styles.toppingThumbEmoji}>{topping.emoji}</span>}
                              </div>
                            )}

                            <div className={styles.toppingInfo}>
                              <span className={styles.toppingName}>{topping.name}</span>
                              {topping.description && <span className={styles.toppingDesc}>{topping.description}</span>}
                            </div>

                            <span className={`${styles.toppingPrice} ${hasExtra ? styles.toppingPriceExtra : ''}`}>
                              {hasExtra ? `+${fmt(topping.extra_price)}` : 'Incluido'}
                            </span>

                            <span className={`${styles.checkBadge} ${active ? styles.checkBadgeOn : ''}`}>
                              {active ? '✓' : ''}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {isSummaryStep && (
            <div className={styles.panel}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <div>
                    <p className={styles.sectionEyebrow}>Ultimo paso</p>
                    <h3 className={styles.sectionTitle}>Revisa tu combo</h3>
                  </div>
                  <span className={styles.sectionHint}>Todo listo para anadir</span>
                </div>

                <div className={styles.summaryList}>
                  {config.map((slot, index) => (
                    <button
                      key={index}
                      type="button"
                      className={styles.summaryRow}
                      onClick={() => setStep(index)}
                    >
                      <div className={styles.summaryThumb}>
                        {slot.product?.image_url
                          ? <img src={slot.product.image_url} alt="" className={styles.summaryThumbImg} />
                          : <span className={styles.summaryThumbEmoji}>{slot.product?.emoji || '🍨'}</span>}
                      </div>

                      <div className={styles.summaryInfo}>
                        <span className={styles.summarySlot}>{slots[index]?.label || `Producto ${index + 1}`}</span>
                        <span className={styles.summaryName}>{slot.product?.name}</span>
                        <span className={styles.summaryMeta}>
                          {SIZE_LABELS[slot.size] || SIZE_LABELS.small}
                          {flattenToppings(slot.toppings).length > 0
                            ? ` · ${flattenToppings(slot.toppings).join(' · ')}`
                            : ''}
                        </span>
                      </div>

                      <span className={styles.summaryEdit}>Editar</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerPriceBlock}>
            <span className={styles.footerLabel}>Total del combo</span>
            <strong className={styles.footerPrice}>{fmt(totalPrice)}</strong>
          </div>

          <div className={styles.footerActions}>
            {step > 0 && (
              <button type="button" className={styles.secondaryBtn} onClick={() => setStep(s => Math.max(0, s - 1))}>
                Atras
              </button>
            )}

            {!isSummaryStep && (
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!canAdvanceStep}
                onClick={() => setStep(step === slotCount - 1 ? slotCount : step + 1)}
              >
                {step === slotCount - 1 ? 'Ver resumen' : 'Continuar'}
              </button>
            )}

            {isSummaryStep && (
              <button type="button" className={styles.primaryBtn} onClick={handleSubmit}>
                {editMode ? 'Actualizar combo' : 'Anadir combo'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}
