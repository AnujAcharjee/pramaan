export const getSignInVerificationTemplate = (name: string, verificationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Sign-In</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #0d6efd;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 24px 0;
      font-weight: 600;
    }
    .footer {
      margin-top: 32px;
      font-size: 0.9em;
      color: #666;
    }
    .notice {
      background: #f8f9fa;
      padding: 12px;
      border-left: 4px solid #0d6efd;
      margin: 20px 0;
      font-size: 0.95em;
    }
  </style>
</head>
<body>
  <h1>Hello ${name},</h1>

  <p>
    We received a request to sign in to your account.  
    Please confirm this sign-in by clicking the button below:
  </p>

  <a href="${verificationUrl}" class="button">Verify Sign-In</a>

  <p>If the button doesn't work, copy and paste this link into your browser:</p>
  <p>${verificationUrl}</p>

  <div class="notice">
    <strong>Security notice:</strong> This link will expire in 15 minutes and can only be used once.
  </div>

  <div class="footer">
    <p>
      If you did not attempt to sign in, you can safely ignore this email.  
      Your account will remain secure.
    </p>
    <p>This is an automated message. Please do not reply.</p>
  </div>
</body>
</html>
`;
