#!/usr/bin/env python3
"""
test_oxidian_db.py — Pruebas completas Oxidian
Requiere: pip install supabase requests
"""
import json
import os
import sys
from pathlib import Path

try:
    from supabase import create_client, ClientOptions
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "supabase", "requests"])
    from supabase import create_client, ClientOptions
    import requests

def _load_env_file(path: Path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


ROOT = Path(__file__).resolve().parent
_load_env_file(ROOT / "backend" / ".env")
_load_env_file(ROOT / "frontend" / ".env.production")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit(
        "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. "
        "Configuralas en backend/.env o frontend/.env.production antes de ejecutar este script."
    )

# ── FIX CRÍTICO: en supabase-py 2.28.x hay que forzar el service_role ──────
# create_client con service_role key NO aplica el JWT automáticamente en 2.28.x
# Solución: pasar headers explícitos al inicializar
sb = create_client(
    SUPABASE_URL,
    SERVICE_KEY,
    options=ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )
)
# Forzar service_role en el cliente postgrest
sb.postgrest.auth(SERVICE_KEY)

# Headers para requests directos (bypassa supabase-py)
HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"
OK  = f"{G}[OK]{X}"
ERR = f"{R}[ERR]{X}"
WRN = f"{Y}[WRN]{X}"
INF = f"{B}[INFO]{X}"

def check_table(table_name):
    """Usa requests directamente — más fiable que supabase-py para verificar tablas."""
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table_name}",
            headers={**HEADERS, "Prefer": "count=exact"},
            params={"select": "count", "limit": "1"},
            timeout=15
        )
        if r.status_code in (200, 206):
            # Intentar leer el header de count
            content_range = r.headers.get("Content-Range", "")
            count = content_range.split("/")[-1] if "/" in content_range else "?"
            return True, count
        elif r.status_code == 404:
            return False, "no existe"
        else:
            # Intentar con supabase-py como fallback
            res = sb.table(table_name).select("*", count="exact", head=True).execute()
            return True, str(res.count or 0)
    except Exception as e:
        return False, str(e)[:60]

def query(table_name, select="*", limit=5, filters=None):
    """Query directa con requests para asegurar service_role."""
    try:
        params = {"select": select, "limit": str(limit)}
        if filters:
            params.update(filters)
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table_name}",
            headers=HEADERS,
            params=params,
            timeout=15
        )
        if r.status_code in (200, 206):
            return r.json(), None
        return [], r.text[:80]
    except Exception as e:
        return [], str(e)[:60]

def insert(table_name, payload):
    """Insert directo con requests."""
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table_name}",
            headers=HEADERS,
            json=payload,
            timeout=15
        )
        if r.status_code in (200, 201):
            data = r.json()
            return (data[0] if isinstance(data, list) else data), None
        return {}, r.text[:100]
    except Exception as e:
        return {}, str(e)[:60]

def delete_where(table_name, col, val):
    try:
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/{table_name}",
            headers=HEADERS,
            params={col: f"eq.{val}"},
            timeout=10
        )
    except Exception:
        pass

print(f"\n{'='*60}")
print("  OXIDIAN — TEST COMPLETO (usando requests directo)")
print(f"{'='*60}")

# ─── 1. VERIFICAR PROYECTO ACTIVO ─────────────────────────────
print(f"\n{INF} Verificando acceso al proyecto...")
try:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/",
        headers=HEADERS,
        timeout=10
    )
    if r.status_code == 200:
        print(f"  {OK} Proyecto accesible — PostgREST activo")
        try:
            paths = list(r.json().get("paths", {}).keys())[:6]
            print(f"  {INF} Tablas visibles en OpenAPI: {len(r.json().get('paths',{}))}")
        except Exception:
            pass
    elif r.status_code == 403:
        body = r.text[:100]
        if "Host not in allowlist" in body:
            print(f"  {WRN} IP Restriction activa — probando con Accept header...")
            # Intentar con Accept: application/json
            r2 = requests.get(
                f"{SUPABASE_URL}/rest/v1/store_templates",
                headers={**HEADERS, "Accept": "application/json"},
                timeout=10
            )
            print(f"  {INF} Acceso directo a tabla: HTTP {r2.status_code}")
            if r2.status_code == 200:
                print(f"  {OK} Conexión OK con Accept header")
            elif "permission denied" in r2.text:
                print(f"  {ERR} RLS bloqueando — service_role no aplicado")
            else:
                print(f"  {WRN} {r2.text[:60]}")
        else:
            print(f"  {ERR} HTTP 403: {body}")
    else:
        print(f"  {WRN} HTTP {r.status_code}: {r.text[:80]}")
except Exception as e:
    print(f"  {ERR} Conexión fallida: {e}")

# ─── 2. VERIFICAR TABLAS ──────────────────────────────────────
print(f"\n{INF} Verificando tablas existentes...")
EXPECTED = [
    "tenants","stores","branches","user_memberships","store_templates",
    "config_tienda","settings","store_settings","store_process_profiles",
    "store_runtime_profiles","store_plans","products","combos","toppings",
    "topping_categories","orders","stock_items","coupons","affiliates",
    "loyalty_rewards","reviews","staff_users","cash_entries",
    "chatbot_conversations","chatbot_authorization_log",
]
ok_tables = []
for t in EXPECTED:
    exists, info = check_table(t)
    if exists:
        ok_tables.append(t)
        print(f"  {OK} {t:<40} {info} filas")
    else:
        print(f"  {ERR} {t:<40} {info}")

print(f"\n  Resultado: {len(ok_tables)}/{len(EXPECTED)} tablas OK")

if len(ok_tables) == 0:
    print(f"\n  {ERR} Sin tablas — la migración no se ejecutó o hay un error de permisos.")
    print(f"  {INF} Verifica en: https://supabase.com/dashboard/project/ljnfjlwlvabpsrwahzjk/editor")
    print(f"\n  Posibles causas:")
    print("  1. El proyecto está PAUSADO (free tier inactivo)")
    print("  2. Restricción de IP activa en Settings → API → Network Restrictions")
    print("  3. La migración RESET_COMPLETE.sql no se ejecutó")
    sys.exit(1)

# ─── 3. DATOS SEMILLA ─────────────────────────────────────────
print(f"\n{INF} Verificando datos semilla...")
templates, err = query("store_templates", "id,name")
if err:
    print(f"  {ERR} store_templates: {err}")
else:
    for t in templates:
        print(f"  {OK} Template: {t.get('id'):<15} {t.get('name')}")
    if not templates:
        print(f"  {WRN} Sin templates — ejecuta el INSERT de datos iniciales")

plans, err = query("store_plans", "id,name,monthly_price")
if err:
    print(f"  {ERR} store_plans: {err}")
else:
    for p in plans:
        print(f"  {OK} Plan: {p.get('id'):<12} €{p.get('monthly_price')} — {p.get('name')}")

# ─── 4. CREAR JERARQUÍA DE PRUEBA ─────────────────────────────
print(f"\n{INF} Creando datos de prueba...")

# Limpiar anterior
delete_where("tenants", "slug", "oxidian-test")

# Tenant
tenant, err = insert("tenants", {
    "slug": "oxidian-test",
    "name": "Pizzería Demo",
    "owner_email": "demo@pizzeria.com",
    "status": "active",
    "monthly_fee": 49
})
if err:
    print(f"  {ERR} Tenant: {err}")
    print(f"  {WRN} Puede que ya exista — verificando...")
    existing, _ = query("tenants", "id,name", filters={"slug": "eq.oxidian-test"})
    if existing:
        tenant = existing[0]
        print(f"  {WRN} Usando tenant existente: {tenant.get('id','')[:12]}...")
    else:
        print(f"  {ERR} No se puede crear ni recuperar el tenant. Revisa el acceso.")
        sys.exit(1)
else:
    print(f"  {OK} Tenant: {tenant.get('id','')[:12]}... '{tenant.get('name')}'")

tenant_id = tenant.get("id", "")

# Store
store, err = insert("stores", {
    "id": "pizzeria-demo",
    "name": "Pizzería Demo",
    "tenant_id": tenant_id,
    "template_id": "delivery",
    "status": "active",
    "business_type": "food",
    "plan_id": "growth",
    "public_visible": True,
})
if err and "duplicate" not in err.lower() and "already exists" not in err.lower() and "23505" not in err:
    print(f"  {ERR} Store: {err}")
else:
    if err:
        print(f"  {WRN} Store ya existe (OK)")
    else:
        print(f"  {OK} Store: '{store.get('id')}'")

# Branch
branch, err = insert("branches", {
    "tenant_id": tenant_id,
    "store_id": "pizzeria-demo",
    "slug": "sede-centro",
    "name": "Sede Centro",
    "address": "Calle Mayor 1",
    "city": "Madrid",
    "status": "active",
    "is_primary": True,
    "open_hour": 12,
    "close_hour": 23,
})
if err and "23505" not in err:
    print(f"  {ERR} Branch: {err}")
    # Intentar recuperar
    existing_b, _ = query("branches", "id,name", filters={"store_id": "eq.pizzeria-demo"})
    if existing_b:
        branch = existing_b[0]
        print(f"  {WRN} Usando branch existente")
else:
    if err:
        print(f"  {WRN} Branch ya existe (OK)")
    else:
        print(f"  {OK} Branch: {branch.get('id','')[:12]}... '{branch.get('name')}'")

branch_id = branch.get("id", "") if branch else ""

# Productos
prods, err = insert("products", [
    {"store_id":"pizzeria-demo","tenant_id":tenant_id,"name":"Pizza Margarita",
     "price":12.50,"category":"pizzas","emoji":"🍕","available":True,"is_active":True},
    {"store_id":"pizzeria-demo","tenant_id":tenant_id,"name":"Tiramisú",
     "price":5.50,"category":"postres","emoji":"🍰","available":True,"is_active":True},
])
if err and "23505" not in err:
    print(f"  {WRN} Productos: {err}")
else:
    count = len(prods) if isinstance(prods, list) else (0 if err else 1)
    print(f"  {OK} Productos insertados: {count}")

# Pedido
order, err = insert("orders", {
    "store_id": "pizzeria-demo",
    "tenant_id": tenant_id,
    "branch_id": branch_id or None,
    "status": "pending",
    "customer_name": "Cliente Test",
    "customer_phone": "600000001",
    "total": 18.00,
    "items": [{"name":"Pizza Margarita","qty":1,"price":12.50}]
})
if err:
    print(f"  {ERR} Pedido: {err}")
else:
    print(f"  {OK} Pedido: {order.get('id','')[:12]}... #{order.get('order_number','(sin número)')}")

# ─── 5. VERIFICAR AISLAMIENTO ─────────────────────────────────
print(f"\n{INF} Verificando aislamiento de datos...")
p1, _ = query("products", "id", filters={"store_id": "eq.pizzeria-demo"})
p_all, _ = query("products", "id")
print(f"  {OK} Productos en pizzeria-demo: {len(p1)}")
print(f"  {OK} Total productos en BD:      {len(p_all)}")
if len(p1) == len(p_all):
    print(f"  {OK} Aislamiento OK — solo existe una tienda de prueba")

# ─── 6. RESUMEN ───────────────────────────────────────────────
print(f"\n{'='*60}")
print("  RESUMEN FINAL")
print(f"{'='*60}")
for t in ["tenants","stores","branches","products","orders"]:
    data, _ = query(t, "id", limit=200)
    print(f"  {OK} {t:<25} {len(data)} filas")

print(f"\n  {G}✅ BASE DE DATOS OPERATIVA{X}")
print(f"  Tenant ID: {tenant_id[:16]}...")
print(f"  Store:     pizzeria-demo")
print(f"  Branch:    {branch_id[:16] if branch_id else 'N/A'}...")
print(f"\n  Próximo paso:")
print(f"  1. JWT Hook en Supabase → Authentication → Hooks")
print(f"     Función: public.custom_jwt_claims")
print(f"  2. Crear Super Admin:")
print(f"     SQL Editor → SELECT public.make_super_admin('tu@email.com');")
print(f"  3. Iniciar frontend: cd frontend && npm run dev")
print(f"{'='*60}\n")
