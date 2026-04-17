from flask import Flask

from .core.config import load_config
from .core.errors import register_error_handlers
from .core.extensions import init_extensions
from .middlewares.tenant_scope import register_tenant_scope_middleware
from .modules.admin.routes import admin_bp
from .modules.branch.routes import branch_bp
from .modules.public.routes import public_bp
from .modules.store.routes import store_bp
from .modules.tenant.routes import tenant_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(load_config())

    init_extensions(app)
    register_tenant_scope_middleware(app)
    register_error_handlers(app)

    app.register_blueprint(public_bp)   # sin auth
    app.register_blueprint(admin_bp)    # super_admin
    app.register_blueprint(tenant_bp)   # tenant_owner / tenant_admin
    app.register_blueprint(store_bp)    # store_admin / store_operator
    app.register_blueprint(branch_bp)   # branch roles

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "oxidian-backend",
            "version": "2.0.0",
            "routes": ["/admin", "/tenant", "/store", "/branch", "/public"],
        }

    return app
