import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    verifyToken(token);

    const body = await request.json();
    const { to, subject, reportTitle, format, fileBase64, fileName } = body as {
      to?: string;
      subject?: string;
      reportTitle?: string;
      format?: string;
      fileBase64?: string;
      fileName?: string;
    };

    if (!to || typeof to !== 'string' || !to.trim()) {
      return NextResponse.json({ message: 'Recipient email is required' }, { status: 400 });
    }
    if (!fileBase64 || !fileName) {
      return NextResponse.json({ message: 'Report file (base64) and file name are required' }, { status: 400 });
    }

    const ext = format === 'Excel' ? 'xlsx' : 'pdf';
    const safeName = (fileName || reportTitle || 'Report').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '') || 'report';
    const finalFileName = safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;

    const buffer = Buffer.from(fileBase64, 'base64');

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"MUBS SPS" <noreply@yourdomain.com>',
      to: to.trim(),
      subject: subject || `Report: ${reportTitle || finalFileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #005696; margin: 0;">Strategy Plan System</h2>
            </div>
            <p style="color: #333333; font-size: 16px; line-height: 1.6;">Please find the requested report attached.</p>
            <p style="color: #666666; font-size: 14px;"><strong>Report:</strong> ${reportTitle || finalFileName}</p>
            <p style="color: #666666; font-size: 14px;"><strong>Format:</strong> ${format === 'Excel' ? 'Excel' : 'PDF'}</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0 20px;" />
            <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
              &copy; ${new Date().getFullYear()} Makerere University Business School.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: finalFileName,
          content: buffer,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: 'Report sent by email successfully' });
  } catch (error) {
    console.error('Error sending report email:', error);
    return NextResponse.json(
      { message: 'Failed to send email. Check server configuration (SMTP).' },
      { status: 500 }
    );
  }
}
