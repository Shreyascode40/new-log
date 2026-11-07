export {
  emailProvider,
  isConsoleProvider,
  exposesDevLinks,
  getSmtpConfig,
  getBrevoApiConfig,
  getResendConfig,
  getSenderAddress,
  type EmailProviderType,
  type SenderAddress,
  type SmtpConfig,
} from "./config.js";

export {
  buildVerificationEmail,
  buildPasswordResetEmail,
  type EmailContent,
} from "./templates.js";

export {
  sendEmail,
  verifySmtpHealth,
  type SendEmailInput,
  type SendEmailResult,
} from "./transporter.js";

export {
  sendVerificationEmail,
  type SendVerificationInput,
} from "./send-verification.js";

export {
  sendPasswordResetEmail,
  type SendPasswordResetInput,
} from "./send-password-reset.js";
