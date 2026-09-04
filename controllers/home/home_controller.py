"""
controllers/home/home_controller.py
Home page handlers, module launch dispatchers, and profile/account API endpoints.
"""
from flask import render_template, redirect, url_for, request, session, jsonify
from services.home.home_service import get_current_user, update_profile, delete_current_account
from services.general.permission_service import permission_required, get_user_permissions


@permission_required('home')
def home_page():
    """Protected entry point for the main application Home dashboard."""
    user = get_current_user()
    permissions = get_user_permissions()
    notice = request.args.get('notice', '') or request.args.get('denied', '')
    return render_template(
        'home/shell.html',
        user=user,
        server_user=user,
        user_permissions=permissions,
        notice=notice
    )


@permission_required('home')
def launch_calculator():
    """Authorized entry point: grants access to calculator only when clicked from Home."""
    session['calculator_access'] = True
    mode = request.args.get('mode', '')
    if mode == 'scientific':
        return redirect('/calculator/scientific')
    elif mode == 'advanced':
        return redirect('/calculator/advanced')
    return redirect('/calculator')


@permission_required('home')
def launch_template():
    """Authorized entry point: grants access to template only when clicked from Home."""
    session['template_access'] = True
    return redirect('/template')


@permission_required('home')
def launch_contact():
    """Authorized entry point: grants access to contact only when clicked from Home."""
    session['contact_access'] = True
    return redirect('/contact')


@permission_required('home')
def launch_calendar():
    """Authorized entry point: grants access to calendar only when clicked from Home."""
    session['calendar_access'] = True
    return redirect('/calendar')



def api_get_profile():
    """Return JSON representation of the currently logged-in user profile."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    return jsonify({'success': True, 'user': user}), 200


def api_update_profile():
    """Handle profile update (name, username, avatar) via JSON request."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    name = data.get('name')
    username = data.get('username')
    avatar = data.get('avatar')

    result = update_profile(name=name, username=username, avatar=avatar)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code


def api_delete_account():
    """Handle immediate account deletion with password verification."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    password = data.get('password', '')

    result = delete_current_account(password=password)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code
