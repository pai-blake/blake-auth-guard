"""
services/__init__.py
Services Layer Aggregator
Roles: general, auth, home
"""
import services.general as general
import services.auth as auth
import services.home as home

__all__ = ['general', 'auth', 'home']
