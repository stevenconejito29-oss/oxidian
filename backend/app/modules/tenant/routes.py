"""
/tenant — Panel del dueño del negocio.
Gestión de store config, staff, finanzas, operaciones, personalización.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, jsonify, request

from ...core.accounts import (
    STAFF_ROLES,
    create_or_update_auth_user,
    hydrate_membership_rows,
    normalize_auth_user,
    update_auth_user,
    upsert_membership,
)
from ...core.extensions import supabase_admin


tenant_bp = Blueprint("tenant", __name__, url_prefix="/tenant")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _scope():
    return g.scope


def _clean_text(value):
    return str(value or "").strip()


def _require_tenant_manager():
    if g.auth_context.app_role not in {"super_admin", "tenant_owner", "tenant_admin"}:
        abort(403, "Ruta reservada para owner/admin del tenant")


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
    orders_query = sb.table("orders").select("id,total", count="exact").gte("created_at", "now()::date")
    if sid:
        orders_query = orders_query.eq("store_id", sid)
    else:
        tenant_store_rows = sb.table("stores").select("id").eq("tenant_id", tid).execute().data or []
        tenant_store_ids = [row["id"] for row in tenant_store_rows if row.get("id")]
        if tenant_store_ids:
            orders_query = orders_query.in_("store_id", tenant_store_ids)
        else:
            return jsonify({
                "tenant_id": tid,
                "stores": stores_res.count or 0,
                "branches": branches_res.count or 0,
                "orders_today": 0,
                "revenue_today": 0.0,
            })
    orders_res = orders_query.execute()

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


@tenant_bp.post("/stores")
def create_tenant_store():
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}

    # El tenant_id puede no estar en el JWT en el primer login (claims no propagados aún).
    # En ese caso lo resolvemos directamente desde user_memberships con service_role.
    tenant_id = scope.get("tenant_id")
    if not tenant_id:
        user_id = g.auth_context.user_id
        if not user_id:
            abort(403, "No se pudo resolver el tenant del usuario")
        row = (
            sb.table("user_memberships")
            .select("tenant_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .in_("role", ["tenant_owner", "tenant_admin"])
            .order("created_at", desc=False)
            .limit(1)
            .maybe_single()
            .execute()
            .data
        )
        if not row or not row.get("tenant_id"):
            abort(403, "El usuario no tiene tenant asignado")
        tenant_id = row["tenant_id"]

    name = _clean_text(body.get("name"))
    store_id = _clean_text(body.get("id") or body.get("slug")).lower()
    slug = _clean_text(body.get("slug") or store_id).lower()
    niche = _clean_text(body.get("niche") or body.get("business_niche") or "universal").lower()
    business_type = _clean_text(body.get("business_type") or "food").lower()
    city = _clean_text(body.get("city"))
    notes = _clean_text(body.get("notes"))

    if not name:
        abort(400, "name requerido")
    if not store_id:
        abort(400, "slug requerido")

    store_id = "".join(ch for ch in store_id if ch.isalnum() or ch in {"-", "_"}).strip("-_")
    slug = "".join(ch for ch in slug if ch.isalnum() or ch == "-").strip("-")
    if not store_id or not slug:
        abort(400, "slug invalido")

    payload = {
        "id": store_id,
        "slug": slug,
        "tenant_id": tenant_id,
        "name": name,
        "city": city,
        "notes": notes,
        "status": body.get("status") or "active",
        "business_type": business_type or "food",
        "niche": niche or "universal",
        "template_id": body.get("template_id"),
        "theme_tokens": body.get("theme_tokens") or {},
        "public_visible": bool(body.get("public_visible", True)),
        "owner_email": _clean_text(body.get("owner_email")),
        "owner_name": _clean_text(body.get("owner_name")),
    }

    try:
        inserted = sb.table("stores").insert(payload).execute().data or []
    except Exception as exc:
        abort(400, f"No se pudo crear la tienda: {exc}")

    created_store = inserted[0] if inserted else payload

    try:
        sb.rpc("apply_niche_preset", {
            "p_store_id": created_store["id"],
            "p_tenant_id": tenant_id,
            "p_niche_id": payload["niche"],
        }).execute()
    except Exception:
        pass

    initial_branch_name = _clean_text(body.get("initial_branch_name"))
    initial_branch_slug = _clean_text(body.get("initial_branch_slug")).lower()
    created_branch = None
    if initial_branch_name:
        branch_payload = {
            "tenant_id": tenant_id,
            "store_id": created_store["id"],
            "slug": initial_branch_slug or "principal",
            "name": initial_branch_name,
            "address": _clean_text(body.get("initial_branch_address")),
            "city": _clean_text(body.get("initial_branch_city") or city),
            "phone": _clean_text(body.get("initial_branch_phone")),
            "status": "active",
            "is_primary": True,
            "public_visible": True,
        }
        try:
            branch_res = sb.table("branches").insert(branch_payload).execute()
            created_branch = (branch_res.data or [None])[0]
        except Exception as exc:
            abort(400, f"La tienda se creo, pero la sede inicial fallo: {exc}")

    return jsonify({
        "store": created_store,
        "branch": created_branch,
    }), 201


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
    allowed = [
        "name", "slug", "status", "template_id", "theme_tokens",
        "public_visible", "business_type", "niche", "city", "notes",
    ]
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
    store_id = body.get("store_id") or scope.get("store_id")
    if not store_id:
        abort(400, "store_id requerido")

    # Resolver tenant_id igual que en create_tenant_store
    tenant_id = scope.get("tenant_id")
    if not tenant_id:
        user_id = g.auth_context.user_id
        row = (
            sb.table("user_memberships")
            .select("tenant_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .in_("role", ["tenant_owner", "tenant_admin"])
            .limit(1)
            .maybe_single()
            .execute()
            .data
        )
        if not row or not row.get("tenant_id"):
            abort(403, "El usuario no tiene tenant asignado")
        tenant_id = row["tenant_id"]

    store = sb.table("stores").select("id,tenant_id").eq("id", store_id).maybe_single().execute().data
    if not store or store.get("tenant_id") != tenant_id:
        abort(400, "La tienda no pertenece al tenant activo")

    payload = {
        "tenant_id": tenant_id,
        "store_id": store_id,
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
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    res = sb.table("user_memberships").select("*").eq(
        "tenant_id", scope["tenant_id"]
    ).order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@tenant_bp.post("/members")
def invite_tenant_member():
    _require_tenant_manager()
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
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    sb.table("user_memberships").delete().eq("id", member_id).eq(
        "tenant_id", scope["tenant_id"]
    ).execute()
    return jsonify({"deleted": True})


@tenant_bp.get("/accounts/staff")
def list_staff_accounts():
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    memberships = sb.table("user_memberships").select("*").eq(
        "tenant_id", scope["tenant_id"]
    ).in_("role", list(STAFF_ROLES)).order("created_at", desc=True).execute()
    return jsonify(hydrate_membership_rows(sb, memberships.data or []))


@tenant_bp.post("/accounts/staff")
def create_staff_account():
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}

    role = _clean_text(body.get("role"))
    email = _clean_text(body.get("email")).lower()
    password = str(body.get("password") or "")
    full_name = _clean_text(body.get("full_name"))
    tenant_id = scope["tenant_id"]
    store_id = body.get("store_id") or scope.get("store_id")
    branch_id = body.get("branch_id") or scope.get("branch_id")

    if role not in STAFF_ROLES:
        abort(403, f"No puedes asignar el rol {role}")
    if not email or not password:
        abort(400, "email y password requeridos")

    if role in {"tenant_admin"}:
        store_id = None
        branch_id = None
    elif role in {"store_admin", "store_operator"}:
        if not store_id:
            abort(400, "store_id requerido para roles de tienda")
        branch_id = None
    else:
        if not store_id:
            abort(400, "store_id requerido para roles operativos")
        if not branch_id:
            abort(400, "branch_id requerido para roles operativos")

    if store_id:
        store = sb.table("stores").select("id,tenant_id").eq("id", store_id).maybe_single().execute().data
        if not store or store.get("tenant_id") != tenant_id:
            abort(400, "La tienda no pertenece al tenant activo")
    if branch_id:
        branch = sb.table("branches").select("id,tenant_id,store_id").eq("id", branch_id).maybe_single().execute().data
        if not branch or branch.get("tenant_id") != tenant_id:
            abort(400, "La sede no pertenece al tenant activo")
        if branch.get("store_id") != store_id:
            abort(400, "La sede no coincide con la tienda seleccionada")

    try:
        auth_result = create_or_update_auth_user(email, password, full_name=full_name)
        auth_user = normalize_auth_user(auth_result["user"])
        membership = upsert_membership(
            sb,
            user_id=auth_user["user_id"],
            role=role,
            tenant_id=tenant_id,
            store_id=store_id,
            branch_id=branch_id,
            metadata={"full_name": full_name, "created_by": g.auth_context.user_id},
        )
    except RuntimeError as exc:
        abort(400, str(exc))

    return jsonify({
        "created": bool(auth_result["created"]),
        "membership_id": membership.get("id"),
        "role": role,
        "tenant_id": tenant_id,
        "store_id": store_id,
        "branch_id": branch_id,
        "is_active": bool(membership.get("is_active", True)),
        **auth_user,
    }), 201 if auth_result["created"] else 200


@tenant_bp.patch("/accounts/staff/<member_id>")
def update_staff_account(member_id):
    _require_tenant_manager()
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}

    membership = sb.table("user_memberships").select("*").eq("id", member_id).maybe_single().execute().data
    if not membership or membership.get("tenant_id") != scope["tenant_id"] or membership.get("role") not in STAFF_ROLES:
        abort(404, "Cuenta de staff no encontrada")

    patch = {}
    if "is_active" in body:
        patch["is_active"] = bool(body.get("is_active"))
    if patch:
        sb.table("user_memberships").update(patch).eq("id", member_id).execute()

    full_name = _clean_text(body.get("full_name"))
    password = str(body.get("password") or "")
    try:
        auth_user = normalize_auth_user(update_auth_user(
            membership["user_id"],
            password=password or None,
            full_name=full_name or None,
        ))
    except RuntimeError as exc:
        abort(400, str(exc))

    updated = sb.table("user_memberships").select("*").eq("id", member_id).maybe_single().execute().data or membership
    return jsonify({
        "membership_id": updated.get("id"),
        "role": updated.get("role"),
        "tenant_id": updated.get("tenant_id"),
        "store_id": updated.get("store_id"),
        "branch_id": updated.get("branch_id"),
        "is_active": bool(updated.get("is_active")),
        **auth_user,
    })


# ─── Chatbot — estado por tienda ──────────────────────────────────────────────

@tenant_bp.get("/chatbot-status")
def tenant_chatbot_status():
    sb = _supa()
    scope = _scope()
    res = sb.table("branches").select(
        "id,name,slug,chatbot_authorized,chatbot_authorized_at,chatbot_last_seen"
    ).eq("store_id", scope.get("store_id", "")).execute()
    return jsonify(res.data or [])
