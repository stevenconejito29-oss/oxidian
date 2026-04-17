import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Globe,
  Layers3,
  MessageSquareMore,
  ShieldCheck,
  Store,
} from 'lucide-react'
import { SUPER_ADMIN_BRAND } from '../lib/adminBranding'
import {
  createOxidianCheckoutSession,
  loadOxidianCheckoutSession,
  loadOxidianPublicPlans,
  loadOxidianPublicStatus,
} from '../lib/oxidianSaas'

const shell = {
  page: 'min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_42%,#020617_100%)] text-slate-50',
  section: 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8',
  pill: 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200/90',
  panel: 'rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.45)]',
}

const valueProps = [
  {
    icon: Layers3,
    title: 'Plantilla operativa',
    copy: 'Cada cliente nace desde la tienda modelo y conserva menu, admin y flujo listos para personalizar sin mezclar datos.',
  },
  {
    icon: ShieldCheck,
    title: 'Control plane separado',
    copy: 'OXIDIAN gobierna planes, altas y supervision. Cada tienda conserva su identidad, URLs y operacion independiente.',
  },
  {
    icon: MessageSquareMore,
    title: 'Chatbot opcional',
    copy: 'La tienda vende sin bot. Si instala su servidor local y escanea el QR, se conecta por Supabase a su sede.',
  },
]

const architectureCards = [
  {
    title: 'Compra publica',
    copy: 'El cliente entra, paga y activa su tienda sin ver el panel interno de Oxidian.',
    action: 'Venta SaaS',
  },
  {
    title: 'Provision automatica',
    copy: 'Tras el pago se crea una tienda nueva lista para personalizar branding, catalogo, staff y PWAs.',
    action: 'Provision',
  },
  {
    title: 'Entrega por correo',
    copy: 'El responsable recibe por email el enlace seguro de activacion y los links operativos de su tienda.',
    action: 'Entrega segura',
  },
]

const NICHE_OPTIONS = [
  { id: 'food', label: 'Food', description: 'Heladerias, cafeterias, postres y delivery.' },
  { id: 'beauty', label: 'Beauty', description: 'Spa, salon, cosmetica y bienestar.' },
  { id: 'retail', label: 'Retail', description: 'Moda, accesorios y catalogo comercial.' },
  { id: 'service', label: 'Service', description: 'Reservas, citas y operaciones por servicio.' },
]

function FeatureChip({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-bold text-slate-200">
      {children}
    </span>
  )
}

function PlanCard({ plan, active, onSelect }) {
  const featureBundle = plan.feature_bundle || {}
  const highlight = active
    ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
    : 'border-white/10 bg-white/5'

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`flex h-full flex-col rounded-[24px] border p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/45 ${highlight}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{plan.id}</div>
          <h3 className="mt-3 text-2xl font-black text-white">{plan.name}</h3>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]"
          style={{ background: `${plan.color || '#22d3ee'}22`, color: plan.color || '#67e8f9' }}
        >
          SaaS
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-4xl font-black text-white">€{Number(plan.monthly_price || 0).toFixed(0)}</span>
        <span className="pb-1 text-sm font-bold text-slate-400">/mes</span>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description || 'Plan listo para operar y crecer.'}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <FeatureChip>{featureBundle.max_products || 'max'} productos</FeatureChip>
        <FeatureChip>{featureBundle.max_staff || 'max'} staff</FeatureChip>
        {featureBundle.supports_affiliates ? <FeatureChip>Afiliados</FeatureChip> : null}
        {featureBundle.supports_loyalty ? <FeatureChip>Club</FeatureChip> : null}
        {featureBundle.supports_supervision ? <FeatureChip>Metricas</FeatureChip> : null}
      </div>

      <div className="mt-auto pt-8">
        <div className="inline-flex items-center gap-2 text-sm font-black text-cyan-200">
          Quiero este plan
          <ArrowRight size={16} />
        </div>
      </div>
    </button>
  )
}

function CheckoutStatus({ state }) {
  if (state.mode === 'idle') return null

  if (state.mode === 'loading') {
    return (
      <div className={`${shell.panel} p-6`}>
        <div className="text-sm font-bold text-slate-300">Verificando tu compra y preparando la tienda...</div>
      </div>
    )
  }

  if (state.mode === 'cancelled') {
    return (
      <div className={`${shell.panel} border-amber-300/25 bg-amber-400/10 p-6`}>
        <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-200">Pago cancelado</div>
        <div className="mt-3 text-lg font-black text-white">Puedes retomar el checkout cuando quieras.</div>
      </div>
    )
  }

  if (state.mode === 'error') {
    return (
      <div className={`${shell.panel} border-rose-300/30 bg-rose-400/10 p-6`}>
        <div className="text-sm font-black uppercase tracking-[0.18em] text-rose-200">No completado</div>
        <div className="mt-3 text-lg font-black text-white">{state.message}</div>
      </div>
    )
  }

  if (state.mode !== 'success') return null

  return (
    <div className={`${shell.panel} border-emerald-300/30 bg-emerald-400/10 p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Pago confirmado</div>
          <div className="mt-3 text-xl font-black text-white">
            {state.businessName || 'Tu tienda'} ya tiene circuito de alta activo
          </div>
          <div className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/90">
            {state.onboardingUrl
              ? 'La tienda ya se esta entregando. Revisa el correo del responsable para abrir el enlace seguro de activacion.'
              : 'La provision esta en marcha. Si la webhook tarda, esta pantalla reintenta con el session_id de Stripe.'}
          </div>
        </div>

        {state.planName ? (
          <span className="rounded-full border border-emerald-200/30 bg-emerald-100/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
            {state.planName}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {state.onboardingUrl ? (
          <a className="btn btn-accent rounded-full px-6 text-sm font-black" href={state.onboardingUrl}>
            Abrir activacion segura
          </a>
        ) : null}
        {state.publicUrl ? (
          <a className="btn btn-outline rounded-full px-6 text-sm font-black text-white" href={state.publicUrl} target="_blank" rel="noreferrer">
            Ver tienda
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default function OxidianLanding() {
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [saasStatus, setSaasStatus] = useState({ checkoutReady: false, accessDeliveryReady: false, missing: [] })
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [checkoutState, setCheckoutState] = useState({ mode: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    niche: 'food',
  })

  const activePlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || plans[0] || null,
    [plans, selectedPlanId],
  )

  useEffect(() => {
    let ignore = false

    async function boot() {
      try {
        const [nextPlans, nextStatus] = await Promise.all([
          loadOxidianPublicPlans(),
          loadOxidianPublicStatus().catch(() => ({ checkoutReady: false, accessDeliveryReady: false, missing: ['config'] })),
        ])
        if (ignore) return
        setPlans(nextPlans)
        setSaasStatus(nextStatus)
        setSelectedPlanId(current => current || nextPlans[0]?.id || '')
      } catch (error) {
        if (!ignore) toast.error(error.message || 'No pude cargar los planes de OXIDIAN')
      } finally {
        if (!ignore) setPlansLoading(false)
      }
    }

    boot()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('checkout')
    const sessionId = params.get('session_id')

    if (mode === 'cancelled') {
      setCheckoutState({ mode: 'cancelled' })
      return
    }

    if (mode === 'success' && sessionId) {
      setCheckoutState({ mode: 'loading' })
      loadOxidianCheckoutSession(sessionId)
        .then(payload => {
          setCheckoutState({
            mode: 'success',
            businessName: payload.businessName,
            planName: payload.planName,
            onboardingUrl: payload.onboardingUrl,
            publicUrl: payload.publicUrl,
          })
        })
        .catch(error => {
          setCheckoutState({
            mode: 'error',
            message: error.message || 'Stripe confirmo el pago, pero la provision aun no esta lista.',
          })
        })
    }
  }, [])

  async function handleCheckout(event) {
    event.preventDefault()

    if (!activePlan) {
      toast.error('No hay planes configurados todavia')
      return
    }

    setSubmitting(true)
    try {
      const payload = await createOxidianCheckoutSession({
        ...form,
        planId: activePlan.id,
      })
      if (!payload?.url) throw new Error('Stripe no devolvio una URL de checkout')
      window.location.href = payload.url
    } catch (error) {
      toast.error(error.message || 'No pude abrir el checkout')
    } finally {
      setSubmitting(false)
    }
  }

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  return (
    <div className={shell.page}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.24),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(244,114,182,0.14),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(2,6,23,0))]" />

      <header className={`${shell.section} flex flex-wrap items-center justify-between gap-4 py-6`}>
        <a href="/" className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
            <Store size={22} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/90">{SUPER_ADMIN_BRAND.name}</div>
            <div className="text-sm font-semibold text-slate-300">{SUPER_ADMIN_BRAND.subtitle}</div>
          </div>
        </a>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300">
          Venta publica de tiendas online por suscripcion
        </div>
      </header>

      <main className={`${shell.section} pb-20 pt-6`}>
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className={shell.pill}>
              <BadgeCheck size={14} />
              Control SaaS + clonacion desde tienda modelo
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">
              Vende tiendas online listas para operar, sin cruzar la privacidad de cada cliente.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Oxidian separa el control plane del SaaS de la operacion diaria de cada tienda. El cliente paga, se provisiona una copia de la tienda modelo y luego personaliza nombre, colores, logo, productos y equipo.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a className="btn btn-accent rounded-full px-6 text-sm font-black" href="#planes">
                Elegir plan
              </a>
              <span className="btn btn-outline pointer-events-none rounded-full border-white/15 px-6 text-sm font-black text-white/80">
                Activacion por correo
              </span>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {valueProps.map(item => {
                const Icon = item.icon
                return (
                  <article key={item.title} className={`${shell.panel} p-5`}>
                    <div className="inline-flex rounded-2xl border border-white/10 bg-white/6 p-3 text-cyan-200">
                      <Icon size={20} />
                    </div>
                    <h2 className="mt-4 text-lg font-black text-white">{item.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{item.copy}</p>
                  </article>
                )
              })}
            </div>
          </div>

          <aside className={`${shell.panel} overflow-hidden`}>
            <div className="border-b border-white/10 px-6 py-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Flujo de alta</div>
              <div className="mt-3 text-2xl font-black text-white">Checkout alojado + aprovisionamiento automatizado</div>
            </div>
            <div className="grid gap-4 p-6">
              {[
                ['1', 'Landing publica', 'El cliente compara planes y compra sin ver accesos internos ni tiendas plantilla.'],
                ['2', 'Stripe Checkout', 'Pago seguro con tarjeta y metadata del negocio para crear su sede.'],
                ['3', 'Correo de activacion', 'Oxidian provisiona la tienda nueva y envia por correo el enlace seguro para activarla.'],
              ].map(([step, title, copy]) => (
                <div key={step} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-400/15 text-sm font-black text-cyan-200">
                      {step}
                    </div>
                    <div className="text-lg font-black text-white">{title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{copy}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-12">
          <CheckoutStatus state={checkoutState} />
        </section>

        {!saasStatus.checkoutReady && (
          <section className="mt-8">
            <div className={`${shell.panel} border-rose-300/30 bg-rose-400/10 p-6`}>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-rose-200">SaaS en configuracion</div>
              <div className="mt-3 text-lg font-black text-white">La venta automatica esta temporalmente bloqueada hasta cerrar la configuracion de Oxidian.</div>
              <div className="mt-3 text-sm leading-7 text-rose-50/90">
                Faltan servicios para entregar tiendas de forma segura por pago y correo. Variables pendientes: {saasStatus.missing.join(', ')}.
              </div>
            </div>
          </section>
        )}

        <section id="planes" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/90">Planes</div>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Elige la tienda que quieres vender y escalar</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300">
              El precio real y el checkout salen de Stripe + Supabase
            </div>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-5 md:grid-cols-2">
              {plansLoading && (
                <div className={`${shell.panel} p-6 text-sm font-bold text-slate-300`}>
                  Cargando planes...
                </div>
              )}

              {!plansLoading && plans.length === 0 && (
                <div className={`${shell.panel} p-6 text-sm font-bold text-slate-300`}>
                  No hay planes de pago configurados en `store_plans` o aun faltan price IDs en Stripe.
                </div>
              )}

              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  active={plan.id === activePlan?.id}
                  onSelect={setSelectedPlanId}
                />
              ))}
            </div>

            <div className={`${shell.panel} p-6`}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Checkout</div>
                  <div className="text-xl font-black text-white">
                    {activePlan ? `Empezar con ${activePlan.name}` : 'Configura tus planes'}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">
                Este formulario recoge la identidad minima del cliente y la envia al checkout alojado de Stripe. Tras el pago, Oxidian provisiona una tienda nueva y envia al responsable el correo de activacion con sus links.
              </p>

              <form className="mt-6 grid gap-4" onSubmit={handleCheckout}>
                <label className="form-control">
                  <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Nombre del negocio</span>
                  <input
                    className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
                    value={form.businessName}
                    onChange={event => updateField('businessName', event.target.value)}
                    placeholder="Ej. Gelato Salamanca"
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Nicho operativo</span>
                  <select
                    className="select select-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white"
                    value={form.niche}
                    onChange={event => updateField('niche', event.target.value)}
                  >
                    {NICHE_OPTIONS.map(option => (
                      <option key={option.id} value={option.id} style={{ color: '#0f172a' }}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 text-xs text-slate-400">
                    {NICHE_OPTIONS.find(option => option.id === form.niche)?.description}
                  </span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Responsable</span>
                    <input
                      className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
                      value={form.ownerName}
                      onChange={event => updateField('ownerName', event.target.value)}
                      placeholder="Nombre y apellido"
                      required
                    />
                  </label>

                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Telefono</span>
                    <input
                      className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
                      value={form.ownerPhone}
                      onChange={event => updateField('ownerPhone', event.target.value)}
                      placeholder="34600000000"
                    />
                  </label>
                </div>

                <label className="form-control">
                  <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Email</span>
                  <input
                    type="email"
                    className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
                    value={form.ownerEmail}
                    onChange={event => updateField('ownerEmail', event.target.value)}
                    placeholder="equipo@negocio.com"
                    required
                  />
                </label>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Se provisiona con</div>
                  <div className="mt-2 text-lg font-black text-white">{activePlan?.name || 'Sin plan'}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    La tienda se crea desde la plantilla del nicho seleccionado, sin exponer la tienda modelo al publico.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-accent mt-2 rounded-full px-6 text-sm font-black"
                  disabled={submitting || !activePlan || !saasStatus.checkoutReady}
                >
                  {submitting ? 'Abriendo checkout...' : (saasStatus.checkoutReady ? 'Ir al pago seguro' : 'Configuracion pendiente')}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-5 lg:grid-cols-3">
          {architectureCards.map(card => (
            <article key={card.title} className={`${shell.panel} block p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-black text-white">{card.title}</div>
                <Globe size={18} className="text-cyan-200" />
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.copy}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-cyan-200">
                {card.action}
                <ArrowRight size={16} />
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
