def extract_auth_admin_users(list_users_response):
    if not list_users_response:
        return []
    if isinstance(list_users_response, dict):
        users = list_users_response.get("users") or list_users_response.get("data") or []
        return users if isinstance(users, list) else []
    users = getattr(list_users_response, "users", None)
    if isinstance(users, list):
        return users
    data = getattr(list_users_response, "data", None)
    if isinstance(data, list):
        return data
    return []


def query_eq_or_null(query, field, value):
    return query.eq(field, value) if value is not None else query.is_(field, "null")
