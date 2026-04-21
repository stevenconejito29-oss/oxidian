import unittest
from types import SimpleNamespace
from unittest.mock import patch

from api.index import app


class _FakeExecuteResult:
    def __init__(self, data=None):
        self.data = data or []


class _FakeInsertQuery:
    def __init__(self, table_name, sink):
        self.table_name = table_name
        self.sink = sink
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        self.sink[self.table_name] = self.payload
        created = {"id": "landing-1", **self.payload}
        return _FakeExecuteResult([created])


class _FakeAuthAdmin:
    def __init__(self):
        self.created_users = []

    def create_user(self, payload):
        self.created_users.append(payload)
        return SimpleNamespace(user=SimpleNamespace(id="auth-user-1", email=payload["email"]))

    def list_users(self):
        return SimpleNamespace(users=[])


class _FakeSupabase:
    def __init__(self):
        self.inserts = {}
        self.auth = SimpleNamespace(admin=_FakeAuthAdmin())

    def table(self, table_name):
        return _FakeInsertQuery(table_name, self.inserts)


class PublicLandingRequestTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_public_landing_request_creates_auth_account_when_password_is_present(self):
        fake_sb = _FakeSupabase()
        payload = {
            "full_name": "Dueno Demo",
            "email": "dueno@example.com",
            "phone": "+34123456789",
            "business_name": "Demo Store",
            "business_niche": "restaurant",
            "city": "Madrid",
            "message": "Quiero una demo",
            "password": "Secret123!",
        }

        with patch("api.index._sb", return_value=fake_sb):
            response = self.client.post("/api/backend/public/landing-request", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["data"]["owner_account_created"])
        self.assertEqual(fake_sb.inserts["landing_requests"]["email"], "dueno@example.com")
        self.assertEqual(fake_sb.auth.admin.created_users[0]["email"], "dueno@example.com")


if __name__ == "__main__":
    unittest.main()
