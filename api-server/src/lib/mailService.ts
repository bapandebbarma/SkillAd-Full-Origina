/**
 * Provider-agnostic mail service.
 * Business code calls `mailService.send(...)` only — swap providers via env
 * without changing contact / notification logic.
 *
 * Current: SMTP (nodemailer)
 * Future: Resend, Brevo, SendGrid, Amazon SES — implement MailProvider and wire in createMailService().
 */
import { logger } from "./logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/** No-op provider when mail is not configured — never throws. */
class NoopMailProvider implements MailProvider {
  readonly name = "noop";

  async send(message: MailMessage): Promise<void> {
    logger.warn(
      { to: message.to, subject: message.subject },
      "mail: SMTP not configured — message skipped",
    );
  }
}

/** SMTP via nodemailer (dynamic import so missing package does not crash boot). */
class SmtpMailProvider implements MailProvider {
  readonly name = "smtp";
  private transporterPromise: Promise<any> | null = null;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    },
  ) {}

  private async getTransporter(): Promise<any> {
    if (!this.transporterPromise) {
      this.transporterPromise = (async () => {
        const nodemailer = await import("nodemailer");
        return nodemailer.createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          auth: {
            user: this.config.user,
            pass: this.config.pass,
          },
        });
      })();
    }
    return this.transporterPromise;
  }

  async send(message: MailMessage): Promise<void> {
    const transporter = await this.getTransporter();
    await transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    logger.info({ to: message.to, subject: message.subject, provider: this.name }, "mail: sent");
  }
}

function createMailService(): MailProvider {
  const host = (process.env["SMTP_HOST"] ?? "").trim();
  const user = (process.env["SMTP_USER"] ?? "").trim();
  const pass = process.env["SMTP_PASS"] ?? "";
  const from =
    (process.env["SMTP_FROM"] ?? "").trim() ||
    (user ? `SkillAd <${user}>` : "SkillAd <noreply@skillad.in>");

  if (!host || !user || !pass) {
    return new NoopMailProvider();
  }

  const port = parseInt(process.env["SMTP_PORT"] ?? "587", 10) || 587;
  const secure =
    process.env["SMTP_SECURE"] === "true" ||
    process.env["SMTP_SECURE"] === "1" ||
    port === 465;

  return new SmtpMailProvider({ host, port, secure, user, pass, from });
}

/** Singleton used by routes. */
export const mailService: MailProvider = createMailService();

/** Send and log failures without failing the caller. */
export async function sendMailSafe(message: MailMessage): Promise<boolean> {
  try {
    await mailService.send(message);
    return true;
  } catch (e) {
    logger.error({ e, to: message.to, subject: message.subject }, "mail: send failed");
    return false;
  }
}
