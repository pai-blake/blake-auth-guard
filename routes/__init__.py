"""
routes/__init__.py
Routes Layer Aggregator
Roles: general, auth, home, calculator
"""
from flask import Blueprint

from routes.general import register_general_page_routes, register_general_api_routes
from routes.auth import register_auth_page_routes, register_auth_api_routes
from routes.home import register_home_page_routes, register_home_api_routes
from routes.calculator import register_calculator_page_routes
from routes.template import register_template_page_routes
from routes.contact import register_contact_page_routes
from routes.calendar import register_calendar_page_routes

# ── Router Blueprint (Web Page Views) ─────────────────────────────────────────
router_bp = Blueprint('router', __name__)

register_general_page_routes(router_bp)
register_auth_page_routes(router_bp)
register_home_page_routes(router_bp)
register_calculator_page_routes(router_bp)
register_template_page_routes(router_bp)
register_contact_page_routes(router_bp)
register_calendar_page_routes(router_bp)

# ── API Blueprint (JSON Endpoints) ────────────────────────────────────────────
api_bp = Blueprint('api', __name__)

register_general_api_routes(api_bp)
register_auth_api_routes(api_bp)
register_home_api_routes(api_bp)

__all__ = ['router_bp', 'api_bp']
