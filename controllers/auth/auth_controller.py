"""
controllers/auth/auth_controller.py
Authentication endpoint handlers for login and password reset.
"""
from flask import jsonify, request
from services.auth.auth_service import authenticate_user
from services.auth.password_service import validate_and_update_password
from services.general.helper_service import sanitize_input


def _get_client_ip() -> str:
    """Extract the real client IP from the request.

    Reads only the FIRST address from X-Forwarded-For (subsequent entries are
    added by proxies and can be spoofed). Falls back to remote_addr.
    """
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        # Take only the leftmost IP (the actual client)
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '')
    password = data.get('password', '')
    client_ip = _get_client_ip()

    result = authenticate_user(email, password, client_ip)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code


def reset_password():
    data = request.get_json(silent=True) or {}
    email = sanitize_input(data.get('email', '')).lower()
    new_password = data.get('newPassword', '')

    result = validate_and_update_password(email, new_password)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code
