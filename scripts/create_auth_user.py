#!/usr/bin/env python3
"""
Create a Supabase Auth user using the Admin API.

Usage:
  python scripts/create_auth_user.py pepemellamoyoo@oxidian.app Oxidian#2026!Acceso
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    raise SystemExit("Missing dependency: requests. Install with `pip install requests`.")


ROOT = Path(__file__).resolve().parents[1]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/create_auth_user.py <email> <password>")
        return 1

    email = sys.argv[1].strip()
    password = sys.argv[2]

    load_env_file(ROOT / "backend" / ".env")
    load_env_file(ROOT / "frontend" / ".env.production")

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in local env files.")
        return 1

    endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
    }

    response = requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=30)

    if response.ok:
        body = response.json()
        print("User created.")
        print(f"id: {body.get('id')}")
        print(f"email: {body.get('email')}")
        return 0

    print(f"Supabase Admin API error: HTTP {response.status_code}")
    print(response.text)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
