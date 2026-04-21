import unittest
from types import SimpleNamespace
from unittest.mock import patch

from api.index import app


class _FakeExecuteResult:
    def __init__(self, data=None):
        self.data = data or []


class _FakeQuery:
    def __init__(self, supabase, table_name):
        self.supabase = supabase
        self.table_name = table_name
        self.operation = None
        self.payload = None
        self.filters = {}
        self.expect_single = False

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def maybe_single(self):
        self.expect_single = True
        return self

    def execute(self):
        return self.supabase.execute(self)


class _FakeRpcQuery:
    def execute(self):
        return _FakeExecuteResult([])


class _FakeAuthAdmin:
    def __init__(self, existing_users=None):
        self.existing_users = existing_users or []
        self.updated_users = []

    def list_users(self):
        return SimpleNamespace(users=self.existing_users)

    def update_user_by_id(self, user_id, payload):
        self.updated_users.append({"user_id": user_id, "payload": payload})
        return SimpleNamespace(user=SimpleNamespace(id=user_id))


class _FakeSupabase:
    def __init__(self, existing_users=None):
        self.auth = SimpleNamespace(admin=_FakeAuthAdmin(existing_users=existing_users))
        self.membership_deletes = []
        self.membership_inserts = []
        self.tenant_updates = []
        self.store_inserts = []
        self.branch_inserts = []

    def table(self, table_name):
        return _FakeQuery(self, table_name)

    def rpc(self, *_args, **_kwargs):
        return _FakeRpcQuery()

    def execute(self, query):
        if query.table_name == "tenants" and query.operation == "select":
            tenant = {"id": "tenant-1", "name": "Tenant Demo"}
            return _FakeExecuteResult(tenant if query.expect_single else [tenant])

        if query.table_name == "user_memberships" and query.operation == "delete":
            self.membership_deletes.append(dict(query.filters))
            return _FakeExecuteResult([])

        if query.table_name == "user_memberships" and query.operation == "insert":
            payload = {"id": f"membership-{len(self.membership_inserts) + 1}", **query.payload}
            self.membership_inserts.append(payload)
            return _FakeExecuteResult([payload])

        if query.table_name == "tenants" and query.operation == "update":
            self.tenant_updates.append({"filters": dict(query.filters), "payload": dict(query.payload)})
            return _FakeExecuteResult([query.payload])

        if query.table_name == "stores" and query.operation == "insert":
            payload = dict(query.payload)
            self.store_inserts.append(payload)
            return _FakeExecuteResult([payload])

        if query.table_name == "branches" and query.operation == "insert":
            payload = {"id": f"branch-{len(self.branch_inserts) + 1}", **query.payload}
            self.branch_inserts.append(payload)
            return _FakeExecuteResult([payload])

        raise AssertionError(f"Operacion inesperada: {query.table_name} {query.operation}")


class OwnerActivationFlowTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_invite_owner_activates_existing_owner_account(self):
        fake_sb = _FakeSupabase(existing_users=[
            {
                "id": "owner-auth-1",
                "email": "owner@example.com",
                "user_metadata": {
                    "full_name": "Owner Pending",
                    "pending_approval": True,
                },
            }
        ])

        with patch("api.index._sb", return_value=fake_sb), patch(
            "api.index._require_super_admin",
            return_value=("admin-1", {"role": "super_admin"}, None, None),
        ):
            response = self.client.post(
                "/api/backend/admin/tenants/tenant-1/invite-owner",
                json={
                    "email": "owner@example.com",
                    "full_name": "Owner Approved",
                    "role": "tenant_owner",
                    "redirect_to": "/login",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertTrue(body["success"])
        self.assertTrue(body["data"]["already_exists"])

        self.assertEqual(len(fake_sb.auth.admin.updated_users), 1)
        updated_user = fake_sb.auth.admin.updated_users[0]
        self.assertEqual(updated_user["user_id"], "owner-auth-1")
        self.assertFalse(updated_user["payload"]["user_metadata"]["pending_approval"])
        self.assertEqual(updated_user["payload"]["user_metadata"]["tenant_id"], "tenant-1")
        self.assertEqual(updated_user["payload"]["user_metadata"]["role"], "tenant_owner")

        self.assertEqual(len(fake_sb.membership_inserts), 1)
        membership = fake_sb.membership_inserts[0]
        self.assertEqual(membership["user_id"], "owner-auth-1")
        self.assertEqual(membership["tenant_id"], "tenant-1")
        self.assertTrue(membership["is_active"])
        self.assertEqual(membership["metadata"]["email"], "owner@example.com")

        self.assertEqual(len(fake_sb.tenant_updates), 1)
        tenant_update = fake_sb.tenant_updates[0]["payload"]
        self.assertEqual(tenant_update["owner_email"], "owner@example.com")
        self.assertEqual(tenant_update["owner_name"], "Owner Approved")

    def test_tenant_owner_can_create_store_with_initial_branch(self):
        fake_sb = _FakeSupabase()

        with patch("api.index._sb", return_value=fake_sb), patch(
            "api.index._require_tenant_manager",
            return_value=("owner-auth-1", {"role": "tenant_owner", "tenant_id": "tenant-1"}, None, None),
        ):
            response = self.client.post(
                "/api/backend/tenant/stores",
                json={
                    "name": "Store Demo",
                    "slug": "store-demo",
                    "city": "Madrid",
                    "niche": "restaurant",
                    "business_type": "delivery",
                    "template_id": "delivery",
                    "initial_branch_name": "Sede principal",
                    "initial_branch_slug": "principal",
                    "initial_branch_city": "Madrid",
                },
            )

        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body["store"]["id"], "store-demo")
        self.assertEqual(body["store"]["tenant_id"], "tenant-1")
        self.assertIsNotNone(body["branch"])
        self.assertEqual(body["branch"]["store_id"], "store-demo")
        self.assertEqual(body["branch"]["tenant_id"], "tenant-1")
        self.assertEqual(body["branch"]["slug"], "principal")


if __name__ == "__main__":
    unittest.main()
