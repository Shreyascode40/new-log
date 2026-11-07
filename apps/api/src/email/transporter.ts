import type { Transporter } from "nodemailer";
import {
  emailProvider,
  getBrevoApiConfig,
  getResendConfig,
  getSenderAddress,
  getSmtpConfig,
} from "./config.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  recipientName?: string;
}

export interface SendEmailResult {
  messageId?: string;
  provider: string;
  durationMs: number;
}

let cachedTransporter: Transporter | null = null;
let lastSmtpConfigKey = "";

/**
 * Returns a cached singleton Nodemailer transporter.
 * Automatically invalidates cache if SMTP configuration changes.
 */
async function getOrCreateSmtpTransporter(): Promise<Transporter> {
  const config = getSmtpConfig();
  const configKey = `${config.host}:${config.port}:${config.user}:${config.secure}`;

  if (cachedTransporter && lastSmtpConfigKey === configKey) {
    return cachedTransporter;
  }

  const { default: nodemailer } = await import("nodemailer");

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Production timeouts: prevents hanging requests when ports are blocked
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // STARTTLS configuration for port 587
    requireTLS: !config.secure,
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
  });

  lastSmtpConfigKey = configKey;
  return cachedTransporter;
}

/**
 * Sends an email via Brevo's Transactional Email REST API over HTTPS (port 443).
 *
 * This completely avoids outbound port 587 / SMTP IP restriction issues on Render
 * and other cloud providers with dynamic outbound IPs.
 */
async function sendViaBrevoApi(
  input: SendEmailInput,
  startTime: number,
): Promise<SendEmailResult> {
  const { apiKey } = getBrevoApiConfig();
  const sender = getSenderAddress();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const payload = {
      sender: {
        name: sender.name,
        email: sender.email,
      },
      to: [
        {
          email: input.to.trim().toLowerCase(),
          ...(input.recipientName ? { name: input.recipientName.trim() } : {}),
        },
      ],
      subject: input.subject,
      textContent: input.text,
      ...(input.html ? { htmlContent: input.html } : {}),
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = (await response.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      const errorMsg = data.message || `Brevo REST API error (${response.status})`;
      console.error(
        `[EMAIL_BREVO_API_ERROR] Brevo REST API rejected message: status=${response.status}, code=${data.code}, message="${errorMsg}"`,
      );
      throw new Error(`Brevo REST API rejected the email (${response.status}): ${errorMsg}`);
    }

    return {
      messageId: data.messageId,
      provider: "brevo-api",
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Brevo REST API request timed out after 15 seconds.");
    }
    throw error;
  }
}

/**
 * Sends an email via SMTP (Brevo SMTP or standard SMTP) using Nodemailer.
 */
async function sendViaSmtp(
  input: SendEmailInput,
  startTime: number,
): Promise<SendEmailResult> {
  const sender = getSenderAddress();
  const transporter = await getOrCreateSmtpTransporter();

  try {
    const info = await transporter.sendMail({
      from: sender.raw,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return {
      messageId: info?.messageId,
      provider: "smtp",
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    const responseCode = error.responseCode || error.code || "";
    const responseMessage = String(error.response || error.message || "");

    // Diagnostic 1: Brevo 525 Unauthorized IP address
    if (
      responseCode === 525 ||
      responseMessage.includes("525") ||
      responseMessage.includes("Unauthorized IP address")
    ) {
      console.error(
        [
          "",
          "══════════════════════════════════════════════════════════════════════",
          "[BREVO_SMTP_IP_RESTRICTION_ERROR] 525 5.7.1 Unauthorized IP address",
          "Brevo rejected the SMTP authentication because IP blocking is active",
          "for your SMTP key, and this server's outbound IP is not authorized.",
          "",
          "TO RESOLVE THIS IN PRODUCTION:",
          "Option A (Recommended for Render dynamic IPs):",
          "  Use Brevo Transactional Email REST API over HTTPS.",
          "  1. Generate a Brevo v3 API key in: Brevo -> SMTP & API -> API Keys.",
          "  2. Add BREVO_API_KEY=<your_api_key> to your Render environment variables.",
          "  3. Set EMAIL_PROVIDER=brevo-api.",
          "",
          "Option B (Keep using SMTP):",
          "  1. Log into Brevo -> Settings -> Security -> Authorized IPs.",
          "  2. Locate 'Blocking unauthorized IP addresses for API keys and SMTP keys'.",
          "  3. Set it to 'Deactivated' (or delete any listed IP to disable the allowlist).",
          "══════════════════════════════════════════════════════════════════════",
          "",
        ].join("\n"),
      );
    }

    // Diagnostic 2: Brevo 535 Authentication failure
    if (
      responseCode === 535 ||
      responseMessage.includes("535") ||
      responseMessage.includes("Authentication failed")
    ) {
      console.error(
        "[EMAIL_SMTP_AUTH_ERROR] SMTP 535 Authentication failed. Check BREVO_SMTP_USER (login) and BREVO_SMTP_PASSWORD (SMTP key). Note: Do NOT use the Brevo API key as the SMTP password.",
      );
    }

    // Diagnostic 3: 550 Sender unverified
    if (
      responseCode === 550 ||
      responseMessage.includes("550") ||
      responseMessage.includes("Sender address rejected")
    ) {
      console.error(
        `[EMAIL_SMTP_SENDER_ERROR] SMTP 550 Sender rejected. Ensure EMAIL_FROM (${sender.email}) is a verified sender in your Brevo dashboard under Senders & IP.`,
      );
    }

    throw error;
  }
}

/**
 * Sends an email via Resend REST API over HTTPS.
 */
async function sendViaResend(
  input: SendEmailInput,
  startTime: number,
): Promise<SendEmailResult> {
  const { apiKey } = getResendConfig();
  const sender = getSenderAddress();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender.raw,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}): ${data.message || ""}`);
    }

    return {
      messageId: data.id,
      provider: "resend",
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Resend API request timed out after 15 seconds.");
    }
    throw error;
  }
}

/**
 * Development console output.
 */
function sendViaConsole(input: SendEmailInput, startTime: number): SendEmailResult {
  console.info(
    [
      "",
      "─────────────────────────── DEV EMAIL ───────────────────────────",
      `To:      ${input.to}`,
      `Subject: ${input.subject}`,
      "",
      input.text,
      "─────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  return {
    messageId: `dev-${Date.now()}`,
    provider: "console",
    durationMs: Date.now() - startTime,
  };
}

/**
 * Main dispatch function for all outbound emails.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const startTime = Date.now();
  const provider = emailProvider();

  if (provider === "noop") {
    return { provider: "noop", durationMs: 0 };
  }

  if (provider === "console") {
    return sendViaConsole(input, startTime);
  }

  if (provider === "brevo-api") {
    return sendViaBrevoApi(input, startTime);
  }

  if (provider === "smtp" || provider === "brevo") {
    return sendViaSmtp(input, startTime);
  }

  if (provider === "resend") {
    return sendViaResend(input, startTime);
  }

  throw new Error(
    `EMAIL_PROVIDER="${provider}" is unknown. Use "brevo-api", "smtp", "brevo", "console", "noop", or "resend".`,
  );
}

/**
 * Diagnostic health-check for SMTP connection.
 * Non-blocking: returns { ok: true } or { ok: false, error: string }.
 */
export async function verifySmtpHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = await getOrCreateSmtpTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
}
