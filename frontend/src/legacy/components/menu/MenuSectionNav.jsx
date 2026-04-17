import React, { forwardRef } from 'react'
import styles from './MenuSectionNav.module.css'

const MenuSectionNav = forwardRef(function MenuSectionNav(
  { categories, activeCategory, onSelectCategory },
  ref
) {
  return (
    <nav className={styles.nav} ref={ref} aria-label="Categorias del menu">
      <div className={styles.track}>
        {categories.map((category) => {
          const isActive = activeCategory === category.id
          const isCombo = category.id === 'combos'
          const activeClass = isActive
            ? (isCombo ? styles.buttonActiveCombo : styles.buttonActive)
            : ''

          return (
            <button
              key={category.id}
              type="button"
              data-active={isActive ? 'true' : 'false'}
              className={`${styles.button} ${activeClass}`}
              onClick={() => onSelectCategory(category.id)}
            >
              <span className={styles.buttonIcon}>{category.icon}</span>
              <span className={styles.buttonLabel}>{category.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})

export default MenuSectionNav
