"""
routes/general/api_routes.py
General API routes: status, session validation, and route catalog.
"""
from flask import Blueprint
from controllers.general import system_controller


def register_general_api_routes(bp: Blueprint):
    bp.add_url_rule('/status', view_func=system_controller.status, methods=['GET'])
    bp.add_url_rule('/session/verify', view_func=system_controller.verify_session, methods=['POST'])
    bp.add_url_rule('/routes', view_func=system_controller.routes_manifest, methods=['GET'])
    bp.add_url_rule('/permissions', view_func=system_controller.get_permissions, methods=['GET'])
    bp.add_url_rule('/permissions/grant', view_func=system_controller.grant_permission, methods=['POST'])
    bp.add_url_rule('/permissions/revoke', view_func=system_controller.revoke_permission, methods=['POST'])
