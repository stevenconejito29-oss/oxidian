import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowRight, BadgeCheck, Palette, ShieldCheck } from 'lucide-react'
import { completeOxidianOnboarding, loadOxidianOnboarding } from '../lib/oxidianSaas'

const shell = {
  page: 'min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#0f172a_42%,#020617_100%)] text-slate-50',
  panel: 'rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.45)]',
}

export default function OxidianOnboarding() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [token, setToken] = useState('')
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({
    ownerName: '',
    businessName: '',
    ownerPassword: '',
    ownerPasswordConfirm: '',
    primaryColor: '#2D6A4F',
    secondaryColor: '#40916C',
    accentColor: '#E8607A',
    logoUrl: '',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextToken = params.get('token') || ''
    setToken(nextToken)

    if (!nextToken) {
      setLoading(false)
      return
    }

    loadOxidianOnboarding(nextToken)
      .then(payload => {
        setMeta(payload)
        setForm(current => ({
          ...current,
          ownerName: payload.ownerName || '',
          businessName: payload.businessName || '',
        }))
      })
      .catch(error => {
        toast.error(error.message || 'No pude cargar el onboarding')
      })
      .finally(() => setLoading(false))
  }, [])

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!token) {
      toast.error('Falta el token de onboarding')
      return
    }

    if (form.ownerPassword.trim().length < 6) {
      toast.error('La contrasena owner debe tener al menos 6 caracteres')
      return
    }

    if (form.ownerPassword !== form.ownerPasswordConfirm) {
      toast.error('Las contrasenas no coinciden')
      return
    }

    setSaving(true)
    try {
      const payload = await completeOxidianOnboarding({
        token,
        ownerName: form.ownerName,
        businessName: form.businessName,
        ownerPassword: form.ownerPassword,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        logoUrl: form.logoUrl,
      })

      setResult(payload)
      toast.success('Onboarding completado')
    } catch (error) {
      toast.error(error.message || 'No pude completar el onboarding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={shell.page}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              <BadgeCheck size={14} />
              Onboarding de tienda
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-white sm:text-5xl">
              Activa tu panel owner y personaliza la nueva tienda.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Este paso llega desde el correo de activacion. Aqui defines la contrasena owner y dejas la identidad base lista para cargar catalogo, logo, staff y operacion.
            </p>

            <div className="mt-8 grid gap-4">
              {[
                ['Seguridad', 'Tu contrasena owner queda scoped por tienda y no comparte acceso con otras sedes.', ShieldCheck],
                ['Marca', 'Los colores iniciales alimentan el motor dinamico de CSS para esa tienda.', Palette],
              ].map(([title, copy, Icon]) => (
                <article key={title} className={`${shell.panel} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-cyan-200">
                      <Icon size={18} />
                    </div>
                    <div className="text-lg font-black text-white">{title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`${shell.panel} p-6 sm:p-8`}>
            {loading ? (
              <div className="text-sm font-bold text-slate-300">Cargando onboarding...</div>
            ) : !token ? (
              <div className="space-y-4">
                <div className="text-sm font-black uppercase tracking-[0.18em] text-rose-200">Token faltante</div>
                <div className="text-xl font-black text-white">Necesitas abrir este onboarding desde el enlace generado tras el pago.</div>
                <a className="btn btn-outline rounded-full text-sm font-black text-white" href="/">
                  Volver a Oxidian
                </a>
              </div>
            ) : result ? (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Tienda activada</div>
                  <div className="mt-3 text-2xl font-black text-white">{result.businessName}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-300">
                    Ya puedes entrar como owner, cargar productos, staff, cupones y terminar de afinar el branding de la tienda. Oxidian ya envio tambien el correo con los links principales.
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <a className="btn btn-accent rounded-full text-sm font-black" href={result.adminUrl}>
                    Entrar al admin
                  </a>
                  <a className="btn btn-outline rounded-full text-sm font-black text-white" href={result.publicUrl} target="_blank" rel="noreferrer">
                    Ver tienda
                  </a>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Acceso owner</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    Usa la contrasena que acabas de definir en <span className="font-black text-white">{result.adminUrl}</span>. Las estaciones de cocina y reparto viven en sus propios links PWA.
                  </div>
                </div>
              </div>
            ) : (
              <form className="grid gap-5" onSubmit={handleSubmit}>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Provision</div>
                  <div className="mt-2 text-2xl font-black text-white">{meta?.businessName || 'Nueva tienda'}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    {meta?.planName ? `Plan ${meta.planName}. ` : ''}La base ya esta creada desde la plantilla operativa de Oxidian.
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Responsable</span>
                    <input className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white" value={form.ownerName} onChange={event => updateField('ownerName', event.target.value)} required />
                  </label>

                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Negocio</span>
                    <input className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white" value={form.businessName} onChange={event => updateField('businessName', event.target.value)} required />
                  </label>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Contrasena owner</span>
                    <input type="password" className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white" value={form.ownerPassword} onChange={event => updateField('ownerPassword', event.target.value)} required />
                  </label>

                  <label className="form-control">
                    <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Confirmar contrasena</span>
                    <input type="password" className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white" value={form.ownerPasswordConfirm} onChange={event => updateField('ownerPasswordConfirm', event.target.value)} required />
                  </label>
                </div>

                <label className="form-control">
                  <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Logo URL opcional</span>
                  <input className="input input-bordered w-full rounded-2xl border-white/10 bg-white/6 text-white" value={form.logoUrl} onChange={event => updateField('logoUrl', event.target.value)} placeholder="https://..." />
                </label>

                <div className="grid gap-5 sm:grid-cols-3">
                  {[
                    ['primaryColor', 'Primario'],
                    ['secondaryColor', 'Secundario'],
                    ['accentColor', 'Acento'],
                  ].map(([field, label]) => (
                    <label key={field} className="form-control">
                      <span className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
                      <input type="color" className="h-14 w-full rounded-2xl border border-white/10 bg-white/6" value={form[field]} onChange={event => updateField(field, event.target.value)} />
                    </label>
                  ))}
                </div>

                <button type="submit" className="btn btn-accent mt-2 rounded-full text-sm font-black" disabled={saving}>
                  {saving ? 'Guardando...' : 'Activar mi tienda'}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
