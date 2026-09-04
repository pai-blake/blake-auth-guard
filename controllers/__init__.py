"""
controllers/__init__.py
Controllers Layer Aggregator
Roles: general, auth, home, calculator, template
"""
import controllers.general as general
import controllers.auth as auth
import controllers.home as home
import controllers.calculator as calculator
import controllers.template as template
import controllers.contact as contact

__all__ = ['general', 'auth', 'home', 'calculator', 'template', 'contact']

