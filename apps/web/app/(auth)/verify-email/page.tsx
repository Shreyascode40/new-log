import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthError, verifyEmail } from "@/lib/services/auth";
import { VerifyEmailView } from "@/components/auth/verify-email-view";

export const metadata = { title: "Verify email — Digital BE Log Book" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token;
  let errorMessage: string | null = null;
  let errorCode: string | null = null;
  let verifiedEmail: string | null = null;
  let alreadyVerified = false;

  if (!token) {
    errorMessage = "This link is missing its verification token.";
    errorCode = "INVALID_TOKEN";
  } else {
    try {
      const result = await verifyEmail(token);
      verifiedEmail = result.email;
      alreadyVerified = Boolean(result.alreadyVerified);
    } catch (e) {
      if (e instanceof AuthError) {
        errorMessage = e.message;
        errorCode = e.code;
      } else {
        errorMessage = "We could not verify this link. Please request a new one.";
        errorCode = "UNKNOWN";
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>Activate your account to sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyEmailView
          verifiedEmail={verifiedEmail}
          alreadyVerified={alreadyVerified}
          errorMessage={errorMessage}
          errorCode={errorCode}
        />
      </CardContent>
    </Card>
  );
}
