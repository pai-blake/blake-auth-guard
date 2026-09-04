"""
controllers/auth/page_controller.py
Page controllers for authentication views (rendering shell templates).
"""
from flask import render_template, redirect, url_for
from services.home.home_service import get_current_user

SHELL_VIEWS = {
    'login':  {'route': '/auth',            'mode': 'mode-login'},
    'signup': {'route': '/signup',          'mode': 'mode-signup'},
    'forgot': {'route': '/forgot',          'mode': 'mode-full'},
    'otp':    {'route': '/otp',             'mode': 'mode-full'},
    'reset':  {'route': '/reset-password',  'mode': 'mode-full'},
    'chat':   {'route': '/body',            'mode': 'mode-one'},
}


def render_shell(active_view: str):
    """Render the unified app shell with the given server-decided entry view."""
    config = SHELL_VIEWS[active_view]
    user = get_current_user()
    from services.general.permission_service import get_user_permissions
    return render_template(
        'auth/shell.html',
        active_view=active_view,
        card_mode=config['mode'],
        server_route=config['route'],
        server_user=user,
        user_session=user is not None,
        user_permissions=get_user_permissions(),
    )


def auth_page():
    if get_current_user():
        return redirect(url_for('router.home_page'))
    return render_shell('login')


def signup_page():
    if get_current_user():
        return redirect(url_for('router.home_page'))
    return render_shell('signup')


def forgot_page():
    return render_shell('forgot')


def otp_page():
    return render_shell('otp')


def reset_password_page():
    return render_shell('reset')
