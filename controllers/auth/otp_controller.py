"""
controllers/auth/otp_controller.py
OTP endpoint handlers for dispatching and verifying OTP codes.
"""
from flask import jsonify, request
from services.auth.otp_service import dispatch_otp, verify_otp_code


def _get_client_ip() -> str:
    """Extract the real client IP from the request.

    Reads only the FIRST (leftmost) address in X-Forwarded-For — subsequent
    addresses are appended by intermediate proxies and CAN be spoofed by the
    client. If the header is absent, fall back to remote_addr.
    """
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def send_otp():
    data = request.get_json(silent=True) or {}
    raw_email = data.get('email', '')
    purpose = data.get('purpose', 'login')
    pending_data = data.get('pendingData', {})

    client_ip = _get_client_ip()
    result = dispatch_otp(raw_email, purpose, pending_data, client_ip)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code


def verify_otp():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '')
    code = data.get('code', '')

    client_ip = _get_client_ip()
    result = verify_otp_code(email, code, client_ip)
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code
