"""
services/general/system_service.py
Service introspection — health status, session validation, route manifest.
"""
from config.db import get_db_status
from config.email_config import get_is_configured, get_smtp_status
from services.general.helper_service import verify_session_token


def get_system_status() -> dict:
    return {
        'status': 'running',
        'isConfigured': get_is_configured(),
        'database': get_db_status(),
        'smtp': get_smtp_status()
    }


def verify_client_session_token(token: str, email: str) -> dict:
    """Verify a client-supplied HMAC-SHA256 signed session token.

    Rejects tokens that are:
    - Missing or malformed (wrong number of segments)
    - Signature-invalid (tampered or forged payloads)
    - Expired (past the `exp` claim)
    - Mismatched against the supplied email
    """
    if not token or not email:
        return {'valid': False, 'error': 'Token and email are required.', 'status_code': 400}

    payload = verify_session_token(token)
    if payload is None:
        return {
            'valid': False,
            'error': 'Invalid or expired session token.',
            'status_code': 401
        }

    token_email = payload.get('email', '')
    if token_email.lower() != email.lower():
        return {
            'valid': False,
            'error': 'Token does not match the provided user.',
            'status_code': 401
        }

    return {
        'valid': True,
        'user': {
            'id': payload.get('sub'),
            'email': payload.get('email'),
            'name': payload.get('name'),
        },
        'status_code': 200,
    }


def get_route_manifest() -> dict:
    return {
        'sections': {
            'auth': {
                'type': 'fixed',
                'description': 'Fixed authentication gatekeeper flow',
                'routes': ['/login', '/signup', '/forgot', '/otp', '/reset-password']
            },
            'session': {
                'type': 'flexible',
                'description': 'Swappable post-authentication destination',
                'defaultRoute': '/chat'
            }
        },
        'database': get_db_status()
    }
