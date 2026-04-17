import { z } from 'zod'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const STORE_NICHES = ['food', 'beauty', 'retail', 'service']

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeOptionalText(value) {
  const text = normalizeText(value)
  return text || ''
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function buildValidationError(result) {
  const messages = result.error.issues.map(issue => issue.message).filter(Boolean)
  return new Error(messages[0] || 'Solicitud invalida')
}

const colorField = z.string()
  .transform(normalizeText)
  .refine(value => HEX_COLOR_REGEX.test(value), 'Color invalido')

export const createCheckoutSessionSchema = z.object({
  planId: z.string().transform(normalizeText).refine(value => value.length > 0, 'Selecciona un plan'),
  businessName: z.string().transform(normalizeText).refine(value => value.length >= 3, 'Indica el nombre del negocio'),
  ownerName: z.string().transform(normalizeText).refine(value => value.length >= 3, 'Indica el nombre del responsable'),
  ownerEmail: z.string().transform(normalizeEmail).email('Indica un email valido'),
  ownerPhone: z.any().optional().transform(normalizeOptionalText),
  niche: z.any().optional()
    .transform(value => normalizeOptionalText(value).toLowerCase() || 'food')
    .refine(value => STORE_NICHES.includes(value), 'Selecciona un nicho valido'),
})

export const onboardingCompletionSchema = z.object({
  token: z.string().transform(normalizeText).refine(value => value.length >= 12, 'Falta el token de onboarding'),
  ownerName: z.string().transform(normalizeText).refine(value => value.length >= 3, 'Indica el responsable'),
  businessName: z.string().transform(normalizeText).refine(value => value.length >= 3, 'Indica el nombre del negocio'),
  ownerPassword: z.string().transform(normalizeText).refine(value => value.length >= 6, 'La contrasena owner debe tener al menos 6 caracteres'),
  primaryColor: colorField,
  secondaryColor: colorField,
  accentColor: colorField,
  logoUrl: z.any().optional().transform(normalizeOptionalText).refine(value => !value || /^https?:\/\//i.test(value), 'Logo URL invalido'),
})

export const authLoginSchema = z.object({
  scope: z.enum(['oxidian', 'store-owner', 'store-admin', 'staff'], { errorMap: () => ({ message: 'Scope de login no soportado' }) }),
  password: z.string().transform(normalizeText).refine(value => value.length > 0, 'La contrasena es obligatoria'),
  storeId: z.any().optional().transform(normalizeOptionalText),
  username: z.any().optional().transform(normalizeOptionalText),
  role: z.any().optional().transform(normalizeOptionalText),
})

export function parseSchema(schema, payload) {
  const result = schema.safeParse(payload)
  if (!result.success) throw buildValidationError(result)
  return result.data
}
