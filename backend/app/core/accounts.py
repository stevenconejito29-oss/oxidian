from __future__ import annotations

from typing import Any

import httpx
from flask import current_app


OWNER_ROLES = {"tenant_owner", "tenant_admin"}
STAFF_ROLES = {
    "tenant_admin",
    "store_admin",
    "store_operator",
    "branch_manager",
    "cashier",
    "kitchen",
    "rider",
}


def _admin_auth_config() -> tuple[str, str]:
    supabase_url = (current_app.config.get("SUPABASE_URL") or "").strip().rstrip("/")
    service_role_key = (current_app.config.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not supabase_url or not service_role_key:
        raise RuntimeError("Supabase Admin API no configurada")
    return supabase_url, service_role_key


def _admin_auth_request(
    method: str,
    path: str,
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    supabase_url, service_role_key = _admin_auth_config()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    url = f"{supabase_url}/auth/v1{path}"
    try:
        response = httpx.request(
            method,
            url,
            headers=headers,
            json=json,
            params=params,
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise RuntimeError(f"No se pudo contactar Supabase Auth: {exc}") from exc

    if response.status_code >= 400:
        raise RuntimeError(response.text or f"Supabase Auth devolvio HTTP {response.status_code}")

    if not response.content:
        return {}
    return response.json()


def normalize_auth_user(user: dict[str, Any] | None) -> dict[str, Any]:
    user = user or {}
    metadata = user.get("user_metadata") or user.get("raw_user_meta_data") or {}
    full_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or user.get("email")
        or ""
    )
    return {
        "user_id": user.get("id"),
        "email": (user.get("email") or "").lower(),
        "full_name": full_name,
        "last_sign_in_at": user.get("last_sign_in_at"),
        "created_at": user.get("created_at"),
    }


def get_auth_user(user_id: str) -> dict[str, Any]:
    return _admin_auth_request("GET", f"/admin/users/{user_id}")


def update_auth_user(user_id: str, *, password: str | None = None, full_name: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if password:
        payload["password"] = password
    if full_name:
        payload["user_metadata"] = {"full_name": full_name.strip()}
    if not payload:
        return get_auth_user(user_id)
    return _admin_auth_request("PUT", f"/admin/users/{user_id}", json=payload)


def invite_auth_user_by_email(
    email: str,
    *,
    redirect_to: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clean_email = (email or "").strip().lower()
    if not clean_email:
        raise RuntimeError("Email requerido")

    payload: dict[str, Any] = {"email": clean_email}
    if redirect_to:
        payload["redirect_to"] = redirect_to
    if data:
        payload["data"] = data

    return _admin_auth_request("POST", "/invite", json=payload)


def find_auth_user_by_email(email: str) -> dict[str, Any] | None:
    target = (email or "").strip().lower()
    if not target:
        return None

    page = 1
    while page <= 20:
        payload = _admin_auth_request("GET", "/admin/users", params={"page": page, "per_page": 100})
        users = payload.get("users") or payload.get("data") or []
        for user in users:
            if (user.get("email") or "").strip().lower() == target:
                return user

        next_page = payload.get("next_page")
        if next_page in (None, "", page):
            if len(users) < 100:
                break
            page += 1
            continue

        try:
            page = int(next_page)
        except Exception:
            break

    return None


def create_or_update_auth_user(email: str, password: str, *, full_name: str | None = None) -> dict[str, Any]:
    clean_email = (email or "").strip().lower()
    if not clean_email:
        raise RuntimeError("Email requerido")
    if not password:
        raise RuntimeError("Password requerida")

    payload: dict[str, Any] = {
        "email": clean_email,
        "password": password,
        "email_confirm": True,
    }
    if full_name:
        payload["user_metadata"] = {"full_name": full_name.strip()}

    try:
        created = _admin_auth_request("POST", "/admin/users", json=payload)
        return {"created": True, "user": created}
    except RuntimeError as exc:
        message = str(exc).lower()
        if "already" not in message and "registered" not in message and "exists" not in message:
            raise

    existing = find_auth_user_by_email(clean_email)
    if not existing:
        raise RuntimeError("La cuenta ya existe, pero no se pudo recuperar el usuario.")

    updated = update_auth_user(existing["id"], password=password, full_name=full_name)
    return {"created": False, "user": updated}


def _query_eq_or_null(builder, field: str, value: Any):
    return builder.eq(field, value) if value is not None else builder.is_(field, "null")


def upsert_membership(
    sb,
    *,
    user_id: str,
    role: str,
    tenant_id: str | None,
    store_id: str | None,
    branch_id: str | None,
    is_active: bool = True,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    query = sb.table("user_memberships").select("*").eq("user_id", user_id).eq("role", role)
    query = _query_eq_or_null(query, "tenant_id", tenant_id)
    query = _query_eq_or_null(query, "store_id", store_id)
    query = _query_eq_or_null(query, "branch_id", branch_id)
    existing = query.maybe_single().execute().data

    payload = {
        "user_id": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "store_id": store_id,
        "branch_id": branch_id,
        "is_active": is_active,
        "metadata": metadata or {},
    }

    if existing:
        result = sb.table("user_memberships").update({
            "is_active": is_active,
            "metadata": payload["metadata"],
        }).eq("id", existing["id"]).execute()
        return result.data[0] if result.data else existing

    result = sb.table("user_memberships").insert(payload).execute()
    return result.data[0] if result.data else payload


def hydrate_membership_rows(sb, memberships: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tenant_ids = sorted({row.get("tenant_id") for row in memberships if row.get("tenant_id")})
    store_ids = sorted({row.get("store_id") for row in memberships if row.get("store_id")})
    branch_ids = sorted({row.get("branch_id") for row in memberships if row.get("branch_id")})

    tenants = {}
    stores = {}
    branches = {}

    if tenant_ids:
        tenant_rows = sb.table("tenants").select("id,name").in_("id", tenant_ids).execute().data or []
        tenants = {row["id"]: row["name"] for row in tenant_rows}
    if store_ids:
        store_rows = sb.table("stores").select("id,name").in_("id", store_ids).execute().data or []
        stores = {row["id"]: row["name"] for row in store_rows}
    if branch_ids:
        branch_rows = sb.table("branches").select("id,name").in_("id", branch_ids).execute().data or []
        branches = {row["id"]: row["name"] for row in branch_rows}

    hydrated = []
    for row in memberships:
        auth_user = normalize_auth_user(get_auth_user(row["user_id"]))
        metadata = row.get("metadata") or {}
        hydrated.append({
            "membership_id": row.get("id"),
            "user_id": row.get("user_id"),
            "role": row.get("role"),
            "tenant_id": row.get("tenant_id"),
            "store_id": row.get("store_id"),
            "branch_id": row.get("branch_id"),
            "tenant_name": tenants.get(row.get("tenant_id")),
            "store_name": stores.get(row.get("store_id")),
            "branch_name": branches.get(row.get("branch_id")),
            "is_active": bool(row.get("is_active")),
            "email": auth_user["email"],
            "full_name": auth_user["full_name"] or metadata.get("full_name") or auth_user["email"],
            "last_sign_in_at": auth_user["last_sign_in_at"],
            "created_at": row.get("created_at"),
            "metadata": metadata,
        })

    return hydrated
