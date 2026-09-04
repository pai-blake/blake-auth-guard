"""
services/home/home_service.py
Home & User Session Service Layer with DB Profile & Account Management.
"""
from functools import wraps
from flask import session, redirect, url_for
from config.db import (
    db_get_user,
    db_ensure_username,
    db_update_user_profile,
    verify_password,
    db_delete_account,
    db_consume_deletion_token,
    db_create_deletion_token,
)
from services.general.helper_service import sanitize_input
import re


def get_current_user():
    """Return the session user dict with all profile fields, or None when not authenticated.
    Validates session against the database — stale sessions are cleared."""
    if 'user_id' not in session:
        return None
    email = session.get('user_email', '')
    if not email:
        return None
    user = db_get_user(email)
    if not user or user['id'] != session['user_id']:
        session.clear()
        return None

    # Ensure username is populated
    username = user.get('username')
    if not username:
        try:
            username = db_ensure_username(email)
        except Exception:
            username = email.split('@')[0]

    return {
        'id': user['id'],
        'name': user['name'],
        'email': user['email'],
        'username': username,
        'avatar': user.get('avatar'),
        'avatar_url': user.get('avatar'),
        'created_at': user.get('created_at'),
        'role': 'Member'
    }


def login_required(f):
    """Security guard decorator: blocks unauthenticated access and bounces users to /auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not get_current_user():
            return redirect(url_for('router.auth_page'))
        return f(*args, **kwargs)
    return decorated


def update_profile(name: str = None, username: str = None, avatar: str = None) -> dict:
    """Update profile fields in the database for the authenticated user."""
    curr_user = get_current_user()
    if not curr_user:
        return {'success': False, 'error': 'Unauthorized', 'status_code': 401}

    email = curr_user['email']
    clean_name = None
    clean_username = None

    if name is not None:
        clean_name = sanitize_input(name)
        if not clean_name:
            return {'success': False, 'error': 'Name cannot be empty.', 'status_code': 400}
        if len(clean_name) > 60:
            return {'success': False, 'error': 'Name is too long (max 60 characters).', 'status_code': 400}

    if username is not None:
        clean_username = sanitize_input(username).lstrip('@').strip().lower()
        if not clean_username:
            return {'success': False, 'error': 'Username cannot be empty.', 'status_code': 400}
        if len(clean_username) < 3 or len(clean_username) > 30:
            return {'success': False, 'error': 'Username must be 3-30 characters long.', 'status_code': 400}
        if not re.match(r'^[a-zA-Z0-9_]+$', clean_username):
            return {'success': False, 'error': 'Username can only contain letters, numbers, and underscores.', 'status_code': 400}

    ok, err = db_update_user_profile(
        email=email,
        name=clean_name,
        username=clean_username,
        avatar=avatar
    )

    if not ok:
        return {'success': False, 'error': err or 'Failed to update profile.', 'status_code': 400}

    if clean_name:
        session['user_name'] = clean_name

    updated_user = get_current_user()
    return {
        'success': True,
        'message': 'Profile updated successfully.',
        'user': updated_user,
        'status_code': 200
    }


def delete_current_account(password: str = '') -> dict:
    """Permanently delete authenticated user's account and session after validating password."""
    if 'user_id' not in session:
        return {'success': False, 'error': 'Unauthorized', 'status_code': 401}

    email = session.get('user_email', '')
    user = db_get_user(email)
    if not user:
        return {'success': False, 'error': 'Account not found.', 'status_code': 404}

    if user.get('password_hash'):
        if not password or not verify_password(password, user['password_hash']):
            return {'success': False, 'error': 'Incorrect password. Account was not deleted.', 'status_code': 400}

    deleted = db_delete_account(email)
    if deleted:
        session.clear()
        return {'success': True, 'message': 'Account permanently deleted.', 'status_code': 200}

    return {'success': False, 'error': 'Could not delete account. Please try again later.', 'status_code': 500}


def verify_and_delete_account(token: str, password: str = '') -> dict:
    """Validate a deletion token and password, then permanently delete the account."""
    if not token:
        return {'success': False, 'reason': 'missing_token'}

    email = db_consume_deletion_token(token)
    if not email:
        return {'success': False, 'reason': 'invalid_token'}

    user = db_get_user(email)
    if not user:
        return {'success': False, 'reason': 'not_found'}

    if user.get('password_hash'):
        if not password or not verify_password(password, user['password_hash']):
            return {'success': False, 'reason': 'invalid_password', 'email': email}

    deleted = db_delete_account(email)
    if deleted:
        session.clear()
        return {'success': True, 'email': email}
    return {'success': False, 'reason': 'delete_failed'}
