from flask import g


def build_rls_headers():
    scope = getattr(g, "scope", {})
    auth_context = getattr(g, "auth_context", None)

    return {
        "x-app-role": getattr(auth_context, "app_role", "anonymous"),
        "x-tenant-id": scope.get("tenant_id", ""),
        "x-store-id": scope.get("store_id", ""),
        "x-branch-id": scope.get("branch_id", ""),
    }

