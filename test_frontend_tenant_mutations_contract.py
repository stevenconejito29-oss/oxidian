import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SUPABASE_API_PATH = ROOT / "frontend" / "src" / "shared" / "lib" / "supabaseApi.js"


class FrontendTenantMutationsContractTests(unittest.TestCase):
    def test_owner_panel_store_and_branch_mutations_use_backend_tenant_endpoints(self):
        source = SUPABASE_API_PATH.read_text(encoding="utf-8")

        self.assertRegex(
            source,
            re.compile(r"export async function createStore\(payload\)\s*\{[\s\S]*?_backendFetch\('POST', '/tenant/stores', payload\)", re.MULTILINE),
        )
        self.assertRegex(
            source,
            re.compile(r"export async function updateStore\(storeId, patch\)\s*\{[\s\S]*?_backendFetch\('PATCH', `/tenant/stores/\$\{storeId\}`, safe\)", re.MULTILINE),
        )
        self.assertRegex(
            source,
            re.compile(r"export async function createBranch\(payload\)\s*\{[\s\S]*?_backendFetch\('POST', '/tenant/branches', payload\)", re.MULTILINE),
        )


if __name__ == "__main__":
    unittest.main()
