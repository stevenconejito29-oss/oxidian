"""
/branch — Panel operativo completo de Branch Manager.
Productos, combos, stock, pedidos, staff, marketing, afiliados, configuración.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, jsonify, request

from ...core.extensions import supabase_admin


branch_bp = Blueprint("branch", __name__, url_prefix="/branch")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _scope():
    return g.scope  # {tenant_id, store_id, branch_id}


# ─── Health ───────────────────────────────────────────────────────────────────

@branch_bp.get("/health")
def branch_health():
    return {"status": "ok", "module": "branch"}


@branch_bp.get("/context")
def branch_context():
    return {
        "module": "branch",
        "scope": g.scope,
        "auth": g.auth_context.to_dict(),
    }


# ─── Dashboard de la sede ─────────────────────────────────────────────────────

@branch_bp.get("/dashboard")
def branch_dashboard():
    sb = _supa()
    scope = _scope()
    bid = scope["branch_id"]
    sid = scope["store_id"]

    # Pedidos de hoy
    today = "now()::date"
    orders_today = sb.table("orders").select("id,status,total", count="exact").eq(
        "branch_id", bid
    ).gte("created_at", "now()::date").execute()

    # Stock bajo
    low_stock = sb.table("stock_items").select(
        "id,name,quantity,min_quantity"
    ).eq("store_id", sid).lt("quantity", 5).limit(10).execute()

    # Personal activo
    staff_online = sb.table("staff_users").select("id", count="exact", head=True).eq(
        "store_id", sid
    ).eq("is_online", True).execute()

    return jsonify({
        "branch_id": bid,
        "store_id": sid,
        "orders_today": {
            "total": orders_today.count or 0,
            "data": orders_today.data or [],
        },
        "low_stock_count": len(low_stock.data or []),
        "low_stock_items": low_stock.data or [],
        "staff_online": staff_online.count or 0,
    })


# ─── PRODUCTOS ────────────────────────────────────────────────────────────────

@branch_bp.get("/products")
def list_products():
    sb = _supa()
    scope = _scope()
    category = request.args.get("category")
    active_only = request.args.get("active") != "false"

    q = sb.table("products").select("*").eq("store_id", scope["store_id"])
    if active_only:
        q = q.eq("is_active", True)
    if category:
        q = q.eq("category", category)

    res = q.order("name").execute()
    return jsonify(res.data or [])


@branch_bp.get("/products/<product_id>")
def get_product(product_id):
    sb = _supa()
    scope = _scope()
    res = sb.table("products").select("*").eq("id", product_id).eq(
        "store_id", scope["store_id"]
    ).maybe_single().execute()
    if not res.data:
        abort(404, "Producto no encontrado")
    return jsonify(res.data)


@branch_bp.post("/products")
def create_product():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}

    if not body.get("name"):
        abort(400, "Nombre requerido")

    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body["name"].strip(),
        "description": body.get("description", ""),
        "price": float(body.get("price", 0)),
        "category": body.get("category", "general"),
        "emoji": body.get("emoji", "🍽️"),
        "is_active": body.get("is_active", True),
        "tags": body.get("tags", []),
    }
    res = sb.table("products").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@branch_bp.patch("/products/<product_id>")
def update_product(product_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "description", "price", "category", "emoji",
               "is_active", "tags", "out_of_stock"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("products").update(patch).eq("id", product_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@branch_bp.delete("/products/<product_id>")
def delete_product(product_id):
    sb = _supa()
    scope = _scope()
    sb.table("products").delete().eq("id", product_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── COMBOS ───────────────────────────────────────────────────────────────────

@branch_bp.get("/combos")
def list_combos():
    sb = _supa()
    scope = _scope()
    res = sb.table("combos").select("*").eq("store_id", scope["store_id"]).order("name").execute()
    return jsonify(res.data or [])


@branch_bp.post("/combos")
def create_combo():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")

    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body["name"].strip(),
        "description": body.get("description", ""),
        "price": float(body.get("price", 0)),
        "emoji": body.get("emoji", "🎁"),
        "is_active": body.get("is_active", True),
        "items": body.get("items", []),
    }
    res = sb.table("combos").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@branch_bp.patch("/combos/<combo_id>")
def update_combo(combo_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "description", "price", "emoji", "is_active", "items"]
    patch = {k: v for k, v in body.items() if k in allowed}
    res = sb.table("combos").update(patch).eq("id", combo_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@branch_bp.delete("/combos/<combo_id>")
def delete_combo(combo_id):
    sb = _supa()
    scope = _scope()
    sb.table("combos").delete().eq("id", combo_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── STOCK ────────────────────────────────────────────────────────────────────

@branch_bp.get("/stock")
def list_stock():
    sb = _supa()
    scope = _scope()
    res = sb.table("stock_items").select("*,stock_item_products(product_id)").eq(
        "store_id", scope["store_id"]
    ).order("name").execute()
    return jsonify(res.data or [])


@branch_bp.patch("/stock/<item_id>")
def update_stock(item_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["quantity", "min_quantity", "name", "unit"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("stock_items").update(patch).eq("id", item_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@branch_bp.post("/stock")
def create_stock_item():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body["name"].strip(),
        "quantity": float(body.get("quantity", 0)),
        "min_quantity": float(body.get("min_quantity", 5)),
        "unit": body.get("unit", "unidades"),
    }
    res = sb.table("stock_items").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


# ─── PEDIDOS ──────────────────────────────────────────────────────────────────

@branch_bp.get("/orders")
def list_orders():
    sb = _supa()
    scope = _scope()
    status = request.args.get("status")
    limit = min(int(request.args.get("limit", 50)), 200)

    q = sb.table("orders").select("*").eq("branch_id", scope["branch_id"])
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).limit(limit).execute()
    return jsonify(res.data or [])


@branch_bp.patch("/orders/<order_id>/status")
def update_order_status(order_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    new_status = body.get("status")
    valid_statuses = ["pending", "preparing", "ready", "delivering", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        abort(400, f"Status inválido. Válidos: {valid_statuses}")

    res = sb.table("orders").update({"status": new_status}).eq("id", order_id).eq(
        "branch_id", scope["branch_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── STAFF ────────────────────────────────────────────────────────────────────

@branch_bp.get("/staff")
def list_staff():
    sb = _supa()
    scope = _scope()
    res = sb.table("staff_users").select("*").eq("store_id", scope["store_id"]).execute()
    return jsonify(res.data or [])


@branch_bp.post("/staff")
def create_staff():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name") or not body.get("role"):
        abort(400, "name y role requeridos")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body["name"].strip(),
        "role": body["role"],
        "phone": body.get("phone", ""),
        "email": body.get("email", ""),
        "is_active": True,
        "is_online": False,
    }
    res = sb.table("staff_users").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@branch_bp.patch("/staff/<staff_id>")
def update_staff(staff_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "role", "phone", "email", "is_active", "is_online"]
    patch = {k: v for k, v in body.items() if k in allowed}
    res = sb.table("staff_users").update(patch).eq("id", staff_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@branch_bp.delete("/staff/<staff_id>")
def delete_staff(staff_id):
    sb = _supa()
    scope = _scope()
    sb.table("staff_users").delete().eq("id", staff_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── AFILIADOS & REFERIDOS ────────────────────────────────────────────────────

@branch_bp.get("/affiliates")
def list_affiliates():
    sb = _supa()
    scope = _scope()
    res = sb.table("affiliates").select("*,affiliate_applications(*)").eq(
        "store_id", scope["store_id"]
    ).order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@branch_bp.post("/affiliates")
def create_affiliate():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body["name"].strip(),
        "email": body.get("email", ""),
        "phone": body.get("phone", ""),
        "code": body.get("code", "").upper().strip(),
        "commission_pct": float(body.get("commission_pct", 10)),
        "is_active": body.get("is_active", True),
    }
    res = sb.table("affiliates").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@branch_bp.patch("/affiliates/<affiliate_id>")
def update_affiliate(affiliate_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "email", "phone", "code", "commission_pct", "is_active"]
    patch = {k: v for k, v in body.items() if k in allowed}
    res = sb.table("affiliates").update(patch).eq("id", affiliate_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── MARKETING — Cupones ──────────────────────────────────────────────────────

@branch_bp.get("/coupons")
def list_coupons():
    sb = _supa()
    scope = _scope()
    res = sb.table("coupons").select("*").eq("store_id", scope["store_id"]).order(
        "created_at", desc=True
    ).execute()
    return jsonify(res.data or [])


@branch_bp.post("/coupons")
def create_coupon():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("code"):
        abort(400, "Código requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "code": body["code"].upper().strip(),
        "type": body.get("type", "percentage"),
        "value": float(body.get("value", 10)),
        "min_order": float(body.get("min_order", 0)),
        "max_uses": body.get("max_uses"),
        "uses_count": 0,
        "valid_from": body.get("valid_from"),
        "valid_until": body.get("valid_until"),
        "is_active": body.get("is_active", True),
        "description": body.get("description", ""),
    }
    res = sb.table("coupons").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@branch_bp.patch("/coupons/<coupon_id>")
def update_coupon(coupon_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["code", "type", "value", "min_order", "max_uses",
               "valid_from", "valid_until", "is_active", "description"]
    patch = {k: v for k, v in body.items() if k in allowed}
    res = sb.table("coupons").update(patch).eq("id", coupon_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@branch_bp.delete("/coupons/<coupon_id>")
def delete_coupon(coupon_id):
    sb = _supa()
    scope = _scope()
    sb.table("coupons").delete().eq("id", coupon_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── FIDELIDAD ────────────────────────────────────────────────────────────────

@branch_bp.get("/loyalty")
def list_loyalty():
    sb = _supa()
    scope = _scope()
    res = sb.table("loyalty_rewards").select("*").eq("store_id", scope["store_id"]).order(
        "created_at", desc=True
    ).execute()
    return jsonify(res.data or [])


@branch_bp.post("/loyalty")
def create_loyalty_reward():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "branch_id": scope["branch_id"],
        "name": body.get("name", "Premio de fidelidad"),
        "points_required": int(body.get("points_required", 100)),
        "reward_type": body.get("reward_type", "discount"),
        "reward_value": float(body.get("reward_value", 10)),
        "description": body.get("description", ""),
        "is_active": body.get("is_active", True),
    }
    res = sb.table("loyalty_rewards").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


# ─── CONFIGURACIÓN DE LA SEDE ─────────────────────────────────────────────────

@branch_bp.get("/config")
def get_branch_config():
    sb = _supa()
    scope = _scope()
    res = sb.table("branches").select("*").eq("id", scope["branch_id"]).maybe_single().execute()
    if not res.data:
        abort(404, "Branch no encontrada")
    return jsonify(res.data)


@branch_bp.patch("/config")
def update_branch_config():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "address", "city", "phone", "open_hour", "close_hour",
               "open_days", "theme_override", "operational_config",
               "public_visible", "status"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("branches").update(patch).eq("id", scope["branch_id"]).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── CHATBOT PORTABLE — Estado y configuración ────────────────────────────────

@branch_bp.get("/chatbot")
def get_chatbot_status():
    sb = _supa()
    scope = _scope()
    res = sb.table("branches").select(
        "id,chatbot_authorized,chatbot_authorized_at,chatbot_last_seen,chatbot_version"
    ).eq("id", scope["branch_id"]).maybe_single().execute()
    return jsonify(res.data or {"chatbot_authorized": False})


@branch_bp.get("/chatbot/secret")
def get_chatbot_secret():
    """El branch manager puede ver su propio WA_SECRET para configurar el portable."""
    sb = _supa()
    scope = _scope()
    res = sb.table("branches").select(
        "chatbot_authorized,chatbot_wa_secret,chatbot_store_id"
    ).eq("id", scope["branch_id"]).maybe_single().execute()
    data = res.data or {}
    if not data.get("chatbot_authorized"):
        abort(403, "El chatbot no está autorizado para esta sede")
    return jsonify({
        "wa_secret": data.get("chatbot_wa_secret", ""),
        "store_id": data.get("chatbot_store_id", scope["store_id"]),
        "port": 3001,
    })


# ─── REVIEWS ─────────────────────────────────────────────────────────────────

@branch_bp.get("/reviews")
def list_reviews():
    sb = _supa()
    scope = _scope()
    approved_only = request.args.get("approved") == "true"
    q = sb.table("reviews").select("*").eq("store_id", scope["store_id"])
    if approved_only:
        q = q.eq("approved", True)
    res = q.order("created_at", desc=True).limit(50).execute()
    return jsonify(res.data or [])


@branch_bp.patch("/reviews/<review_id>/approve")
def approve_review(review_id):
    sb = _supa()
    scope = _scope()
    res = sb.table("reviews").update({"approved": True}).eq("id", review_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── ANALYTICS RÁPIDO ─────────────────────────────────────────────────────────

@branch_bp.get("/analytics/today")
def analytics_today():
    sb = _supa()
    scope = _scope()
    bid = scope["branch_id"]

    orders = sb.table("orders").select(
        "id,status,total,created_at"
    ).eq("branch_id", bid).gte("created_at", "now()::date").execute()

    data = orders.data or []
    total_revenue = sum(float(o.get("total", 0) or 0) for o in data)
    by_status = {}
    for o in data:
        s = o.get("status", "unknown")
        by_status[s] = by_status.get(s, 0) + 1

    return jsonify({
        "orders_count": len(data),
        "revenue": round(total_revenue, 2),
        "by_status": by_status,
    })
