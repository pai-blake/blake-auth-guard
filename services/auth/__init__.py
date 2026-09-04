"""
services/auth/__init__.py
Auth services aggregation.
"""
from services.auth.auth_service import authenticate_user
from services.auth.otp_service import dispatch_otp, verify_otp_code
from services.auth.social_service import get_oauth_config, verify_social_token
from services.auth.password_service import validate_and_update_password

__all__ = [
    'authenticate_user',
    'dispatch_otp',
    'verify_otp_code',
    'get_oauth_config',
    'verify_social_token',
    'validate_and_update_password',
]
