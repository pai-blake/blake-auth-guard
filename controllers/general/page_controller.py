"""
controllers/general/page_controller.py
Page request handlers for general routes: index redirect, logout, and account deletion confirmation.
"""
from flask import Response, redirect, request, session, url_for
from services.home.home_service import get_current_user, verify_and_delete_account
from config.db import db_peek_deletion_token, db_get_user

_PAGE_CSS = """body{font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;display:flex;
align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.1);
padding:2.2rem 2.4rem;max-width:460px;width:calc(100vw - 2rem);text-align:center;box-sizing:border-box}
h1{font-size:1.25rem;color:#0f172a;margin:0 0 .6rem}
p{color:#64748b;font-size:.9rem;line-height:1.6;margin:0 0 1.2rem}
.icon{font-size:2.2rem;margin-bottom:.6rem}
.email{color:#0f172a;font-weight:bold}
.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);color:#dc2626;
font-size:.82rem;font-weight:600;border-radius:10px;padding:.6rem .8rem;margin-bottom:1rem}
input[type=password]{width:100%;box-sizing:border-box;padding:.75rem .9rem;border-radius:10px;
border:1.5px solid #cbd5e1;font-size:.95rem;margin-bottom:1rem;outline:none}
input[type=password]:focus{border-color:#6366f1}
button{width:100%;padding:.85rem 1rem;border:none;border-radius:10px;cursor:pointer;
background:#ef4444;color:#fff;font-size:.95rem;font-weight:bold;font-family:inherit}
button:hover{background:#dc2626}
.note{font-size:.78rem;color:#94a3b8;margin-top:1rem}
a{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:.7rem 1.4rem;
border-radius:10px;text-decoration:none;font-weight:bold;font-size:.85rem;display:inline-block}"""


def _page(title, body_html, icon, status=200):
    return Response(
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{title} — AuthGuard</title><style>{_PAGE_CSS}</style></head><body>
        <div class="card"><div class="icon">{icon}</div>{body_html}</div></body></html>""",
        mimetype='text/html', status=status)


def index():
    if get_current_user():
        return redirect(url_for('router.home_page'))
    return redirect(url_for('router.auth_page'))


def logout():
    session.clear()
    return redirect(url_for('router.auth_page'))


def confirm_delete():
    token = request.args.get('token', '') or request.form.get('token', '')
    email = db_peek_deletion_token(token) if token else None

    if not email:
        return _page(
            'Link invalid',
            """<h1>Link invalid or expired</h1>
            <p>This deletion link is no longer valid — each link works once and
            expires after 15 minutes. Your account was <strong>not</strong> deleted.
            You can request a new confirmation email from User Settings.</p>""",
            '⚠️', status=400)

    user = db_get_user(email)
    if not user:
        return _page(
            'Already deleted',
            """<h1>Account already deleted</h1>
            <p>This account no longer exists — nothing more to do.</p>""",
            '🗑️', status=404)

    if request.method == 'POST':
        password = request.form.get('password', '')
        result = verify_and_delete_account(token, password)

        if not result['success']:
            if result.get('reason') == 'invalid_password':
                error_html = '<div class="error">Incorrect password. The account was not deleted.</div>'
                pw_field = '<input type="password" name="password" placeholder="Account password" required autofocus>'
                return _page(
                    'Delete your account',
                    f"""<h1>Delete your account</h1>
                    <p>Confirming deletion for <span class="email">{email}</span>.
                    Enter your account password to permanently delete it.</p>
                    {error_html}
                    <form method="post" action="/confirm-delete">
                      <input type="hidden" name="token" value="{token}">
                      {pw_field}
                      <button type="submit">Permanently Delete</button>
                    </form>
                    <div class="note">This cannot be undone.</div>""",
                    '🗑️', status=401)
            elif result.get('reason') == 'not_found':
                return _page(
                    'Already deleted',
                    """<h1>Account already deleted</h1>
                    <p>This account no longer exists — nothing more to do.</p>""",
                    '🗑️', status=404)
            else:
                return _page(
                    'Link invalid',
                    """<h1>Link invalid or expired</h1>
                    <p>This link was already used or has expired. The account was
                    <strong>not</strong> deleted by this attempt.</p>""",
                    '⚠️', status=400)

        return _page(
            'Account deleted',
            """<h1>Your account has been deleted</h1>
            <p>Your profile, username, photo and all content you sent have been
            permanently removed. We're sorry to see you go.</p>
            <a href="/">Return to AuthGuard</a>
            <script>try { localStorage.removeItem('authguard_current_session'); } catch (e) { }</script>""",
            '🗑️')

    has_password = bool(user.get('password_hash'))
    pw_field = '<input type="password" name="password" placeholder="Account password" required autofocus>' if has_password else ''
    note = '' if has_password else '<div class="note">This account has no password — press the button to confirm.</div>'

    return _page(
        'Delete your account',
        f"""<h1>Delete your account</h1>
        <p>Confirming deletion for <span class="email">{email}</span>.
        Enter your account password to permanently delete it.</p>
        <form method="post" action="/confirm-delete">
          <input type="hidden" name="token" value="{token}">
          {pw_field}
          <button type="submit">Permanently Delete</button>
        </form>
        {note}
        <div class="note">This cannot be undone.</div>""",
        '🗑️')
