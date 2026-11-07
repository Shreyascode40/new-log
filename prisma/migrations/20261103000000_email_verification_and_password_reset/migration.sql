-- AlterTable: Safely add emailVerified to User without dropping any existing column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);

-- Backfill existing users so existing verified users are not locked out
UPDATE "User" SET "emailVerified" = "emailVerifiedAt" WHERE "emailVerifiedAt" IS NOT NULL AND "emailVerified" IS NULL;

-- CreateIndex: Add unique constraint on tokenHash for EmailVerificationToken
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex: Add unique constraint on tokenHash for PasswordResetToken
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
