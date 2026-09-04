"""
config/email_config.py
Handles SMTP email client initialization, credential loading, and email delivery.
"""
import os
import ssl
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / '.env'
load_dotenv(dotenv_path=ENV_PATH, override=True)

_is_configured = False
_last_smtp_error = None
_lock = threading.Lock()

def get_credentials():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    user = (os.getenv('EMAIL_USER') or '').strip().strip('\'"')
    pass_ = (os.getenv('EMAIL_PASS') or '').replace(' ', '').strip('\'"')
    return user, pass_

def get_is_configured():
    global _is_configured
    return _is_configured

def get_smtp_status():
    """Delivery health for diagnostics: {'configured': bool, 'error': str|None}."""
    return {'configured': _is_configured, 'error': _last_smtp_error}

def _get_smtp_connection(user: str, pass_: str):
    smtp_host = (os.getenv('SMTP_HOST') or '').strip()
    smtp_port_str = (os.getenv('SMTP_PORT') or '').strip()
    smtp_secure = os.getenv('SMTP_SECURE', '').lower() == 'true'

    if not smtp_host:
        # Default to Gmail
        smtp_host = 'smtp.gmail.com'
        smtp_port = 465
        smtp_secure = True
    else:
        smtp_port = int(smtp_port_str) if smtp_port_str.isdigit() else 587

    context = ssl.create_default_context()

    def _connect_ssl(host, port):
        """Try SMTP_SSL (port 465)."""
        server = smtplib.SMTP_SSL(host, port, context=context, timeout=15)
        server.login(user, pass_)
        return server

    def _connect_starttls(host, port):
        """Try SMTP + STARTTLS (port 587)."""
        server = smtplib.SMTP(host, port, timeout=15)
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(user, pass_)
        return server

    if smtp_secure or smtp_port == 465:
        try:
            return _connect_ssl(smtp_host, smtp_port)
        except (OSError, ConnectionRefusedError, TimeoutError) as primary_err:
            # Port 465 blocked (common on Vercel/serverless) — try 587 with STARTTLS
            print(f'[Email] Port 465 failed ({primary_err}), trying port 587 with STARTTLS...')
            try:
                return _connect_starttls(smtp_host, 587)
            except Exception as fallback_err:
                raise ConnectionError(
                    f'SMTP connection failed on both port 465 ({primary_err}) '
                    f'and port 587 ({fallback_err}). '
                    f'If deploying on Vercel, SMTP may be blocked — '
                    f'consider using a transactional email API (Resend, SendGrid) instead.'
                ) from fallback_err
    else:
        return _connect_starttls(smtp_host, smtp_port)


def init_transporter():
    global _is_configured

    def _verify():
        global _is_configured
        user, pass_ = get_credentials()
        if not user or not pass_:
            print('⚠️ [Email Config] EMAIL_USER and EMAIL_PASS not set in .env')
            _is_configured = False
            return

        try:
            server = _get_smtp_connection(user, pass_)
            server.quit()
            _is_configured = True
            print('\n====================================================')
            print(f'[Email] Sender Connected: {user}')
            print('[Email] Real emails will now be sent to any inbox!')
            print('====================================================\n')
        except Exception as e:
            global _last_smtp_error
            _is_configured = False
            _last_smtp_error = str(e)
            print(f'[Email Error] SMTP authentication failed: {e}')

    # Run verification in background thread so startup isn't blocked
    thread = threading.Thread(target=_verify, daemon=True)
    thread.start()

def send_email(to_email: str, subject: str, html_content: str, text_content: str = '') -> bool:
    global _last_smtp_error
    from email.utils import formatdate, make_msgid

    user, pass_ = get_credentials()
    if not user or not pass_:
        _last_smtp_error = 'EMAIL_USER and EMAIL_PASS are required in .env.'
        raise ValueError(_last_smtp_error)

    # Extract sender domain for Message-ID alignment (e.g. gmail.com)
    domain = user.split('@')[-1] if '@' in user else 'gmail.com'

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'AuthGuard Security <{user}>'
    msg['To'] = to_email
    msg['Reply-To'] = user
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain=domain)
    msg['MIME-Version'] = '1.0'
    msg['Auto-Submitted'] = 'auto-generated'
    msg['X-Auto-Response-Suppress'] = 'All'

    # Plain-text version MUST come first in multipart/alternative
    if text_content:
        msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
    if html_content:
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    with _lock:
        try:
            server = _get_smtp_connection(user, pass_)
            try:
                server.sendmail(user, [to_email], msg.as_string())
            finally:
                server.quit()
            _last_smtp_error = None
            return True
        except Exception as smtp_error:
            _last_smtp_error = str(smtp_error)
            raise
