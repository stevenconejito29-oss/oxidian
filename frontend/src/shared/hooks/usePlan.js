/**
 * usePlan.js — Hook central de feature gating
 * Consulta el plan del tenant y expone helpers para bloquear/mostrar features.
 * NOTA: Usa React.createElement en lugar de JSX para evitar problemas de extensión.
 */
import React from 'react'
import { useAuth } from '../../core/providers/AuthProvider'
import { supabaseAuth } from '../supabase/client'
import {
  getPlan, planHasFeature, planLimit, FEATURES, minPlanForFeature,
} from '../lib/planFeatures'

const PlanContext = React.createContext(null)

export function PlanProvider({ children }) {
  const { tenantId, role } = useAuth()
  const [planId,    setPlanId]    = React.useState('starter')
  const [overrides, setOverrides] = React.useState({})
  const [loading,   setLoading]   = React.useState(true)

  React.useEffect(() => {
    if (!tenantId) {
      if (role === 'super_admin') setPlanId('enterprise')
      setLoading(false)
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

  function can(feature) {
    if (role === 'super_admin') return true
    if (overrides[feature] !== undefined) return Boolean(overrides[feature])
    return planHasFeature(planId, feature)
  }

  function canCreateMore(limitKey, currentCount) {
    if (role === 'super_admin') return true
    const limit = planLimit(planId, limitKey)
    return currentCount < limit
  }

  function remaining(limitKey, currentCount) {
    const limit = planLimit(planId, limitKey)
    if (limit === Infinity) return Infinity
    return Math.max(0, limit - currentCount)
  }

  function upgradeTarget(feature) {
    return minPlanForFeature(feature)
  }

  const value = { planId, plan, loading, overrides, can, canCreateMore, remaining, upgradeTarget, FEATURES }

  // Usar React.createElement para evitar JSX en archivo .js
  return React.createElement(PlanContext.Provider, { value }, children)
}

export function usePlan() {
  const ctx = React.useContext(PlanContext)
  if (!ctx) {
    return {
      planId: 'enterprise', plan: getPlan('enterprise'), loading: false, overrides: {},
      can: () => true, canCreateMore: () => true, remaining: () => Infinity,
      upgradeTarget: () => 'starter', FEATURES,
    }
  }
  return ctx
}
