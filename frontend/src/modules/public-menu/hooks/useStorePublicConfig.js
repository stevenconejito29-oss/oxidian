/**
 * useStorePublicConfig — Carga la config pública de una tienda desde Supabase.
 * Acepta slug o id (compatibilidad legacy).
 */
import React from 'react'
import { supabaseAuth } from '../../../legacy/lib/supabase'

export function useStorePublicConfig(storeSlugOrId, branchSlugOrId = null) {
  const [store,    setStore]    = React.useState(null)
  const [branches, setBranches] = React.useState([])
  const [branch,   setBranch]   = React.useState(null)
  const [menu,     setMenu]     = React.useState([])
  const [loading,  setLoading]  = React.useState(true)
  const [error,    setError]    = React.useState(null)

  React.useEffect(() => {
    if (!storeSlugOrId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const sb = supabaseAuth

        // ── 1. Buscar tienda por slug primero, luego por id ──────
        const bySlug = await sb.from('stores')
          .select('id,name,slug,status,niche,business_type,template_id,theme_tokens,city,currency,public_visible,store_templates(id,name,react_module_key,default_theme)')
          .eq('slug', storeSlugOrId)
          .eq('public_visible', true)
          .maybeSingle()

        let storeData = bySlug.data
        if (!storeData) {
          const byId = await sb.from('stores')
            .select('id,name,slug,status,niche,business_type,template_id,theme_tokens,city,currency,public_visible,store_templates(id,name,react_module_key,default_theme)')
            .eq('id', storeSlugOrId)
            .eq('public_visible', true)
            .maybeSingle()
          storeData = byId.data
        }

        if (!storeData) {
          if (!cancelled) setError('Tienda no encontrada o no disponible.')
          return
        }
        if (!cancelled) setStore(storeData)

        // ── 2. Sedes activas ─────────────────────────────────────
        const branchRes = await sb.from('branches')
          .select('id,name,slug,address,city,phone,status,is_primary,open_hour,close_hour,open_days,theme_override')
          .eq('store_id', storeData.id)
          .eq('status', 'active')
          .eq('public_visible', true)
          .order('is_primary', { ascending: false })

        const branchList = branchRes.data || []
        if (!cancelled) setBranches(branchList)

        let activeBranch = null
        if (branchSlugOrId) {
          activeBranch = branchList.find(b => b.slug === branchSlugOrId || b.id === branchSlugOrId) || null
        }
        if (!activeBranch) activeBranch = branchList.find(b => b.is_primary) || branchList[0] || null
        if (!cancelled) setBranch(activeBranch)

        // ── 3. Categorías + productos ────────────────────────────
        const [catsRes, prodsRes] = await Promise.all([
          sb.from('categories')
            .select('id,name,description,image_url,sort_order,category_type')
            .eq('store_id', storeData.id)
            .eq('is_active', true)
            .order('sort_order'),
          sb.from('products')
            .select('id,name,description,price,compare_price,image_url,emoji,track_stock,stock_quantity,service_duration_minutes,has_variants,variants,modifiers,tags,category_id,sort_order,is_featured,out_of_stock')
            .eq('store_id', storeData.id)
            .eq('is_active', true)
            .order('sort_order'),
        ])

        const cats  = catsRes.data  || []
        const prods = prodsRes.data || []

        // Filtrar productos sin stock si track_stock activo
        const availableProds = prods.filter(p => !p.out_of_stock)

        const prodsByCat = {}
        for (const p of availableProds) {
          const cid = p.category_id || '__none__'
          if (!prodsByCat[cid]) prodsByCat[cid] = []
          prodsByCat[cid].push(p)
        }

        const sections = cats
          .map(c => ({ ...c, products: prodsByCat[c.id] || [] }))
          .filter(c => c.products.length > 0)

        const uncategorized = prodsByCat['__none__'] || []
        if (uncategorized.length > 0) {
          sections.push({ id: '__none__', name: 'Otros', sort_order: 999, products: uncategorized })
        }

        if (!cancelled) setMenu(sections)
      } catch (e) {
        console.error('[useStorePublicConfig]', e)
        if (!cancelled) setError(e.message || 'Error al cargar el menú.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [storeSlugOrId, branchSlugOrId])

  return { store, branches, branch, menu, loading, error }
}
