"""
/admin — Super Admin CRUD completo con rate limiting.
"""
from __future__ import annotations

import io
import secrets
import zipfile
from datetime import datetime, timezone

from flask import Blueprint, abort, g, jsonify, request, send_file

from ...core.accounts import (
    OWNER_ROLES,
    create_or_update_auth_user,
    hydrate_membership_rows,
    normalize_auth_user,
    update_auth_user,
    upsert_membership,
)
from ...core.extensions import limiter, supabase_admin

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


def _supa():
    if not supabase_admin:
        abort(503, "Supabase no configurado")
    return supabase_admin


def _clean_text(value):
    return str(value or "").strip()


# ─── Health ───────────────────────────────────────────────────────

@admin_bp.get("/health")
def admin_health():
    return {"status": "ok", "module": "admin"}


@admin_bp.get("/context")
def admin_context():
    return {"module": "admin", "auth": g.auth_context.to_dict(), "scope": g.scope}


# ─── Stats globales ───────────────────────────────────────────────

@admin_bp.get("/stats")
@limiter.limit("60 per minute")
def admin_stats():
    sb = _supa()
    tenants  = sb.table("tenants").select("id", count="exact", head=True).execute()
    stores   = sb.table("stores").select("id", count="exact", head=True).execute()
    branches = sb.table("branches").select("id", count="exact", head=True).execute()
    members  = sb.table("user_memberships").select("id", count="exact", head=True).execute()
    return {
        "tenants":  tenants.count  or 0,
        "stores":   stores.count   or 0,
        "branches": branches.count or 0,
        "members":  members.count  or 0,
    }


# ─── Tenants CRUD ─────────────────────────────────────────────────

@admin_bp.get("/tenants")
@limiter.limit("120 per minute")
def list_tenants():
    sb = _supa()
    res = sb.table("tenants").select("*").order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@admin_bp.get("/tenants/<tenant_id>")
def get_tenant(tenant_id):
    sb = _supa()
    res = sb.table("tenants").select("*").eq("id", tenant_id).maybe_single().execute()
    if not res.data:
        abort(404, "Tenant no encontrado")
    return jsonify(res.data)


@admin_bp.post("/tenants")
@limiter.limit("30 per minute")
def create_tenant():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    for field in ["slug", "name"]:
        if not body.get(field):
            abort(400, f"Campo requerido: {field}")
    payload = {
        "slug":          body["slug"].lower().strip(),
        "name":          body["name"].strip(),
        "owner_name":    body.get("owner_name", "").strip() or None,
        "owner_email":   body.get("owner_email", "").strip() or None,
        "owner_phone":   body.get("owner_phone", "").strip() or None,
        "billing_email": body.get("billing_email", "").strip() or None,
        "monthly_fee":   float(body.get("monthly_fee", 0)),
        "notes":         body.get("notes", "").strip() or None,
        "status":        body.get("status", "active"),
    }
    res = sb.table("tenants").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@admin_bp.patch("/tenants/<tenant_id>")
def update_tenant(tenant_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "owner_name", "owner_email", "owner_phone",
               "billing_email", "monthly_fee", "notes", "status"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("tenants").update(patch).eq("id", tenant_id).execute()
    return jsonify(res.data[0] if res.data else {})


@admin_bp.delete("/tenants/<tenant_id>")
@limiter.limit("10 per minute")
def delete_tenant(tenant_id):
    sb = _supa()
    sb.table("tenants").delete().eq("id", tenant_id).execute()
    return jsonify({"deleted": True, "id": tenant_id})


# ─── Stores CRUD ──────────────────────────────────────────────────

@admin_bp.get("/stores")
@limiter.limit("120 per minute")
def list_stores():
    sb = _supa()
    tenant_id = request.args.get("tenant_id")
    q = sb.table("stores").select("*")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    res = q.order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@admin_bp.post("/stores")
@limiter.limit("30 per minute")
def create_store():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    for field in ["id", "name", "tenant_id"]:
        if not body.get(field):
            abort(400, f"Campo requerido: {field}")
    payload = {
        "id":            body["id"].lower().strip(),
        "name":          body["name"].strip(),
        "tenant_id":     body["tenant_id"],
        "template_id":   body.get("template_id", "delivery"),
        "status":        body.get("status", "draft"),
        "business_type": body.get("business_type", "food"),
        "plan_id":       body.get("plan_id", "growth"),
        "city":          body.get("city", "").strip() or None,
        "owner_email":   body.get("owner_email", "").strip() or None,
        "public_visible":body.get("public_visible", True),
        "theme_tokens":  body.get("theme_tokens", {}),
    }
    res = sb.table("stores").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@admin_bp.patch("/stores/<store_id>")
def update_store(store_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "status", "template_id", "theme_tokens",
               "public_visible", "business_type", "plan_id", "city", "owner_email"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("stores").update(patch).eq("id", store_id).execute()
    return jsonify(res.data[0] if res.data else {})


@admin_bp.delete("/stores/<store_id>")
@limiter.limit("10 per minute")
def delete_store(store_id):
    sb = _supa()
    sb.table("stores").delete().eq("id", store_id).execute()
    return jsonify({"deleted": True, "id": store_id})


# ─── Branches CRUD ────────────────────────────────────────────────

@admin_bp.get("/branches")
@limiter.limit("120 per minute")
def list_branches():
    sb = _supa()
    store_id  = request.args.get("store_id")
    tenant_id = request.args.get("tenant_id")
    q = sb.table("branches").select("*")
    if store_id:
        q = q.eq("store_id", store_id)
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    res = q.order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@admin_bp.post("/branches")
@limiter.limit("30 per minute")
def create_branch():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    for field in ["tenant_id", "store_id", "slug", "name"]:
        if not body.get(field):
            abort(400, f"Campo requerido: {field}")
    payload = {
        "tenant_id":      body["tenant_id"],
        "store_id":       body["store_id"],
        "slug":           body["slug"].lower().strip(),
        "name":           body["name"].strip(),
        "address":        body.get("address", "").strip() or None,
        "city":           body.get("city", "").strip() or None,
        "phone":          body.get("phone", "").strip() or None,
        "status":         body.get("status", "active"),
        "is_primary":     body.get("is_primary", False),
        "public_visible": body.get("public_visible", True),
        "open_hour":      body.get("open_hour", 10),
        "close_hour":     body.get("close_hour", 22),
        "open_days":      body.get("open_days", "L-D"),
    }
    res = sb.table("branches").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@admin_bp.patch("/branches/<branch_id>")
def update_branch(branch_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    allowed = ["name", "address", "city", "phone", "status",
               "is_primary", "public_visible", "open_hour", "close_hour",
               "open_days", "theme_override", "operational_config"]
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        abort(400, "Sin campos válidos")
    res = sb.table("branches").update(patch).eq("id", branch_id).execute()
    return jsonify(res.data[0] if res.data else {})


@admin_bp.delete("/branches/<branch_id>")
@limiter.limit("10 per minute")
def delete_branch(branch_id):
    sb = _supa()
    sb.table("branches").delete().eq("id", branch_id).execute()
    return jsonify({"deleted": True, "id": branch_id})


# ─── Membresías ───────────────────────────────────────────────────

@admin_bp.get("/members")
@limiter.limit("60 per minute")
def list_members():
    sb = _supa()
    tenant_id = request.args.get("tenant_id")
    q = sb.table("user_memberships").select("*")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    res = q.order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@admin_bp.post("/members")
@limiter.limit("30 per minute")
def create_member():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    if not body.get("user_id") or not body.get("role"):
        abort(400, "user_id y role requeridos")
    payload = {
        "user_id":   body["user_id"],
        "role":      body["role"],
        "tenant_id": body.get("tenant_id"),
        "store_id":  body.get("store_id"),
        "branch_id": body.get("branch_id"),
        "is_active": body.get("is_active", True),
        "metadata":  body.get("metadata", {}),
    }
    res = sb.table("user_memberships").insert(payload).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@admin_bp.delete("/members/<member_id>")
@limiter.limit("20 per minute")
def delete_member(member_id):
    sb = _supa()
    sb.table("user_memberships").delete().eq("id", member_id).execute()
    return jsonify({"deleted": True, "id": member_id})


# Cuentas de duenos y admins de tenant

@admin_bp.get("/accounts/owners")
@limiter.limit("60 per minute")
def list_owner_accounts():
    sb = _supa()
    memberships = sb.table("user_memberships").select("*").in_(
        "role", list(OWNER_ROLES)
    ).order("created_at", desc=True).execute()
    return jsonify(hydrate_membership_rows(sb, memberships.data or []))


@admin_bp.post("/accounts/owners")
@limiter.limit("20 per minute")
def create_owner_account():
    sb = _supa()
    body = request.get_json(silent=True) or {}
    tenant_id = body.get("tenant_id")
    role = _clean_text(body.get("role") or "tenant_owner")
    email = _clean_text(body.get("email")).lower()
    password = str(body.get("password") or "")
    full_name = _clean_text(body.get("full_name"))

    if role not in OWNER_ROLES:
        abort(400, "Rol invalido para esta cuenta")
    if not tenant_id:
        abort(400, "tenant_id requerido")
    if not email or not password:
        abort(400, "email y password requeridos")

    tenant = sb.table("tenants").select("id,name").eq("id", tenant_id).maybe_single().execute().data
    if not tenant:
        abort(404, "Tenant no encontrado")

    try:
        auth_result = create_or_update_auth_user(email, password, full_name=full_name)
        auth_user = normalize_auth_user(auth_result["user"])
        membership = upsert_membership(
            sb,
            user_id=auth_user["user_id"],
            role=role,
            tenant_id=tenant_id,
            store_id=None,
            branch_id=None,
            metadata={"full_name": full_name, "created_by": g.auth_context.user_id},
        )
    except RuntimeError as exc:
        abort(400, str(exc))

    if role == "tenant_owner":
        tenant_patch = {"owner_email": email}
        if full_name:
            tenant_patch["owner_name"] = full_name
        sb.table("tenants").update(tenant_patch).eq("id", tenant_id).execute()

    response = {
        "created": bool(auth_result["created"]),
        "membership_id": membership.get("id"),
        "role": role,
        "tenant_id": tenant_id,
        "tenant_name": tenant["name"],
        **auth_user,
        "is_active": bool(membership.get("is_active", True)),
    }
    return jsonify(response), 201 if auth_result["created"] else 200


@admin_bp.patch("/accounts/owners/<member_id>")
@limiter.limit("30 per minute")
def update_owner_account(member_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    membership_res = sb.table("user_memberships").select("*").eq("id", member_id).maybe_single().execute()
    membership = membership_res.data
    if not membership or membership.get("role") not in OWNER_ROLES:
        abort(404, "Cuenta de owner no encontrada")

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
        "is_active": bool(updated.get("is_active")),
        **auth_user,
    })


# ─── Chatbot — Autorización ───────────────────────────────────────

@admin_bp.get("/chatbot/authorizations")
@limiter.limit("60 per minute")
def list_chatbot_authorizations():
    sb = _supa()
    res = sb.table("branches").select(
        "id,name,slug,store_id,tenant_id,"
        "chatbot_authorized,chatbot_authorized_at,chatbot_last_seen,chatbot_version"
    ).order("chatbot_authorized_at", desc=True, nullsfirst=False).execute()
    return jsonify(res.data or [])


@admin_bp.post("/chatbot/authorize/<branch_id>")
@limiter.limit("20 per minute")
def authorize_chatbot(branch_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    note = body.get("note", "Autorizado desde Super Admin panel")
    res = sb.rpc("authorize_branch_chatbot", {
        "p_branch_id": branch_id,
        "p_authorize": True,
        "p_note": note,
    }).execute()
    return jsonify(res.data or {"authorized": True, "branch_id": branch_id})


@admin_bp.post("/chatbot/revoke/<branch_id>")
@limiter.limit("20 per minute")
def revoke_chatbot(branch_id):
    sb = _supa()
    body = request.get_json(silent=True) or {}
    note = body.get("note", "Revocado desde Super Admin panel")
    res = sb.rpc("authorize_branch_chatbot", {
        "p_branch_id": branch_id,
        "p_authorize": False,
        "p_note": note,
    }).execute()
    return jsonify(res.data or {"authorized": False, "branch_id": branch_id})


@admin_bp.post("/chatbot/regenerate-secret/<branch_id>")
@limiter.limit("10 per minute")
def regenerate_chatbot_secret(branch_id):
    sb = _supa()
    res = sb.rpc("regenerate_chatbot_secret", {"p_branch_id": branch_id}).execute()
    return jsonify(res.data or {})


@admin_bp.get("/chatbot/download/<branch_id>")
@limiter.limit("10 per minute")
def download_chatbot_portable(branch_id):
    """Genera y devuelve el ZIP del chatbot portable para la branch."""
    sb = _supa()

    branch_res = sb.table("branches").select(
        "id,name,slug,store_id,tenant_id,"
        "chatbot_authorized,chatbot_wa_secret,chatbot_store_id"
    ).eq("id", branch_id).maybe_single().execute()

    branch = branch_res.data
    if not branch:
        abort(404, "Branch no encontrada")
    if not branch.get("chatbot_authorized"):
        abort(403, "Esta sede no tiene autorizado el chatbot portable")

    wa_secret  = branch.get("chatbot_wa_secret") or secrets.token_hex(24)
    store_id   = branch.get("chatbot_store_id") or branch.get("store_id") or "default"
    store_res  = sb.table("stores").select("id,name").eq("id", branch["store_id"]).maybe_single().execute()
    store_name = (store_res.data or {}).get("name", "Mi Tienda")

    env_content = f"""# OXIDIAN Chatbot Portable — {store_name} / {branch['name']}
# Generado: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

# ── OBLIGATORIO — Supabase ──────────────────────────────────────────
SUPABASE_URL=TU_SUPABASE_URL_AQUI
SUPABASE_SERVICE_KEY=TU_SERVICE_ROLE_KEY_AQUI

# ── OBLIGATORIO — Esta sede ─────────────────────────────────────────
CHATBOT_STORE_ID={store_id}

# ── OBLIGATORIO — WhatsApp ──────────────────────────────────────────
ADMIN_PHONE=34600000000
WA_SECRET={wa_secret}

# ── OBLIGATORIO — URL de tu tienda ─────────────────────────────────
SHOP_URL=https://tu-tienda.vercel.app

# ── IA (recomendado: Groq gratuito) ────────────────────────────────
AI_PROVIDER=groq
AI_API_KEY=TU_GROQ_API_KEY
AI_MODEL=llama-3.3-70b-versatile

PORT=3001
"""
    bat_content = r"""@echo off
chcp 65001 >nul
title OXIDIAN Chatbot Portable
echo.
echo  ============================================
echo   OXIDIAN Chatbot Portable
echo  ============================================
node --version >nul 2>&1
if errorlevel 1 (
  echo Instalando Node.js...
  powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile node.msi"
  start /wait msiexec /i node.msi /qn & del node.msi
)
if not exist .env (
  echo ERROR: Copia .env.example como .env y rellena tus datos
  pause & exit /b 1
)
if not exist node_modules npm install
echo Abriendo panel...
timeout /t 2 /nobreak >nul
start http://localhost:3001/qr-page
node server.js
pause
"""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("chatbot-portable/.env", env_content)
        zf.writestr("chatbot-portable/iniciar.bat", bat_content)
        zf.writestr("chatbot-portable/README.md",
                    f"# OXIDIAN Chatbot — {store_name} / {branch['name']}\n\n"
                    "1. Edita `.env` con tus credenciales de Supabase\n"
                    "2. Ejecuta `iniciar.bat`\n"
                    "3. Escanea el QR con WhatsApp\n")
    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"oxidian-chatbot-{store_id}-{branch['slug']}.zip",
    )
