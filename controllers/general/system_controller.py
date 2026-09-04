"""
controllers/general/system_controller.py
System & general endpoint request handlers.
"""
from flask import jsonify, request
from services.general.system_service import (
    get_system_status,
    verify_client_session_token,
    get_route_manifest,
)
from services.general.helper_service import ALLOWED_PERMISSIONS, sanitize_input


def status():
    return jsonify(get_system_status())


def verify_session():
    data = request.get_json(silent=True) or {}
    token = data.get('token', '')
    email = data.get('email', '')

    result = verify_client_session_token(token, email)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code


def routes_manifest():
    """Return the application route manifest. Requires authentication."""
    from services.home.home_service import get_current_user
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401
    return jsonify(get_route_manifest())


def get_permissions():
    from services.general.permission_service import get_user_permissions
    return jsonify({
        'success': True,
        'permissions': get_user_permissions(),
    })


def grant_permission():
    """Grant a whitelisted permission to the current session.

    Only permissions in ALLOWED_PERMISSIONS are accepted. Arbitrary strings
    are rejected with 400 to prevent privilege escalation attacks.
    """
    from services.general.permission_service import grant_permission as _grant
    from services.home.home_service import get_current_user

    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401

    data = request.get_json(silent=True) or {}
    permission = sanitize_input(data.get('permission', '')).lower()

    if not permission:
        return jsonify({'success': False, 'error': 'Permission name is required.'}), 400

    # Whitelist enforcement — only known permissions are allowed
    if permission not in ALLOWED_PERMISSIONS:
        return jsonify({
            'success': False,
            'error': f"Unknown permission '{permission}'. Allowed: {sorted(ALLOWED_PERMISSIONS)}",
        }), 400

    updated = _grant(permission)
    return jsonify({
        'success': True,
        'message': f"Permission '{permission}' granted.",
        'permissions': updated,
    })


def revoke_permission():
    """Revoke a whitelisted permission from the current session."""
    from services.general.permission_service import revoke_permission as _revoke
    from services.home.home_service import get_current_user

    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401

    data = request.get_json(silent=True) or {}
    permission = sanitize_input(data.get('permission', '')).lower()

    if not permission:
        return jsonify({'success': False, 'error': 'Permission name is required.'}), 400

    if permission not in ALLOWED_PERMISSIONS:
        return jsonify({
            'success': False,
            'error': f"Unknown permission '{permission}'.",
        }), 400

    updated = _revoke(permission)
    return jsonify({
        'success': True,
        'message': f"Permission '{permission}' revoked.",
        'permissions': updated,
    })
