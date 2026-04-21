import unittest

from api._lib.owner_account_helpers import extract_auth_admin_users, query_eq_or_null


class FakeQuery:
    def __init__(self):
        self.calls = []

    def eq(self, field, value):
        self.calls.append(("eq", field, value))
        return self

    def is_(self, field, value):
        self.calls.append(("is_", field, value))
        return self


class OwnerAccountHelperTests(unittest.TestCase):
    def test_extract_auth_admin_users_supports_admin_api_payload_shape(self):
        payload = {
            "users": [
                {"id": "u1", "email": "owner@example.com"},
                {"id": "u2", "email": "other@example.com"},
            ]
        }

        users = extract_auth_admin_users(payload)

        self.assertEqual([u["email"] for u in users], ["owner@example.com", "other@example.com"])

    def test_extract_auth_admin_users_supports_sdk_response_object_shape(self):
        class Response:
            users = [{"id": "u1", "email": "owner@example.com"}]

        users = extract_auth_admin_users(Response())

        self.assertEqual(users[0]["id"], "u1")

    def test_query_eq_or_null_uses_eq_for_non_null_values(self):
        query = FakeQuery()

        query_eq_or_null(query, "tenant_id", "tenant-123")

        self.assertEqual(query.calls, [("eq", "tenant_id", "tenant-123")])

    def test_query_eq_or_null_uses_is_null_for_none(self):
        query = FakeQuery()

        query_eq_or_null(query, "branch_id", None)

        self.assertEqual(query.calls, [("is_", "branch_id", "null")])


if __name__ == "__main__":
    unittest.main()
