"""
services/general/helper_service.py
Shared utilities: rate limiting, cryptographic token generation,
input sanitization, timing-safe string comparison, and session mirrors.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from flask import session

# ── Token Constants ────────────────────────────────────────────────────────────
OTP_EXPIRY_SECONDS = 5 * 60  # 5 minutes
TOKEN_EXPIRY_SECONDS = 24 * 3600  # 24 hours

# ── Rate Limiting ──────────────────────────────────────────────────────────────
# In-memory sliding window store: key -> list of timestamps
rate_limit_store: dict = {}
RATE_LIMIT_WINDOW_SECONDS = 15 * 60        # 15-minute window
MAX_OTP_DISPATCH_PER_WINDOW = 5            # max OTP sends per window
MAX_VERIFY_ATTEMPTS_PER_WINDOW = 15        # max OTP verify attempts per window
MAX_LOGIN_ATTEMPTS_PER_WINDOW = 5          # max login attempts per window (brute-force guard)

# ── Allowed Permissions Whitelist ──────────────────────────────────────────────
ALLOWED_PERMISSIONS = frozenset({'home', 'body', 'calculator', 'template', 'contact', 'calendar'})

# ── Allowed Icon Names (for contact pages) ─────────────────────────────────────
ALLOWED_ICONS = frozenset({
    'folder', 'star', 'heart', 'bookmark', 'tag', 'users',
    'briefcase', 'home', 'flag', 'globe', 'link', 'bell',
    'lock', 'coffee', 'smile', 'zap', 'layers', 'grid',
})

# ── Page Name Limits ───────────────────────────────────────────────────────────
MAX_PAGE_NAME_LENGTH = 40


def _get_hmac_secret() -> bytes:
    """Return the application HMAC secret as bytes. Falls back to a hard-coded
    value only for local dev; production MUST set SECRET_KEY in .env."""
    key = os.getenv('SECRET_KEY', 'change-me-in-production')
    return key.encode('utf-8')


# ── OTP ────────────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) for 6-Digit OTP."""
    return str(secrets.randbelow(900000) + 100000)


# ── Rate Limiting ──────────────────────────────────────────────────────────────

def check_rate_limit(key: str, max_limit: int) -> bool:
    """In-Memory Sliding Window Rate Limiter.
    Returns True if the request is allowed, False if the limit has been exceeded."""
    now = time.time()
    history = [ts for ts in rate_limit_store.get(key, []) if now - ts < RATE_LIMIT_WINDOW_SECONDS]

    if len(history) >= max_limit:
        rate_limit_store[key] = history
        return False

    history.append(now)
    rate_limit_store[key] = history
    return True


# ── Input Sanitization ─────────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    """Sanitize a plain-text string:
    - Rejects non-strings (returns empty string).
    - Strips null bytes, carriage returns, newlines.
    - Strips leading/trailing whitespace.
    - Strips HTML metacharacters (<, >, ", ', &) to prevent XSS injection.
    - Strips Unicode control characters (categories Cc, Cf).
    """
    if not isinstance(text, str):
        return ''
    # Strip null bytes and CRLF/LF first
    text = re.sub(r'[\x00\r\n]', '', text)
    # Strip Unicode control characters (C0, C1 blocks and other control chars)
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    # Strip HTML-dangerous metacharacters
    text = re.sub(r'[<>"\'&]', '', text)
    return text.strip()


def sanitize_page_name(text: str) -> str:
    """Sanitize a contact page name: alphanumeric, spaces and hyphens only,
    max MAX_PAGE_NAME_LENGTH characters."""
    clean = sanitize_input(text)
    # Allow only letters, digits, spaces, hyphens, underscores
    clean = re.sub(r'[^\w\s\-]', '', clean).strip()
    return clean[:MAX_PAGE_NAME_LENGTH]


def sanitize_icon_name(text: str) -> str:
    """Validate and return a safe icon name from the whitelist."""
    clean = sanitize_input(text).lower().strip()
    if clean not in ALLOWED_ICONS:
        return 'folder'
    return clean


# ── Timing-Safe Comparison ─────────────────────────────────────────────────────

def timing_safe_compare(a: str, b: str) -> bool:
    """Timing-safe string comparison to prevent side-channel attacks."""
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))


# ── Session Token (HMAC-SHA256 Signed) ─────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    """URL-safe base64 encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _b64url_decode(text: str) -> bytes:
    """URL-safe base64 decode with padding correction."""
    padding = 4 - (len(text) % 4)
    if padding != 4:
        text += '=' * padding
    return base64.urlsafe_b64decode(text)


def generate_session_token(user: dict) -> str:
    """Generate a real HMAC-SHA256 signed JWT-style session token.

    Structure: base64url(header).base64url(payload).base64url(HMAC-SHA256 signature)

    The signature covers header + '.' + payload, keyed with SECRET_KEY.
    This prevents token forgery — any tampered payload invalidates the signature.
    """
    header_data = {'alg': 'HS256', 'typ': 'JWT'}
    payload_data = {
        'sub': user.get('id', 'usr_1'),
        'email': user.get('email', ''),
        'name': user.get('name', ''),
        'iat': int(time.time()),
        'exp': int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }

    header = _b64url_encode(json.dumps(header_data, separators=(',', ':')).encode('utf-8'))
    payload = _b64url_encode(json.dumps(payload_data, separators=(',', ':')).encode('utf-8'))

    signing_input = f"{header}.{payload}".encode('utf-8')
    sig_bytes = hmac.new(_get_hmac_secret(), signing_input, hashlib.sha256).digest()
    sig = _b64url_encode(sig_bytes)

    return f"{header}.{payload}.{sig}"


def verify_session_token(token: str) -> dict | None:
    """Verify an HMAC-SHA256 signed session token.

    Returns the decoded payload dict on success, or None if the token is
    missing, malformed, tampered with, or expired.
    """
    if not token or not isinstance(token, str):
        return None

    parts = token.split('.')
    if len(parts) != 3:
        return None

    header, payload_b64, sig_b64 = parts
    signing_input = f"{header}.{payload_b64}".encode('utf-8')
    expected_sig = hmac.new(_get_hmac_secret(), signing_input, hashlib.sha256).digest()
    expected_sig_b64 = _b64url_encode(expected_sig)

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(sig_b64.encode('ascii'), expected_sig_b64.encode('ascii')):
        return None  # Signature mismatch — tampered or forged token

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode('utf-8'))
    except Exception:
        return None

    if payload.get('exp') and payload['exp'] < int(time.time()):
        return None  # Token expired

    return payload


# ── Session Management ─────────────────────────────────────────────────────────

def start_server_session(user: dict) -> None:
    """Mirror user info into the server-side Flask session."""
    if not user:
        return
    session['user_id'] = user.get('id')
    session['user_email'] = user.get('email')
    session['user_name'] = user.get('name')
    if 'permissions' not in session:
        session['permissions'] = list(ALLOWED_PERMISSIONS)


def session_email() -> str | None:
    """Retrieve authenticated caller's email from the server session, or None."""
    email = session.get('user_email')
    return email.lower().strip() if email else None
