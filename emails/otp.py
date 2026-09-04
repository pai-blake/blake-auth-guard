"""
emails/otp.py
Generates clean responsive HTML and plain text email letters for OTP delivery.
"""

def generate_email_letter(otp_code: str, purpose: str, recipient_email: str) -> str:
    title = 'Your verification code'
    message = 'Here is your one-time verification code:'

    if purpose == 'signup':
        title = 'Verify your email address'
        message = 'Please use the following verification code to complete your registration:'
    elif purpose == 'login':
        title = 'Your login verification code'
        message = 'Use this code to verify your login request:'
    elif purpose == 'forgot':
        title = 'Password reset code'
        message = 'Use this code to reset your account password:'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f5f7; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 30px 20px; border-bottom: 1px solid #edf2f7; text-align: left;">
              <span style="font-size: 18px; font-weight: 700; color: #4f46e5; letter-spacing: -0.02em;">AuthGuard</span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #1a202c; margin: 0 0 12px;">{title}</h1>
              <p style="font-size: 15px; color: #4a5568; margin: 0 0 24px;">{message}</p>
              
              <!-- OTP Box -->
              <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 6px; padding: 18px; text-align: center; margin: 20px 0;">
                <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e1b4b; display: block;">
                  {otp_code}
                </span>
              </div>

              <p style="font-size: 13px; color: #718096; margin: 24px 0 0;">
                This code will expire in <strong>5 minutes</strong>. If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #edf2f7; text-align: center; font-size: 12px; color: #a0aec0;">
              &copy; AuthGuard Security Platform. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

# Backwards compatible alias
generate_otp_email = generate_email_letter
