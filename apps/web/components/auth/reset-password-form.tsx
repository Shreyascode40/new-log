"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resetPasswordAction } from "@/lib/actions/auth";

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "The two passwords do not match",
    path: ["confirm"],
  });

type Values = z.infer<typeof formSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const result = await resetPasswordAction({ token, password: values.password });
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setDoneMessage(result.data?.message || "Password updated successfully. Redirecting you to sign in…");
    setTimeout(() => router.push("/login"), 2000);
  }

  if (doneMessage) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>{doneMessage}</AlertDescription>
        </Alert>
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
          <AlertDescription>
            <div className="space-y-2">
              <p>{formError}</p>
              {formError.includes("expired") || formError.includes("invalid") ? (
                <div className="pt-1">
                  <Button asChild variant="outline" size="sm" className="text-xs">
                    <Link href="/forgot-password">Request a new reset link</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Enter new password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder="Confirm new password"
          {...register("confirm")}
        />
        {errors.confirm ? (
          <p className="text-xs text-destructive">{errors.confirm.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Resetting password…" : "Reset password"}
      </Button>

      <div className="text-center pt-2">
        <Link href="/login" className="text-xs text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
