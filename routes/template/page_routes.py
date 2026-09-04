"""
routes/template/page_routes.py
Template page routes.
"""
from flask import Blueprint
from controllers.template import page_controller


def register_template_page_routes(bp: Blueprint):
    bp.add_url_rule(
        '/template',
        endpoint='template_page',
        view_func=page_controller.template_page,
        methods=['GET'],
    )
