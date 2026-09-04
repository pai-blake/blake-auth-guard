"""
services/auth/otp_service.py
OTP lifecycle service: creation, delivery, rate limiting, and verification.
"""
import re
import time

from config.db import (
    hash_password,
    db_save_otp,
    db_get_otp,
    db_increment_otp_attempt,
    db_delete_otp,
    db_get_user,
    db_create_user,
)
from services.general.email_service import has_email_credentials, send_otp_email
from services.general.helper_service import (
    OTP_EXPIRY_SECONDS,
    MAX_OTP_DISPATCH_PER_WINDOW,
    MAX_VERIFY_ATTEMPTS_PER_WINDOW,
    check_rate_limit,
    generate_otp,
    generate_session_token,
    sanitize_input,
    start_server_session,
    timing_safe_compare,
)


# Allowed OTP purposes — reject any other value to prevent injection
_ALLOWED_OTP_PURPOSES = frozenset({'login', 'signup', 'forgot'})


def dispatch_otp(raw_email: str, purpose: str = 'login', pending_data: dict = None, client_ip: str = 'unknown'):
    try:
        purpose = sanitize_input(purpose or 'login') or 'login'
        if purpose not in _ALLOWED_OTP_PURPOSES:
            purpose = 'login'  # silently normalise unknown purposes
        pending_data = pending_data or {}

        if not raw_email or not isinstance(raw_email, str):
            return {'success': False, 'error': 'Please enter a valid email address.', 'status_code': 400}

        normalized_email = sanitize_input(raw_email).lower()
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        if not re.match(email_regex, normalized_email):
            return {'success': False, 'error': 'Please enter a valid email address.', 'status_code': 400}

        existing_user = db_get_user(normalized_email)

        if purpose == 'signup' and existing_user:
            return {
                'success': False,
                'error': 'An account with this email is already registered. Please sign in instead.',
                'status_code': 409
            }

        if purpose == 'forgot' and not existing_user:
            return {
                'success': False,
                'error': 'No account found with this email address. Please sign up first.',
                'status_code': 404
            }

        ip_key = f"ip_send_{client_ip}"
        email_key = f"email_send_{normalized_email}"

        if not check_rate_limit(ip_key, MAX_OTP_DISPATCH_PER_WINDOW) or not check_rate_limit(email_key, MAX_OTP_DISPATCH_PER_WINDOW):
            return {
                'success': False,
                'error': 'Too many OTP requests. Please wait 15 minutes before trying again.',
                'status_code': 429
            }

        if not has_email_credentials():
            return {
                'success': False,
                'error': 'Real email sender is not configured. Please set EMAIL_USER and EMAIL_PASS in your .env file.',
                'status_code': 503
            }

        existing = db_get_otp(normalized_email)
        if existing and (time.time() - (existing['expires_at'] - OTP_EXPIRY_SECONDS)) < 15:
            return {
                'success': True,
                'message': f"Verification code already sent to {normalized_email}. Please check your inbox.",
                'status_code': 200
            }

        if pending_data and pending_data.get('password'):
            pending_data['password_hash'] = hash_password(pending_data['password'])
            pending_data.pop('password', None)

        otp_code = generate_otp()
        expires_at = time.time() + OTP_EXPIRY_SECONDS

        db_save_otp(normalized_email, otp_code, purpose, pending_data, expires_at)
        send_otp_email(normalized_email, otp_code, purpose)

        return {
            'success': True,
            'message': f"A verification code has been sent to {normalized_email}. Please check your inbox.",
            'status_code': 200
        }
    except Exception as error:
        print('[Error sending real email]', error)
        return {
            'success': False,
            'error': 'Failed to deliver verification email. Please verify your credentials or network connection.',
            'status_code': 500
        }


def verify_otp_code(email: str, code: str, client_ip: str = 'unknown'):
    if not email or not code or not isinstance(email, str) or not isinstance(code, str):
        return {'success': False, 'error': 'Email and 6-digit OTP code are required.', 'status_code': 400}

    normalized_email = sanitize_input(email).lower()
    input_code = sanitize_input(code)

    verify_ip_key = f"ip_verify_{client_ip}"
    if not check_rate_limit(verify_ip_key, MAX_VERIFY_ATTEMPTS_PER_WINDOW):
        return {
            'success': False,
            'error': 'Too many verification attempts. Please wait 15 minutes before trying again.',
            'status_code': 429
        }

    session_record = db_get_otp(normalized_email)
    if not session_record:
        return {'success': False, 'error': 'No active OTP session found. Please request a new code.', 'status_code': 400}

    if time.time() > session_record['expires_at']:
        db_delete_otp(normalized_email)
        return {'success': False, 'error': 'This OTP has expired. Please request a new code.', 'status_code': 400}

    if session_record['attempts'] >= 5:
        db_delete_otp(normalized_email)
        return {'success': False, 'error': 'Too many incorrect attempts. Session invalidated. Please request a new code.', 'status_code': 400}

    if not timing_safe_compare(session_record['code'], input_code):
        db_increment_otp_attempt(normalized_email)
        return {
            'success': False,
            'error': f"Incorrect OTP code. ({4 - session_record['attempts']} attempts remaining)",
            'status_code': 400
        }

    db_delete_otp(normalized_email)

    pending_data = session_record.get('pending_data') or {}
    user_record = None

    if session_record['purpose'] == 'signup' and pending_data.get('email'):
        user_id = pending_data.get('id', f"usr_{int(time.time()*1000)}")
        db_create_user(
            user_id=user_id,
            name=pending_data.get('name', 'User'),
            email=pending_data.get('email'),
            password_hash=pending_data.get('password_hash'),
            verified=True
        )
        user_record = {
            'id': user_id,
            'name': pending_data.get('name', 'User'),
            'email': pending_data.get('email')
        }
    elif session_record['purpose'] == 'login':
        user_record = db_get_user(normalized_email)
        if not user_record:
            # SECURITY: Do NOT auto-create an account for an unknown email on OTP login.
            # Silently creating accounts here would allow anyone to register by simply
            # triggering an OTP login for an arbitrary email address.
            db_delete_otp(normalized_email)
            return {
                'success': False,
                'error': 'No account found with this email. Please sign up first.',
                'status_code': 404,
            }

    token = generate_session_token(user_record) if user_record else None
    start_server_session(user_record)

    return {
        'success': True,
        'message': 'OTP verified successfully!',
        'purpose': session_record['purpose'],
        'pendingData': session_record['pending_data'],
        'user': user_record,
        'token': token,
        'status_code': 200
    }
