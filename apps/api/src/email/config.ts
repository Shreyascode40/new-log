/**
 * Centralized email configuration and provider detection.
 *
 * Supported providers:
 *   - "brevo-api" : Brevo Transactional Email REST API over HTTPS (port 443).
 *                   Recommended for cloud hosting (Render, Vercel) where dynamic
 *                   outbound IPs may trigger Brevo SMTP 525 Unauthorized IP blocks.
 *   - "smtp"      : Brevo SMTP (smtp-relay.brevo.com:587) or standard SMTP.
 *                   Requires Brevo IP allowlist to be deactivated or Render IPs allowed.
 *   - "brevo"     : Alias for "smtp" with Brevo credentials.
 *   - "resend"    : Resend REST API over HTTPS.
 *   - "console"   : Development default when no credentials are configured.
 *   - "noop"      : Discards emails silently (used in automated tests).
 */

export type EmailProviderType =
  | "brevo-api"
  | "smtp"
  | "brevo"
  | "resend"
  | "console"
  | "noop";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

export interface BrevoApiConfig {
  apiKey: string;
}

export interface ResendConfig {
  apiKey: string;
}

export interface SenderAddress {
  name: string;
  email: string;
  raw: string;
}

export function emailProvider(): EmailProviderType {
  const envProvider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (envProvider) {
    if (
      envProvider === "brevo-api" ||
      envProvider === "smtp" ||
      envProvider === "brevo" ||
      envProvider === "resend" ||
      envProvider === "console" ||
      envProvider === "noop"
    ) {
      return envProvider as EmailProviderType;
    }
  }

  // Automatic provider resolution:
  // 1. If Brevo API key is set, prefer HTTPS REST API (avoids port 587 / IP issues on cloud hosting)
  if (process.env.BREVO_API_KEY?.trim()) {
    return "brevo-api";
  }

  // 2. If Brevo SMTP or standard SMTP credentials are configured, use smtp
  const hasBrevoSmtp = Boolean(
    process.env.BREVO_SMTP_USER?.trim() && process.env.BREVO_SMTP_PASSWORD?.trim(),
  );
  const hasGenericSmtp = Boolean(
    process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim(),
  );
  if (hasBrevoSmtp || hasGenericSmtp) {
    return "smtp";
  }

  // 3. If Resend is configured, use resend
  if (process.env.RESEND_API_KEY?.trim()) {
    return "resend";
  }

  // 4. Default to console in development
  return "console";
}

export function isConsoleProvider(): boolean {
  return emailProvider() === "console";
}

export function exposesDevLinks(): boolean {
  const provider = emailProvider();
  return provider === "console" || provider === "noop";
}

export function getSmtpConfig(): SmtpConfig {
  const host =
    process.env.BREVO_SMTP_HOST?.trim() ||
    process.env.SMTP_HOST?.trim() ||
    "smtp-relay.brevo.com";
  const port = Number(
    process.env.BREVO_SMTP_PORT?.trim() ||
    process.env.SMTP_PORT?.trim() ||
    "587",
  );
  const user =
    process.env.BREVO_SMTP_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "";
  const pass =
    process.env.BREVO_SMTP_PASSWORD?.trim() ||
    process.env.SMTP_PASSWORD?.trim() ||
    "";

  if (!user || !pass) {
    throw new Error(
      "Missing SMTP credentials. Please configure BREVO_SMTP_USER and BREVO_SMTP_PASSWORD (or SMTP_USER and SMTP_PASSWORD).",
    );
  }

  return {
    host,
    port,
    user,
    pass,
    secure: port === 465,
  };
}

export function getBrevoApiConfig(): BrevoApiConfig {
  const apiKey = (
    process.env.BREVO_API_KEY ||
    process.env.BREVO_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "Missing Brevo API key. Please configure BREVO_API_KEY in your environment variables.",
    );
  }

  return { apiKey };
}

export function getResendConfig(): ResendConfig {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "Missing Resend API key. Please configure RESEND_API_KEY in your environment variables.",
    );
  }
  return { apiKey };
}

/**
 * Parses and validates EMAIL_FROM into name and email.
 * Supports:
 *   "Digital BE Project Logbook <no-reply@apcoer.edu.in>"
 *   "no-reply@apcoer.edu.in"
 */
export function getSenderAddress(): SenderAddress {
  const raw = (process.env.EMAIL_FROM || "").trim();
  if (!raw) {
    throw new Error(
      'Set EMAIL_FROM in environment variables (e.g. "Digital BE Log Book <no-reply@apcoer.edu.in>").',
    );
  }

  const match = raw.match(/^(?:(?:"?([^"]*)"?\s*)?<?([^>]+)>?)$/);
  if (match) {
    const name = match[1]?.trim() || "Digital BE Project Logbook";
    const email = match[2]?.trim().toLowerCase() || "";
    if (email && email.includes("@")) {
      return { name, email, raw };
    }
  }

  if (raw.includes("@")) {
    return { name: "Digital BE Project Logbook", email: raw.toLowerCase(), raw };
  }

  throw new Error(`Invalid EMAIL_FROM address: "${raw}". Must contain a valid email address.`);
}
