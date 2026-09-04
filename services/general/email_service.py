"""
services/general/email_service.py
Email sending service wrapping email configuration and OTP letter rendering.
"""
from config.email_config import get_credentials, send_email, get_is_configured, get_smtp_status
from emails.otp import generate_email_letter


def has_email_credentials() -> bool:
    user, pass_ = get_credentials()
    return bool(user and pass_)


def send_otp_email(email: str, otp_code: str, purpose: str = 'login'):
    """Generate email letter and send OTP code to recipient."""
    html_letter = generate_email_letter(otp_code, purpose, email)
    text_letter = (
        f"Your AuthGuard verification code is: {otp_code}\n\n"
        f"This code will expire in 5 minutes. If you did not request this, please ignore this email."
    )
    return send_email(
        to_email=email,
        subject=f"Your verification code is {otp_code}",
        html_content=html_letter,
        text_content=text_letter
    )
