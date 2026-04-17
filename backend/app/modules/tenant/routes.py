"""
/tenant — Panel del dueño del negocio.
Gestión de store config, staff, finanzas, operaciones, personalización.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, jsonify, request

from ...core.extensions import supabase_admin


tenant_bp = Blueprint("tenant", __name__, url_prefix="/tenant")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _scope():
    return g.scope


# ─── Health ───────────────────────────────────────────────────────────────────

@tenant_bp.get("/health")
def tenant_health():
    return {"status": "ok", "module": "tenant"}


@tenant_bp.get("/context")
def tenant_context():
    return {"module": "tenant", "scope": g.scope, "auth": g.auth_context.to_dict()}


# ─── Dashboard del tenant ─────────────────────────────────────────────────────

@tenant_bp.get("/dashboard")
def tenant_dashboard():
    sb = _supa()
    scope = _scope()
    tid = scope["tenant_id"]
    sid = scope["store_id"]

    stores_res = sb.table("stores").select("id,name,status", count="exact", head=True).eq("tenant_id", tid).execute()
    branches_res = sb.table("branches").select("id,name,status", count="exact", head=True).eq("tenant_id", tid).execute()
    orders_res = sb.table("orders").select("id,total", count="exact").eq("store_id", sid or "").gte(
        "created_at", "now()::date"
    ).execute()

    orders_today = orders_res.data or []
    revenue_today = sum(float(o.get("total", 0) or 0) for o in orders_today)

    return jsonify({
        "tenant_id": tid,
        "stores": stores_res.count or 0,
        "branches": branches_res.count or 0,
        "orders_today": len(orders_today),
        "revenue_today": round(revenue_today, 2),
    })


# ─── Stores del tenant ────────────────────────────────────────────────────────

@tenant_bp.get("/stores")
def list_tenant_stores():
    sb = _supa()
    scope = _scope()
    res = sb.table("stores").select("*").eq("tenant_id", scope["tenant_id"]).execute()
    return jsonify(res.data or [])


@tenant_bp.get("/stores/<store_id>")
def get_tenant_store(store_id):
    sb = _supa()
    scope = _scope()
    res = sb.table("stores").select("*").eq("id", store_id).eq(
        "tenant_id", scope["tenant_id"]
    ).maybe_single().execute()
    if not res.data:
        abort(404, "Store no encontrada")
    return jsonify(res.data)


@tenant_bp.patch("/stores/<store_id>")
def update_tenant_store(store_id):
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "status", "template_id", "theme_tokens",
               "public_visible", "business_type", "city"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("stores").update(patch).eq("id", store_id).eq(
        "tenant_id", scope["tenant_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── Branches del tenant ──────────────────────────────────────────────────────

@tenant_bp.get("/branches")
def list_tenant_branches():
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id")
    q = sb.table("branches").select("*").eq("tenant_id", scope["tenant_id"])
    if sid:
        q = q.eq("store_id", sid)
    res = q.order("is_primary", desc=True).execute()
    return jsonify(res.data or [])


@tenant_bp.post("/branches")
def create_tenant_branch():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    required = ["slug", "name"]
    for field in required:
        if not body.get(field):
            abort(400, f"Campo requerido: {field}")
    payload = {
        "tenant_id": scope["tenant_id"],
        "store_id": scope["store_id"],
        "slug": body["slug"].lower().strip(),
        "name": body["name"].strip(),
        "address": body.get("address", ""),
        "city": body.get("city", ""),
        "phone": body.get("phone", ""),
        "status": "active",
        "is_primary": body.get("is_primary", False),
        "open_hour": body.get("open_hour", 10),
        "close_hour": body.get("close_hour", 22),
        "open_days": body.get("open_days", "L-D"),
    }
    res = sb.table("branches").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


# ─── Config de tienda (store settings) ───────────────────────────────────────

@tenant_bp.get("/store-config")
def get_store_config():
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id")
    if not sid:
        abort(400, "store_id requerido")

    # Combina config_tienda + store_settings + store
    config_res = sb.table("config_tienda").select("*").eq("id", "default").maybe_single().execute()
    settings_res = sb.table("store_settings").select("key,value").eq("store_id", sid).execute()
    store_res = sb.table("stores").select("*,store_templates(*)").eq("id", sid).maybe_single().execute()

    settings_map = {r["key"]: r["value"] for r in (settings_res.data or [])}
    config = config_res.data or {}

    return jsonify({
        "store": store_res.data or {},
        "config": config,
        "settings": settings_map,
    })


@tenant_bp.patch("/store-config")
def update_store_config():
    """Actualiza store_settings clave a clave."""
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id")
    if not sid:
        abort(400, "store_id requerido")

    body = request.get_json(silent=True) or {}
    rows = [{"store_id": sid, "key": k, "value": str(v)} for k, v in body.items()]
    if not rows:
        abort(400, "Sin datos")

    res = sb.table("store_settings").upsert(rows, on_conflict="store_id,key").execute()
    return jsonify({"updated": len(rows), "store_id": sid})


# ─── Tematización ─────────────────────────────────────────────────────────────

@tenant_bp.get("/theme")
def get_theme():
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id")
    res = sb.table("stores").select(
        "id,template_id,theme_tokens,store_templates(*)"
    ).eq("id", sid).maybe_single().execute()
    return jsonify(res.data or {})


@tenant_bp.patch("/theme")
def update_theme():
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id")
    body = request.get_json(silent=True) or {}
    patch = {}
    if "template_id" in body:
        patch["template_id"] = body["template_id"]
    if "theme_tokens" in body:
        patch["theme_tokens"] = body["theme_tokens"]
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("stores").update(patch).eq("id", sid).eq(
        "tenant_id", scope["tenant_id"]
    ).execute()
    return jsonify(res.data[0] if res.data else {})


@tenant_bp.get("/templates")
def list_templates():
    sb = _supa()
    res = sb.table("store_templates").select("*").eq("is_active", True).execute()
    return jsonify(res.data or [])


# ─── Staff del tenant ─────────────────────────────────────────────────────────

@tenant_bp.get("/staff")
def list_tenant_staff():
    sb = _supa()
    scope = _scope()
    res = sb.table("staff_users").select("*").eq("store_id", scope.get("store_id", "")).execute()
    return jsonify(res.data or [])


# ─── Finanzas / Caja ──────────────────────────────────────────────────────────

@tenant_bp.get("/finance/summary")
def finance_summary():
    sb = _supa()
    scope = _scope()
    sid = scope.get("store_id", "")

    # Resumen de pedidos de los últimos 30 días
    orders_res = sb.table("orders").select("id,total,status,created_at").eq(
        "store_id", sid
    ).gte("created_at", "now() - interval '30 days'").execute()

    orders = orders_res.data or []
    delivered = [o for o in orders if o.get("status") == "delivered"]
    total_revenue = sum(float(o.get("total", 0) or 0) for o in delivered)

    return jsonify({
        "period": "30d",
        "total_orders": len(orders),
        "delivered": len(delivered),
        "revenue": round(total_revenue, 2),
        "avg_ticket": round(total_revenue / max(len(delivered), 1), 2),
    })


@tenant_bp.get("/finance/cash-entries")
def list_cash_entries():
    sb = _supa()
    scope = _scope()
    res = sb.table("cash_entries").select("*").eq("store_id", scope.get("store_id", "")).order(
        "created_at", desc=True
    ).limit(100).execute()
    return jsonify(res.data or [])


@tenant_bp.post("/finance/cash-entries")
def create_cash_entry():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    payload = {
        "store_id": scope.get("store_id"),
        "tenant_id": scope.get("tenant_id"),
        "branch_id": scope.get("branch_id"),
        "type": body.get("type", "income"),
        "amount": float(body.get("amount", 0)),
        "concept": body.get("concept", "Entrada manual"),
        "note": body.get("note", ""),
    }
    res = sb.table("cash_entries").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


# ─── Membresías del tenant ────────────────────────────────────────────────────

@tenant_bp.get("/members")
def list_tenant_members():
    sb = _supa()
    scope = _scope()
    res = sb.table("user_memberships").select("*").eq(
        "tenant_id", scope["tenant_id"]
    ).order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@tenant_bp.post("/members")
def invite_tenant_member():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("user_id") or not body.get("role"):
        abort(400, "user_id y role requeridos")

    # Roles que el tenant owner puede asignar (no puede crear super_admin)
    tenant_roles = {"tenant_admin", "store_admin", "store_operator",
                    "branch_manager", "kitchen", "rider", "cashier"}
    if body["role"] not in tenant_roles:
        abort(403, f"No puedes asignar el rol {body['role']}")

    payload = {
        "user_id": body["user_id"],
        "role": body["role"],
        "tenant_id": scope["tenant_id"],
        "store_id": body.get("store_id", scope.get("store_id")),
        "branch_id": body.get("branch_id", scope.get("branch_id")),
        "is_active": True,
    }
    res = sb.table("user_memberships").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@tenant_bp.delete("/members/<member_id>")
def remove_tenant_member(member_id):
    sb = _supa()
    scope = _scope()
    sb.table("user_memberships").delete().eq("id", member_id).eq(
        "tenant_id", scope["tenant_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── Chatbot — estado por tienda ──────────────────────────────────────────────

@tenant_bp.get("/chatbot-status")
def tenant_chatbot_status():
    sb = _supa()
    scope = _scope()
    res = sb.table("branches").select(
        "id,name,slug,chatbot_authorized,chatbot_authorized_at,chatbot_last_seen"
    ).eq("store_id", scope.get("store_id", "")).execute()
    return jsonify(res.data or [])
