"""
routes/auth/__init__.py
Auth routes registration helper.
"""
from routes.auth.page_routes import register_auth_page_routes
from routes.auth.api_routes import register_auth_api_routes

__all__ = [
    'register_auth_page_routes',
    'register_auth_api_routes',
]
