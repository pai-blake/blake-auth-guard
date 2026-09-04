"""
controllers/calendar/page_controller.py
Page controller & API endpoints for Calendar core module.
"""
import re
from flask import render_template, request, jsonify, session
from services.home.home_service import get_current_user
from services.general.permission_service import permission_required, get_user_permissions
from services.general.helper_service import sanitize_input
from database import (
    db_create_calendar_event,
    db_get_calendar_events,
    db_get_calendar_event,
    db_update_calendar_event,
    db_delete_calendar_event,
    db_search_users_for_contact,
)

# Allowed categories and validation constants
ALLOWED_CATEGORIES = frozenset({'work', 'personal', 'meeting', 'urgent', 'holiday', 'general', 'other'})
MAX_TITLE_LENGTH = 140
MAX_DESC_LENGTH = 2000
MAX_LOCATION_LENGTH = 256
MAX_ATTENDEES_LENGTH = 500
MAX_EVENTS_PER_USER = 500
ALLOWED_REMINDER_MINUTES = frozenset({5, 15, 30, 60, 1440})

HEX_COLOR_REGEX = re.compile(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')
EVENT_ID_REGEX = re.compile(r'^evt_[a-zA-Z0-9_-]{1,64}$')
ISO_DATETIME_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$')


def _sanitize_multiline(text: str, max_len: int = 2000) -> str:
    """Sanitize multi-line text preserving formatting while eliminating HTML/XSS and control chars."""
    if not isinstance(text, str):
        return ''
    # Strip null bytes & control chars, keeping newline & carriage return
    clean = re.sub(r'[\x00\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    # Strip HTML-dangerous characters
    clean = re.sub(r'[<>"\'&]', '', clean)
    return clean.strip()[:max_len]


@permission_required('calendar')
def calendar_page():
    """Render the unified Calendar shell."""
    user = get_current_user()
    permissions = get_user_permissions()
    return render_template(
        'calendar/shell.html',
        active_view='calendar',
        server_route='/calendar',
        server_user=user,
        user_session=user is not None,
        user_permissions=permissions,
    )


# ==========================================================================
# Internal Auth Guard
# ==========================================================================

def _require_auth():
    """Return (user, None) on success or (None, error_response) on failure.
    Enforces that user is logged in AND reached calendar via authorized launcher.
    """
    user = get_current_user()
    if not user:
        return None, (jsonify({'ok': False, 'error': 'Unauthorized'}), 401)
    if not session.get('calendar_access'):
        return None, (jsonify({'ok': False, 'error': 'Access denied. Please open Calendar from the Home dashboard.'}), 403)
    return user, None


# ==========================================================================
# Calendar JSON APIs
# ==========================================================================

def api_get_events():
    """GET /calendar/api/events?start=&end=&category="""
    user, err = _require_auth()
    if err:
        return err

    start_dt = sanitize_input(request.args.get('start', '').strip())
    end_dt = sanitize_input(request.args.get('end', '').strip())
    category = sanitize_input(request.args.get('category', '').strip().lower())

    if len(start_dt) > 40:
        start_dt = start_dt[:40]
    if len(end_dt) > 40:
        end_dt = end_dt[:40]
    if category and category not in ALLOWED_CATEGORIES and category != 'all':
        category = None

    events = db_get_calendar_events(
        user['email'],
        start_dt=start_dt or None,
        end_dt=end_dt or None,
        category=category or None
    )
    return jsonify({'ok': True, 'events': events})


def api_get_event(event_id: str):
    """GET /calendar/api/events/<event_id>"""
    user, err = _require_auth()
    if err:
        return err

    clean_id = (event_id or '').strip()
    if not EVENT_ID_REGEX.match(clean_id):
        return jsonify({'ok': False, 'error': 'Invalid event ID format'}), 400

    event = db_get_calendar_event(user['email'], clean_id)
    if not event:
        return jsonify({'ok': False, 'error': 'Event not found'}), 404

    return jsonify({'ok': True, 'event': event})


def api_create_event():
    """POST /calendar/api/events/create"""
    user, err = _require_auth()
    if err:
        return err

    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({'ok': False, 'error': 'Invalid request body. Expected JSON object.'}), 400

    # Quota check (DDoS / DB flooding protection)
    existing_events = db_get_calendar_events(user['email'])
    if len(existing_events) >= MAX_EVENTS_PER_USER:
        return jsonify({'ok': False, 'error': f'Event limit reached. Maximum {MAX_EVENTS_PER_USER} events allowed per user.'}), 400

    title = sanitize_input(data.get('title', '').strip())
    if not title:
        return jsonify({'ok': False, 'error': 'Event title is required'}), 400
    if len(title) > MAX_TITLE_LENGTH:
        return jsonify({'ok': False, 'error': f'Title cannot exceed {MAX_TITLE_LENGTH} characters'}), 400

    start_dt = str(data.get('start_dt', '')).strip()
    end_dt = str(data.get('end_dt', '')).strip()
    if not start_dt or not end_dt:
        return jsonify({'ok': False, 'error': 'Start and end time are required'}), 400

    if not ISO_DATETIME_REGEX.match(start_dt) or not ISO_DATETIME_REGEX.match(end_dt):
        return jsonify({'ok': False, 'error': 'Invalid datetime format. Expected ISO 8601 (YYYY-MM-DDTHH:MM)'}), 400

    if start_dt > end_dt:
        return jsonify({'ok': False, 'error': 'End time cannot be earlier than start time'}), 400

    category = sanitize_input(str(data.get('category', 'general')).strip().lower())
    if category not in ALLOWED_CATEGORIES:
        category = 'general'

    color = str(data.get('color', '#6C63FF')).strip()
    if not HEX_COLOR_REGEX.match(color):
        color = '#6C63FF'

    description = _sanitize_multiline(data.get('description', ''), MAX_DESC_LENGTH)
    location = sanitize_input(data.get('location', '').strip())[:MAX_LOCATION_LENGTH]
    attendees = sanitize_input(data.get('attendees', '').strip())[:MAX_ATTENDEES_LENGTH]
    recurrence = sanitize_input(data.get('recurrence', '').strip())[:64]
    all_day = 1 if data.get('all_day') in (1, '1', True, 'true') else 0

    raw_reminder = data.get('reminder_min')
    reminder_min = None
    if raw_reminder not in (None, '', 'none'):
        try:
            val = int(raw_reminder)
            if val in ALLOWED_REMINDER_MINUTES:
                reminder_min = val
        except (ValueError, TypeError):
            reminder_min = None

    event_payload = {
        'title': title,
        'description': description,
        'start_dt': start_dt,
        'end_dt': end_dt,
        'all_day': all_day,
        'color': color,
        'category': category,
        'location': location,
        'recurrence': recurrence,
        'reminder_min': reminder_min,
        'attendees': attendees
    }

    ok, res = db_create_calendar_event(user['email'], event_payload)
    if not ok:
        return jsonify({'ok': False, 'error': res}), 400

    return jsonify({'ok': True, 'event': res})


def api_update_event(event_id: str):
    """POST /calendar/api/events/update/<event_id>"""
    user, err = _require_auth()
    if err:
        return err

    clean_id = (event_id or '').strip()
    if not EVENT_ID_REGEX.match(clean_id):
        return jsonify({'ok': False, 'error': 'Invalid event ID format'}), 400

    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({'ok': False, 'error': 'Invalid request body. Expected JSON object.'}), 400

    update_data = {}

    if 'title' in data:
        title = sanitize_input(data.get('title', '').strip())
        if not title:
            return jsonify({'ok': False, 'error': 'Title cannot be empty'}), 400
        if len(title) > MAX_TITLE_LENGTH:
            return jsonify({'ok': False, 'error': f'Title cannot exceed {MAX_TITLE_LENGTH} characters'}), 400
        update_data['title'] = title

    if 'start_dt' in data:
        s_dt = str(data['start_dt']).strip()
        if not ISO_DATETIME_REGEX.match(s_dt):
            return jsonify({'ok': False, 'error': 'Invalid start datetime format'}), 400
        update_data['start_dt'] = s_dt

    if 'end_dt' in data:
        e_dt = str(data['end_dt']).strip()
        if not ISO_DATETIME_REGEX.match(e_dt):
            return jsonify({'ok': False, 'error': 'Invalid end datetime format'}), 400
        update_data['end_dt'] = e_dt

    if 'start_dt' in update_data and 'end_dt' in update_data:
        if update_data['start_dt'] > update_data['end_dt']:
            return jsonify({'ok': False, 'error': 'End time cannot be earlier than start time'}), 400

    if 'all_day' in data:
        update_data['all_day'] = 1 if data['all_day'] in (1, '1', True, 'true') else 0

    if 'category' in data:
        cat = sanitize_input(str(data['category']).strip().lower())
        if cat in ALLOWED_CATEGORIES:
            update_data['category'] = cat

    if 'color' in data:
        color = str(data['color']).strip()
        if HEX_COLOR_REGEX.match(color):
            update_data['color'] = color

    if 'description' in data:
        update_data['description'] = _sanitize_multiline(data.get('description', ''), MAX_DESC_LENGTH)

    if 'location' in data:
        update_data['location'] = sanitize_input(str(data.get('location', '')).strip())[:MAX_LOCATION_LENGTH]

    if 'attendees' in data:
        update_data['attendees'] = sanitize_input(str(data.get('attendees', '')).strip())[:MAX_ATTENDEES_LENGTH]

    if 'recurrence' in data:
        update_data['recurrence'] = sanitize_input(str(data.get('recurrence', '')).strip())[:64]

    if 'reminder_min' in data:
        rem_raw = data.get('reminder_min')
        if rem_raw in (None, '', 'none'):
            update_data['reminder_min'] = None
        else:
            try:
                rem_val = int(rem_raw)
                if rem_val in ALLOWED_REMINDER_MINUTES:
                    update_data['reminder_min'] = rem_val
            except (ValueError, TypeError):
                pass

    ok, res = db_update_calendar_event(user['email'], clean_id, update_data)
    if not ok:
        return jsonify({'ok': False, 'error': res}), 400

    return jsonify({'ok': True, 'event': res})


def api_delete_event(event_id: str):
    """POST /calendar/api/events/delete/<event_id>"""
    user, err = _require_auth()
    if err:
        return err

    clean_id = (event_id or '').strip()
    if not EVENT_ID_REGEX.match(clean_id):
        return jsonify({'ok': False, 'error': 'Invalid event ID format'}), 400

    ok, res = db_delete_calendar_event(user['email'], clean_id)
    if not ok:
        return jsonify({'ok': False, 'error': res or 'Event not found'}), 404

    return jsonify({'ok': True, 'message': 'Event deleted successfully'})


def api_search_attendees():
    """GET /calendar/api/attendees/search?q=..."""
    user, err = _require_auth()
    if err:
        return err

    q = sanitize_input(request.args.get('q', '').strip())
    if not q:
        return jsonify({'ok': True, 'users': []})
    if len(q) > 100:
        return jsonify({'ok': False, 'error': 'Query too long'}), 400

    users = db_search_users_for_contact(q, user['email'], limit=10)
    # Format contacts for quick attendee tagging
    attendees = [{
        'id': u['id'],
        'name': u['name'],
        'email': u['email'],
        'username': u['username'],
        'avatar': u.get('avatar')
    } for u in users]
    return jsonify({'ok': True, 'users': attendees})
