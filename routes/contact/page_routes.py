"""
routes/contact/page_routes.py
Contact page and API routes.
"""
from flask import Blueprint
from controllers.contact import page_controller


def register_contact_page_routes(bp: Blueprint):
    """Register all routes for the contact module on the main router blueprint."""
    # Main Contact Shell View
    bp.add_url_rule(
        '/contact',
        endpoint='contact_page',
        view_func=page_controller.contact_page,
        methods=['GET']
    )

    # API Endpoints
    bp.add_url_rule(
        '/contact/api/search',
        endpoint='contact_api_search',
        view_func=page_controller.api_search,
        methods=['GET']
    )
    bp.add_url_rule(
        '/contact/api/all',
        endpoint='contact_api_all',
        view_func=page_controller.api_all_contacts,
        methods=['GET']
    )
    bp.add_url_rule(
        '/contact/api/save',
        endpoint='contact_api_save',
        view_func=page_controller.api_save_contact,
        methods=['POST']
    )
    bp.add_url_rule(
        '/contact/api/unsave',
        endpoint='contact_api_unsave',
        view_func=page_controller.api_unsave_contact,
        methods=['POST']
    )
    bp.add_url_rule(
        '/contact/api/favourites',
        endpoint='contact_api_favourites',
        view_func=page_controller.api_get_favourites,
        methods=['GET']
    )
    bp.add_url_rule(
        '/contact/api/favourite/toggle',
        endpoint='contact_api_toggle_favourite',
        view_func=page_controller.api_toggle_favourite,
        methods=['POST']
    )
    bp.add_url_rule(
        '/contact/api/pages',
        endpoint='contact_api_pages',
        view_func=page_controller.api_get_pages,
        methods=['GET']
    )
    bp.add_url_rule(
        '/contact/api/pages/create',
        endpoint='contact_api_create_page',
        view_func=page_controller.api_create_page,
        methods=['POST']
    )
    bp.add_url_rule(
        '/contact/api/pages/rename',
        endpoint='contact_api_rename_page',
        view_func=page_controller.api_rename_page,
        methods=['POST']
    )
    bp.add_url_rule(
        '/contact/api/pages/delete',
        endpoint='contact_api_delete_page',
        view_func=page_controller.api_delete_page,
        methods=['POST']
    )
