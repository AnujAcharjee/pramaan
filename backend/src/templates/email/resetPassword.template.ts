export const getPasswordResetEmailTemplate = (name: string, resetUrl: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
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
            padding: 10px 20px;
            background: #007bff;
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Hello ${name},</h1>
    <p>You requested to reset your password. Click the button below to reset it:</p>
    
    <a href="${resetUrl}" class="button">Reset Password</a>
    
    <p>Or copy and paste this link in your browser:</p>
    <p>${resetUrl}</p>
    
    <p>This link will expire in 1 hour.</p>
    
    <div class="footer">
        <p>If you didn't request this, please ignore this email.</p>
        <p>Your password will remain unchanged.</p>
    </div>
</body>
</html>
`;
