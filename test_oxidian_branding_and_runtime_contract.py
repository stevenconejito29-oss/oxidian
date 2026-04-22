import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class OxidianBrandingAndRuntimeContractTests(unittest.TestCase):
    def test_resolve_store_middleware_is_not_forced_to_edge_runtime(self):
        source = (ROOT / "api" / "middleware" / "resolve-store.js").read_text(encoding="utf-8")
        self.assertNotIn("runtime: 'edge'", source)
        self.assertNotIn('runtime: "edge"', source)

    def test_active_user_facing_sources_do_not_use_legacy_branding(self):
        files = [
            ROOT / "api" / "manifest.js",
            ROOT / "README.md",
            ROOT / "DEPLOY.md",
            ROOT / "deploy.bat",
            ROOT / "deploy-vercel.bat",
            ROOT / "database_schema.sql",
            ROOT / "MEMORY_LOG.md",
            ROOT / "docs" / "architecture" / "reuse-map.md",
            ROOT / "frontend" / "index.html",
            ROOT / "frontend" / ".env",
            ROOT / "frontend" / ".env.production",
            ROOT / "frontend" / "public" / "service-worker.js",
            ROOT / "frontend" / "src" / "legacy" / "components" / "Cart.jsx",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "appSession.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "currentStore.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "cashReporting.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "clubAccess.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "useLoyalty.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "usePWAInstall.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "usePushSubscription.js",
            ROOT / "frontend" / "src" / "legacy" / "main.jsx",
            ROOT / "frontend" / "src" / "legacy" / "components" / "LoyaltyWidget.jsx",
            ROOT / "frontend" / "src" / "legacy" / "components" / "PostOrderScreen.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Admin.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "AffiliatePortal.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "AdminBusinessTab.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Menu.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Pedidos.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "PedidosContent.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Repartidor.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "RepartidorContent.jsx",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "storeExperience.js",
            ROOT / "scripts" / "supabase_single_setup.sql",
            ROOT / "supabase" / "migrations" / "RESET_COMPLETE.sql",
        ]
        legacy_brand = "Carmo" + "Cream"
        legacy_slug = "carmo" + "cream"
        for file_path in files:
            source = file_path.read_text(encoding="utf-8")
            self.assertNotIn(legacy_brand, source, msg=str(file_path))
            self.assertNotIn(legacy_slug, source, msg=str(file_path))

    def test_active_runtime_storage_keys_do_not_keep_old_legacy_names(self):
        files = [
            ROOT / "frontend" / "src" / "legacy" / "components" / "PostOrderScreen.jsx",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "appSession.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "currentStore.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "useLoyalty.js",
            ROOT / "frontend" / "src" / "legacy" / "lib" / "usePushSubscription.js",
            ROOT / "frontend" / "src" / "legacy" / "main.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "AffiliatePortal.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Admin.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Menu.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Pedidos.jsx",
            ROOT / "frontend" / "src" / "legacy" / "pages" / "Repartidor.jsx",
        ]
        forbidden_tokens = [
            "cc_" + "admin",
            "cc_" + "active_store_id",
            "cc_" + "domain_store_context",
            "cc_" + "stamps_",
            "cc_" + "vid_",
            "cc_" + "loyalty_local_",
            "cc_" + "push_endpoint",
            "cc_" + "affiliate_code_",
            "carmo" + "cream_staff_cocina",
            "carmo" + "cream_staff_repartidor",
            "carmo" + "cream_customer",
        ]
        for file_path in files:
            source = file_path.read_text(encoding="utf-8")
            for token in forbidden_tokens:
                self.assertNotIn(token, source, msg=f"{file_path}: {token}")


if __name__ == "__main__":
    unittest.main()
