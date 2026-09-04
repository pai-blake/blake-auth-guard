"""
routes/auth/api_routes.py
Authentication API routes: login, password reset, OTP, social OAuth endpoints.
"""
from flask import Blueprint
from controllers.auth import auth_controller, otp_controller, social_controller


def register_auth_api_routes(bp: Blueprint):
    # Password Auth & Recovery
    bp.add_url_rule('/auth/login', view_func=auth_controller.login, methods=['POST'])
    bp.add_url_rule('/auth/reset-password', view_func=auth_controller.reset_password, methods=['POST'])

    # OTP Lifecycle
    bp.add_url_rule('/send-otp', view_func=otp_controller.send_otp, methods=['POST'])
    bp.add_url_rule('/verify-otp', view_func=otp_controller.verify_otp, methods=['POST'])

    # OAuth Provider Configurations
    bp.add_url_rule('/config/google', view_func=social_controller.get_google_config, methods=['GET'])
    bp.add_url_rule('/config/github', view_func=social_controller.get_github_config, methods=['GET'])
    bp.add_url_rule('/config/discord', view_func=social_controller.get_discord_config, methods=['GET'])

    # OAuth Verification & Logins
    bp.add_url_rule('/auth/google', view_func=social_controller.auth_social, methods=['POST'])
    bp.add_url_rule('/auth/github', view_func=social_controller.auth_social, methods=['POST'])
    bp.add_url_rule('/auth/discord', view_func=social_controller.auth_social, methods=['POST'])
    bp.add_url_rule('/auth/social', view_func=social_controller.auth_social, methods=['POST'])
