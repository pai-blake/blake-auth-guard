"""
routes/auth/page_routes.py
Authentication page routes: /auth (primary), /login, /signup, /forgot, /otp, and /reset-password.
"""
from flask import Blueprint
from controllers.auth import page_controller


def register_auth_page_routes(bp: Blueprint):
    # Primary authentication shell base route is /auth
    bp.add_url_rule('/auth', endpoint='auth_page', view_func=page_controller.auth_page, methods=['GET'])
    bp.add_url_rule('/login', endpoint='login_page_alias', view_func=page_controller.auth_page, methods=['GET'])

    bp.add_url_rule('/signup', endpoint='signup_page', view_func=page_controller.signup_page, methods=['GET'])
    bp.add_url_rule('/auth/signup', endpoint='auth_signup_page', view_func=page_controller.signup_page, methods=['GET'])

    bp.add_url_rule('/forgot', endpoint='forgot_page', view_func=page_controller.forgot_page, methods=['GET'])
    bp.add_url_rule('/auth/forgot', endpoint='auth_forgot_page', view_func=page_controller.forgot_page, methods=['GET'])

    bp.add_url_rule('/otp', endpoint='otp_page', view_func=page_controller.otp_page, methods=['GET'])
    bp.add_url_rule('/auth/otp', endpoint='auth_otp_page', view_func=page_controller.otp_page, methods=['GET'])

    bp.add_url_rule('/reset-password', endpoint='reset_password_page', view_func=page_controller.reset_password_page, methods=['GET'])
    bp.add_url_rule('/auth/reset-password', endpoint='auth_reset_password_page', view_func=page_controller.reset_password_page, methods=['GET'])
