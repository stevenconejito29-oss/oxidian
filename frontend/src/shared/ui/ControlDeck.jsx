import React from 'react'
import styles from './ControlDeck.module.css'

export function Shell({ children }) {
  return <div className={styles.shell}><div className={styles.frame}>{children}</div></div>
}

export function Hero({ eyebrow, title, description, signals = [] }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      <div className={styles.heroAside}>
        {signals.map(signal => (
          <div className={styles.signalCard} key={signal.label}>
            <span className={styles.signalLabel}>{signal.label}</span>
            <span className={styles.signalValue}>{signal.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Panel({ title, text, dark = false, actions = null, children }) {
  return (
    <section className={`${styles.panel} ${dark ? styles.panelDark : ''}`}>
      {(title || text || actions) ? (
        <div className={styles.panelHeader}>
          <div>
            {title ? <h2 className={styles.panelTitle}>{title}</h2> : null}
            {text ? <p className={styles.panelText}>{text}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Stats({ items = [] }) {
  return <div className={styles.stats}>{items.map(item => <article className={styles.statCard} key={item.label}><span className={styles.statLabel}>{item.label}</span><span className={styles.statValue}>{item.value}</span>{item.hint ? <span className={styles.statHint}>{item.hint}</span> : null}</article>)}</div>
}

export function QuickLinks({ links = [] }) {
  return <div className={styles.quickLinks}>{links.map(link => <a className={styles.quickLinkCard} href={link.href} key={link.title}><span className={styles.quickLinkEmoji}>{link.emoji}</span><span className={styles.quickLinkTitle}>{link.title}</span><span className={styles.quickLinkText}>{link.text}</span></a>)}</div>
}

export function BadgeRow({ items = [] }) {
  return <div className={styles.badgeRow}>{items.map(item => <span className={styles.badge} key={item}>{item}</span>)}</div>
}

export function Actions({ children }) {
  return <div className={styles.actions}>{children}</div>
}

export function Button(props) {
  return <button className={styles.button} {...props} />
}

export function GhostButton(props) {
  return <button className={styles.ghostButton} {...props} />
}

export function Grid({ children }) {
  return <div className={`${styles.grid} ${styles.gridTwo}`}>{children}</div>
}

export function Field({ label, children }) {
  return <label className={styles.field}><span className={styles.label}>{label}</span>{children}</label>
}

export function Form(props) {
  return <form className={styles.form} {...props} />
}

export function FormGrid({ children }) {
  return <div className={styles.formGrid}>{children}</div>
}

export function Notice({ tone = 'info', children }) {
  const toneClass = tone === 'error' ? styles.noticeError : tone === 'success' ? styles.noticeSuccess : styles.noticeInfo
  return <div className={`${styles.notice} ${toneClass}`}>{children}</div>
}

export { styles as controlDeckStyles }
