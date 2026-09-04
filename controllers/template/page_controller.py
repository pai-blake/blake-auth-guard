"""
controllers/template/page_controller.py
Page controller for template views (rendering shell templates).
"""
from flask import render_template
from services.home.home_service import get_current_user
from services.general.permission_service import permission_required, get_user_permissions


@permission_required('template')
def template_page():
    """Render the unified template shell."""
    user = get_current_user()
    permissions = get_user_permissions()
    return render_template(
        'template/shell.html',
        active_view='template',
        server_route='/template',
        server_user=user,
        user_session=user is not None,
        user_permissions=permissions,
    )
