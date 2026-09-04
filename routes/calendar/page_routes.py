"""
routes/calendar/page_routes.py
Calendar page and API routes.
"""
from flask import Blueprint
from controllers.calendar import page_controller


def register_calendar_page_routes(bp: Blueprint):
    """Register all routes for the calendar module on the main router blueprint."""
    # Main Calendar Shell View
    bp.add_url_rule(
        '/calendar',
        endpoint='calendar_page',
        view_func=page_controller.calendar_page,
        methods=['GET']
    )

    # API Endpoints
    bp.add_url_rule(
        '/calendar/api/events',
        endpoint='calendar_api_events',
        view_func=page_controller.api_get_events,
        methods=['GET']
    )
    bp.add_url_rule(
        '/calendar/api/events/<event_id>',
        endpoint='calendar_api_event_detail',
        view_func=page_controller.api_get_event,
        methods=['GET']
    )
    bp.add_url_rule(
        '/calendar/api/events/create',
        endpoint='calendar_api_create_event',
        view_func=page_controller.api_create_event,
        methods=['POST']
    )
    bp.add_url_rule(
        '/calendar/api/events/update/<event_id>',
        endpoint='calendar_api_update_event',
        view_func=page_controller.api_update_event,
        methods=['POST']
    )
    bp.add_url_rule(
        '/calendar/api/events/delete/<event_id>',
        endpoint='calendar_api_delete_event',
        view_func=page_controller.api_delete_event,
        methods=['POST']
    )
    bp.add_url_rule(
        '/calendar/api/attendees/search',
        endpoint='calendar_api_search_attendees',
        view_func=page_controller.api_search_attendees,
        methods=['GET']
    )
