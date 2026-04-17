import React from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronDown } from 'lucide-react'
import styles from './OxidianWorkspace.module.css'

export function WorkspaceTabs({ value, onValueChange, items, children }) {
  return (
    <Tabs.Root className={styles.tabsRoot} value={value} onValueChange={onValueChange}>
      <Tabs.List className={styles.tabsList}>
        {items.map(item => (
          <Tabs.Trigger key={item.id} className={styles.tabsTrigger} value={item.id}>
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}

export function WorkspaceTabPanel({ value, children }) {
  return (
    <Tabs.Content className={styles.tabsContent} value={value}>
      {children}
    </Tabs.Content>
  )
}

export function WorkspaceAccordion({ type = 'multiple', value, onValueChange, children }) {
  return (
    <Accordion.Root className={styles.accordionRoot} type={type} value={value} onValueChange={onValueChange}>
      {children}
    </Accordion.Root>
  )
}

export function WorkspaceAccordionItem({ value, title, meta, badge, children }) {
  return (
    <Accordion.Item className={styles.accordionItem} value={value}>
      <Accordion.Header className={styles.accordionHeader}>
        <Accordion.Trigger className={styles.accordionTrigger}>
          <span className={styles.accordionCopy}>
            <span className={styles.accordionTitle}>{title}</span>
            {meta ? <span className={styles.accordionMeta}>{meta}</span> : null}
          </span>
          <span className={styles.accordionSide}>
            {badge ? <span className={styles.accordionBadge}>{badge}</span> : null}
            <ChevronDown size={16} className={styles.accordionChevron} />
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.accordionContent}>
        <div className={styles.accordionBody}>
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

export function WorkspaceSwitch({ checked, onCheckedChange, label, description }) {
  return (
    <label className={styles.switchField}>
      <span className={styles.switchCopy}>
        <span className={styles.switchLabel}>{label}</span>
        {description ? <span className={styles.switchDesc}>{description}</span> : null}
      </span>
      <Switch.Root className={styles.switchRoot} checked={checked} onCheckedChange={onCheckedChange}>
        <Switch.Thumb className={styles.switchThumb} />
      </Switch.Root>
    </label>
  )
}

export function WorkspaceHero({ eyebrow, title, description, meta = [], side = null }) {
  return (
    <div className={styles.heroGrid}>
      <div className={styles.heroCard}>
        <div className={styles.heroBody}>
          {eyebrow ? <div className={styles.heroEyebrow}>{eyebrow}</div> : null}
          <div className={styles.heroTitle}>{title}</div>
          {description ? <div className={styles.heroDesc}>{description}</div> : null}
          {meta.length > 0 ? (
            <div className={styles.heroMetaRow}>
              {meta.map(item => (
                <span key={item.label} className={styles.softPill}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.heroMetricGrid}>
        {side}
      </div>
    </div>
  )
}

export function WorkspaceMetric({ label, value, description, children }) {
  return (
    <div className={styles.heroMetricCard}>
      <div className={styles.heroMetricLabel}>{label}</div>
      <div className={styles.heroMetricValue}>{value}</div>
      {description ? <div className={styles.heroMetricDesc}>{description}</div> : null}
      {children}
    </div>
  )
}

export function WorkspacePills({ items }) {
  return (
    <div className={styles.pillRow}>
      {items.map(item => (
        <span key={item.label} className={styles.statPill}>
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  )
}

export function WorkspaceEmptyState({ children }) {
  return <div className={styles.emptyState}>{children}</div>
}
