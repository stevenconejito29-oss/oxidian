import unittest
from unittest.mock import patch

from backend.app import create_app


class _FakeExecuteResult:
    def __init__(self, data=None):
        self.data = data or []


class _FakeInsertQuery:
    def __init__(self, sink):
        self.sink = sink
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        self.sink["landing_requests"] = self.payload
        return _FakeExecuteResult([{"id": "lead-local-1", **self.payload}])


class _FakeSupabase:
    def __init__(self):
        self.inserts = {}

    def table(self, table_name):
        if table_name != "landing_requests":
            raise AssertionError(f"Tabla inesperada: {table_name}")
        return _FakeInsertQuery(self.inserts)


class BackendPublicLandingRequestRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_public_route_creates_lead_and_owner_account(self):
        fake_sb = _FakeSupabase()
        payload = {
            "full_name": "Owner Local",
            "email": "owner-local@example.com",
            "business_name": "Local Store",
            "password": "Secret123!",
        }

        with patch("backend.app.modules.public.routes._supa", return_value=fake_sb), \
             patch("backend.app.modules.public.routes.find_auth_user_by_email", return_value=None), \
             patch("backend.app.modules.public.routes.create_or_update_auth_user", return_value={
                 "created": True,
                 "user": {"id": "auth-local-1", "email": "owner-local@example.com", "user_metadata": {"full_name": "Owner Local"}},
             }):
            response = self.client.post("/public/landing-request", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["owner_account_created"])
        self.assertEqual(fake_sb.inserts["landing_requests"]["email"], "owner-local@example.com")


if __name__ == "__main__":
    unittest.main()
