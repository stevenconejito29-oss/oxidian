from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent
RESET = ROOT / "supabase" / "migrations" / "RESET_COMPLETE.sql"
PLAN_MIGRATION = ROOT / "supabase" / "migrations" / "0008_plans_and_feature_overrides.sql"
SCHEMA_INDEX = ROOT / "database_schema.sql"


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


if __name__ == "__main__":
    unittest.main()
