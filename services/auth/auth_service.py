"""
services/auth/auth_service.py
User authentication, password verification, and session token generation.
"""
from config.db import db_get_user, verify_password
from services.general.helper_service import (
    MAX_LOGIN_ATTEMPTS_PER_WINDOW,
    check_rate_limit,
    generate_session_token,
    sanitize_input,
    start_server_session,
)


def authenticate_user(email: str, password: str, client_ip: str = 'unknown'):
    """Authenticate a user by email and password.

    Rate-limited per IP and per email (MAX_LOGIN_ATTEMPTS_PER_WINDOW attempts
    per 15-minute window) to prevent brute-force and password-scanning attacks.
    """
    email = sanitize_input(email).lower()

    if not email or not password:
        return {'success': False, 'error': 'Email and password are required.', 'status_code': 400}

    # ── Rate limiting: block brute-force per IP and per email ─────────────────
    ip_key = f"login_ip_{client_ip}"
    email_key = f"login_email_{email}"

    if not check_rate_limit(ip_key, MAX_LOGIN_ATTEMPTS_PER_WINDOW):
        return {
            'success': False,
            'error': 'Too many login attempts from this network. Please wait 15 minutes.',
            'status_code': 429,
        }

    if not check_rate_limit(email_key, MAX_LOGIN_ATTEMPTS_PER_WINDOW):
        return {
            'success': False,
            'error': 'Too many login attempts for this account. Please wait 15 minutes or reset your password.',
            'status_code': 429,
        }

    # ── Credential verification ───────────────────────────────────────────────
    user = db_get_user(email)
    if not user:
        # Return a generic error to avoid leaking whether an email is registered
        return {'success': False, 'error': 'Incorrect email or password.', 'status_code': 401}

    if not user.get('password_hash') or not verify_password(password, user['password_hash']):
        return {'success': False, 'error': 'Incorrect email or password.', 'status_code': 401}

    token = generate_session_token(user)
    start_server_session(user)

    return {
        'success': True,
        'message': 'Login successful!',
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
        },
        'token': token,
        'status_code': 200,
    }
