from __future__ import annotations

from flask import abort, g, request

from ..core.auth import build_auth_context
from ..core.extensions import supabase_admin


def _is_public_path(path: str) -> bool:
    return path.startswith("/public") or path == "/health"


def register_tenant_scope_middleware(app):
    @app.before_request
    def resolve_scope():
        if request.method == "OPTIONS":
            return None

        auth_context = build_auth_context()
        g.auth_context = auth_context

        tenant_id = auth_context.tenant_id or request.args.get("tenant_id")
        store_id = auth_context.store_id or request.args.get("store_id")
        branch_id = auth_context.branch_id or request.args.get("branch_id")

        g.scope = {
            "tenant_id": tenant_id,
            "store_id": store_id,
            "branch_id": branch_id,
        }

        path = request.path

        if _is_public_path(path):
            return None

        if path.startswith("/admin"):
            if auth_context.app_role != "super_admin":
                abort(403, "Ruta reservada para super admin")
            return None

        if path.startswith("/tenant") and not tenant_id:
            # Super admin puede operar rutas /tenant sin tenant_id
            # (el route handler lo resuelve internamente)
            if auth_context.app_role == "super_admin":
                return None
            # Tenant recien invitado: intentar resolver tenant_id desde user_memberships
            if auth_context.user_id and supabase_admin:
                try:
                    row = (
                        supabase_admin
                        .table("user_memberships")
                        .select("tenant_id")
                        .eq("user_id", auth_context.user_id)
                        .eq("is_active", True)
                        .in_("role", ["tenant_owner", "tenant_admin"])
                        .order("created_at", desc=False)
                        .limit(1)
                        .maybe_single()
                        .execute()
                        .data
                    )
                    if row and row.get("tenant_id"):
                        g.scope["tenant_id"] = row["tenant_id"]
                        tenant_id = row["tenant_id"]
                        return None
                except Exception:
                    pass
            abort(400, "Falta tenant_id en la peticion")

        if path.startswith("/store"):
            if not tenant_id:
                abort(400, "Falta tenant_id en la peticion")
            if not store_id:
                abort(400, "Falta store_id en la peticion")

        if path.startswith("/branch"):
            if not tenant_id:
                abort(400, "Falta tenant_id en la peticion")
            if not store_id:
                abort(400, "Falta store_id en la peticion")
            if not branch_id:
                abort(400, "Falta branch_id en la peticion")

        return None

