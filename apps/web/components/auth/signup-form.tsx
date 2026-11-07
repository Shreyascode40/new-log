"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signUpAction, resendVerificationAction } from "@/lib/actions/auth";
import { signupSchema } from "@/lib/validation/auth";

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm({ verificationRequired }: { verificationRequired: boolean }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verificationUrl?: string; message?: string } | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendDevUrl, setResendDevUrl] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", rollNo: "", mobile: "", password: "" },
  });

  async function handleResendVerification() {
    if (!registeredEmail) return;
    setIsResending(true);
    setResendStatus(null);
    setResendDevUrl(null);

    const result = await resendVerificationAction({ email: registeredEmail });
    setIsResending(false);

    if (result.success) {
      setResendStatus("A new verification link has been sent to your email.");
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
    } else {
      setResendStatus(result.error);
    }
  }

  async function onSubmit(values: SignupValues) {
    setFormError(null);
    setResendStatus(null);
    const result = await signUpAction(values);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setRegisteredEmail(values.email);
    setDone(result.data);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            {verificationRequired
              ? done.message || "Your account has been created. Please check your email to verify your account."
              : "Your account has been created. You can sign in right away."}
          </AlertDescription>
        </Alert>

        {verificationRequired ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or click below to resend.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResendVerification}
              disabled={isResending || cooldown > 0}
              className="w-full text-xs"
            >
              {isResending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : "Resend verification email"}
            </Button>
          </div>
        ) : null}

        {resendStatus ? (
          <Alert>
            <AlertDescription>{resendStatus}</AlertDescription>
          </Alert>
        ) : null}

        {done.verificationUrl || resendDevUrl ? (
          <Alert>
            <AlertDescription>
              <span className="font-medium">Development link:</span>{" "}
              <Link className="underline" href={resendDevUrl || done.verificationUrl || "#"}>
                Verify my email
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">College email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="rollNo">Roll number</Label>
          <Input id="rollNo" {...register("rollNo")} />
          {errors.rollNo ? <p className="text-xs text-destructive">{errors.rollNo.message}</p> : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input id="mobile" inputMode="numeric" {...register("mobile")} />
          {errors.mobile ? <p className="text-xs text-destructive">{errors.mobile.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create student account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Staff accounts (guide / HOD) are created by the Head of Department, not here.
      </p>
    </form>
  );
}
