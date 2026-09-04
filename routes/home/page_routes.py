"""
routes/home/page_routes.py
Home page routes: /home, /chat, module launch actions, and profile API endpoints.
"""
from flask import Blueprint
from controllers.home import home_controller


def register_home_page_routes(bp: Blueprint):
    bp.add_url_rule('/home', endpoint='home_page', view_func=home_controller.home_page, methods=['GET'])
    bp.add_url_rule('/body', endpoint='body_page', view_func=home_controller.home_page, methods=['GET'])
    bp.add_url_rule('/chat', endpoint='chat_page', view_func=home_controller.home_page, methods=['GET'])
    bp.add_url_rule('/home/launch/calculator', endpoint='launch_calculator_home', view_func=home_controller.launch_calculator, methods=['GET', 'POST'])
    bp.add_url_rule('/body/launch/calculator', endpoint='launch_calculator_body', view_func=home_controller.launch_calculator, methods=['GET', 'POST'])
    bp.add_url_rule('/home/launch/template', endpoint='launch_template_home', view_func=home_controller.launch_template, methods=['GET', 'POST'])
    bp.add_url_rule('/body/launch/template', endpoint='launch_template_body', view_func=home_controller.launch_template, methods=['GET', 'POST'])
    bp.add_url_rule('/home/launch/contact', endpoint='launch_contact_home', view_func=home_controller.launch_contact, methods=['GET', 'POST'])
    bp.add_url_rule('/body/launch/contact', endpoint='launch_contact_body', view_func=home_controller.launch_contact, methods=['GET', 'POST'])
    bp.add_url_rule('/home/launch/calendar', endpoint='launch_calendar_home', view_func=home_controller.launch_calendar, methods=['GET', 'POST'])
    bp.add_url_rule('/body/launch/calendar', endpoint='launch_calendar_body', view_func=home_controller.launch_calendar, methods=['GET', 'POST'])

    # Profile & Account API Endpoints
    bp.add_url_rule('/home/api/profile', endpoint='api_get_profile', view_func=home_controller.api_get_profile, methods=['GET'])
    bp.add_url_rule('/home/api/profile/update', endpoint='api_update_profile', view_func=home_controller.api_update_profile, methods=['POST'])
    bp.add_url_rule('/home/api/account/delete', endpoint='api_delete_account', view_func=home_controller.api_delete_account, methods=['POST'])
