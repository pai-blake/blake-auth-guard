"""
routes/calculator/page_routes.py
Calculator page routes: /calculator (primary), /calculator/basic, /calculator/scientific, and /calculator/advanced.
"""
from flask import Blueprint
from controllers.calculator import page_controller


def register_calculator_page_routes(bp: Blueprint):
    bp.add_url_rule('/calculator', endpoint='calculator_page', view_func=page_controller.calculator_page, methods=['GET'])
    bp.add_url_rule('/calculator/basic', endpoint='calculator_basic_page', view_func=page_controller.calculator_page, methods=['GET'])
    bp.add_url_rule('/calculator/scientific', endpoint='calculator_scientific_page', view_func=page_controller.scientific_page, methods=['GET'])
    bp.add_url_rule('/calculator/advanced', endpoint='calculator_advanced_page', view_func=page_controller.advanced_page, methods=['GET'])
