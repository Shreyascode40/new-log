import dotenv from "dotenv";
dotenv.config();

import {
  emailProvider,
  getSenderAddress,
  getSmtpConfig,
  verifySmtpHealth,
} from "../apps/api/src/email/index.js";

async function diagnose() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("       Digital BE Project Logbook — Email Diagnostics Tool       ");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const provider = emailProvider();
  console.log(`[1] Detected EMAIL_PROVIDER: "${provider}"`);

  // Check Sender
  try {
    const sender = getSenderAddress();
    console.log(`[2] Configured EMAIL_FROM: "${sender.raw}" (Email: ${sender.email})`);
  } catch (err: any) {
    console.error(`[2] EMAIL_FROM ERROR: ${err.message}`);
  }

  // Check Brevo REST API
  const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
  if (brevoApiKey) {
    console.log(`\n[3] Checking Brevo REST API (api-key: ${brevoApiKey.slice(0, 10)}...):`);
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": brevoApiKey, accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`    >>> SUCCESS: Brevo API Key is VALID! Account: ${(data as any).email || "Active"}`);
      } else {
        console.error(`    >>> FAILED: Brevo API Key returned status ${res.status}: ${(data as any).message || ""}`);
      }
    } catch (e: any) {
      console.error(`    >>> FAILED: Network error reaching Brevo API: ${e.message}`);
    }
  } else {
    console.log("\n[3] Brevo REST API: BREVO_API_KEY is not configured.");
  }

  // Check SMTP
  const smtpUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || "";
  const smtpPass = process.env.BREVO_SMTP_PASSWORD || process.env.SMTP_PASSWORD || "";
  if (smtpUser && smtpPass) {
    const config = getSmtpConfig();
    console.log(`\n[4] Checking SMTP Connection to ${config.host}:${config.port} (user: ${config.user}):`);
    const health = await verifySmtpHealth();
    if (health.ok) {
      console.log("    >>> SUCCESS: SMTP connection & authentication verified!");
    } else {
      console.error(`    >>> FAILED: SMTP check failed with: ${health.error}`);
      if (health.error?.includes("525") || health.error?.includes("Unauthorized IP address")) {
        console.log("\n    [!] DIAGNOSIS: Brevo IP blocking is active for this SMTP key.");
        console.log("        Your server's IP is not in Brevo's Authorized IPs list.");
        console.log("        Solution A: In Brevo -> Settings -> Security -> Authorized IPs, Deactivate IP blocking.");
        console.log("        Solution B: Configure BREVO_API_KEY to send via Brevo HTTPS REST API.");
      }
    }
  } else {
    console.log("\n[4] SMTP: SMTP credentials are not configured.");
  }

  console.log("\n══════════════════════════════════════════════════════════════════\n");
}

diagnose();
