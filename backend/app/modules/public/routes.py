"""
/public — Menú, checkout, reviews, loyalty. Sin autenticación requerida.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, jsonify, request

from ...core.extensions import supabase_admin, limiter

public_bp = Blueprint("public", __name__, url_prefix="/public")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _get_menu_data(store_id: str):
    """Lógica reutilizada por ambos endpoints de menú."""
    sb = _supa()

    store_res = sb.table("stores").select(
        "id,name,status,public_visible,template_id,theme_tokens,store_templates(id,name,default_theme)"
    ).eq("id", store_id).eq("public_visible", True).maybe_single().execute()

    if not store_res.data:
        abort(404, "Tienda no encontrada o no pública")

    store = store_res.data
    if store.get("status") not in ("active", "draft"):
        abort(404, "Tienda no disponible actualmente")

    products_res = sb.table("products").select("*").eq("store_id", store_id).eq(
        "available", True).eq("is_active", True).order("category").order("sort_order").execute()

    combos_res = sb.table("combos").select("*").eq("store_id", store_id).eq(
        "available", True).eq("is_active", True).order("sort_order").execute()

    topping_cats_res = sb.table("topping_categories").select(
        "id,name,sort_order,required,max_selections"
    ).eq("store_id", store_id).order("sort_order").execute()

    toppings_res = sb.table("toppings").select("*").eq("store_id", store_id).eq(
        "available", True).eq("is_active", True).execute()

    settings_res = sb.table("store_settings").select("key,value").eq("store_id", store_id).execute()
    settings = {r["key"]: r["value"] for r in (settings_res.data or [])}

    # Enriquecer topping_categories con sus toppings
    toppings_by_cat = {}
    for t in (toppings_res.data or []):
        cid = t.get("category_id")
        if cid:
            toppings_by_cat.setdefault(cid, []).append(t)

    cats_with_toppings = []
    for cat in (topping_cats_res.data or []):
        cats_with_toppings.append({
            **cat,
            "toppings": toppings_by_cat.get(cat["id"], [])
        })

    return jsonify({
        "store": store,
        "products": products_res.data or [],
        "combos": combos_res.data or [],
        "topping_categories": cats_with_toppings,
        "settings": settings,
    })


# ─── Health ───────────────────────────────────────────────────────

@public_bp.get("/health")
def public_health():
    return {"status": "ok", "module": "public"}


# ─── Menú público por store_id ─────────────────────────────────────

@public_bp.get("/menu/<store_id>")
@limiter.limit("120 per minute")
def get_public_menu(store_id):
    return _get_menu_data(store_id)


@public_bp.get("/menu")
@limiter.limit("120 per minute")
def get_public_menu_by_slug():
    """GET /public/menu?slug=mi-tienda  o  ?store_id=mi-tienda"""
    sb = _supa()
    slug = (request.args.get("slug") or request.args.get("store_id") or "").strip().lower()
    if not slug:
        abort(400, "Parámetro slug o store_id requerido")

    # Intentar como ID directo primero
    store_res = sb.table("stores").select("id").eq("id", slug).maybe_single().execute()
    if store_res.data:
        return _get_menu_data(slug)

    # Intentar por branch slug
    branch_res = sb.table("branches").select("store_id").eq("slug", slug).maybe_single().execute()
    if branch_res.data:
        return _get_menu_data(branch_res.data["store_id"])

    abort(404, f"No se encontró tienda con slug: {slug}")


# ─── Checkout ──────────────────────────────────────────────────────

@public_bp.post("/checkout")
@limiter.limit("30 per minute")
def public_checkout():
    sb = _supa()
    body = request.get_json(silent=True) or {}

    for field in ["store_id", "items", "customer_name", "customer_phone"]:
        if not body.get(field):
            abort(400, f"Campo requerido: {field}")

    store_id = body["store_id"]
    items = body["items"]
    if not isinstance(items, list) or not items:
        abort(400, "items debe ser una lista no vacía")

    # Calcular total
    total = sum(
        float(item.get("price", 0)) * int(item.get("qty", 1))
        for item in items
    )

    payload = {
        "store_id": store_id,
        "status": "pending",
        "customer_name": str(body["customer_name"]).strip(),
        "customer_phone": str(body["customer_phone"]).strip(),
        "address": str(body.get("address", "")).strip(),
        "total": round(total, 2),
        "items": items,
        "delivery_type": body.get("delivery_type", "delivery"),
        "payment_method": body.get("payment_method", "cash"),
        "notes": str(body.get("notes", "")).strip(),
        "coupon_code": str(body.get("coupon_code", "")).strip() or None,
        "affiliate_code": str(body.get("affiliate_code", "")).strip() or None,
    }

    # Buscar branch_id si viene
    if body.get("branch_id"):
        payload["branch_id"] = body["branch_id"]

    res = sb.table("orders").insert(payload).execute()
    order = res.data[0] if res.data else {}

    return jsonify({
        "success": True,
        "order_id": order.get("id"),
        "order_number": order.get("order_number"),
        "total": order.get("total"),
        "status": "pending",
    }), 201


# ─── Reviews públicas ──────────────────────────────────────────────

@public_bp.get("/reviews/<store_id>")
@limiter.limit("60 per minute")
def get_public_reviews(store_id):
    sb = _supa()
    res = sb.table("reviews").select(
        "id,customer_name,rating,comment,created_at"
    ).eq("store_id", store_id).eq("approved", True).order(
        "created_at", desc=True
    ).limit(20).execute()
    return jsonify(res.data or [])


@public_bp.post("/reviews")
@limiter.limit("10 per minute")
def submit_review():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    if not body.get("store_id") or not body.get("rating"):
        abort(400, "store_id y rating requeridos")

    payload = {
        "store_id": body["store_id"],
        "customer_name": str(body.get("customer_name", "Anónimo")).strip(),
        "customer_phone": str(body.get("customer_phone", "")).strip(),
        "rating": min(5, max(1, int(body["rating"]))),
        "comment": str(body.get("comment", "")).strip(),
        "approved": False,
    }
    res = sb.table("reviews").insert(payload).execute()
    return jsonify({"success": True, "id": (res.data[0] or {}).get("id")}), 201


# ─── Fidelidad pública ─────────────────────────────────────────────

@public_bp.get("/loyalty")
@limiter.limit("60 per minute")
def get_loyalty_status():
    sb = _supa()
    store_id = (request.args.get("store_id") or "").strip()
    phone = (request.args.get("phone") or "").strip()

    if not store_id or not phone:
        abort(400, "store_id y phone requeridos")

    orders_res = sb.table("orders").select("id", count="exact", head=True).eq(
        "store_id", store_id
    ).eq("customer_phone", phone).eq("status", "delivered").execute()

    order_count = orders_res.count or 0
    points = order_count * 10

    rewards_res = sb.table("loyalty_rewards").select("*").eq(
        "store_id", store_id
    ).eq("is_active", True).lte("points_required", points).execute()

    return jsonify({
        "phone": phone,
        "store_id": store_id,
        "orders": order_count,
        "points": points,
        "available_rewards": rewards_res.data or [],
    })


# ─── Validar cupón ─────────────────────────────────────────────────

@public_bp.post("/coupons/validate")
@limiter.limit("30 per minute")
def validate_coupon():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    code = str(body.get("code", "")).upper().strip()
    store_id = str(body.get("store_id", "")).strip()
    order_total = float(body.get("order_total", 0))

    if not code or not store_id:
        abort(400, "code y store_id requeridos")

    res = sb.table("coupons").select("*").eq("store_id", store_id).eq(
        "code", code
    ).eq("is_active", True).maybe_single().execute()

    coupon = res.data
    if not coupon:
        return jsonify({"valid": False, "reason": "Cupón no encontrado o inactivo"}), 404

    if coupon.get("max_uses") and (coupon.get("uses_count", 0) or 0) >= coupon["max_uses"]:
        return jsonify({"valid": False, "reason": "Cupón agotado"}), 400

    if coupon.get("min_order") and order_total < float(coupon["min_order"]):
        return jsonify({
            "valid": False,
            "reason": f"Pedido mínimo de €{coupon['min_order']} requerido"
        }), 400

    discount = 0.0
    if coupon["type"] == "percentage":
        discount = round(order_total * float(coupon["value"]) / 100, 2)
    elif coupon["type"] == "fixed":
        discount = min(float(coupon["value"]), order_total)

    return jsonify({
        "valid": True,
        "coupon_id": coupon["id"],
        "code": coupon["code"],
        "type": coupon["type"],
        "value": coupon["value"],
        "discount": discount,
        "new_total": round(order_total - discount, 2),
    })
