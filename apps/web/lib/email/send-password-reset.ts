import { buildPasswordResetEmail } from "./templates";
import { sendEmail, type SendEmailResult } from "./transporter";

export interface SendPasswordResetInput {
  to: string;
  name?: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(
  input: SendPasswordResetInput,
): Promise<SendEmailResult> {
  const emailDomain = input.to.split("@")[1] || "unknown";
  console.info(`[AUTH] Password reset email requested for domain=@${emailDomain}`);

  const content = buildPasswordResetEmail({
    name: input.name,
    resetUrl: input.resetUrl,
  });

  const result = await sendEmail({
    to: input.to,
    recipientName: input.name,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  console.info(
    `[AUTH] Password reset email sent successfully: recipientDomain=@${emailDomain}, provider=${result.provider}, durationMs=${result.durationMs}`,
  );

  return result;
}
