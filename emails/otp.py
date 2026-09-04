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
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #4338ca; letter-spacing: -0.01em;">AuthGuard Security</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; font-weight: 600; color: #64748b; background-color: #f1f5f9; padding: 4px 10px; border-radius: 20px;">Verification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 12px; line-height: 1.3;">{title}</h1>
              <p style="font-size: 14px; color: #475569; margin: 0 0 20px; line-height: 1.5;">
                {message}
              </p>
              
              <!-- OTP Code Display -->
              <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #1e1b4b; display: inline-block;">
                  {otp_code}
                </span>
              </div>

              <!-- Security Information -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; background-color: #f8fafc; border-radius: 6px; padding: 12px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.5;">
                    <strong style="color: #334155;">Security Notice:</strong> This code expires in <strong>5 minutes</strong>. Never share this code with anyone. AuthGuard will never ask for your code via phone or chat.
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0; line-height: 1.5;">
                Requested for: <span style="color: #475569;">{recipient_email}</span>. If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Transactional Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
              This is an automated security transmission from AuthGuard.<br>
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
