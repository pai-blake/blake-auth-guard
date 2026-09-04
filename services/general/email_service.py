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
        f"AuthGuard Security Notification\n"
        f"================================\n\n"
        f"Your verification code is: {otp_code}\n\n"
        f"This one-time security code was requested for: {email}\n"
        f"This code will expire in 5 minutes.\n\n"
        f"If you did not request this verification code, please ignore this email or check your account security.\n\n"
        f"---\n"
        f"AuthGuard Security Platform • Automated Authentication System"
    )
    return send_email(
        to_email=email,
        subject=f"[{otp_code}] AuthGuard Security Verification Code",
        html_content=html_letter,
        text_content=text_letter
    )
