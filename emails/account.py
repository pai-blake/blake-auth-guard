"""
emails/account.py
Account-related email templates (account deletion confirmation, security alerts).
"""

def generate_delete_confirmation_email(email: str, confirmation_link: str) -> str:
    """Generate HTML email for account permanent deletion request"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Account Deletion</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2d3748; line-height: 1.6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f5f7; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 28px 30px 20px; border-bottom: 1px solid #edf2f7;">
              <span style="font-size: 18px; font-weight: 700; color: #ef4444;">AuthGuard Security</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #1a202c; margin: 0 0 12px;">Confirm Account Deletion</h1>
              <p style="font-size: 15px; color: #4a5568; margin: 0 0 20px;">
                We received a request to permanently delete your AuthGuard account associated with <strong>{email}</strong>.
              </p>
              <p style="font-size: 14px; color: #e53e3e; background: #fff5f5; border: 1px solid #fed7d7; padding: 12px; border-radius: 6px; margin: 0 0 24px;">
                ⚠️ This action is permanent and cannot be undone. All your profile data, settings, and workspace access will be removed.
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="{confirmation_link}" style="background: #ef4444; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  Confirm Permanent Deletion
                </a>
              </div>
              <p style="font-size: 13px; color: #718096; margin: 24px 0 0;">
                This link expires in <strong>15 minutes</strong>. If you did not request this, please ignore this email and your account will remain safe.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
