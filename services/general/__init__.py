"""
services/general/__init__.py
General services aggregation.
"""
from services.general.helper_service import (
    OTP_EXPIRY_SECONDS,
    MAX_OTP_DISPATCH_PER_WINDOW,
    MAX_VERIFY_ATTEMPTS_PER_WINDOW,
    generate_otp,
    check_rate_limit,
    sanitize_input,
    timing_safe_compare,
    generate_session_token,
    start_server_session,
    session_email,
)
from services.general.email_service import (
    has_email_credentials,
    send_otp_email,
)
from services.general.system_service import (
    get_system_status,
    verify_client_session_token,
    get_route_manifest,
)
from services.general.permission_service import (
    get_user_permissions,
    has_permission,
    grant_permission,
    revoke_permission,
    permission_required,
)
