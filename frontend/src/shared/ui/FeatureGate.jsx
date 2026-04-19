/**
 * FeatureGate.jsx — Componente de feature gating
 * Envuelve cualquier feature y muestra un UpgradeCard si no tiene acceso.
 *
 * Uso:
 *   <FeatureGate feature={FEATURES.AFFILIATES}>
 *     <AffiliatesPanel />
 *   </FeatureGate>
 *
 *   <FeatureGate feature={FEATURES.CHATBOT_AI} fallback={<p>Solo Pro</p>}>
 *     <ChatbotAIPanel />
 *   </FeatureGate>
 */
import React from 'react'
import { usePlan } from '../hooks/usePlan'
import { PLANS, FEATURE_LABELS, getPlan } from '../lib/planFeatures'

// ─── Upgrade Card ──────────────────────────────────────────────────
function UpgradeCard({ feature, targetPlan, compact = false }) {
  const plan = getPlan(targetPlan)

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 20,
        background: `${plan.color}15`, border: `1px solid ${plan.color}40`,
        fontSize: 12, color: plan.color, fontWeight: 600,
      }}>
        🔒 {plan.emoji} {plan.name}
      </div>
    )
  }

  return (
    <div style={{
      border: `1px solid ${plan.color}30`,
      borderRadius: 14, padding: '24px',
      background: `${plan.color}08`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
        {FEATURE_LABELS[feature] || feature}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Esta función está disponible desde el plan <strong style={{ color: plan.color }}>{plan.emoji} {plan.name}</strong>.
        <br />Contacta con tu administrador para actualizar tu plan.
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 20px', borderRadius: 8,
        background: plan.color, color: '#fff',
        fontSize: 13, fontWeight: 600,
      }}>
        {plan.emoji} Actualizar a {plan.name}
      </div>
    </div>
  )
}

// ─── FeatureGate ──────────────────────────────────────────────────
export default function FeatureGate({ feature, children, fallback, compact = false }) {
  const { can, upgradeTarget, loading } = usePlan()

  if (loading) return null
  if (can(feature)) return children

  const target = upgradeTarget(feature)

  if (fallback !== undefined) return fallback

  return <UpgradeCard feature={feature} targetPlan={target} compact={compact} />
}

// ─── LimitGate — muestra aviso cuando se acerca al límite ────────
export function LimitGate({ limitKey, currentCount, children }) {
  const { canCreateMore, remaining, plan, upgradeTarget } = usePlan()

  if (!canCreateMore(limitKey, currentCount)) {
    const target = upgradeTarget(limitKey)
    const targetPlan = getPlan(target)
    return (
      <div style={{
        padding: '12px 16px', borderRadius: 10, marginBottom: 12,
        background: '#fff7ed', border: '1px solid #fed7aa',
        fontSize: 13, color: '#9a3412',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        ⚠️ Has alcanzado el límite de tu plan <strong>{plan.name}</strong>.
        Actualiza a <strong>{targetPlan.emoji} {targetPlan.name}</strong> para continuar.
      </div>
    )
  }

  const rem = remaining(limitKey, currentCount)
  const showWarning = rem !== Infinity && rem <= 2 && rem > 0

  return (
    <>
      {showWarning && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          background: '#fefce8', border: '1px solid #fde047',
          fontSize: 12, color: '#854d0e',
        }}>
          ⚠️ Solo te quedan <strong>{rem}</strong> más en tu plan actual.
        </div>
      )}
      {children}
    </>
  )
}

// ─── PlanBadge — muestra el plan activo ──────────────────────────
export function PlanBadge({ size = 'sm' }) {
  const { plan } = usePlan()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '2px 8px' : '5px 14px',
      borderRadius: 20, fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      background: `${plan.color}15`, color: plan.color,
      border: `1px solid ${plan.color}30`,
    }}>
      {plan.emoji} {plan.name}
    </span>
  )
}
