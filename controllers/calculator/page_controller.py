"""
controllers/calculator/page_controller.py
Page controllers for calculator views (rendering shell templates).
"""
from flask import render_template
from services.home.home_service import get_current_user
from services.general.permission_service import permission_required, get_user_permissions

CALCULATOR_VIEWS = {
    'basic':      {'route': '/calculator',            'mode': 'mode-basic'},
    'scientific': {'route': '/calculator/scientific', 'mode': 'mode-scientific'},
    'advanced':   {'route': '/calculator/advanced',   'mode': 'mode-advanced'},
}


def render_shell(active_view: str = 'basic'):
    """Render the unified calculator shell with the given server-decided entry view."""
    config = CALCULATOR_VIEWS.get(active_view, CALCULATOR_VIEWS['basic'])
    user = get_current_user()
    permissions = get_user_permissions()
    return render_template(
        'calculator/shell.html',
        active_view=active_view,
        card_mode=config['mode'],
        server_route=config['route'],
        server_user=user,
        user_session=user is not None,
        user_permissions=permissions,
    )


@permission_required('calculator')
def calculator_page():
    return render_shell('basic')


@permission_required('calculator')
def scientific_page():
    return render_shell('scientific')


@permission_required('calculator')
def advanced_page():
    return render_shell('advanced')
