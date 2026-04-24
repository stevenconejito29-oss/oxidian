from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent
RESET = ROOT / "supabase" / "migrations" / "RESET_COMPLETE.sql"
PLAN_MIGRATION = ROOT / "supabase" / "migrations" / "0008_plans_and_feature_overrides.sql"
SCHEMA_INDEX = ROOT / "database_schema.sql"
LANDING_GRANTS_MIGRATION = ROOT / "supabase" / "migrations" / "0011_fix_landing_requests_service_role_grants.sql"
SECURITY_FIX_MIGRATION = ROOT / "supabase" / "migrations" / "0007_fix_security_and_missing_tables.sql"
PUBLIC_RLS_MIGRATION = ROOT / "supabase" / "migrations" / "0014_orders_and_staff_rls.sql"
OPERATIONS_MIGRATION = ROOT / "supabase" / "migrations" / "0016_branch_operations_support.sql"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


class SchemaContractTest(unittest.TestCase):
    def test_catalog_and_order_contract(self) -> None:
        text = read_text(RESET)
        self.assertIn("create table public.categories", text)
        self.assertIn("category_id uuid references public.categories(id)", text)
        self.assertIn("add column if not exists compare_price numeric(10,2)", text)
        self.assertIn("add column if not exists variants jsonb not null default '[]'", text)
        self.assertIn("alter column order_number type integer", text)

    def test_subscription_plan_contract(self) -> None:
        text = read_text(RESET)
        self.assertIn("plan_id                text not null default 'starter'", text)
        self.assertIn("feature_overrides      jsonb not null default '{}'::jsonb", text)
        self.assertIn("check (status in ('active', 'suspended', 'trialing'))", text)

    def test_rls_contract(self) -> None:
        text = read_text(RESET)
        self.assertIn("create or replace function public.is_super_admin()", text)
        self.assertIn("security definer set search_path = public", text)
        self.assertIn("create policy categories_public_read on public.categories", text)
        self.assertIn("out_of_stock = false", text)
        self.assertIn("user_memberships_own_read", text)
        self.assertIn("user_memberships_super_admin_all", text)

    def test_plan_migration_contract(self) -> None:
        text = read_text(PLAN_MIGRATION).lower()
        self.assertIn("drop constraint if exists tenant_subscriptions_status_check", text)
        self.assertIn("add constraint tenant_subscriptions_status_check", text)
        self.assertIn("create or replace function public.change_tenant_plan(", text)
        self.assertIn("on conflict (tenant_id) do update set", text)

    def test_schema_index_mentions_new_contract(self) -> None:
        text = read_text(SCHEMA_INDEX)
        self.assertIn("public.categories", text)
        self.assertIn("order_number ya es entero", text)
        self.assertIn("plan_id starter", text)

    def test_landing_requests_backend_grants_contract(self) -> None:
        text = read_text(LANDING_GRANTS_MIGRATION).lower()
        self.assertIn("grant usage on schema public to service_role;", text)
        self.assertIn("grant select, insert, update, delete", text)
        self.assertIn("on table public.landing_requests", text)
        self.assertIn("to service_role;", text)
        self.assertIn("create policy landing_requests_public_insert", text)

    def test_scope_function_keeps_branch_manager_out_of_store_scope_shortcut(self) -> None:
        text = read_text(SECURITY_FIX_MIGRATION).lower()
        self.assertIn("public.current_request_app_role() in ('store_admin', 'store_operator')", text)

    def test_public_rls_policies_are_scoped_to_visible_active_stores(self) -> None:
        text = read_text(PUBLIC_RLS_MIGRATION).lower()
        self.assertIn("where s.id = coupons.store_id and s.status = 'active' and s.public_visible = true", text)
        self.assertIn("where s.id = categories.store_id and s.status = 'active' and s.public_visible = true", text)
        self.assertIn("where s.id = reviews.store_id and s.status = 'active' and s.public_visible = true", text)
        self.assertNotIn("with check (true);", text)

    def test_schema_index_mentions_latest_tracking_migration(self) -> None:
        text = read_text(SCHEMA_INDEX)
        self.assertIn("0015_orders_tracking_columns.sql", text)

    def test_branch_operations_support_contract(self) -> None:
        text = read_text(OPERATIONS_MIGRATION).lower()
        self.assertIn("create table if not exists public.combos", text)
        self.assertIn("create table if not exists public.stock_item_products", text)
        self.assertIn("create table if not exists public.cash_entries", text)
        self.assertIn("create table if not exists public.daily_sales_summary", text)
        self.assertIn("add column if not exists max_uses integer", text)
        self.assertIn("add column if not exists valid_from timestamptz", text)
        self.assertIn("add column if not exists valid_until timestamptz", text)


if __name__ == "__main__":
    unittest.main()
