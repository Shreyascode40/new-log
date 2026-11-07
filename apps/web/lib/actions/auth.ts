"use server";

import {
  AuthError,
  requestPasswordReset,
  resetPassword,
  resendVerificationEmail,
  signupStudent,
} from "@/lib/services/auth";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

/**
 * Server actions for the auth forms. They always return
 * `{ success, data?, error? }` and never throw to the client.
 */
export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function messageOf(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  console.error("auth action failed", error);
  return "Something went wrong. Please try again.";
}

export async function signUpAction(
  input: unknown,
): Promise<ActionResult<{ userId: string; verificationUrl?: string; message: string }>> {
  const ip = clientIp();
  const limit = await rateLimit(`signup:${ip}`, RATE_LIMITS.signup.limit, RATE_LIMITS.signup.windowMs);
  if (!limit.ok) {
    return { success: false, error: "Too many sign-up attempts. Please try again later." };
  }

  try {
    const data = await signupStudent(input);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: messageOf(error) };
  }
}

export async function resendVerificationAction(
  input: unknown,
): Promise<ActionResult<{ success: true; message: string; alreadyVerified?: boolean; verificationUrl?: string }>> {
  const ip = clientIp();
  const limit = await rateLimit(
    `resend-verify:${ip}`,
    RATE_LIMITS.resendVerification.limit,
    RATE_LIMITS.resendVerification.windowMs,
  );
  if (!limit.ok) {
    return { success: false, error: "Too many verification requests. Please try again later." };
  }

  try {
    const data = await resendVerificationEmail(input);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: messageOf(error) };
  }
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<ActionResult<{ success: true; message: string; resetUrl?: string }>> {
  const ip = clientIp();
  const limit = await rateLimit(
    `reset:${ip}`,
    RATE_LIMITS.passwordReset.limit,
    RATE_LIMITS.passwordReset.windowMs,
  );
  if (!limit.ok) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  try {
    const data = await requestPasswordReset(input);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: messageOf(error) };
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  const limit = await rateLimit(
    `reset-complete:${clientIp()}`,
    RATE_LIMITS.passwordReset.limit,
    RATE_LIMITS.passwordReset.windowMs,
  );
  if (!limit.ok) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  try {
    const data = await resetPassword(input);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: messageOf(error) };
  }
}
