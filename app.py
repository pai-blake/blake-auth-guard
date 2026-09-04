"""
app.py
AuthGuard — Unified Flask Application Factory & Configuration

Initializes the Flask application, configures template loaders, session security,
and registers blueprints from the routes layer (general, auth, body).
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
import jinja2

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=ROOT_DIR / '.env')

# Detect if running on Render (or any production environment)
IS_PRODUCTION = bool(os.getenv('RENDER') or os.getenv('FLASK_ENV') == 'production')


def create_app():
    """Application factory for AuthGuard Flask application."""
    app = Flask(
        __name__,
        static_folder='static',
        static_url_path='/static',
    )

    # Multi-Module Template Loader (supports core root and role subdirectories)
    app.jinja_loader = jinja2.ChoiceLoader([
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'general')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'home')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'auth')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'calculator')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'template')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'contact')),
        jinja2.FileSystemLoader(str(ROOT_DIR / 'core' / 'calendar')),
    ])

    app.secret_key = os.getenv('SECRET_KEY', 'change-me-in-production')
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        # Use secure cookies over HTTPS in production (Render is always HTTPS)
        SESSION_COOKIE_SECURE=IS_PRODUCTION,
        SESSION_COOKIE_NAME='authguard_session',
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16 MB payload limit
        # Cache static assets for 1 day on Render's CDN
        SEND_FILE_MAX_AGE_DEFAULT=86400 if IS_PRODUCTION else 0,
    )

    # ── Blueprint Registration ─────────────────────────────────────────────────
    from routes import router_bp, api_bp

    app.register_blueprint(router_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    # ── Security Headers ───────────────────────────────────────────────────────
    @app.after_request
    def add_security_headers(response):
        # Prevent MIME-type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'

        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'

        # Restrict referrer information
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Legacy XSS filter for older browsers
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # Disable dangerous browser features not needed by this app
        response.headers['Permissions-Policy'] = (
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), '
            'accelerometer=(), gyroscope=()'
        )

        # Content Security Policy — allows scripts/styles from self and common CDNs.
        # Adjust trusted sources as needed.
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://accounts.google.com https://discord.com https://api.github.com https://github.com",
            "frame-src https://accounts.google.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers['Content-Security-Policy'] = '; '.join(csp_directives)

        # HTTP Strict Transport Security (only meaningful over HTTPS)
        # Included here so it's ready for production; browsers ignore it over HTTP.
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'

        return response

    # ── Global Error Handlers (prevent stack-trace leakage) ───────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'error': 'Bad request.', 'status': 400}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({'error': 'Authentication required.', 'status': 401}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({'error': 'Access denied.', 'status': 403}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Resource not found.', 'status': 404}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Method not allowed.', 'status': 405}), 405

    @app.errorhandler(413)
    def payload_too_large(e):
        return jsonify({'error': 'Request payload is too large.', 'status': 413}), 413

    @app.errorhandler(429)
    def too_many_requests(e):
        return jsonify({'error': 'Too many requests. Please try again later.', 'status': 429}), 429

    @app.errorhandler(500)
    def internal_error(e):
        # Never expose exception details in production
        return jsonify({'error': 'An internal server error occurred.', 'status': 500}), 500

    return app


app = create_app()