import { createTransport, type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  if (host) {
    cached = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  } else {
    cached = createTransport({ jsonTransport: true });
  }
  return cached;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? "no-reply@caloriespro.local";
  const info = await transporter.sendMail({ from, ...input });

  if (!process.env.SMTP_HOST) {
    // dev fallback: surface the message in the server console
    // eslint-disable-next-line no-console
    console.log("[email:dev]", JSON.stringify({ to: input.to, subject: input.subject, info }));
  }
}

export function buildPasswordResetEmail(token: string): { subject: string; text: string } {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: "Reset your CaloriesPro password",
    text: `Use the link below to reset your password. It expires in 24 hours.\n\n${url}\n\nIf you did not request this, ignore this email.`,
  };
}
