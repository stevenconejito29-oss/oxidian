import { getOxidianPublicStatus, json } from '../_lib/oxidianSaas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Metodo no permitido' })
  }

  return json(res, 200, getOxidianPublicStatus())
}
