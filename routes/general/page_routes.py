"""
routes/general/page_routes.py
General web page routes: root redirect, logout, and account deletion confirmation.
"""
from flask import Blueprint
from controllers.general import page_controller


def register_general_page_routes(bp: Blueprint):
    bp.add_url_rule('/', view_func=page_controller.index, methods=['GET'])
    bp.add_url_rule('/logout', view_func=page_controller.logout, methods=['GET', 'POST'])
    bp.add_url_rule('/confirm-delete', view_func=page_controller.confirm_delete, methods=['GET', 'POST'])
