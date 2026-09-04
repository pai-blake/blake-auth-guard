"""
controllers/general/__init__.py
General controllers aggregation.
"""
from controllers.general.system_controller import (
    status,
    verify_session,
    routes_manifest,
)
from controllers.general.page_controller import (
    index,
    logout,
    confirm_delete,
)

__all__ = [
    'status',
    'verify_session',
    'routes_manifest',
    'index',
    'logout',
    'confirm_delete',
]
