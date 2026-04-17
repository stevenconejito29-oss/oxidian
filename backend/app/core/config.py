import os
from pathlib import Path

from dotenv import load_dotenv


def load_config():
    env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(env_path)

    return {
        "SECRET_KEY": os.getenv("SECRET_KEY", "change-me"),
        "FLASK_ENV": os.getenv("FLASK_ENV", "development"),
        "FLASK_DEBUG": os.getenv("FLASK_DEBUG", "1") == "1",
        "FLASK_HOST": os.getenv("FLASK_HOST", "127.0.0.1"),
        "FLASK_PORT": int(os.getenv("FLASK_PORT", "5000")),
        "ALLOW_INSECURE_LOCAL_AUTH": os.getenv("ALLOW_INSECURE_LOCAL_AUTH", "true").lower() == "true",
        "SUPABASE_URL": os.getenv("SUPABASE_URL", "").strip(),
        "SUPABASE_ANON_KEY": os.getenv("SUPABASE_ANON_KEY", "").strip(),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        "SUPABASE_JWT_SECRET": os.getenv("SUPABASE_JWT_SECRET", "").strip(),
        "FRONTEND_ORIGIN": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").strip(),
    }

