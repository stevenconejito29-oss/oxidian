/**
 * usePlan.js — Hook central de feature gating
 * Consulta el plan del tenant y expone helpers para bloquear/mostrar features.
 */
import React from 'react'
import { useAuth } from '../../core/providers/AuthProvider'
import { supabaseAuth } from '../supabase/client'
import {
  getPlan, planHasFeature, planLimit, FEATURES, minPlanForFeature,
} from '../lib/planFeatures'

const PlanContext = React.createContext(null)

// ─── Provider ────────────────────────────────────────────────────
export function PlanProvider({ children }) {
  const { tenantId, role } = useAuth()
  const [planId,    setPlanId]    = React.useState('starter')
  const [overrides, setOverrides] = React.useState({}) // feature overrides por tenant
  const [loading,   setLoading]   = React.useState(true)

  React.useEffect(() => {
    if (!tenantId) {
      // super_admin siempre tiene acceso total
      if (role === 'super_admin') {
        setPlanId('enterprise')
        setLoading(false)
      } else {
        setLoading(false)
      }
      return
    }

    supabaseAuth
      .from('tenant_subscriptions')
      .select('plan_id, status, feature_overrides')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active' || data?.status === 'trialing') {
          setPlanId(data.plan_id || 'starter')
          setOverrides(data.feature_overrides || {})
        }
        setLoading(false)
      })
  }, [tenantId, role])

  const plan = getPlan(planId)

  /** ¿Tiene acceso a este feature? (plan + overrides) */
  function can(feature) {
    if (role === 'super_admin') return true
    // Override manual del super admin (puede desbloquear o bloquear)
    if (overrides[feature] !== undefined) return Boolean(overrides[feature])
    return planHasFeature(planId, feature)
  }

  /** ¿Puede crear más recursos? (compara contra el límite del plan) */
  function canCreateMore(limitKey, currentCount) {
    if (role === 'super_admin') return true
    const limit = planLimit(planId, limitKey)
    return currentCount < limit
  }

  /** Cuántos recursos le quedan disponibles */
  function remaining(limitKey, currentCount) {
    const limit = planLimit(planId, limitKey)
    if (limit === Infinity) return Infinity
    return Math.max(0, limit - currentCount)
  }

  /** Qué plan necesita para acceder a un feature */
  function upgradeTarget(feature) {
    return minPlanForFeature(feature)
  }

  const value = {
    planId, plan, loading, overrides,
    can, canCreateMore, remaining, upgradeTarget,
    FEATURES,
  }

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = React.useContext(PlanContext)
  if (!ctx) {
    // Fallback si no hay provider (ej: rutas públicas)
    return {
      planId: 'enterprise', plan: getPlan('enterprise'), loading: false, overrides: {},
      can: () => true, canCreateMore: () => true, remaining: () => Infinity,
      upgradeTarget: () => 'starter', FEATURES,
    }
  }
  return ctx
}
