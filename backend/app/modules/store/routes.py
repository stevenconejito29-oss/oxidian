"""
/store — Gestión de template, catálogo, toppings y dominio de la marca.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, jsonify, request

from ...core.extensions import supabase_admin


store_bp = Blueprint("store", __name__, url_prefix="/store")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _scope():
    return g.scope


# ─── Health ───────────────────────────────────────────────────────────────────

@store_bp.get("/health")
def store_health():
    return {"status": "ok", "module": "store"}


# ─── Template y tema ──────────────────────────────────────────────────────────

@store_bp.get("/templates")
def list_templates():
    sb = _supa()
    res = sb.table("store_templates").select("*").eq("is_active", True).execute()
    return jsonify(res.data or [])


@store_bp.get("/theme")
def get_store_theme():
    sb = _supa()
    scope = _scope()
    res = sb.table("stores").select(
        "id,template_id,theme_tokens,store_templates(*)"
    ).eq("id", scope["store_id"]).maybe_single().execute()
    return jsonify(res.data or {})


@store_bp.patch("/theme")
def update_store_theme():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    patch = {}
    if "template_id" in body:
        patch["template_id"] = body["template_id"]
    if "theme_tokens" in body:
        patch["theme_tokens"] = body["theme_tokens"]
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("stores").update(patch).eq("id", scope["store_id"]).execute()
    return jsonify(res.data[0] if res.data else {})


# ─── Catálogo — Productos ─────────────────────────────────────────────────────

@store_bp.get("/products")
def list_store_products():
    sb = _supa()
    scope = _scope()
    category = request.args.get("category")
    q = sb.table("products").select("*").eq("store_id", scope["store_id"])
    if category:
        q = q.eq("category", category)
    res = q.order("category").order("name").execute()
    return jsonify(res.data or [])


@store_bp.post("/products")
def create_store_product():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
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


@store_bp.patch("/products/<product_id>")
def update_store_product(product_id):
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


@store_bp.delete("/products/<product_id>")
def delete_store_product(product_id):
    sb = _supa()
    scope = _scope()
    sb.table("products").delete().eq("id", product_id).eq(
        "store_id", scope["store_id"]
    ).execute()
    return jsonify({"deleted": True})


# ─── Toppings ─────────────────────────────────────────────────────────────────

@store_bp.get("/toppings")
def list_toppings():
    sb = _supa()
    scope = _scope()
    res = sb.table("toppings").select("*,topping_categories(*)").eq(
        "store_id", scope["store_id"]
    ).order("name").execute()
    return jsonify(res.data or [])


@store_bp.post("/toppings")
def create_topping():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "name": body["name"].strip(),
        "price": float(body.get("price", 0)),
        "category_id": body.get("category_id"),
        "is_active": body.get("is_active", True),
    }
    res = sb.table("toppings").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@store_bp.get("/topping-categories")
def list_topping_categories():
    sb = _supa()
    scope = _scope()
    res = sb.table("topping_categories").select("*").eq(
        "store_id", scope["store_id"]
    ).order("name").execute()
    return jsonify(res.data or [])


@store_bp.post("/topping-categories")
def create_topping_category():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        abort(400, "Nombre requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "name": body["name"].strip(),
        "required": body.get("required", False),
        "max_selections": body.get("max_selections", 1),
    }
    res = sb.table("topping_categories").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


# ─── Domain mapping ───────────────────────────────────────────────────────────

@store_bp.get("/domain-mappings")
def list_domain_mappings():
    sb = _supa()
    scope = _scope()
    res = sb.table("domain_mappings").select("*").eq("store_id", scope["store_id"]).execute()
    return jsonify(res.data or [])


@store_bp.post("/domain-mappings")
def create_domain_mapping():
    sb = _supa()
    scope = _scope()
    body = request.get_json(silent=True) or {}
    if not body.get("domain"):
        abort(400, "domain requerido")
    payload = {
        "store_id": scope["store_id"],
        "tenant_id": scope["tenant_id"],
        "domain": body["domain"].lower().strip(),
        "is_primary": body.get("is_primary", False),
        "is_verified": False,
    }
    res = sb.table("domain_mappings").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201
