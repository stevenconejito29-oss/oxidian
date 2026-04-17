from flask import jsonify


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"error": str(error)}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"error": str(error)}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Ruta no encontrada"}), 404

    @app.errorhandler(Exception)
    def internal_error(error):
        return jsonify({"error": str(error)}), 500

