/**
 * Reusable, responsive email templates for Logbook authentication (web workspace).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildVerificationEmail(params: {
  name?: string;
  verificationUrl: string;
}): EmailContent {
  const safeName = params.name ? escapeHtml(params.name.trim()) : "";
  const safeUrl = params.verificationUrl.trim();
  const subject = "Verify Your Email — Digital BE Project Logbook";
  const greeting = safeName ? `Hello ${safeName},` : "Hello,";
  const textGreeting = params.name ? `Hello ${params.name.trim()},` : "Hello,";

  const text = [
    textGreeting,
    "",
    "Thank you for registering for the Digital BE Project Logbook (Department of Computer Engineering, APCOE&R).",
    "",
    "Click the link below to verify your email address and activate your account:",
    safeUrl,
    "",
    "This verification link expires in 30 minutes.",
    "",
    "If you did not create this account, you can safely ignore this email.",
    "",
    "─────────────────────────────────────────────────────────────",
    "Anantrao Pawar College of Engineering & Research | Record No. ACA/D/003B",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">Digital BE Project Logbook</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Department of Computer Engineering</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5;">${greeting}</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5;">
        Thank you for registering for the <strong>Digital BE Project Logbook</strong>. Click the button below to verify your email address and activate your account.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${safeUrl}" style="background-color: #000000; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 4px; font-size: 15px; font-weight: 600; display: inline-block;">Verify Email</a>
      </div>
      <p style="margin: 24px 0 12px 0; font-size: 13px; color: #64748b;">
        If the button does not work, copy and paste this URL into your browser:
      </p>
      <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
        <a href="${safeUrl}" style="color: #0f172a;">${safeUrl}</a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        If you did not create this account, you can safely ignore this email.<br>
        <strong>This link expires in 30 minutes.</strong>
      </p>
    </div>
    <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
      <p style="margin: 0;">Anantrao Pawar College of Engineering & Research | Record No. ACA/D/003B</p>
      <p style="margin: 4px 0 0 0;">This is an automated system notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export function buildPasswordResetEmail(params: {
  name?: string;
  resetUrl: string;
}): EmailContent {
  const safeName = params.name ? escapeHtml(params.name.trim()) : "";
  const safeUrl = params.resetUrl.trim();
  const subject = "Reset Your Logbook Password";
  const greeting = safeName ? `Hello ${safeName},` : "Hello,";
  const textGreeting = params.name ? `Hello ${params.name.trim()},` : "Hello,";

  const text = [
    textGreeting,
    "",
    "We received a request to reset your Digital BE Project Logbook password.",
    "",
    "Click the link below to reset your password:",
    safeUrl,
    "",
    "This password reset link expires in 30 minutes.",
    "",
    "If you did not request this password reset, you can safely ignore this email. Your current password remains unchanged.",
    "",
    "─────────────────────────────────────────────────────────────",
    "Anantrao Pawar College of Engineering & Research | Record No. ACA/D/003B",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">Digital BE Project Logbook</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Department of Computer Engineering</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5;">${greeting}</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5;">
        We received a request to reset your <strong>Digital BE Project Logbook</strong> password. Click the button below to choose a new password.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${safeUrl}" style="background-color: #000000; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 4px; font-size: 15px; font-weight: 600; display: inline-block;">Reset Password</a>
      </div>
      <p style="margin: 24px 0 12px 0; font-size: 13px; color: #64748b;">
        If the button does not work, copy and paste this URL into your browser:
      </p>
      <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
        <a href="${safeUrl}" style="color: #0f172a;">${safeUrl}</a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        If you did not request this password reset, you can safely ignore this email.<br>
        <strong>This link expires in 30 minutes.</strong>
      </p>
    </div>
    <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
      <p style="margin: 0;">Anantrao Pawar College of Engineering & Research | Record No. ACA/D/003B</p>
      <p style="margin: 4px 0 0 0;">This is an automated system notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
