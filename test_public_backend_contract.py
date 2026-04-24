from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent
API_INDEX = ROOT / "api" / "index.py"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


class PublicBackendContractTest(unittest.TestCase):
    def test_backend_accepts_query_token_for_download_links(self) -> None:
        text = read_text(API_INDEX)
        self.assertIn('request.args.get("token", "").strip()', text)

    def test_staff_login_route_exists_with_staff_identity_flow(self) -> None:
        text = read_text(API_INDEX)
        self.assertIn('@app.route("/api/backend/public/staff/login", methods=["POST"])', text)
        self.assertIn("def staff_pin_login()", text)
        self.assertIn("_ensure_staff_identity", text)
        self.assertIn("_build_supabase_access_token", text)
        self.assertIn("session_membership", text)

    def test_public_order_route_exists_with_branch_scope(self) -> None:
        text = read_text(API_INDEX)
        self.assertIn('@app.route("/api/backend/public/orders", methods=["POST"])', text)
        self.assertIn("def create_public_order()", text)
        self.assertIn('"branch_id requerido"', text)
        self.assertIn('"tenant_id": branch.get("tenant_id") or store.get("tenant_id")', text)
        self.assertIn("_serialize_public_order_item", text)

    def test_landing_request_treats_duplicate_owner_email_as_reusable_account(self) -> None:
        text = read_text(API_INDEX)
        self.assertIn("def _is_duplicate_auth_email_error(error: Exception) -> bool:", text)
        self.assertIn("already been registered", text)
        self.assertIn("owner_account_exists = True", text)
        self.assertIn("if not _is_duplicate_auth_email_error(auth_error):", text)

    def test_staff_creation_validates_store_and_branch_scope(self) -> None:
        text = read_text(API_INDEX)
        self.assertIn('"store_id requerido"', text)
        self.assertIn('"branch_id requerido"', text)
        self.assertIn('"store_id fuera del tenant activo"', text)
        self.assertIn('"branch_id no pertenece a la tienda indicada"', text)

    def test_tenant_finance_entries_use_notes_contract(self) -> None:
        text = read_text(ROOT / "backend" / "app" / "modules" / "tenant" / "routes.py")
        self.assertIn('@tenant_bp.post("/finance/cash-entries")', text)
        self.assertIn('"notes": body.get("notes", "")', text)
        self.assertNotIn('"note": body.get("note", "")', text)


if __name__ == "__main__":
    unittest.main()
