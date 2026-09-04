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
    user = (os.getenv('EMAIL_USER') or '').strip()
    pass_ = (os.getenv('EMAIL_PASS') or '').replace(' ', '')
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

    if smtp_secure or smtp_port == 465:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=15)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()

    server.login(user, pass_)
    return server

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
    user, pass_ = get_credentials()
    if not user or not pass_:
        _last_smtp_error = 'EMAIL_USER and EMAIL_PASS are required in .env.'
        raise ValueError(_last_smtp_error)

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'AuthGuard <{user}>'
    msg['To'] = to_email
    msg['Reply-To'] = user
    msg['X-Priority'] = '3'

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
