export const getEmailVerificationTemplate = (name: string, verificationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
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
    <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
    
    <a href="${verificationUrl}" class="button">Verify Email</a>
    
    <p>Or copy and paste this link in your browser:</p>
    <p>${verificationUrl}</p>
    
    <p>This link will expire in 24 hours.</p>
    
    <div class="footer">
        <p>If you didn't create an account, please ignore this email.</p>
        <p>This is an automated message, please do not reply.</p>
    </div>
</body>
</html>
`;
