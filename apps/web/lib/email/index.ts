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
} from "./config";

export {
  buildVerificationEmail,
  buildPasswordResetEmail,
  type EmailContent,
} from "./templates";

export {
  sendEmail,
  verifySmtpHealth,
  type SendEmailInput,
  type SendEmailResult,
} from "./transporter";

export {
  sendVerificationEmail,
  type SendVerificationInput,
} from "./send-verification";

export {
  sendPasswordResetEmail,
  type SendPasswordResetInput,
} from "./send-password-reset";
