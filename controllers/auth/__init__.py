"""
controllers/auth/__init__.py
Auth controllers aggregation.
"""
from controllers.auth.auth_controller import login, reset_password
from controllers.auth.otp_controller import send_otp, verify_otp
from controllers.auth.social_controller import (
    get_google_config,
    get_github_config,
    get_discord_config,
    auth_social,
)
from controllers.auth.page_controller import (
    render_shell,
    auth_page,
    signup_page,
    forgot_page,
    otp_page,
    reset_password_page,
)

__all__ = [
    'login',
    'reset_password',
    'send_otp',
    'verify_otp',
    'get_google_config',
    'get_github_config',
    'get_discord_config',
    'auth_social',
    'render_shell',
    'auth_page',
    'signup_page',
    'forgot_page',
    'otp_page',
    'reset_password_page',
]
