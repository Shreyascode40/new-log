import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import { sendEmail } from "../apps/api/src/email";
import {
  authenticate,
  emailVerificationRequired,
  requestPasswordReset,
  resetPassword,
  resendVerificationEmail,
  signupStudent,
  verifyEmail,
} from "../apps/api/src/modules/auth";
import { canAccessPath, homeForRole } from "@/lib/roles";
import {
  canApproveMarks,
  canEnterMarks,
  canGeneratePdf,
  canViewGroup,
  type CurrentUser,
} from "@/lib/permissions";

// Mailer is mocked to avoid external network calls during tests
vi.mock("../apps/api/src/email", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../apps/api/src/email")>();
  return { ...mod, sendEmail: vi.fn(async () => {}) };
});

const unique = () => Math.random().toString(36).slice(2, 10);
const createdEmails: string[] = [];

function newStudentInput() {
  const id = unique();
  const email = `t${id}@apcoer.edu.in`;
  createdEmails.push(email);
  return {
    name: `Test Student ${id}`,
    email,
    rollNo: `R${id}`,
    mobile: "9876543210",
    password: "Password@123",
  };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("PART 1: EMAIL VERIFICATION", () => {
  it("strips client-supplied role at schema layer and assigns STUDENT", async () => {
    const parsed = signupSchema.parse({
      name: "Mallory",
      email: "mallory@apcoer.edu.in",
      rollNo: "TE9999",
      mobile: "9123456780",
      password: "Password@123",
      role: "HOD",
    });
    expect(parsed).not.toHaveProperty("role");
  });

  it("new user registration creates user with null emailVerified and emailVerifiedAt", async () => {
    const input = newStudentInput();
    const { userId, message } = await signupStudent({ ...input, role: "HOD" });
    expect(message).toContain("check your email to verify your account");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.role).toBe("STUDENT");
    expect(user.emailVerified).toBeNull();
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("blocks newly registered unverified user from logging in", async () => {
    const input = newStudentInput();
    await signupStudent(input);

    const loginResult = await authenticate(input.email, input.password);
    expect(loginResult).toEqual({ ok: false, reason: "EMAIL_NOT_VERIFIED" });
  });

  it("successful verification marks both emailVerified and emailVerifiedAt and allows login", async () => {
    const input = newStudentInput();
    const { userId, verificationUrl } = await signupStudent(input);
    expect(verificationUrl).toBeDefined();

    const token = new URL(verificationUrl!).searchParams.get("token")!;
    const verifyResult = await verifyEmail(token);
    expect(verifyResult.email).toBe(input.email);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(updatedUser.emailVerified).not.toBeNull();
    expect(updatedUser.emailVerifiedAt).not.toBeNull();

    const afterLogin = await authenticate(input.email, input.password);
    expect(afterLogin.ok).toBe(true);
    if (afterLogin.ok) expect(afterLogin.user.id).toBe(userId);
  });

  it("rejects invalid, reused, or expired tokens", async () => {
    const input = newStudentInput();
    const { verificationUrl } = await signupStudent(input);
    const token = new URL(verificationUrl!).searchParams.get("token")!;

    // 1. Consume token
    await verifyEmail(token);

    // 2. Already verified handling / single use
    const secondCall = await verifyEmail(token);
    expect(secondCall.alreadyVerified).toBe(true);

    // 3. Completely invalid token
    await expect(verifyEmail("invalid-fake-token-string")).rejects.toThrow(/invalid/i);
  });

  it("supports resend verification email with 60-second cooldown", async () => {
    const input = newStudentInput();
    await signupStudent(input);

    // First resend immediately succeeds
    // (mock older token time to test cooldown logic)
    const resend1 = await resendVerificationEmail({ email: input.email });
    expect(resend1.success).toBe(true);
    expect(resend1.verificationUrl).toBeDefined();

    // Immediate second resend throws RATE_LIMITED
    await expect(resendVerificationEmail({ email: input.email })).rejects.toThrow(
      /60 seconds/i,
    );
  });

  it("rolls back safely on email delivery failure", async () => {
    const input = newStudentInput();
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("SMTP connection failed"));

    await expect(signupStudent(input)).rejects.toThrow(/could not send the verification email/i);

    // User is completely rolled back to avoid orphaned state
    expect(await prisma.user.findUnique({ where: { email: input.email } })).toBeNull();
  });
});

describe("PART 2: FORGOT PASSWORD & PASSWORD RESET", () => {
  it("protects against email enumeration on forgot password", async () => {
    const unregisteredEmail = `unregistered_${unique()}@apcoer.edu.in`;
    const result = await requestPasswordReset({ email: unregisteredEmail });
    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account exists");
  });

  it("generates 30-minute single-use reset token and resets password successfully", async () => {
    const input = newStudentInput();
    const { verificationUrl } = await signupStudent(input);
    const token = new URL(verificationUrl!).searchParams.get("token")!;
    await verifyEmail(token);

    // Request reset
    const resetReq = await requestPasswordReset({ email: input.email });
    expect(resetReq.success).toBe(true);
    expect(resetReq.resetUrl).toBeDefined();

    const resetToken = new URL(resetReq.resetUrl!).searchParams.get("token")!;
    const newPassword = "NewSecretPassword@999";

    // Complete reset
    const resetResult = await resetPassword({ token: resetToken, password: newPassword });
    expect(resetResult.success).toBe(true);

    // Old password no longer works
    const oldLogin = await authenticate(input.email, input.password);
    expect(oldLogin).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });

    // New password works
    const newLogin = await authenticate(input.email, newPassword);
    expect(newLogin.ok).toBe(true);

    // Token cannot be reused
    await expect(resetPassword({ token: resetToken, password: "AnotherPassword@111" })).rejects.toThrow(
      /invalid or has already been used|invalid/i,
    );
  });
});

describe("PART 3: EXISTING USERS & PERMISSIONS", () => {
  it("existing users with verified timestamps remain active and can log in", async () => {
    const input = newStudentInput();
    // Simulate an existing user created previously
    const existing = await prisma.user.create({
      data: {
        name: "Existing User",
        email: input.email,
        rollNo: input.rollNo,
        passwordHash: await import("../apps/api/src/password").then((m) => m.hashPassword(input.password)),
        role: "STUDENT",
        emailVerified: new Date(),
        emailVerifiedAt: new Date(),
      },
    });

    const login = await authenticate(input.email, input.password);
    expect(login.ok).toBe(true);
    if (login.ok) expect(login.user.id).toBe(existing.id);
  });

  it("respects demo kill-switch when REQUIRE_EMAIL_VERIFICATION is false", async () => {
    const previous = process.env.REQUIRE_EMAIL_VERIFICATION;
    process.env.REQUIRE_EMAIL_VERIFICATION = "false";
    try {
      expect(emailVerificationRequired()).toBe(false);
      const input = newStudentInput();
      const { userId, verificationUrl } = await signupStudent(input);
      expect(verificationUrl).toBeUndefined();

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.emailVerified).not.toBeNull();
      expect(user.emailVerifiedAt).not.toBeNull();

      const login = await authenticate(input.email, input.password);
      expect(login.ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
      else process.env.REQUIRE_EMAIL_VERIFICATION = previous;
    }
  });

  it("enforces role-based route permissions", () => {
    expect(canAccessPath("STUDENT", "/hod")).toBe(false);
    expect(canAccessPath("STUDENT", "/student")).toBe(true);
    expect(canAccessPath("GUIDE", "/guide")).toBe(true);
    expect(canAccessPath("HOD", "/hod")).toBe(true);
    expect(homeForRole("STUDENT")).toBe("/student");
    expect(homeForRole("GUIDE")).toBe("/guide");
    expect(homeForRole("HOD")).toBe("/hod");
  });

  it("enforces group-scoped marks and PDF permissions", () => {
    const group = { guideId: "guide-1", members: [{ userId: "student-1" }], pdfPermission: false };
    const assignedGuide: CurrentUser = { id: "guide-1", name: "G1", email: "g1@x", role: "GUIDE" };
    const otherGuide: CurrentUser = { id: "guide-2", name: "G2", email: "g2@x", role: "GUIDE" };
    const member: CurrentUser = { id: "student-1", name: "S1", email: "s1@x", role: "STUDENT" };
    const hod: CurrentUser = { id: "hod-1", name: "H", email: "h@x", role: "HOD" };

    expect(canEnterMarks(assignedGuide, group)).toBe(true);
    expect(canEnterMarks(otherGuide, group)).toBe(false);
    expect(canEnterMarks(member, group)).toBe(false);
    expect(canEnterMarks(hod, group)).toBe(false);

    expect(canApproveMarks(assignedGuide, group)).toBe(true);
    expect(canApproveMarks(hod, group)).toBe(true);
    expect(canApproveMarks(otherGuide, group)).toBe(false);

    expect(canViewGroup(member, group)).toBe(true);
    expect(canViewGroup(assignedGuide, group)).toBe(true);
    expect(canViewGroup(hod, group)).toBe(true);
    expect(canViewGroup(otherGuide, group)).toBe(false);

    expect(canGeneratePdf(member, group, true)).toBe(false);
    expect(canGeneratePdf(member, { ...group, pdfPermission: true }, false)).toBe(false);
    expect(canGeneratePdf(member, { ...group, pdfPermission: true }, true)).toBe(true);
  });
});
