import nodemailer from 'nodemailer';

export function isSmtpConfigured(): boolean {
    return Boolean(String(process.env.EMAIL_HOST || '').trim() && String(process.env.EMAIL_USER || '').trim());
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
    if (!isSmtpConfigured()) return null;
    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return cachedTransporter;
}

export function defaultMailFrom(): string {
    return process.env.EMAIL_FROM || '"MUBS M&E System" <noreply@yourdomain.com>';
}

/** Escape text for HTML email bodies (user-supplied titles, names, etc.). */
export function escapeHtml(text: string): string {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function brandEmailWrapper(innerHtml: string): string {
    const year = new Date().getFullYear();
    return `
<div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #005696; margin: 0;">MUBS Monitoring &amp; Evaluation System</h2>
    </div>
    ${innerHtml}
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0 20px;" />
    <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
      &copy; ${year} Makerere University Business School.
    </p>
  </div>
</div>`.trim();
}

/**
 * Sends email via SMTP. Returns false if SMTP is not configured or send fails (errors are logged).
 */
export async function sendTransactionalMail(
    options: Omit<nodemailer.SendMailOptions, 'from'> & { from?: string }
): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[mail] SMTP not configured; skipping:', options.subject);
        return false;
    }
    try {
        await transport.sendMail({
            ...options,
            from: options.from ?? defaultMailFrom(),
        });
        return true;
    } catch (e) {
        console.error('[mail] send failed:', e);
        return false;
    }
}
