"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resendVerificationAction } from "@/lib/actions/auth";

type Props = {
  verifiedEmail: string | null;
  alreadyVerified?: boolean;
  errorMessage: string | null;
  errorCode?: string | null;
};

export function VerifyEmailView({
  verifiedEmail,
  alreadyVerified,
  errorMessage,
  errorCode,
}: Props) {
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendDevUrl, setResendDevUrl] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    setResendStatus(null);
    setResendDevUrl(null);

    const result = await resendVerificationAction({ email: resendEmail.trim() });
    setIsResending(false);

    if (result.success) {
      if (result.data.alreadyVerified) {
        setResendStatus("This email is already verified. You can sign in right away.");
      } else {
        setResendStatus("A new verification link has been sent. Please check your inbox.");
        if (result.data.verificationUrl) {
          setResendDevUrl(result.data.verificationUrl);
        }
        setCooldown(60);
        const timer = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      setResendStatus(result.error);
    }
  }

  // 1. Successfully verified
  if (verifiedEmail) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            {alreadyVerified ? (
              <span>
                Your email <span className="font-semibold">{verifiedEmail}</span> is already verified. You can sign in.
              </span>
            ) : (
              <span>
                Your email <span className="font-semibold">{verifiedEmail}</span> has been successfully verified! You can now sign in to access your Project Logbook.
              </span>
            )}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  // 2. Failed / Expired / Invalid
  const isExpired = errorCode === "EXPIRED_TOKEN" || errorMessage?.toLowerCase().includes("expired");

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertDescription>
          {errorMessage || "We could not verify your email link."}
        </AlertDescription>
      </Alert>

      <div className="rounded border p-4 bg-muted/30 space-y-3">
        <h3 className="text-sm font-medium">Request a new verification link</h3>
        <p className="text-xs text-muted-foreground">
          {isExpired
            ? "Your verification link has expired (valid for 30 minutes). Enter your email to receive a fresh link."
            : "Enter your registered college email address to receive a new verification link."}
        </p>

        <form onSubmit={handleResend} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="resend-email" className="text-xs">
              College email
            </Label>
            <Input
              id="resend-email"
              type="email"
              placeholder="e.g. student@apcoer.edu.in"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isResending || cooldown > 0 || !resendEmail.trim()}
            className="w-full"
          >
            {isResending
              ? "Sending…"
              : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Resend verification email"}
          </Button>
        </form>

        {resendStatus ? (
          <Alert className="mt-2">
            <AlertDescription className="text-xs">{resendStatus}</AlertDescription>
          </Alert>
        ) : null}

        {resendDevUrl ? (
          <Alert className="mt-2">
            <AlertDescription className="text-xs">
              <span className="font-medium">Dev link:</span>{" "}
              <Link className="underline" href={resendDevUrl}>
                Verify my email
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
