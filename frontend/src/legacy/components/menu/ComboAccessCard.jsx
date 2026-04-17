import React from 'react'
import styles from './ComboAccessCard.module.css'

function formatPrice(value) {
  return value ? `€${Number(value).toFixed(2)}` : 'Ver precio'
}
function getSlotCount(combo) {
  try {
    if (!combo.combo_slots) return combo.max_items || 2
    const slots = Array.isArray(combo.combo_slots) ? combo.combo_slots
      : typeof combo.combo_slots === 'string' ? JSON.parse(combo.combo_slots)
      : Object.values(combo.combo_slots)
    return slots.length || combo.max_items || 2
  } catch { return combo.max_items || 2 }
}

// ─── delivery (original) ─────────────────────────────────────────────────────
function ComboDelivery({ combo, isStoreOpen, isLimitReached, clubAccess, onOpen }) {
  const isDisabled = !isStoreOpen || isLimitReached || combo.out_of_stock
  const slotCount  = getSlotCount(combo)
  const clubMeta   = clubAccess || null

  return (
    <article
      data-testid={`combo-card-${combo.id}`}
      className={`${styles.card} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onOpen(combo)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.mediaWrap}>
        {combo.image_url
          ? <img className={styles.media} src={combo.image_url} alt={combo.name} />
          : <div className={styles.emojiMedia}>{combo.emoji || '🎁'}</div>
        }
        {combo.discount_percent > 0 && <span className={styles.discountBadge}>-{combo.discount_percent}%</span>}
        {clubMeta && !isLimitReached && !combo.out_of_stock && (
          <span className={styles.clubBadge}><span>{clubMeta.emoji}</span><span>{clubMeta.badgeLabel}</span></span>
        )}
        {!isLimitReached && !combo.out_of_stock && <span className={styles.slotsBadge}>{slotCount} postres</span>}
        {combo.max_quantity && <span className={styles.limitBadge}>{combo.remaining_today > 0 ? `${combo.remaining_today} hoy` : 'Limitado'}</span>}
        {(isLimitReached || combo.out_of_stock) && <div className={styles.stateOverlay}>{combo.has_reached_daily_limit ? 'LÍMITE HOY' : 'AGOTADO'}</div>}
        {!isLimitReached && !isStoreOpen && <div className={styles.stateOverlay}>CERRADO</div>}
        <div className={styles.nameOverlay}>
          <div className={styles.nameOverlayKicker}>Combo especial</div>
          <h3 className={styles.nameOverlayTitle}>{combo.name}</h3>
        </div>
      </div>
      <div className={styles.body}>
        {clubMeta && (
          <div className={styles.clubSignal}>
            <span className={styles.clubSignalEyebrow}>{clubMeta.requirementLabel}</span>
            <span className={styles.clubSignalText}>{clubMeta.unlockedLabel}</span>
          </div>
        )}
        {combo.description && <p className={styles.description}>{combo.description}</p>}
        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            <span className={styles.price}>{formatPrice(combo.price)}</span>
            <span className={styles.priceHint}>precio combo</span>
            {combo.has_daily_limit && combo.remaining_today > 0 && (
              <span className={styles.remainingHint}>Quedan {combo.remaining_today} hoy</span>
            )}
          </div>
          <button type="button" data-testid={`combo-add-${combo.id}`}
            className={styles.action} disabled={isDisabled}
            aria-label={`Elegir combo ${combo.name}`}
            onClick={e => { e.stopPropagation(); if (!isDisabled) onOpen(combo) }}>+</button>
        </div>
      </div>
    </article>
  )
}

// ─── vitrina ─────────────────────────────────────────────────────────────────
function ComboVitrina({ combo, isStoreOpen, isLimitReached, clubAccess, onOpen }) {
  const isDisabled = !isStoreOpen || isLimitReached || combo.out_of_stock
  const slotCount  = getSlotCount(combo)
  const clubMeta   = clubAccess || null

  return (
    <article
      data-testid={`combo-card-${combo.id}`}
      className={`${styles.cardVitrina} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onOpen(combo)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.mediaWrapVitrina}>
        {combo.image_url
          ? <img className={styles.media} src={combo.image_url} alt={combo.name} />
          : <div className={styles.emojiMediaVitrina}>{combo.emoji || '🎁'}</div>
        }
        {combo.discount_percent > 0 && <span className={styles.discountBadge}>-{combo.discount_percent}%</span>}
        {isDisabled && (
          <div className={styles.stateOverlay}>
            {combo.has_reached_daily_limit ? 'LÍMITE HOY' : !isStoreOpen ? 'CERRADO' : 'AGOTADO'}
          </div>
        )}
        <span className={styles.slotsBadgeVitrina}>{slotCount} ítems</span>
      </div>
      <div className={styles.bodyVitrina}>
        {clubMeta && (
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--club-text,#166534)', opacity: 0.72 }}>
            {clubMeta.emoji} {clubMeta.requirementLabel}
          </span>
        )}
        <h3 className={styles.namVitrina}>{combo.name}</h3>
        {combo.description && <p className={styles.descVitrina}>{combo.description}</p>}
        <div className={styles.footerVitrina}>
          <div className={styles.priceBlock}>
            <span className={styles.price}>{formatPrice(combo.price)}</span>
          </div>
          <button type="button" data-testid={`combo-add-${combo.id}`}
            className={styles.actionVitrina} disabled={isDisabled}
            onClick={e => { e.stopPropagation(); if (!isDisabled) onOpen(combo) }}>
            Elegir
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── portfolio ───────────────────────────────────────────────────────────────
function ComboPortfolio({ combo, isStoreOpen, isLimitReached, clubAccess, onOpen }) {
  const isDisabled = !isStoreOpen || isLimitReached || combo.out_of_stock
  const slotCount  = getSlotCount(combo)
  const clubMeta   = clubAccess || null

  return (
    <article
      data-testid={`combo-card-${combo.id}`}
      className={`${styles.cardPortfolio} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onOpen(combo)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <div className={styles.thumbPortfolio}>
        {combo.image_url
          ? <img className={styles.thumbImg} src={combo.image_url} alt={combo.name} />
          : <div className={styles.thumbEmoji}>{combo.emoji || '🎁'}</div>
        }
      </div>
      <div className={styles.textPortfolio}>
        {clubMeta && (
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--club-text,#166534)', opacity: 0.72 }}>
            {clubMeta.emoji} {clubMeta.requirementLabel}
          </span>
        )}
        <h3 className={styles.namePortfolio}>{combo.name}</h3>
        {combo.description && <p className={styles.descPortfolio}>{combo.description}</p>}
        <span style={{ fontSize: '0.68rem', color: '#9CA3AF', fontWeight: 700 }}>
          🎁 {slotCount} ítems incluidos
        </span>
      </div>
      <div className={styles.actPortfolio}>
        <span className={styles.price}>{formatPrice(combo.price)}</span>
        <button type="button" data-testid={`combo-add-${combo.id}`}
          className={styles.action} disabled={isDisabled}
          onClick={e => { e.stopPropagation(); if (!isDisabled) onOpen(combo) }}>+</button>
      </div>
    </article>
  )
}

// ─── minimal ─────────────────────────────────────────────────────────────────
function ComboMinimal({ combo, isStoreOpen, isLimitReached, clubAccess, onOpen }) {
  const isDisabled = !isStoreOpen || isLimitReached || combo.out_of_stock
  const slotCount  = getSlotCount(combo)
  const clubMeta   = clubAccess || null

  return (
    <article
      data-testid={`combo-card-${combo.id}`}
      className={`${styles.cardMinimal} ${clubMeta ? styles.cardClub : ''} ${isDisabled ? styles.cardDisabled : ''}`}
      onClick={() => !isDisabled && onOpen(combo)}
      style={clubMeta ? { '--club-accent': clubMeta.accent, '--club-bg': clubMeta.bg, '--club-text': clubMeta.text } : undefined}
    >
      <span className={styles.emojiMinimal}>{combo.emoji || '🎁'}</span>
      <div className={styles.textMinimal}>
        {clubMeta && (
          <span style={{ fontSize: '0.60rem', fontWeight: 800, color: 'var(--club-text,#166534)', opacity: 0.72, display: 'block', marginBottom: 1 }}>
            {clubMeta.emoji} {clubMeta.requirementLabel}
          </span>
        )}
        <h3 className={styles.nameMinimal}>
          {combo.name} <span style={{ fontWeight: 600, color: '#9CA3AF', fontSize: '0.78rem' }}>({slotCount} ítems)</span>
        </h3>
        {combo.description && <p className={styles.descMinimal}>{combo.description}</p>}
      </div>
      <div className={styles.actMinimal}>
        <span className={styles.price}>{formatPrice(combo.price)}</span>
        <button type="button" data-testid={`combo-add-${combo.id}`}
          className={styles.actionMinimal} disabled={isDisabled}
          onClick={e => { e.stopPropagation(); if (!isDisabled) onOpen(combo) }}>+</button>
      </div>
    </article>
  )
}

// ─── export principal ────────────────────────────────────────────────────────
export default function ComboAccessCard({ combo, isStoreOpen, isLimitReached, clubAccess, onOpen, layout = 'delivery' }) {
  if (layout === 'vitrina')   return <ComboVitrina   combo={combo} isStoreOpen={isStoreOpen} isLimitReached={isLimitReached} clubAccess={clubAccess} onOpen={onOpen} />
  if (layout === 'portfolio') return <ComboPortfolio combo={combo} isStoreOpen={isStoreOpen} isLimitReached={isLimitReached} clubAccess={clubAccess} onOpen={onOpen} />
  if (layout === 'minimal')   return <ComboMinimal   combo={combo} isStoreOpen={isStoreOpen} isLimitReached={isLimitReached} clubAccess={clubAccess} onOpen={onOpen} />
  return <ComboDelivery combo={combo} isStoreOpen={isStoreOpen} isLimitReached={isLimitReached} clubAccess={clubAccess} onOpen={onOpen} />
}
