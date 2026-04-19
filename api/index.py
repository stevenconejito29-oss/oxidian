"""
api/index.py — Flask Serverless en Vercel (Python 3.12)

Solo maneja lo que NO se puede hacer desde el frontend directamente:
  - Crear / actualizar usuarios en Supabase Auth (requiere service_role)
  - Generar y descargar el chatbot portable en ZIP
  - Invitar usuarios por email

El resto (CRUD de stores, branches, products, orders) va directo desde
el frontend → Supabase JS con RLS.
"""
from __future__ import annotations

import io
import json
import os
import zipfile
from datetime import datetime, timezone

import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client

# ── Configuración ───────────────────────────────────────────────────
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET  = os.environ.get("SUPABASE_JWT_SECRET", "")
SUPER_ADMIN_EMAIL    = os.environ.get("SUPER_ADMIN_EMAIL", "pepemellamoyoo@oxidian.app")

app = Flask(__name__)
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization", "X-Tenant-ID"])

# ── Supabase admin client (service_role) ─────────────────────────────
def _sb() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Auth helpers ──────────────────────────────────────────────────────
def _get_token() -> str | None:
    h = request.headers.get("Authorization", "")
    return h[7:] if h.lower().startswith("bearer ") else None

def _decode_token(token: str) -> dict:
    if not SUPABASE_JWT_SECRET:
        raise RuntimeError("SUPABASE_JWT_SECRET no configurado")
    return jwt.decode(
        token,
        SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )

def _load_membership(user_id: str) -> dict | None:
    try:
        res = _sb().table("user_memberships") \
            .select("role,tenant_id,store_id,branch_id,is_active") \
            .eq("user_id", user_id).eq("is_active", True).execute()
        rows = res.data or []
        if not rows:
            return None
        priority = ["super_admin","tenant_owner","tenant_admin","store_admin",
                    "store_operator","branch_manager","cashier","kitchen","rider"]
        rows.sort(key=lambda r: priority.index(r["role"]) if r["role"] in priority else 99)
        return rows[0]
    except Exception:
        return None

def _require_auth():
    """Returns (user_id, membership) or raises."""
    token = _get_token()
    if not token:
        return None, None
    try:
        claims = _decode_token(token)
    except Exception:
        return None, None
    user_id = claims.get("sub")
    if not user_id:
        return None, None
    membership = _load_membership(user_id)
    return user_id, membership

def _require_super_admin():
    uid, m = _require_auth()
    if not m or m.get("role") != "super_admin":
        return None, None, jsonify({"error": "Super admin required"}), 403
    return uid, m, None, None

def _err(msg, code=400):
    return jsonify({"error": msg}), code

def _ok(data=None, msg="OK", status=200):
    payload = {"success": True, "message": msg}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status

# ── Preflight CORS ────────────────────────────────────────────────────
@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        from flask import Response
        r = Response()
        r.headers["Access-Control-Allow-Origin"] = "*"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Tenant-ID"
        return r, 204

# ── Health ────────────────────────────────────────────────────────────
@app.route("/api/backend/health")
def health():
    return _ok({"supabase": bool(SUPABASE_URL)}, "API OK")

# ══════════════════════════════════════════════════════════════════════
# ADMIN — Cuentas de usuario (requiere service_role)
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/backend/admin/accounts/owners", methods=["GET"])
def list_owner_accounts():
    uid, m, err, code = _require_super_admin()
    if err:
        return err, code
    try:
        sb = _sb()
        res = sb.table("user_memberships") \
            .select("id,user_id,role,tenant_id,is_active,metadata") \
            .in_("role", ["tenant_owner", "tenant_admin"]) \
            .order("created_at", desc=True).execute()
        rows = res.data or []
        # Hidratar con info de auth (email, name)
        hydrated = []
        for row in rows:
            user_info = {}
            try:
                u = sb.auth.admin.get_user_by_id(row["user_id"])
                if u.user:
                    user_info = {
                        "email": u.user.email,
                        "full_name": (u.user.user_metadata or {}).get("full_name", ""),
                        "last_sign_in_at": str(u.user.last_sign_in_at or ""),
                    }
            except Exception:
                pass
            # Tenant name
            tenant_name = ""
            if row.get("tenant_id"):
                try:
                    t = sb.table("tenants").select("name").eq("id", row["tenant_id"]).maybe_single().execute()
                    tenant_name = (t.data or {}).get("name", "")
                except Exception:
                    pass
            hydrated.append({**row, **user_info, "membership_id": row["id"], "tenant_name": tenant_name})
        return jsonify(hydrated), 200
    except Exception as e:
        return _err(str(e), 500)


@app.route("/api/backend/admin/accounts/owners", methods=["POST"])
def create_owner_account():
    uid, m, err, code = _require_super_admin()
    if err:
        return err, code
    body = request.get_json(silent=True) or {}
    tenant_id  = body.get("tenant_id")
    role       = body.get("role", "tenant_owner")
    email      = str(body.get("email", "")).strip().lower()
    password   = str(body.get("password", "")).strip()
    full_name  = str(body.get("full_name", "")).strip()
    if role not in ("tenant_owner", "tenant_admin"):
        return _err("Rol inválido para esta cuenta")
    if not tenant_id or not email or not password:
        return _err("tenant_id, email y password son requeridos")
    try:
        sb = _sb()
        # Crear o reutilizar usuario en Auth
        try:
            auth_res = sb.auth.admin.create_user({
                "email": email, "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name},
            })
            user_id = auth_res.user.id
            created = True
        except Exception as create_err:
            if "already registered" in str(create_err).lower():
                users = sb.auth.admin.list_users()
                existing = next((u for u in users if u.email == email), None)
                if not existing:
                    return _err(f"Usuario ya existe pero no se pudo obtener: {create_err}")
                user_id = existing.id
                sb.auth.admin.update_user_by_id(user_id, {"password": password})
                created = False
            else:
                return _err(str(create_err), 500)
        # Upsert membresía
        sb.table("user_memberships").delete() \
            .eq("user_id", user_id).eq("role", role).is_("tenant_id", tenant_id).execute()
        mem_res = sb.table("user_memberships").insert({
            "user_id": user_id, "role": role,
            "tenant_id": tenant_id, "store_id": None, "branch_id": None,
            "is_active": True,
            "metadata": {"full_name": full_name, "created_by": uid},
        }).execute()
        membership = (mem_res.data or [{}])[0]
        # Actualizar owner_email en tenant
        if role == "tenant_owner":
            sb.table("tenants").update({"owner_email": email, "owner_name": full_name}) \
                .eq("id", tenant_id).execute()
        return _ok({
            "user_id": user_id, "email": email, "full_name": full_name,
            "role": role, "tenant_id": tenant_id,
            "membership_id": membership.get("id"),
            "created": created,
        }, "Cuenta creada" if created else "Cuenta actualizada", 201 if created else 200)
    except Exception as e:
        return _err(str(e), 500)


@app.route("/api/backend/admin/accounts/owners/<member_id>", methods=["PATCH"])
def update_owner_account(member_id):
    uid, m, err, code = _require_super_admin()
    if err:
        return err, code
    body = request.get_json(silent=True) or {}
    try:
        sb = _sb()
        mem = sb.table("user_memberships").select("*").eq("id", member_id).maybe_single().execute().data
        if not mem:
            return _err("Membresía no encontrada", 404)
        patch = {}
        if "is_active" in body:
            patch["is_active"] = bool(body["is_active"])
        if patch:
            sb.table("user_memberships").update(patch).eq("id", member_id).execute()
        auth_patch = {}
        if body.get("password"):
            auth_patch["password"] = body["password"]
        if body.get("full_name"):
            auth_patch["user_metadata"] = {"full_name": body["full_name"]}
        if auth_patch:
            sb.auth.admin.update_user_by_id(mem["user_id"], auth_patch)
        return _ok({"membership_id": member_id}, "Cuenta actualizada")
    except Exception as e:
        return _err(str(e), 500)


@app.route("/api/backend/tenant/accounts/staff", methods=["POST"])
def create_staff_account():
    uid, m, err_resp, err_code = None, None, None, None
    token = _get_token()
    if not token:
        return _err("Authentication required", 401)
    try:
        claims = _decode_token(token)
        uid = claims.get("sub")
        m = _load_membership(uid)
    except Exception:
        return _err("Invalid token", 401)
    if not m or m.get("role") not in ("super_admin", "tenant_owner", "tenant_admin"):
        return _err("Forbidden", 403)

    body = request.get_json(silent=True) or {}
    tenant_id = m.get("tenant_id") if m.get("role") != "super_admin" else body.get("tenant_id")
    role      = str(body.get("role", "")).strip()
    email     = str(body.get("email", "")).strip().lower()
    password  = str(body.get("password", "")).strip()
    full_name = str(body.get("full_name", "")).strip()
    store_id  = body.get("store_id")
    branch_id = body.get("branch_id")

    staff_roles = {"tenant_admin","store_admin","store_operator","branch_manager","cashier","kitchen","rider"}
    if role not in staff_roles:
        return _err(f"Rol '{role}' no permitido para staff")
    if not email or not password:
        return _err("email y password requeridos")
    if not tenant_id:
        return _err("tenant_id requerido")

    try:
        sb = _sb()
        try:
            auth_res = sb.auth.admin.create_user({
                "email": email, "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name},
            })
            user_id = auth_res.user.id
            created = True
        except Exception as ce:
            if "already registered" in str(ce).lower():
                users = sb.auth.admin.list_users()
                existing = next((u for u in users if u.email == email), None)
                if not existing:
                    return _err(str(ce), 500)
                user_id = existing.id
                sb.auth.admin.update_user_by_id(user_id, {"password": password})
                created = False
            else:
                return _err(str(ce), 500)

        mem_res = sb.table("user_memberships").insert({
            "user_id": user_id, "role": role,
            "tenant_id": tenant_id,
            "store_id": store_id,
            "branch_id": branch_id,
            "is_active": True,
            "metadata": {"full_name": full_name, "created_by": uid},
        }).execute()
        membership = (mem_res.data or [{}])[0]
        return _ok({
            "user_id": user_id, "email": email, "role": role,
            "membership_id": membership.get("id"), "created": created,
        }, "Staff creado", 201 if created else 200)
    except Exception as e:
        return _err(str(e), 500)


@app.route("/api/backend/tenant/accounts/staff/<member_id>", methods=["PATCH"])
def update_staff_account(member_id):
    token = _get_token()
    if not token:
        return _err("Authentication required", 401)
    try:
        claims = _decode_token(token)
        uid = claims.get("sub")
        m = _load_membership(uid)
    except Exception:
        return _err("Invalid token", 401)
    if not m or m.get("role") not in ("super_admin", "tenant_owner", "tenant_admin"):
        return _err("Forbidden", 403)
    body = request.get_json(silent=True) or {}
    try:
        sb = _sb()
        mem = sb.table("user_memberships").select("*").eq("id", member_id).maybe_single().execute().data
        if not mem:
            return _err("Staff no encontrado", 404)
        if m.get("role") != "super_admin" and mem.get("tenant_id") != m.get("tenant_id"):
            return _err("Forbidden", 403)
        patch = {}
        if "is_active" in body:
            patch["is_active"] = bool(body["is_active"])
        if patch:
            sb.table("user_memberships").update(patch).eq("id", member_id).execute()
        auth_patch = {}
        if body.get("password"):
            auth_patch["password"] = body["password"]
        if body.get("full_name"):
            auth_patch["user_metadata"] = {"full_name": body["full_name"]}
        if auth_patch:
            sb.auth.admin.update_user_by_id(mem["user_id"], auth_patch)
        return _ok({"membership_id": member_id}, "Staff actualizado")
    except Exception as e:
        return _err(str(e), 500)


# ══════════════════════════════════════════════════════════════════════
# CHATBOT PORTABLE — Generación del ZIP por sede
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/backend/admin/chatbot/download/<branch_id>")
def download_chatbot(branch_id):
    uid, m, err, code = _require_super_admin()
    if err:
        return err, code
    try:
        sb = _sb()
        branch = sb.table("branches").select(
            "id,name,slug,store_id,tenant_id,chatbot_authorized,chatbot_wa_secret"
        ).eq("id", branch_id).maybe_single().execute().data
        if not branch:
            return _err("Sede no encontrada", 404)

        store = sb.table("stores").select("id,name,slug,niche").eq(
            "id", branch["store_id"]
        ).maybe_single().execute().data or {}
        store_name  = store.get("name", "Mi Tienda")
        store_slug  = store.get("slug", branch["store_id"])
        branch_slug = branch.get("slug", branch_id)

        import secrets as _secrets
        wa_secret = branch.get("chatbot_wa_secret") or _secrets.token_hex(24)

        # Leer URL del frontend desde env o usar default
        frontend_url = os.environ.get("FRONTEND_URL", "https://oxidian.vercel.app")
        shop_url = f"{frontend_url}/s/{store_slug}/menu"

        env_content = f"""# OXIDIAN Chatbot Portable — {store_name} / {branch['name']}
# Generado: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
# NO compartas este archivo — contiene claves privadas.

# ── Supabase (obligatorio) ──────────────────────────────────────────
SUPABASE_URL={SUPABASE_URL}
SUPABASE_SERVICE_KEY={SUPABASE_SERVICE_KEY}

# ── Sede (obligatorio) ──────────────────────────────────────────────
STORE_ID={store_slug}
BRANCH_ID={branch_id}

# ── WhatsApp (obligatorio) ──────────────────────────────────────────
ADMIN_PHONE=34600000000
WA_SECRET={wa_secret}

# ── Tienda ──────────────────────────────────────────────────────────
SHOP_URL={shop_url}
INSTAGRAM_HANDLE=@{store_slug}

# ── IA (opcional — mejora respuestas generales) ─────────────────────
AI_PROVIDER=groq
AI_API_KEY=pega_aqui_tu_groq_api_key
AI_MODEL=llama-3.3-70b-versatile

PORT=3001
ORDER_SYNC_INTERVAL_MS=10000
REVIEW_DELAY_MINUTES=5
ORDER_LOOKBACK_HOURS=72
"""

        bat = r"""@echo off
chcp 65001 >nul
title OXIDIAN Chatbot Portable
echo.
echo  ============================================
echo   OXIDIAN Chatbot — Panel WhatsApp
echo  ============================================
echo.
node --version >nul 2>&1
if errorlevel 1 (
    echo Necesitas Node.js. Descargalo en https://nodejs.org
    pause & exit /b 1
)
if not exist ".env" (
    echo ERROR: Falta el archivo .env
    echo Copia .env.example como .env y rellena tus datos.
    pause & exit /b 1
)
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)
echo Abriendo panel QR...
timeout /t 2 /nobreak >nul
start http://localhost:3001/qr-page
node server.js
pause
"""

        sh = """#!/bin/bash
echo "OXIDIAN Chatbot Portable"
if ! command -v node &> /dev/null; then
    echo "Necesitas Node.js: https://nodejs.org"
    exit 1
fi
[ ! -f ".env" ] && echo "Falta .env — copia .env.example" && exit 1
[ ! -d "node_modules" ] && npm install
open http://localhost:3001/qr-page 2>/dev/null || xdg-open http://localhost:3001/qr-page 2>/dev/null &
node server.js
"""

        readme = f"""# OXIDIAN Chatbot Portable — {store_name} / {branch['name']}

## Configuración inicial

1. El archivo `.env` ya está pre-configurado para esta sede.
2. Revisa y ajusta:
   - `ADMIN_PHONE` → tu número con prefijo país (ej: 34600000000)
   - `AI_API_KEY` → opcional, mejora las respuestas generales

## Arrancar el chatbot

**Windows:** Doble clic en `iniciar.bat`

**Mac/Linux:**
```bash
chmod +x iniciar.sh && ./iniciar.sh
```

3. Escanea el QR con WhatsApp en tu móvil
4. El bot queda activo mientras la ventana esté abierta

## El chatbot puede:
- Responder preguntas sobre el menú y horarios
- Informar del estado de pedidos
- Notificar automáticamente los nuevos pedidos
- Escalar al administrador cuando no puede ayudar
- Enviarte alertas de pedidos pendientes

## Datos de la sede
- **Tienda:** {store_name}
- **Sede:** {branch['name']}
- **Store ID:** {store_slug}
- **Branch ID:** {branch_id}
"""

        # Generar ZIP con todos los archivos necesarios del chatbot
        zip_buf = io.BytesIO()
        prefix  = f"oxidian-chatbot-{store_slug}-{branch_slug}/"

        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(prefix + ".env",         env_content)
            zf.writestr(prefix + ".env.example", _env_example())
            zf.writestr(prefix + "iniciar.bat",  bat)
            zf.writestr(prefix + "iniciar.sh",   sh)
            zf.writestr(prefix + "README.md",    readme)
            zf.writestr(prefix + "package.json", _package_json())
            zf.writestr(prefix + "server.js",    _server_js())
            zf.writestr(prefix + "chatbot-logic.js", _chatbot_logic_js())
            zf.writestr(prefix + "config.js",    _config_js())
            zf.writestr(prefix + "order-notifier.js", _order_notifier_js())
            zf.writestr(prefix + ".gitignore",
                        "node_modules/\n.env\n.wa-session/\n.wwebjs_cache/\n*.log\n")

        zip_buf.seek(0)
        from flask import send_file
        return send_file(
            zip_buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"oxidian-chatbot-{store_slug}-{branch_slug}.zip",
        )
    except Exception as e:
        return _err(str(e), 500)


# ── Pipeline: invitar usuario por email ──────────────────────────────
@app.route("/api/backend/admin/pipeline/<req_id>/invite", methods=["POST"])
def invite_pipeline(req_id):
    uid, m, err, code = _require_super_admin()
    if err:
        return err, code
    try:
        sb = _sb()
        lead = sb.table("landing_requests").select("*").eq("id", req_id).maybe_single().execute().data
        if not lead:
            return _err("Solicitud no encontrada", 404)
        email = str(lead.get("email", "")).strip().lower()
        if not email:
            return _err("La solicitud no tiene email", 400)
        body = request.get_json(silent=True) or {}
        redirect_to = body.get("redirectTo") or \
            (request.headers.get("Origin", "") + "/onboarding")
        sb.auth.admin.invite_user_by_email(email, options={
            "redirect_to": redirect_to,
            "data": {
                "full_name": lead.get("full_name"),
                "business_name": lead.get("business_name"),
                "source": "landing_pipeline",
            },
        })
        sb.table("landing_requests").update({"status": "onboarding"}).eq("id", req_id).execute()
        return _ok({"email": email}, "Invitación enviada")
    except Exception as e:
        return _err(str(e), 500)


# ══════════════════════════════════════════════════════════════════════
# Archivos del chatbot portable (inline para el ZIP)
# ══════════════════════════════════════════════════════════════════════

def _env_example():
    return """# OXIDIAN Chatbot Portable — Variables de entorno
# Copia como .env y rellena los valores

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key

STORE_ID=tu-tienda-slug
BRANCH_ID=uuid-de-la-sede

ADMIN_PHONE=34600000000
WA_SECRET=clave-secreta-aleatoria

SHOP_URL=https://tu-tienda.vercel.app/s/tu-tienda/menu
INSTAGRAM_HANDLE=@tu_tienda

AI_PROVIDER=groq
AI_API_KEY=
AI_MODEL=llama-3.3-70b-versatile

PORT=3001
ORDER_SYNC_INTERVAL_MS=10000
REVIEW_DELAY_MINUTES=5
ORDER_LOOKBACK_HOURS=72
"""

def _package_json():
    return json.dumps({
        "name": "oxidian-chatbot-portable",
        "version": "3.0.0",
        "description": "OXIDIAN Chatbot WhatsApp portable — multi-tienda",
        "main": "server.js",
        "scripts": {"start": "node server.js"},
        "dependencies": {
            "whatsapp-web.js": "^1.23.0",
            "qrcode": "^1.5.3",
            "express": "^4.18.2",
            "cors": "^2.8.5",
            "@supabase/supabase-js": "^2.39.0",
            "dotenv": "^16.3.1",
            "node-fetch": "^3.3.2"
        }
    }, indent=2)

def _config_js():
    return r"""'use strict'
require('dotenv').config()

function str(v, def_ = '') { return String(v || '').trim() || def_ }
function int(v, def_) {
  const n = parseInt(String(v || '').trim(), 10)
  return isFinite(n) && n > 0 ? n : def_
}

const appConfig = {
  port:                  int(process.env.PORT, 3001),
  orderSyncIntervalMs:   int(process.env.ORDER_SYNC_INTERVAL_MS, 10000),
  reviewDelayMinutes:    int(process.env.REVIEW_DELAY_MINUTES, 5),
  orderLookbackHours:    int(process.env.ORDER_LOOKBACK_HOURS, 72),
  waSecret:              str(process.env.WA_SECRET),
  supabaseUrl:           str(process.env.SUPABASE_URL),
  supabaseServiceKey:    str(process.env.SUPABASE_SERVICE_KEY),
  adminPhone:            str(process.env.ADMIN_PHONE),
  shopUrl:               str(process.env.SHOP_URL),
  storeId:               str(process.env.STORE_ID),
  branchId:              str(process.env.BRANCH_ID),
  instagramHandle:       str(process.env.INSTAGRAM_HANDLE),
  aiProvider:            str(process.env.AI_PROVIDER, 'groq'),
  aiApiKey:              str(process.env.AI_API_KEY),
  aiModel:               str(process.env.AI_MODEL, 'llama-3.3-70b-versatile'),
  waSessionPath:         require('path').resolve(__dirname, '.wa-session'),
}

function validate() {
  const missing = []
  if (!appConfig.supabaseUrl)        missing.push('SUPABASE_URL')
  if (!appConfig.supabaseServiceKey) missing.push('SUPABASE_SERVICE_KEY')
  if (!appConfig.storeId)            missing.push('STORE_ID')
  return missing
}

module.exports = { appConfig, validate }
"""

def _server_js():
    return r"""'use strict'
require('dotenv').config()

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode   = require('qrcode')
const express  = require('express')
const cors     = require('cors')
const { createClient } = require('@supabase/supabase-js')
const { appConfig, validate } = require('./config')
const { handleMessage, reloadSettings, setWAClient } = require('./chatbot-logic')
const { createOrderNotifier } = require('./order-notifier')

const missing = validate()
if (missing.length > 0) {
  console.error(`ERROR: Faltan variables: ${missing.join(', ')}`)
  process.exit(1)
}

const { port, waSecret, adminPhone, shopUrl, storeId, branchId } = appConfig
const sb = createClient(appConfig.supabaseUrl, appConfig.supabaseServiceKey)

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '2mb' }))

let qrBase64  = null
let connected = false
let notifier  = null
const takeovers = new Set()

function isLocal(req) {
  const raw = String(req.ip || req.socket?.remoteAddress || '')
  const ip  = raw.replace(/^::ffff:/, '').split('%')[0]
  return ['127.0.0.1', '::1', 'localhost'].includes(ip)
}

function auth(req, res, next) {
  const secret = req.headers['x-secret'] || req.query.secret || ''
  if (waSecret && secret !== waSecret && !isLocal(req))
    return res.status(401).json({ error: 'Unauthorized' })
  next()
}

function normalize(phone) {
  const d = String(phone || '').replace('@c.us', '').replace(/\D/g, '')
  return d ? `${d}@c.us` : null
}

async function send(phone, msg) {
  if (!connected) throw new Error('WhatsApp no conectado')
  const wa = normalize(phone)
  if (!wa) throw new Error('phone inválido')
  await client.sendMessage(wa, msg)
  return wa
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: appConfig.waSessionPath }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-accelerated-2d-canvas','--no-zygote','--disable-gpu'],
  },
})

client.on('qr', async qr => {
  console.log(`QR listo → http://localhost:${port}/qr-page`)
  try { qrBase64 = await qrcode.toDataURL(qr) } catch (e) { console.error(e.message) }
  connected = false
})

client.on('ready', async () => {
  console.log('WhatsApp conectado')
  qrBase64  = null
  connected = true
  setWAClient(client, adminPhone, storeId, branchId)
  await reloadSettings(sb, storeId, branchId)
  if (notifier) notifier.stop()
  notifier = createOrderNotifier({ sb, send, isReady: () => connected, storeId, branchId })
  notifier.start()
})

client.on('disconnected', () => {
  connected = false
  if (notifier) notifier.stop()
})

client.on('message', async msg => {
  if (msg.fromMe || msg.isGroupMsg || msg.isStatus) return
  const from = msg.from
  if (takeovers.has(from)) return
  try {
    const reply = await handleMessage(msg.body, from, sb, storeId, branchId, adminPhone, shopUrl)
    if (reply) await client.sendMessage(from, reply)
  } catch (e) { console.error('Error:', e.message) }
})

client.initialize().catch(e => console.error('Fatal WA:', e.message))

// ── Rutas API ─────────────────────────────────────────────────────
app.get('/',           (_, r) => r.json({ ok: true, connected, storeId, branchId }))
app.get('/qr-page',    (_, r) => r.setHeader('Content-Type','text/html').send(qrPage()))
app.get('/qr',   auth, (_, r) => {
  if (connected)  return r.json({ connected: true, qr: null })
  if (!qrBase64)  return r.status(202).json({ waiting: true })
  return r.json({ connected: false, qr: qrBase64 })
})
app.get('/status', auth, (_, r) => r.json({ ok: true, connected, storeId, branchId }))
app.post('/reload', auth, async (_, r) => {
  await reloadSettings(sb, storeId, branchId)
  r.json({ ok: true })
})
app.post('/send', auth, async (req, r) => {
  const { phone, message } = req.body
  if (!phone || !message) return r.status(400).json({ error: 'phone y message requeridos' })
  try { const wa = await send(phone, message); r.json({ ok: true, wa }) }
  catch (e) { r.status(500).json({ error: e.message }) }
})
app.post('/takeover', auth, (req, r) => {
  const { phone, release } = req.body
  if (!phone) return r.status(400).json({ error: 'phone requerido' })
  release ? takeovers.delete(phone) : takeovers.add(phone)
  r.json({ ok: true, phone, active: !release })
})
app.post('/chatbot/test', auth, async (req, r) => {
  const { message = '', phone = 'test@c.us' } = req.body
  try {
    const reply = await handleMessage(message, phone, sb, storeId, branchId, adminPhone, shopUrl)
    r.json({ ok: true, reply })
  } catch (e) { r.status(500).json({ error: e.message }) }
})

app.listen(port, () => {
  console.log(`\nOXIDIAN Chatbot activo → http://localhost:${port}/qr-page`)
  console.log(`Tienda: ${storeId} | Sede: ${branchId || 'principal'}`)
})

function qrPage() {
  const s = waSecret || ''
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OXIDIAN Chatbot</title>
<style>*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;
display:flex;align-items:center;justify-content:center}
.card{background:#141414;border:1px solid #222;border-radius:20px;padding:36px;
text-align:center;max-width:400px;width:90%}
h1{color:#6366f1;font-size:1.5rem;margin-bottom:6px}
.sub{color:#555;font-size:.8rem;margin-bottom:24px}
.qr-box{background:#fff;display:inline-block;padding:12px;border-radius:12px;margin-bottom:18px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
border-radius:999px;font-size:.8rem;font-weight:700}
.ok{background:#14532d;color:#86efac}.wait{background:#78350f;color:#fcd34d}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:blink 1.2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}</style></head>
<body><div class="card">
<h1>OXIDIAN</h1><p class="sub">Panel WhatsApp</p>
<div id="qr-wrap"><div class="badge wait"><span class="dot"></span> Cargando...</div></div>
<div id="st" class="badge wait" style="margin-top:12px"><span class="dot"></span> Conectando...</div>
</div>
<script>
const SEC='${s}'
async function f(p){const sep=p.includes('?')?'&':'?';const u=SEC?p+sep+'secret='+encodeURIComponent(SEC):p;return fetch(u).then(r=>r.json())}
async function poll(){try{
const st=await f('/status');const ste=document.getElementById('st');const qw=document.getElementById('qr-wrap');
if(st.connected){ste.className='badge ok';ste.innerHTML='Conectado ✓';qw.innerHTML='<p style="color:#86efac;padding:20px">Bot activo</p>'}
else{const q=await f('/qr');if(q.qr){qw.innerHTML='<div class="qr-box"><img src="'+q.qr+'" width="220" height="220"/></div>'}
ste.className='badge wait';ste.innerHTML='<span class="dot"></span> Escanea el QR'}}catch(e){}}
poll();setInterval(poll,4000)
</script></body></html>`
}
"""

def _chatbot_logic_js():
    return r"""'use strict'
/**
 * OXIDIAN Chatbot Logic — Multi-tienda, configurable desde Supabase.
 * Lee ajustes de la tabla store_settings (o settings) para el store/branch configurado.
 */
const { appConfig } = require('./config')

let chatbotEnabled  = true
let chatbotRules    = []
let storeSettings   = {}
let lastReload      = 0
let waClient        = null
let adminPhone      = null

const conversationState = new Map()
const STATE_TTL = 20 * 60 * 1000

const NO_CANCEL = ['preparing','ready','delivering','delivered']
const CONFIRM_WORDS = ['si','sí','confirmo','cancelar','si cancelar']

const STATE_LABELS = {
  pending:'Pendiente', preparing:'En preparación',
  ready:'Listo', delivering:'En camino', delivered:'Entregado', cancelled:'Cancelado',
}

function setWAClient(client, phone, storeId, branchId) {
  waClient    = client
  adminPhone  = phone
}

function norm(v) {
  return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function matches(msg, words) { return words.some(w => msg.includes(norm(w))) }
function money(v, currency = 'EUR') { return `${Number(v||0).toFixed(2)} ${currency}` }
function fmt(v) {
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleString('es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
}

function setState(phone, data) {
  conversationState.set(phone, { ...data, expiresAt: Date.now() + STATE_TTL })
}
function getState(phone) {
  const s = conversationState.get(phone)
  if (!s) return null
  if (s.expiresAt <= Date.now()) { conversationState.delete(phone); return null }
  return s
}
function clearState(phone) { conversationState.delete(phone) }

async function reloadSettings(sb, storeId, branchId) {
  try {
    // Intentar cargar desde store_settings (tabla del proyecto)
    const { data: rows } = await sb.from('store_settings')
      .select('key,value').eq('store_id', storeId)
      .in('key', ['chatbot_enabled','chatbot_rules','web_url','shop_url',
                   'business_name','min_order','delivery_fee','store_hours_text',
                   'review_url','affiliate_url','instagram_handle','currency'])

    const map = Object.fromEntries((rows||[]).map(r => [r.key, r.value]))

    // Fallback: tabla settings (legacy)
    if (!Object.keys(map).length) {
      const { data: legacy } = await sb.from('settings').select('key,value')
        .in('key', ['chatbot_enabled','chatbot_rules','web_url','business_name',
                     'min_order','delivery_fee','store_hours_text'])
      Object.assign(map, Object.fromEntries((legacy||[]).map(r => [r.key, r.value])))
    }

    // Intentar cargar nombre de la tienda desde stores table
    let storeName = map.business_name || ''
    if (!storeName) {
      const { data: store } = await sb.from('stores').select('name,currency')
        .eq('id', storeId).maybeSingle()
      storeName = store?.name || 'La tienda'
      if (store?.currency) map.currency = store.currency
    }

    chatbotEnabled = map.chatbot_enabled !== 'false'
    try { chatbotRules = JSON.parse(map.chatbot_rules || '[]') } catch { chatbotRules = [] }

    storeSettings = {
      businessName: storeName,
      webUrl:       map.web_url || map.shop_url || appConfig.shopUrl || '',
      currency:     map.currency || 'EUR',
      minOrder:     Math.max(0, Number(map.min_order || 0)),
      deliveryFee:  Math.max(0, Number(map.delivery_fee || 0)),
      hoursText:    map.store_hours_text || 'Consulta nuestro horario en la web',
      reviewUrl:    map.review_url || '',
      affiliateUrl: map.affiliate_url || '',
      instagram:    map.instagram_handle || appConfig.instagramHandle || '',
    }
    lastReload = Date.now()
    console.log('[Bot] Settings cargados para:', storeId, '| Negocio:', storeName)
  } catch (e) {
    console.error('[Bot] reloadSettings error:', e.message)
  }
}

async function getClientOrders(sb, phone) {
  const digits = String(phone||'').replace('@c.us','').replace(/\D/g,'')
  const variants = [digits, `+${digits}`, digits.startsWith('34') ? digits.slice(2) : `34${digits}`]

  for (const col of ['customer_phone','phone']) {
    for (const v of variants) {
      try {
        const { data } = await sb.from('orders').select(
          'id,order_number,status,created_at,total,delivery_address,address,customer_name'
        ).eq(col, v).eq('store_id', appConfig.storeId).order('created_at',{ascending:false}).limit(5)
        if (data?.length) return data
      } catch {}
    }
  }
  return []
}

async function escalate(sb, phone, reason, msg) {
  try {
    await sb.from('chatbot_conversations').upsert({
      phone, escalation_reason: reason, last_message: msg,
      resolved: false, admin_takeover: false,
      store_id: appConfig.storeId, branch_id: appConfig.branchId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
  } catch {}
  if (!waClient || !adminPhone) return
  const adminWA = adminPhone.includes('@c.us') ? adminPhone : `${adminPhone.replace(/\D/g,'')}@c.us`
  const shortPhone = phone.replace('@c.us','')
  try {
    await waClient.sendMessage(adminWA,
      `*[${storeSettings.businessName}]*\n\n*Motivo:* ${reason}\n*Cliente:* ${shortPhone}\n*Mensaje:* "${msg}"\n\nResponde a este número para tomar el chat.`)
  } catch {}
}

async function getMenu(sb) {
  const storeId = appConfig.storeId
  const [{ data: prods }, { data: cats }] = await Promise.all([
    sb.from('products').select('name,price,category_id').eq('store_id', storeId)
      .eq('is_active', true).order('sort_order').limit(20),
    sb.from('categories').select('id,name').eq('store_id', storeId).eq('is_active', true),
  ])
  if (!prods?.length) return null
  const catMap = Object.fromEntries((cats||[]).map(c => [c.id, c.name]))
  const byCat = {}
  for (const p of prods) {
    const cat = catMap[p.category_id] || 'Productos'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(`- ${p.name} (${money(p.price, storeSettings.currency)})`)
  }
  return Object.entries(byCat).map(([cat, items]) => `*${cat}*\n${items.join('\n')}`).join('\n\n')
}

const INTENT = {
  hi:     ['hola','buenos dias','buenas','hey','hi'],
  bye:    ['adios','hasta luego','bye','chao'],
  status: ['mi pedido','estado','donde esta','cuando llega','pedido numero','pedido #'],
  cancel: ['cancelar','anular','cancela','no lo quiero'],
  human:  ['hablar','persona','humano','agente'],
  menu:   ['menu','carta','que teneis','que hay','productos'],
  order:  ['quiero pedir','como pido','quiero comprar'],
  price:  ['precio','cuanto cuesta','cuanto vale'],
  hours:  ['horario','cuando abren','cerrais','abierto'],
  zone:   ['reparto','envio','delivery','zona'],
  payment:['pago','pagar','bizum','tarjeta','efectivo'],
  thanks: ['gracias','genial','perfecto','buenisimo'],
  help:   ['ayuda','opciones','que puedes'],
}

async function handleMessage(body, phone, sb, storeId, branchId, nextAdminPhone, shopUrl) {
  if (!body?.trim()) return null
  if (nextAdminPhone) adminPhone = nextAdminPhone
  if (Date.now() - lastReload > 300000) await reloadSettings(sb, storeId, branchId)
  if (!chatbotEnabled) return null

  const msg  = norm(body)
  const web  = shopUrl || storeSettings.webUrl || ''
  const biz  = storeSettings.businessName || 'La tienda'
  const curr = storeSettings.currency || 'EUR'
  const state = getState(phone)

  // ── Flujo de cancelación ──────────────────────────────────────────
  if (state?.type === 'cancel_confirm') {
    if (!CONFIRM_WORDS.some(w => msg.includes(norm(w)))) {
      clearState(phone)
      return 'Cancelación anulada. Escribe *mi pedido* para ver el estado.'
    }
    try {
      const { data: order } = await sb.from('orders').select('id,order_number,status')
        .eq('id', state.orderId).maybeSingle()
      clearState(phone)
      if (!order) return 'No pude localizar ese pedido. Escribe *hablar*.'
      if (NO_CANCEL.includes(order.status))
        return `El pedido ya está en estado *${STATE_LABELS[order.status]}* y no puede cancelarse.`
      await sb.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      return `✅ Pedido *#${order.order_number}* cancelado.\n\nSi quieres pedir de nuevo:\n${web}`
    } catch {
      return 'Error al cancelar. Escribe *hablar* para hacerlo manualmente.'
    }
  }

  // ── Flujo humano ──────────────────────────────────────────────────
  if (state?.type === 'human') {
    clearState(phone)
    await escalate(sb, phone, 'Solicitud de atención humana', body)
    return 'Listo. Ya avisé al equipo y te responderán en breve.'
  }

  // ── Intents ────────────────────────────────────────────────────────
  if (matches(msg, INTENT.cancel)) {
    const orders = await getClientOrders(sb, phone)
    const active = orders.filter(o => !['cancelled','delivered'].includes(o.status))
    if (!active.length) return `No veo pedidos activos que cancelar.\n\nMenú: ${web}`
    const canCancel = active.filter(o => !NO_CANCEL.includes(o.status))
    if (!canCancel.length) return `Tu pedido está en *${STATE_LABELS[active[0].status]}* y ya no puede cancelarse. Escribe *hablar* si necesitas ayuda.`
    const o = canCancel[0]
    setState(phone, { type:'cancel_confirm', orderId: o.id, orderNumber: o.order_number })
    return `¿Cancelar el pedido *#${o.order_number}*?\n\nEscribe *SI CANCELAR* para confirmar.`
  }

  if (matches(msg, INTENT.status)) {
    const orders = await getClientOrders(sb, phone)
    if (!orders.length) return `No encontré pedidos para tu número.\n\nPide en: ${web}`
    const o = orders[0]
    const ref = o.order_number || String(o.id).slice(-6).toUpperCase()
    const lines = [
      `📦 *Pedido #${ref}*`,
      `Estado: *${STATE_LABELS[o.status] || o.status}*`,
      `Fecha: ${fmt(o.created_at)}`,
      o.total != null ? `Total: *${money(o.total, curr)}*` : null,
      o.delivery_address || o.address ? `Dirección: ${o.delivery_address || o.address}` : null,
    ].filter(Boolean)
    return lines.join('\n')
  }

  if (matches(msg, INTENT.menu)) {
    const menuText = await getMenu(sb)
    return menuText
      ? `*Menú ${biz}*\n\n${menuText}\n\nPedido: ${web}`
      : `Ve el menú completo en:\n${web}`
  }

  if (matches(msg, INTENT.order)) {
    return `Pedir es fácil:\n1. Abre ${web}\n2. Elige y confirma\n3. Te avisamos por WhatsApp`
  }

  if (matches(msg, INTENT.price)) {
    const min = storeSettings.minOrder > 0 ? `\nMínimo: *${money(storeSettings.minOrder, curr)}*` : ''
    return `Los precios están en el menú:\n${web}${min}`
  }

  if (matches(msg, INTENT.hours)) {
    return `*Horario:* ${storeSettings.hoursText}`
  }

  if (matches(msg, INTENT.zone)) {
    return `Para saber la zona de reparto, contacta directamente con nosotros.\nPuedes escribir *hablar* y te atendemos.`
  }

  if (matches(msg, INTENT.payment)) {
    return `Aceptamos pago al repartidor.\n\nMás info en: ${web}`
  }

  if (matches(msg, INTENT.human)) {
    setState(phone, { type: 'human' })
    return 'Te paso con el equipo. Cuéntame en un mensaje qué necesitas (incluye el número de pedido si lo tienes).'
  }

  if (matches(msg, INTENT.thanks)) {
    return `¡De nada! Si quieres pedir de nuevo:\n${web}`
  }

  if (matches(msg, INTENT.bye)) {
    return `Hasta pronto. Pide cuando quieras:\n${web}`
  }

  if (matches(msg, INTENT.hi) || matches(msg, INTENT.help)) {
    return `Hola 👋 Soy el asistente de *${biz}*.\n\nPuedo ayudarte con:\n- *mi pedido* → estado\n- *cancelar* → anular pedido\n- *menu* → productos\n- *hablar* → persona real\n\nPedido directo: ${web}`
  }

  // Reglas personalizadas de Supabase
  if (chatbotRules.length) {
    for (const rule of chatbotRules) {
      if (!rule?.active) continue
      for (const t of String(rule.trigger||'').split(',')) {
        if (msg.includes(norm(t.trim()))) return String(rule.response||'').replace(/\{\{web\}\}/g, web)
      }
    }
  }

  return `No te he entendido del todo. Escribe:\n- *menu*\n- *mi pedido*\n- *hablar*\n\nO pide aquí: ${web}`
}

module.exports = { handleMessage, reloadSettings, setWAClient }
"""

def _order_notifier_js():
    return r"""'use strict'
/**
 * Order Notifier — Monitorea pedidos nuevos en Supabase y notifica por WhatsApp.
 */
function createOrderNotifier({ sb, send, isReady, storeId, branchId, logger = console }) {
  let timer  = null
  let lastId = null
  let running = false

  const cfg = require('./config').appConfig

  async function sync() {
    if (!isReady()) return
    try {
      let q = sb.from('orders')
        .select('id,order_number,status,customer_name,customer_phone,total,created_at,delivery_address')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

      if (branchId) q = q.eq('branch_id', branchId)

      const { data: orders } = await q
      if (!orders?.length) return

      const newest = orders[0]
      if (lastId === newest.id) return
      lastId = newest.id

      const adminPhone = cfg.adminPhone
      if (!adminPhone) return

      const ref   = newest.order_number || String(newest.id).slice(-6).toUpperCase()
      const total = `${Number(newest.total||0).toFixed(2)} EUR`
      const msg   = `🔔 *Nuevo pedido #${ref}*\nCliente: ${newest.customer_name||'—'}\nTotal: ${total}\n\nRevisa el panel de gestión.`

      await send(adminPhone, msg)
    } catch (e) {
      logger.error('[Notifier] error:', e.message)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      timer = setInterval(sync, cfg.orderSyncIntervalMs || 10000)
      logger.log('[Notifier] iniciado')
    },
    stop() {
      clearInterval(timer)
      running = false
    },
    async syncNow() { await sync() },
    getState() { return { running, lastId, storeId, branchId } },
  }
}

module.exports = { createOrderNotifier }
"""

# ── Punto de entrada Vercel ──────────────────────────────────────────
# Vercel detecta la variable `app` como WSGI handler automáticamente.
