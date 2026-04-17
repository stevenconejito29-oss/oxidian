from __future__ import annotations

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


def build_auth_context() -> AuthContext:
    token = _get_bearer_token()
    claims: dict[str, Any] = {}

    if token:
        try:
            claims = _decode_token(token) or {}
        except Exception:
            claims = {}

    allow_local = current_app.config.get("ALLOW_INSECURE_LOCAL_AUTH", False)

    return AuthContext(
        user_id=str(claims.get("sub") or request.headers.get("X-User-Id") or "").strip() or None,
        app_role=str(
            claims.get("app_role")
            or claims.get("user_role")
            or request.headers.get("X-App-Role")
            or ("super_admin" if allow_local and request.headers.get("X-Debug-Super-Admin") == "1" else "anonymous")
        ).strip(),
        tenant_id=str(claims.get("tenant_id") or request.headers.get("X-Tenant-Id") or "").strip() or None,
        store_id=str(claims.get("store_id") or request.headers.get("X-Store-Id") or "").strip() or None,
        branch_id=str(claims.get("branch_id") or request.headers.get("X-Branch-Id") or "").strip() or None,
        claims=claims,
    )
