from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Any

import jwt
from flask import current_app, request


@dataclass
class AuthContext:
    user_id: str | None = None
    app_role: str = "anonymous"
    tenant_id: str | None = None
    store_id: str | None = None
    branch_id: str | None = None
    claims: dict[str, Any] | None = None

    def to_dict(self):
        return asdict(self)


ROLE_PRIORITY = [
    "super_admin",
    "tenant_owner",
    "tenant_admin",
    "store_admin",
    "store_operator",
    "branch_manager",
    "cashier",
    "kitchen",
    "rider",
]


def _get_bearer_token() -> str | None:
    auth_header = request.headers.get("Authorization", "").strip()
    if not auth_header.lower().startswith("bearer "):
        return None
    return auth_header[7:].strip() or None


def _decode_token(token: str) -> dict[str, Any]:
    jwt_secret = current_app.config.get("SUPABASE_JWT_SECRET", "")

    if jwt_secret:
        return jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    return jwt.decode(
        token,
        options={"verify_signature": False, "verify_aud": False},
        algorithms=["HS256", "RS256"],
    )


def _resolve_membership_context(user_id: str | None) -> dict[str, Any]:
    if not user_id:
        return {}

    try:
        from .extensions import supabase_admin

        if not supabase_admin:
            return {}

        res = (
            supabase_admin
            .table("user_memberships")
            .select("role,tenant_id,store_id,branch_id,is_active")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {}

        rows = sorted(
            rows,
            key=lambda row: ROLE_PRIORITY.index(row.get("role")) if row.get("role") in ROLE_PRIORITY else 999,
        )
        top = rows[0]
        return {
            "app_role": str(top.get("role") or "").strip() or "anonymous",
            "tenant_id": str(top.get("tenant_id") or "").strip() or None,
            "store_id": str(top.get("store_id") or "").strip() or None,
            "branch_id": str(top.get("branch_id") or "").strip() or None,
        }
    except Exception:
        return {}


def build_auth_context() -> AuthContext:
    token = _get_bearer_token()
    claims: dict[str, Any] = {}

    if token:
        try:
            claims = _decode_token(token) or {}
        except Exception:
            claims = {}

    allow_local = current_app.config.get("ALLOW_INSECURE_LOCAL_AUTH", False)

    debug_user_id = request.headers.get("X-User-Id") if allow_local else ""
    debug_role = request.headers.get("X-App-Role") if allow_local else ""
    debug_tenant_id = request.headers.get("X-Tenant-Id") if allow_local else ""
    debug_store_id = request.headers.get("X-Store-Id") if allow_local else ""
    debug_branch_id = request.headers.get("X-Branch-Id") if allow_local else ""

    user_id = str(claims.get("sub") or debug_user_id or "").strip() or None
    membership = _resolve_membership_context(user_id)

    # ── Fallback por SUPER_ADMIN_USER_IDS ────────────────────────────────────
    # Si el super admin aún no tiene fila en user_memberships, su rol se puede
    # definir en la variable de entorno SUPER_ADMIN_USER_IDS (separados por coma).
    super_admin_ids_raw = current_app.config.get("SUPER_ADMIN_USER_IDS", "") or ""
    super_admin_ids = {sid.strip() for sid in super_admin_ids_raw.split(",") if sid.strip()}
    is_configured_super_admin = bool(user_id and user_id in super_admin_ids)

    app_role = str(
        claims.get("app_role")
        or claims.get("user_role")
        or membership.get("app_role")
        or debug_role
        or ("super_admin" if is_configured_super_admin else "")
        or ("super_admin" if allow_local and request.headers.get("X-Debug-Super-Admin") == "1" else "anonymous")
    ).strip()

    # Si el user es un super admin configurado, asegurarse de que el rol sea correcto
    # aunque las claims digan otra cosa (excepto si viene un rol ya válido del DB)
    if is_configured_super_admin and app_role not in {"super_admin"}:
        app_role = "super_admin"

    return AuthContext(
        user_id=user_id,
        app_role=app_role,
        tenant_id=str(claims.get("tenant_id") or membership.get("tenant_id") or debug_tenant_id or "").strip() or None,
        store_id=str(claims.get("store_id") or membership.get("store_id") or debug_store_id or "").strip() or None,
        branch_id=str(claims.get("branch_id") or membership.get("branch_id") or debug_branch_id or "").strip() or None,
        claims=claims,
    )
