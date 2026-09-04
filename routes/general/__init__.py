"""
routes/general/__init__.py
General routes registration helper.
"""
from routes.general.page_routes import register_general_page_routes
from routes.general.api_routes import register_general_api_routes

__all__ = [
    'register_general_page_routes',
    'register_general_api_routes',
]
