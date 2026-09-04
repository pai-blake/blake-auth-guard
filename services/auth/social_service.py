"""
services/auth/social_service.py
OAuth provider configuration and social authentication verification.
"""
import os
import re
import time
import requests

from config.db import db_create_user, db_get_user
from services.general.helper_service import (
    generate_session_token,
    sanitize_input,
    start_server_session,
)

# ── Discord / OAuth redirect URI whitelist ─────────────────────────────────────
# Derived from the PORT env var; extend this list if you have additional
# allowed origins (e.g. staging / production domains).
def _get_allowed_origins() -> list[str]:
    port = os.getenv('PORT', '3000')
    base = [
        f'http://localhost:{port}/',
        f'http://127.0.0.1:{port}/',
        'http://localhost:3000/',
        'http://127.0.0.1:3000/',
    ]
    extra = os.getenv('ALLOWED_ORIGINS', '')
    if extra:
        for o in extra.split(','):
            o = o.strip().rstrip('/') + '/'
            if o not in base:
                base.append(o)
    return base


def _sanitize_redirect_uri(candidate: str) -> str:
    """Return the redirect URI only if it matches the whitelist, else use localhost default."""
    allowed = _get_allowed_origins()
    if not candidate:
        return allowed[0]
    # Normalise: add trailing slash
    norm = candidate.rstrip('/') + '/'
    if norm in allowed:
        return norm
    # Fall back to default
    return allowed[0]


def get_oauth_config(provider: str) -> dict:
    provider = provider.lower()
    if provider == 'discord':
        from dotenv import load_dotenv
        load_dotenv(override=True)
        client_id = os.getenv('DISCORD_CLIENT_ID', '').strip()
    elif provider == 'github':
        client_id = os.getenv('GITHUB_CLIENT_ID', '').strip()
    else:
        client_id = os.getenv('GOOGLE_CLIENT_ID', '').strip()

    return {
        'clientId': client_id,
        'hasClientId': bool(client_id)
    }


def verify_social_token(provider: str, data: dict, request_headers: dict = None, request_path: str = ''):
    request_headers = request_headers or {}
    provider = sanitize_input(provider or data.get('provider', 'google')).lower() or 'google'
    credential = data.get('credential') or data.get('idToken') or data.get('token') or data.get('code')
    email = sanitize_input(data.get('email', '')).lower()
    name = sanitize_input(data.get('name', ''))

    path_provider = request_path.split('/')[-1].lower() if request_path else ''
    if path_provider in ['google', 'github', 'discord']:
        provider = path_provider

    # ── 1. Discord ─────────────────────────────────────────────────────────────
    if provider == 'discord':
        code = data.get('code')
        origin = request_headers.get('Origin') or (request_headers.get('Referer', '').split('#')[0].rstrip('/'))
        if origin and not origin.endswith('/'):
            origin += '/'
        # Whitelist the redirect URI — never trust raw client-supplied values
        raw_redirect = data.get('redirectUri') or origin or ''
        redirect_uri = _sanitize_redirect_uri(raw_redirect)

        discord_token = data.get('accessToken') or data.get('access_token')
        client_id = os.getenv('DISCORD_CLIENT_ID', '').strip()
        client_secret = os.getenv('DISCORD_CLIENT_SECRET', '').strip()

        if code and client_id and client_secret:
            try:
                token_res = requests.post(
                    'https://discord.com/api/v10/oauth2/token',
                    data={
                        'client_id': client_id,
                        'client_secret': client_secret,
                        'grant_type': 'authorization_code',
                        'code': code,
                        'redirect_uri': redirect_uri
                    },
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    timeout=5
                )
                if token_res.status_code == 200:
                    discord_token = token_res.json().get('access_token')
            except Exception as err:
                print(f"[Discord Token Exchange Exception] {err}")

        if discord_token and isinstance(discord_token, str) and len(discord_token) > 5:
            try:
                dc_res = requests.get(
                    'https://discord.com/api/v10/users/@me',
                    headers={'Authorization': f'Bearer {discord_token}'},
                    timeout=5
                )
                if dc_res.status_code == 200:
                    dc_info = dc_res.json()
                    name = sanitize_input(dc_info.get('global_name') or dc_info.get('username') or name)
                    dc_email = dc_info.get('email')
                    if dc_email:
                        email = dc_email.lower()
                    elif dc_info.get('username'):
                        email = f"{dc_info['username'].lower()}@discord.com"
                    elif dc_info.get('id'):
                        email = f"user_{dc_info['id']}@discord.com"
            except Exception as err:
                print(f"[Discord UserInfo Error] {err}")

    # ── 2. GitHub ──────────────────────────────────────────────────────────────
    if provider == 'github':
        code = data.get('code')
        github_token = data.get('accessToken') or data.get('access_token') or credential
        client_id = os.getenv('GITHUB_CLIENT_ID', '')
        client_secret = os.getenv('GITHUB_CLIENT_SECRET', '')

        if code and client_id and client_secret:
            try:
                token_res = requests.post(
                    'https://github.com/login/oauth/access_token',
                    json={'client_id': client_id, 'client_secret': client_secret, 'code': code},
                    headers={'Accept': 'application/json'},
                    timeout=5
                )
                if token_res.status_code == 200:
                    github_token = token_res.json().get('access_token', github_token)
            except Exception as err:
                print(f"[GitHub Code Exchange Error] {err}")

        if github_token and isinstance(github_token, str) and len(github_token) > 5:
            try:
                gh_user_res = requests.get(
                    'https://api.github.com/user',
                    headers={'Authorization': f'Bearer {github_token}', 'User-Agent': 'AuthGuard-App'},
                    timeout=5
                )
                if gh_user_res.status_code == 200:
                    gh_info = gh_user_res.json()
                    name = sanitize_input(gh_info.get('name') or gh_info.get('login') or name)
                    gh_email = gh_info.get('email')
                    if gh_email:
                        email = gh_email.lower()
                    else:
                        emails_res = requests.get(
                            'https://api.github.com/user/emails',
                            headers={'Authorization': f'Bearer {github_token}', 'User-Agent': 'AuthGuard-App'},
                            timeout=5
                        )
                        if emails_res.status_code == 200:
                            emails_list = emails_res.json()
                            primary = next((e['email'] for e in emails_list if e.get('primary')), None)
                            if primary:
                                email = primary.lower()
            except Exception as err:
                print(f"[GitHub UserInfo Error] {err}")

    # ── 3. Google ──────────────────────────────────────────────────────────────
    access_token = data.get('accessToken') or data.get('access_token')
    if access_token and isinstance(access_token, str):
        try:
            google_userinfo = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=5
            )
            if google_userinfo.status_code == 200:
                info = google_userinfo.json()
                email = info.get('email', email).lower()
                name = sanitize_input(info.get('name', name) or email.split('@')[0].title())
        except Exception as err:
            print(f"[Google UserInfo Error] {err}")

    if credential and isinstance(credential, str) and len(credential) > 20 and not email:
        try:
            google_res = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
                timeout=5
            )
            if google_res.status_code == 200:
                google_info = google_res.json()
                email = google_info.get('email', email).lower()
                name = sanitize_input(
                    google_info.get('name', name) or
                    (email.split('@')[0].capitalize() if email else 'Google User')
                )
            else:
                # SECURITY: Do NOT fall back to decoding the JWT without verification.
                # If Google's tokeninfo API rejects the token, we reject authentication.
                print(f"[Google Token Rejected] tokeninfo returned {google_res.status_code}")
        except Exception as err:
            print(f"[Google Verification Error] {err}")

    if not name and email:
        name = email.split('@')[0].replace('.', ' ').replace('_', ' ').title()

    if not email:
        return {
            'success': False,
            'error': 'Social authentication requires a valid email address.',
            'status_code': 400
        }

    # Basic email format sanity check
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        return {
            'success': False,
            'error': 'Social authentication returned an invalid email address.',
            'status_code': 400
        }

    user = db_get_user(email)
    if not user:
        user_id = f"usr_{provider}_{int(time.time()*1000)}"
        db_create_user(
            user_id=user_id,
            name=name,
            email=email,
            password_hash=None,
            verified=True
        )
        user = {
            'id': user_id,
            'name': name,
            'email': email
        }

    token = generate_session_token(user)
    start_server_session(user)

    return {
        'success': True,
        'message': f"{provider.capitalize()} authentication successful!",
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
        },
        'token': token,
        'status_code': 200,
    }
