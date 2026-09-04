"""
controllers/contact/page_controller.py
Page controller & API endpoints for Contact views.
"""
from flask import render_template, request, jsonify, session
from services.home.home_service import get_current_user
from services.general.permission_service import permission_required, get_user_permissions
from services.general.helper_service import (
    sanitize_input,
    sanitize_page_name,
    sanitize_icon_name,
    MAX_PAGE_NAME_LENGTH,
)
from database import (
    db_search_users_for_contact,
    db_get_saved_contacts_enhanced,
    db_save_contact_enhanced,
    db_unsave_contact_enhanced,
    db_toggle_favourite_contact,
    db_get_favourite_contacts,
    db_get_user_contact_pages,
    db_create_contact_page,
    db_rename_contact_page,
    db_delete_contact_page,
)

# Maximum length for a search query string
MAX_SEARCH_QUERY_LENGTH = 100
# Maximum length for contact identifier (email / username)
MAX_CONTACT_ID_LENGTH = 254


@permission_required('contact')
def contact_page():
    """Render the unified Contact shell."""
    user = get_current_user()
    permissions = get_user_permissions()
    return render_template(
        'contact/shell.html',
        active_view='contact',
        server_route='/contact',
        server_user=user,
        user_session=user is not None,
        user_permissions=permissions,
    )


# ==========================================================================
# Internal Helpers
# ==========================================================================

def _require_auth():
    """Return (user, None) on success or (None, error_response) on failure.

    Checks:
    1. User must be authenticated (session must contain user_id).
    2. User must have entered Contact via the Home launch button
       (session['contact_access'] must be truthy) — prevents direct API
       access from users who never loaded the Contact page.
    """
    user = get_current_user()
    if not user:
        return None, (jsonify({'ok': False, 'error': 'Unauthorized'}), 401)
    if not session.get('contact_access'):
        return None, (jsonify({'ok': False, 'error': 'Access denied. Please open Contact from the Home dashboard.'}), 403)
    return user, None


# ==========================================================================
# Contact JSON APIs
# ==========================================================================

def api_search():
    """GET /contact/api/search?q=..."""
    user, err = _require_auth()
    if err:
        return err
    q = sanitize_input(request.args.get('q', '').strip())
    if not q:
        return jsonify({'ok': True, 'users': []})
    if len(q) > MAX_SEARCH_QUERY_LENGTH:
        return jsonify({'ok': False, 'error': 'Search query is too long.'}), 400
    users = db_search_users_for_contact(q, user['email'])
    return jsonify({'ok': True, 'users': users})


def api_all_contacts():
    """GET /contact/api/all"""
    user, err = _require_auth()
    if err:
        return err
    contacts = db_get_saved_contacts_enhanced(user['email'])
    return jsonify({'ok': True, 'contacts': contacts})


def api_save_contact():
    """POST /contact/api/save { "contact_id": "..." }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    contact_id = sanitize_input(str(data.get('contact_id') or data.get('email') or ''))
    if not contact_id:
        return jsonify({'ok': False, 'error': 'Contact ID required'}), 400
    if len(contact_id) > MAX_CONTACT_ID_LENGTH:
        return jsonify({'ok': False, 'error': 'Contact identifier is too long.'}), 400
    ok, error = db_save_contact_enhanced(user['email'], contact_id)
    if not ok:
        return jsonify({'ok': False, 'error': error or 'Failed to save contact'}), 400
    return jsonify({'ok': True, 'message': 'Contact saved successfully'})


def api_unsave_contact():
    """POST /contact/api/unsave { "contact_id": "..." }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    contact_id = sanitize_input(str(data.get('contact_id') or data.get('email') or ''))
    if not contact_id:
        return jsonify({'ok': False, 'error': 'Contact ID required'}), 400
    if len(contact_id) > MAX_CONTACT_ID_LENGTH:
        return jsonify({'ok': False, 'error': 'Contact identifier is too long.'}), 400
    ok = db_unsave_contact_enhanced(user['email'], contact_id)
    if not ok:
        return jsonify({'ok': False, 'error': 'Failed to unsave contact'}), 400
    return jsonify({'ok': True, 'message': 'Contact removed from saved list'})


def api_get_favourites():
    """GET /contact/api/favourites"""
    user, err = _require_auth()
    if err:
        return err
    favourites = db_get_favourite_contacts(user['email'])
    return jsonify({'ok': True, 'favourites': favourites})


def api_toggle_favourite():
    """POST /contact/api/favourite/toggle { "contact_id": "...", "is_fav": bool }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    contact_id = sanitize_input(str(data.get('contact_id') or data.get('email') or ''))
    is_fav = bool(data.get('is_fav', True))
    if not contact_id:
        return jsonify({'ok': False, 'error': 'Contact ID required'}), 400
    if len(contact_id) > MAX_CONTACT_ID_LENGTH:
        return jsonify({'ok': False, 'error': 'Contact identifier is too long.'}), 400
    ok, error = db_toggle_favourite_contact(user['email'], contact_id, is_fav)
    if not ok:
        return jsonify({'ok': False, 'error': error or 'Failed to update favourite'}), 400
    return jsonify({'ok': True, 'is_fav': is_fav, 'message': 'Favourites updated'})


def api_get_pages():
    """GET /contact/api/pages"""
    user, err = _require_auth()
    if err:
        return err
    pages = db_get_user_contact_pages(user['email'])
    return jsonify({'ok': True, 'pages': pages, 'count': len(pages), 'max_extra': 3, 'max_total': 6})


def api_create_page():
    """POST /contact/api/pages/create { "name": "...", "icon": "..." }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    # Sanitize and validate name
    raw_name = data.get('name') or ''
    name = sanitize_page_name(raw_name)
    if not name:
        return jsonify({'ok': False, 'error': 'Page name is required and must contain valid characters.'}), 400
    if len(name) > MAX_PAGE_NAME_LENGTH:
        return jsonify({'ok': False, 'error': f'Page name must be {MAX_PAGE_NAME_LENGTH} characters or fewer.'}), 400

    # Validate icon against whitelist
    raw_icon = data.get('icon') or 'folder'
    icon = sanitize_icon_name(raw_icon)

    ok, result_or_err = db_create_contact_page(user['email'], name, icon)
    if not ok:
        return jsonify({'ok': False, 'error': result_or_err}), 400
    return jsonify({'ok': True, 'page': result_or_err, 'message': f"Page '{name}' created"})


def api_rename_page():
    """POST /contact/api/pages/rename { "page_id": "...", "name": "..." }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    page_id = sanitize_input(str(data.get('page_id') or '')).strip()
    raw_name = data.get('name') or ''
    name = sanitize_page_name(raw_name)

    if not page_id:
        return jsonify({'ok': False, 'error': 'Page ID is required.'}), 400
    if not name:
        return jsonify({'ok': False, 'error': 'Page name is required and must contain valid characters.'}), 400
    if len(name) > MAX_PAGE_NAME_LENGTH:
        return jsonify({'ok': False, 'error': f'Page name must be {MAX_PAGE_NAME_LENGTH} characters or fewer.'}), 400

    ok, err_msg = db_rename_contact_page(user['email'], page_id, name)
    if not ok:
        return jsonify({'ok': False, 'error': err_msg or 'Failed to rename page'}), 400
    return jsonify({'ok': True, 'message': f"Page renamed to '{name}'"})


def api_delete_page():
    """POST /contact/api/pages/delete { "page_id": "..." }"""
    user, err = _require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    page_id = sanitize_input(str(data.get('page_id') or '')).strip()
    if not page_id:
        return jsonify({'ok': False, 'error': 'Page ID required'}), 400
    ok, err_msg = db_delete_contact_page(user['email'], page_id)
    if not ok:
        return jsonify({'ok': False, 'error': err_msg or 'Failed to delete page'}), 400
    return jsonify({'ok': True, 'message': 'Page deleted'})
