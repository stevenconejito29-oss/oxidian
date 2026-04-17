import React from 'react'
import { StockBadge } from '../ScarcityEngine'
import styles from './ProductAccessCard.module.css'

function formatPrice(value) {
  return `€${Number(value || 0).toFixed(2)}`
}

// ─── layout: delivery (original, sin cambios) ────────────────────────────────
function CardDelivery({ product, isStoreOpen, clubAccess, onAdd }) {
  const discountedPrice = product.discount_percent
    ? Number(product.price) * (1 - product.discount_percent / 100)
    : null
  const clubMeta = clubAccess || null
  const hasMedium = product.price_medium != null
  const hasLarge  = product.price_large  != null
  const hasSizes  = hasMedium || hasLarge
  const isCartLimitReached = product.is_cart_limit_reached === true
  const isDisabled = !isStoreOpen || product.out_of_stock || product.has_reached_daily_limit || isCartLimitReached
  const overlayLabel = product.has_reached_daily_limit ? 'LIMITE HOY'
    : isCartLimitReached ? 'MAX. CARRITO' : 'AGOTADO'

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className={`${styles.card} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onAdd(product)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.mediaWrap}>
        {product.image_url
          ? <img className={styles.media} src={product.image_url} alt={product.name} />
          : <div className={styles.emojiMedia}>{product.emoji || '🍨'}</div>
        }
        {product.discount_percent > 0 && !product.out_of_stock && (
          <span className={styles.discountBadge}>-{product.discount_percent}%</span>
        )}
        {product.out_of_stock && <div className={styles.stateOverlay}>{overlayLabel}</div>}
        {!product.out_of_stock && isCartLimitReached && <div className={styles.stateOverlay}>{overlayLabel}</div>}
        {!product.out_of_stock && !isStoreOpen && <div className={styles.stateOverlay}>CERRADO</div>}
        {hasSizes && !product.out_of_stock && (
          <div className={styles.sizePills}>
            <span className={styles.sizePill}>S</span>
            {hasMedium && <span className={styles.sizePill}>M</span>}
            {hasLarge  && <span className={styles.sizePill}>L</span>}
          </div>
        )}
        <div className={styles.nameOverlay}>
          <h3 className={styles.nameOverlayTitle}>{product.name}</h3>
        </div>
      </div>
      <div className={styles.body}>
        {clubMeta && <span className={styles.clubHint}>{clubMeta.emoji} {clubMeta.requirementLabel}</span>}
        {product.description && <p className={styles.description}>{product.description}</p>}
        <div className={styles.stockLine}>
          <StockBadge productName={product.name} outOfStock={product.out_of_stock}
            lowStock={product.low_stock} remainingToday={product.remaining_today} />
        </div>
        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            {discountedPrice ? (
              <>
                <span className={styles.originalPrice}>{formatPrice(product.price)}</span>
                <span className={styles.price}>{formatPrice(discountedPrice)}</span>
              </>
            ) : (
              <span className={styles.price}>{formatPrice(product.price)}</span>
            )}
            <span className={styles.priceHint}>{hasSizes ? 'desde' : 'precio único'}</span>
            {product.has_daily_limit && product.remaining_today > 0 && (
              <span className={styles.limitHint}>Quedan {product.remaining_today} hoy</span>
            )}
          </div>
          <button type="button" data-testid={`product-add-${product.id}`}
            className={styles.action} disabled={isDisabled}
            onClick={e => { e.stopPropagation(); if (!isDisabled) onAdd(product) }}
            aria-label={`Añadir ${product.name}`}>+</button>
        </div>
      </div>
    </article>
  )
}

// ─── layout: vitrina — grid e-commerce limpio, imagen horizontal ─────────────
function CardVitrina({ product, isStoreOpen, clubAccess, onAdd }) {
  const discountedPrice = product.discount_percent
    ? Number(product.price) * (1 - product.discount_percent / 100)
    : null
  const clubMeta = clubAccess || null
  const isCartLimitReached = product.is_cart_limit_reached === true
  const isDisabled = !isStoreOpen || product.out_of_stock || product.has_reached_daily_limit || isCartLimitReached

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className={`${styles.cardVitrina} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onAdd(product)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.mediaWrapVitrina}>
        {product.image_url
          ? <img className={styles.media} src={product.image_url} alt={product.name} />
          : <div className={styles.emojiMediaVitrina}>{product.emoji || '🍨'}</div>
        }
        {product.discount_percent > 0 && !product.out_of_stock && (
          <span className={styles.discountBadge}>-{product.discount_percent}%</span>
        )}
        {isDisabled && (
          <div className={styles.stateOverlay}>
            {product.has_reached_daily_limit ? 'LIMITE HOY'
              : isCartLimitReached ? 'MAX. CARRITO'
              : !isStoreOpen ? 'CERRADO' : 'AGOTADO'}
          </div>
        )}
      </div>
      <div className={styles.bodyVitrina}>
        {clubMeta && <span className={styles.clubHint}>{clubMeta.emoji} {clubMeta.requirementLabel}</span>}
        <h3 className={styles.namVitrina}>{product.name}</h3>
        {product.description && <p className={styles.descVitrina}>{product.description}</p>}
        <div className={styles.footerVitrina}>
          <div className={styles.priceBlock}>
            {discountedPrice ? (
              <>
                <span className={styles.originalPrice}>{formatPrice(product.price)}</span>
                <span className={styles.price}>{formatPrice(discountedPrice)}</span>
              </>
            ) : (
              <span className={styles.price}>{formatPrice(product.price)}</span>
            )}
          </div>
          <button type="button" data-testid={`product-add-${product.id}`}
            className={styles.actionVitrina} disabled={isDisabled}
            onClick={e => { e.stopPropagation(); if (!isDisabled) onAdd(product) }}
            aria-label={`Añadir ${product.name}`}>
            Añadir
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── layout: portfolio — fila horizontal, imagen cuadrada pequeña ─────────────
function CardPortfolio({ product, isStoreOpen, clubAccess, onAdd }) {
  const discountedPrice = product.discount_percent
    ? Number(product.price) * (1 - product.discount_percent / 100)
    : null
  const clubMeta = clubAccess || null
  const isCartLimitReached = product.is_cart_limit_reached === true
  const isDisabled = !isStoreOpen || product.out_of_stock || product.has_reached_daily_limit || isCartLimitReached

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className={`${styles.cardPortfolio} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onAdd(product)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.thumbPortfolio}>
        {product.image_url
          ? <img className={styles.thumbImg} src={product.image_url} alt={product.name} />
          : <div className={styles.thumbEmoji}>{product.emoji || '🍨'}</div>
        }
      </div>
      <div className={styles.textPortfolio}>
        {clubMeta && <span className={styles.clubHint}>{clubMeta.emoji} {clubMeta.requirementLabel}</span>}
        <h3 className={styles.namePortfolio}>{product.name}</h3>
        {product.description && <p className={styles.descPortfolio}>{product.description}</p>}
        <StockBadge productName={product.name} outOfStock={product.out_of_stock}
          lowStock={product.low_stock} remainingToday={product.remaining_today} />
      </div>
      <div className={styles.actPortfolio}>
        <div className={styles.priceBlock}>
          {discountedPrice ? (
            <>
              <span className={styles.originalPrice}>{formatPrice(product.price)}</span>
              <span className={styles.price}>{formatPrice(discountedPrice)}</span>
            </>
          ) : (
            <span className={styles.price}>{formatPrice(product.price)}</span>
          )}
        </div>
        <button type="button" data-testid={`product-add-${product.id}`}
          className={styles.action} disabled={isDisabled}
          onClick={e => { e.stopPropagation(); if (!isDisabled) onAdd(product) }}
          aria-label={`Añadir ${product.name}`}>+</button>
      </div>
    </article>
  )
}

// ─── layout: minimal — lista compacta sin imagen ─────────────────────────────
function CardMinimal({ product, isStoreOpen, clubAccess, onAdd }) {
  const discountedPrice = product.discount_percent
    ? Number(product.price) * (1 - product.discount_percent / 100)
    : null
  const clubMeta = clubAccess || null
  const isCartLimitReached = product.is_cart_limit_reached === true
  const isDisabled = !isStoreOpen || product.out_of_stock || product.has_reached_daily_limit || isCartLimitReached

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className={`${styles.cardMinimal} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onAdd(product)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <span className={styles.emojiMinimal}>{product.emoji || '•'}</span>
      <div className={styles.textMinimal}>
        {clubMeta && <span className={styles.clubHint}>{clubMeta.emoji} {clubMeta.requirementLabel}</span>}
        <h3 className={styles.nameMinimal}>{product.name}</h3>
        {product.description && <p className={styles.descMinimal}>{product.description}</p>}
      </div>
      <div className={styles.actMinimal}>
        {discountedPrice ? (
          <span className={styles.price}>{formatPrice(discountedPrice)}</span>
        ) : (
          <span className={styles.price}>{formatPrice(product.price)}</span>
        )}
        <button type="button" data-testid={`product-add-${product.id}`}
          className={styles.actionMinimal} disabled={isDisabled}
          onClick={e => { e.stopPropagation(); if (!isDisabled) onAdd(product) }}
          aria-label={`Añadir ${product.name}`}>+</button>
      </div>
    </article>
  )
}

// ─── export principal — elige variante según layout ──────────────────────────
export default function ProductAccessCard({ product, isStoreOpen, clubAccess, onAdd, layout = 'delivery' }) {
  if (layout === 'vitrina')   return <CardVitrina   product={product} isStoreOpen={isStoreOpen} clubAccess={clubAccess} onAdd={onAdd} />
  if (layout === 'portfolio') return <CardPortfolio product={product} isStoreOpen={isStoreOpen} clubAccess={clubAccess} onAdd={onAdd} />
  if (layout === 'minimal')   return <CardMinimal   product={product} isStoreOpen={isStoreOpen} clubAccess={clubAccess} onAdd={onAdd} />
  return <CardDelivery product={product} isStoreOpen={isStoreOpen} clubAccess={clubAccess} onAdd={onAdd} />
}
