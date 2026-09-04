"""
services/auth/password_service.py
Password hashing, verification and password update logic.

Password policy (enforced here for both signup reset and profile update):
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 digit
"""
import re
from config.db import db_update_user_password, hash_password, verify_password


def _check_password_strength(password: str) -> tuple[bool, str]:
    """Return (ok, error_message). ok=True means the password passes policy."""
    if len(password) < 8:
        return False, 'Password must be at least 8 characters long.'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain at least one uppercase letter.'
    if not re.search(r'[a-z]', password):
        return False, 'Password must contain at least one lowercase letter.'
    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number.'
    return True, ''


def validate_and_update_password(email: str, new_password: str):
    if not email or not new_password:
        return {'success': False, 'error': 'Email and new password are required.', 'status_code': 400}

    ok, err = _check_password_strength(new_password)
    if not ok:
        return {'success': False, 'error': err, 'status_code': 400}

    new_hash = hash_password(new_password)
    updated = db_update_user_password(email, new_hash)

    if updated:
        return {'success': True, 'message': 'Password updated successfully!', 'status_code': 200}
    return {'success': False, 'error': 'Account not found.', 'status_code': 404}


# Expose for use in signup flow
check_password_strength = _check_password_strength
