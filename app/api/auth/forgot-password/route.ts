import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-123456';
function ensureJwtSecret() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-123456')) {
    throw new Error('JWT_SECRET must be set in production');
  }
}

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: Request) {
  try {
    ensureJwtSecret();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    // Check if user exists
    const users = await query({
      query: 'SELECT id, email, full_name FROM users WHERE email = ?',
      values: [email]
    });

    const user = (users as any[])[0];

    // Generic success message to prevent email enumeration attacks
    const successResponse = NextResponse.json({ 
      message: 'If that email address exists in our database, we have sent a password reset link to it.' 
    });

    if (!user) {
      // Return success anyway, but do nothing
      return successResponse;
    }

    // Create stateless reset token valid for 1 hour
    const resetToken = jwt.sign(
      { email: user.email, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Provide the reset link
    const resetLink = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // For local development, log the link to the terminal
    console.log('\n========================================================');
    console.log('PASSWORD RESET REQUESTED FOR:', user.email);
    console.log('RESET LINK:', resetLink);
    console.log('========================================================\n');

    // Set up the email data
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"MUBS M&E System" <noreply@yourdomain.com>',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #005696; margin: 0;">MUBS Monitoring & Evaluation System</h2>
            </div>
            <p style="color: #333333; font-size: 16px; line-height: 1.6;">Hello ${user.full_name},</p>
            <p style="color: #333333; font-size: 16px; line-height: 1.6;">We received a request to reset the password associated with this email address. If you made this request, please click the button below to securely set a new password. This link is valid for 1 hour.</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetLink}" style="background-color: #005696; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666666; font-size: 14px; line-height: 1.6;">If you did not request a password reset, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0 20px;" />
            <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
              &copy; ${new Date().getFullYear()} Makerere University Business School.<br/>
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${resetLink}" style="color: #005696;">${resetLink}</a>
            </p>
          </div>
        </div>
      `,
    };

    // Attempt to send the email
    try {
      await transporter.sendMail(mailOptions);
      console.log('Password reset email successfully mapped and sent to Mail Server');
    } catch (mailError) {
      console.error('Failed delivering email through SMTP:', mailError);
      // Even if it fails we don't expose SMTP issues to the frontend client to prevent enumeration
    }

    return successResponse;

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
