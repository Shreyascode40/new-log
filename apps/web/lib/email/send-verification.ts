import { buildVerificationEmail } from "./templates";
import { sendEmail, type SendEmailResult } from "./transporter";

export interface SendVerificationInput {
  to: string;
  name?: string;
  verificationUrl: string;
}

export async function sendVerificationEmail(
  input: SendVerificationInput,
): Promise<SendEmailResult> {
  const emailDomain = input.to.split("@")[1] || "unknown";
  console.info(`[AUTH] Verification email requested for domain=@${emailDomain}`);

  const content = buildVerificationEmail({
    name: input.name,
    verificationUrl: input.verificationUrl,
  });

  const result = await sendEmail({
    to: input.to,
    recipientName: input.name,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  console.info(
    `[AUTH] Verification email sent successfully: recipientDomain=@${emailDomain}, provider=${result.provider}, durationMs=${result.durationMs}`,
  );

  return result;
}
