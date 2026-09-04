"""
services/general/permission_service.py
Route-Level Access & Entry Point Enforcement Service.

Rules:
- /body requires the user to be authenticated.
- /calculator requires entering by clicking the launch button in /body (session['calculator_access']).
- Direct URL manipulation from the browser address bar (e.g. typing /calculator while in /body) is blocked and redirects to /body.
"""
from functools import wraps
from flask import session, redirect, url_for
from services.home.home_service import get_current_user


def get_user_permissions() -> list:
    """Retrieve active permissions for the user session."""
    user = get_current_user()
    if not user:
        return []
    perms = session.get('permissions')
    if perms is None:
        perms = ['home', 'body', 'calculator', 'template', 'contact', 'calendar']
        session['permissions'] = perms
    return list(perms)


def has_permission(permission_name: str) -> bool:
    """Check if the user is authenticated for the permission category."""
    if not permission_name:
        return True
    user = get_current_user()
    if not user:
        return False
    return True


def grant_permission(permission_name: str) -> list:
    """Grant a permission to the current session."""
    perms = set(get_user_permissions())
    perms.add(permission_name)
    session['permissions'] = list(perms)
    return list(perms)


def revoke_permission(permission_name: str) -> list:
    """Revoke a permission from the current session."""
    perms = set(get_user_permissions())
    perms.discard(permission_name)
    session['permissions'] = list(perms)
    return list(perms)


def permission_required(permission_name: str):
    """Decorator to guard server routes and enforce button-based entry.
    - If unauthenticated, redirects to /auth.
    - /home requires logged in user. Accessing /home resets module-specific launch tokens.
    - /calculator requires the user to have clicked 'Open Calculator' in /home.
    - /template requires the user to have clicked 'Open Template' in /home.
    - /contact requires the user to have clicked 'Open Contact' in /home.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return redirect(url_for('router.auth_page', denied=permission_name))

            if permission_name == 'body' or permission_name == 'home':
                # Clear one-time module launch tokens when returning to home dashboard
                session.pop('calculator_access', None)
                session.pop('template_access', None)
                session.pop('contact_access', None)
                session.pop('calendar_access', None)
                return f(*args, **kwargs)

            if permission_name == 'calculator':
                # Direct URL entry check: must have entered via button in Home
                if not session.get('calculator_access'):
                    return redirect(url_for('router.home_page', notice='direct_url_blocked_calculator'))

            if permission_name == 'template':
                # Direct URL entry check: must have entered via button in Home
                if not session.get('template_access'):
                    return redirect(url_for('router.home_page', notice='direct_url_blocked_template'))

            if permission_name == 'contact':
                # Direct URL entry check: must have entered via button in Home
                if not session.get('contact_access'):
                    return redirect(url_for('router.home_page', notice='direct_url_blocked_contact'))

            if permission_name == 'calendar':
                # Direct URL entry check: must have entered via button in Home
                if not session.get('calendar_access'):
                    return redirect(url_for('router.home_page', notice='direct_url_blocked_calendar'))

            return f(*args, **kwargs)
        return decorated_function
    return decorator
