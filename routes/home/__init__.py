"""
routes/home/__init__.py
Home routes package.
"""
from routes.home.page_routes import register_home_page_routes
from routes.home.api_routes import register_home_api_routes

__all__ = ['register_home_page_routes', 'register_home_api_routes']
