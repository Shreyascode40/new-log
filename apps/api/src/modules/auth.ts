import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import { hashPassword, verifyPassword } from "../password.js";
import {
  sendEmail,
  exposesDevLinks,
  buildVerificationEmail,
  buildPasswordResetEmail,
} from "../email.js";
import {
  generateToken,
  hashToken,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  expiresIn,
} from "../tokens.js";
import type { Role } from "../constants.js";

export class AuthError extends ApiDomainError {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "EMAIL_DOMAIN"
      | "EMAIL_TAKEN"
      | "ROLL_TAKEN"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN"
      | "ALREADY_VERIFIED"
      | "USER_NOT_FOUND"
      | "EMAIL_FAILED"
      | "RATE_LIMITED",
    message: string,
    status = 400,
  ) {
    super(code, message, status);
    this.name = "AuthError";
  }
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "EMAIL_NOT_VERIFIED" | "ACCOUNT_INACTIVE" };

function resolveBaseUrl(providedUrl?: string): string {
  if (providedUrl && typeof providedUrl === "string") {
    try {
      const parsed = new URL(providedUrl);
      const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || "http://localhost:3000")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const isAllowed = allowedOrigins.some((origin) => {
        try {
          return new URL(origin).origin === parsed.origin;
        } catch {
          return false;
        }
      });

      if (isAllowed || process.env.NODE_ENV !== "production") {
        return parsed.origin;
      }
    } catch {
      // Fallback below
    }
  }

  const url = process.env.WEB_URL || process.env.NEXTAUTH_URL || process.env.APP_URL;
  return url?.replace(/\/$/, "") || "http://localhost:3000";
}

function allowedDomain(): string | null {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  return domain ? domain : null;
}

function isAllowedEmail(email: string): boolean {
  const domain = allowedDomain();
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain}`);
}

export function emailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
}

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  rollNo: z.string().trim().min(1, "Roll number is required").max(30),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
  password: passwordSchema,
  webUrl: z.string().url().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  webUrl: z.string().url().optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  webUrl: z.string().url().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Missing or invalid reset token"),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

/** Student self-registration */
export async function signupStudent(input: unknown): Promise<{
  userId: string;
  verificationUrl?: string;
  message: string;
}> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { name, email, rollNo, mobile, password, webUrl } = parsed.data;

  console.info(`[AUTH] Registration attempt for emailDomain=@${email.split("@")[1]}, rollNo=${rollNo}`);

  if (!isAllowedEmail(email)) {
    throw new AuthError("EMAIL_DOMAIN", `Sign up is restricted to @${allowedDomain()} email addresses`);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { rollNo }] },
    select: { email: true, rollNo: true },
  });
  if (existing?.email === email) throw new AuthError("EMAIL_TAKEN", "An account with this email already exists");
  if (existing?.rollNo === rollNo) throw new AuthError("ROLL_TAKEN", "This roll number is already registered");

  const passwordHash = await hashPassword(password);
  const rawToken = generateToken(32);
  const verificationRequired = emailVerificationRequired();

  const user = await prisma.$transaction(
    async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        rollNo,
        mobile,
        passwordHash,
        role: "STUDENT" satisfies Role,
        createdVia: "SELF_SIGNUP",
        ...(verificationRequired
          ? { emailVerified: null, emailVerifiedAt: null }
          : { emailVerified: new Date(), emailVerifiedAt: new Date() }),
      },
    });

    if (verificationRequired) {
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: expiresIn(EMAIL_VERIFICATION_TTL_MS),
        },
      });
    }

    await logAction(
      {
        userId: created.id,
        action: "USER_SIGNUP",
        entity: "User",
        entityId: created.id,
        after: { email, rollNo, role: "STUDENT" },
      },
      tx,
    );
    return created;
  }, { maxWait: 10000, timeout: 20000 });

  if (!verificationRequired) {
    return {
      userId: user.id,
      message: "Account created successfully.",
    };
  }

  const base = resolveBaseUrl(webUrl);
  const verificationUrl = `${base}/verify-email?token=${rawToken}`;
  const mailContent = buildVerificationEmail({ name, verificationUrl });

  try {
    await sendEmail({
      to: email,
      recipientName: name,
      subject: mailContent.subject,
      text: mailContent.text,
      html: mailContent.html,
    });
  } catch (error) {
    console.error(
      `signup email delivery failed for ${email}: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Safe atomic rollback so user does not remain in unusable state
    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    }, { maxWait: 10000, timeout: 20000 });
    throw new AuthError(
      "EMAIL_FAILED",
      "We could not send the verification email. Please verify your email configuration or try again later.",
      500,
    );
  }

  return {
    userId: user.id,
    verificationUrl: exposesDevLinks() ? verificationUrl : undefined,
    message: "Your account has been created. Please check your email to verify your account.",
  };
}

/** Credentials authentication for NextAuth */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return { ok: false, reason: "INVALID_CREDENTIALS" };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { ok: false, reason: "INVALID_CREDENTIALS" };

  if (!user.active) return { ok: false, reason: "ACCOUNT_INACTIVE" };

  // Faculty and staff accounts (GUIDE, HOD, or HOD_CREATED) never require email verification.
  // Existing users with emailVerified or emailVerifiedAt set are verified.
  const isStaff = user.role === "GUIDE" || user.role === "HOD" || user.createdVia === "HOD_CREATED";
  if (!isStaff && emailVerificationRequired() && !user.emailVerified && !user.emailVerifiedAt) {
    return { ok: false, reason: "EMAIL_NOT_VERIFIED" };
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
  };
}

/** Consumes a single-use email verification token */
export async function verifyEmail(rawToken: string): Promise<{
  email: string;
  alreadyVerified?: boolean;
}> {
  if (!rawToken || typeof rawToken !== "string") {
    throw new AuthError("INVALID_TOKEN", "This verification link is invalid.");
  }

  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      user: {
        select: { id: true, email: true, emailVerified: true, emailVerifiedAt: true },
      },
    },
  });

  if (!tokenRecord) {
    throw new AuthError("INVALID_TOKEN", "This verification link is invalid.");
  }

  // If already used, check if the user is already verified
  if (tokenRecord.usedAt) {
    if (tokenRecord.user.emailVerified || tokenRecord.user.emailVerifiedAt) {
      return { email: tokenRecord.user.email, alreadyVerified: true };
    }
    throw new AuthError("INVALID_TOKEN", "This verification link has already been used.");
  }

  // Check expiration (30 minutes)
  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    console.warn(`[AUTH] Verification token expired for userId=${tokenRecord.userId}`);
    throw new AuthError("EXPIRED_TOKEN", "This verification link has expired. Please request a new one.");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Atomic single-use token consumption (prevents concurrent double-verification)
    const updated = await tx.emailVerificationToken.updateMany({
      where: { id: tokenRecord.id, usedAt: null },
      data: { usedAt: now },
    });

    if (updated.count === 0) {
      // Concurrently consumed
      const fresh = await tx.emailVerificationToken.findUnique({ where: { id: tokenRecord.id } });
      if (fresh?.usedAt) {
        return;
      }
      throw new AuthError("INVALID_TOKEN", "This verification link has already been used.");
    }

    // Invalidate other pending verification tokens for this user
    await tx.emailVerificationToken.updateMany({
      where: { userId: tokenRecord.userId, usedAt: null },
      data: { usedAt: now },
    });

    // Mark user verified in both columns for complete safety
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: {
        emailVerified: now,
        emailVerifiedAt: now,
      },
    });

    await logAction(
      {
        userId: tokenRecord.userId,
        action: "EMAIL_VERIFIED",
        entity: "User",
        entityId: tokenRecord.userId,
      },
      tx,
    );
  }, { maxWait: 10000, timeout: 20000 });

  console.info(`[AUTH] Email verified successfully for userId=${tokenRecord.userId}`);
  return { email: tokenRecord.user.email };
}

/** Resends verification email with 60-second cooldown */
export async function resendVerificationEmail(input: unknown): Promise<{
  success: true;
  message: string;
  alreadyVerified?: boolean;
  verificationUrl?: string;
}> {
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid email");
  }

  const { email, webUrl } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Email enumeration protection: generic success if user does not exist
  if (!user) {
    return {
      success: true,
      message: "If an unverified account exists with this email, a new verification link has been sent.",
    };
  }

  if (user.emailVerified || user.emailVerifiedAt) {
    return {
      success: true,
      alreadyVerified: true,
      message: "Your email address is already verified. You can sign in.",
    };
  }

  // 60-second cooldown check:
  // Throttles if 2 or more tokens were generated in the last 60 seconds (allows 1 signup + 1 immediate resend)
  const recentTokens = await prisma.emailVerificationToken.findMany({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (recentTokens.length >= 2) {
    throw new AuthError(
      "RATE_LIMITED",
      "Please wait 60 seconds before requesting another verification email.",
      429,
    );
  }

  const rawToken = generateToken(32);
  const now = new Date();

  // Invalidate previous verification tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  // Create fresh single-use 30-min token
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: expiresIn(EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const base = resolveBaseUrl(webUrl);
  const verificationUrl = `${base}/verify-email?token=${rawToken}`;
  const mailContent = buildVerificationEmail({ name: user.name, verificationUrl });

  try {
    await sendEmail({
      to: user.email,
      recipientName: user.name,
      subject: mailContent.subject,
      text: mailContent.text,
      html: mailContent.html,
    });
  } catch (error) {
    console.error(
      `resend verification email failed for ${email}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new AuthError(
      "EMAIL_FAILED",
      "We could not send the verification email. Please try again later.",
      500,
    );
  }

  return {
    success: true,
    verificationUrl: exposesDevLinks() ? verificationUrl : undefined,
    message: "If an unverified account exists with this email, a new verification link has been sent.",
  };
}

/** Requests a password reset with email enumeration protection and 30-min token */
export async function requestPasswordReset(input: unknown): Promise<{
  success: true;
  message: string;
  resetUrl?: string;
}> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid email");
  }
  const { email, webUrl } = parsed.data;

  const genericResponse = {
    success: true as const,
    message: "If an account exists with this email address, a password reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return genericResponse;
  }

  // 60-second cooldown check to prevent spamming
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    // To protect email enumeration, return generic message without triggering multiple emails
    return genericResponse;
  }

  const rawToken = generateToken(32);
  const now = new Date();

  // Invalidate previous reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  // Create new 30-min single-use token
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: expiresIn(PASSWORD_RESET_TTL_MS),
    },
  });

  const base = resolveBaseUrl(webUrl);
  const resetUrl = `${base}/reset-password?token=${rawToken}`;
  const mailContent = buildPasswordResetEmail({ name: user.name, resetUrl });

  try {
    await sendEmail({
      to: user.email,
      recipientName: user.name,
      subject: mailContent.subject,
      text: mailContent.text,
      html: mailContent.html,
    });
  } catch (error) {
    console.error(
      `password-reset email failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return genericResponse;
  }

  return {
    success: true,
    message: "If an account exists with this email address, a password reset link has been sent.",
    resetUrl: exposesDevLinks() ? resetUrl : undefined,
  };
}

/** Completes password reset and invalidates all outstanding reset tokens */
export async function resetPassword(input: unknown): Promise<{
  success: true;
  message: string;
}> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { token: rawToken, password } = parsed.data;

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!tokenRecord) {
    throw new AuthError("INVALID_TOKEN", "This reset link is invalid or has already been used.");
  }

  if (tokenRecord.usedAt) {
    throw new AuthError("INVALID_TOKEN", "This reset link is invalid or has already been used.");
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    console.warn(`[AUTH] Password reset token expired for userId=${tokenRecord.userId}`);
    throw new AuthError("EXPIRED_TOKEN", "This reset link has expired. Please request a new link.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Atomic update: ensure token was not consumed concurrently
    const updated = await tx.passwordResetToken.updateMany({
      where: { id: tokenRecord.id, usedAt: null },
      data: { usedAt: now },
    });

    if (updated.count === 0) {
      throw new AuthError("INVALID_TOKEN", "This reset link is invalid or has already been used.");
    }

    // Update password hash and mark verified
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash,
        emailVerified: now,
        emailVerifiedAt: now,
      },
    });

    // Invalidate all other outstanding reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: { userId: tokenRecord.userId, usedAt: null },
      data: { usedAt: now },
    });

    await logAction(
      {
        userId: tokenRecord.userId,
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: tokenRecord.userId,
      },
      tx,
    );
  }, { maxWait: 10000, timeout: 20000 });

  console.info(`[AUTH] Password reset completed successfully for userId=${tokenRecord.userId}`);

  return {
    success: true,
    message: "Password reset successfully. You can now sign in with your new password.",
  };
}
