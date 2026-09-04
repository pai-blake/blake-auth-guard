"""
controllers/auth/social_controller.py
Social OAuth configuration and callback handlers.
"""
from flask import jsonify, request
from services.auth.social_service import get_oauth_config, verify_social_token


def get_google_config():
    return jsonify(get_oauth_config('google'))


def get_github_config():
    return jsonify(get_oauth_config('github'))


def get_discord_config():
    return jsonify(get_oauth_config('discord'))


def auth_social():
    data = request.get_json(silent=True) or {}
    provider = data.get('provider', '')
    result = verify_social_token(
        provider=provider,
        data=data,
        request_headers=dict(request.headers),
        request_path=request.path
    )
    status_code = result.pop('status_code', 200)
    return jsonify(result), status_code
