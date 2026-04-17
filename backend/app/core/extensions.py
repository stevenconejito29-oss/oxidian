"""
Extensiones Flask: CORS, Supabase client, Rate Limiter.
"""
from flask import jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from supabase import Client, create_client

cors = CORS()
limiter = Limiter(key_func=get_remote_address, default_limits=[])
supabase_admin: Client | None = None


def init_extensions(app):
    global supabase_admin

    # ── CORS ───────────────────────────────────────────────────────
    cors.init_app(
        app,
        resources={r"/*": {"origins": [
            app.config["FRONTEND_ORIGIN"],
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]}},
        supports_credentials=True,
    )

    # ── Rate Limiter ───────────────────────────────────────────────
    limiter.init_app(app)

    # ── Supabase Admin Client ──────────────────────────────────────
    if app.config.get("SUPABASE_URL") and app.config.get("SUPABASE_SERVICE_ROLE_KEY"):
        supabase_admin = create_client(
            app.config["SUPABASE_URL"],
            app.config["SUPABASE_SERVICE_ROLE_KEY"],
        )
