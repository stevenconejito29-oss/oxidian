from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent
API_INDEX = ROOT / "api" / "index.py"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


class PublicBackendContractTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
