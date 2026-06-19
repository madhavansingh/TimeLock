import nodemailer from 'nodemailer';
import { config } from './env';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

if (config.smtpHost) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  logger.info(`Mail service configured: SMTP Host=${config.smtpHost}, Port=${config.smtpPort}`);
} else {
  logger.warn('SMTP_HOST is not set. Mail service will run in simulated console-only mode.');
}

/**
 * Sends a 6-digit verification code to the target email.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const subject = 'Legal TimeLock Network (LTN) - OTP Verification';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1e3a8a; text-align: center;">Legal TimeLock Network (LTN)</h2>
      <hr style="border: 0; border-top: 1px solid #e0e0e0;" />
      <p>Hello,</p>
      <p>You requested a one-time password (OTP) to log in or register your account on the Legal TimeLock Network.</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e3a8a; padding: 10px 20px; background-color: #f3f4f6; border-radius: 4px; border: 1px dashed #d1d5db;">
          ${code}
        </span>
      </div>
      <p>This code is valid for <strong>5 minutes</strong>. If you did not make this request, you can safely ignore this email.</p>
      <br />
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">
        This is an automated security notification. Please do not reply to this email.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.smtpFrom,
        to: email,
        subject: subject,
        html: htmlContent,
      });
      logger.info(`OTP email successfully sent to: ${email}`);
    } catch (error) {
      logger.error(`Failed to send OTP email to ${email}`, { error: (error as Error).message });
      // Don't crash, still print to console so developer has it
      logger.info(`[MAIL MOCK FALLBACK] OTP Code for ${email} is: ${code}`);
    }
  } else {
    // Console fallback
    logger.info('╔═════════════════════════════════════════════════════════════════╗');
    logger.info(`║ [SIMULATED EMAIL] To: ${email.padEnd(46)} ║`);
    logger.info(`║ Subject: ${subject.padEnd(54)} ║`);
    logger.info(`║ OTP Code: ${code.padEnd(53)} ║`);
    logger.info('╚═════════════════════════════════════════════════════════════════╝');
  }
}
