import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { backendApi } from "../apps/web/lib/backend-api";

async function main() {
  // Let's test with Shreyas Deshmukh's member id: cmvunh84b000eewu592ux6we6
  // Or find Shreyas's member id
  const fs = await import("node:fs");
  const testBytes = fs.readFileSync("var/uploads/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg");
  
  // Actor header is added by backendApi when session exists, or let's call fetch directly with x-internal-user header:
  const secret = process.env.API_INTERNAL_SECRET!;
  const payload = Buffer.from(
    JSON.stringify({ sub: "cmvuoltgo0010mbtg59bu9vy1", aud: "be-logbook-api", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  const { createHmac } = await import("node:crypto");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;

  const res = await fetch("http://localhost:4000/v1/student/group-info/members/cmvuoodqz001ambtgx25b9co0/photo", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "image/jpeg",
    },
    body: testBytes,
  });

  console.log("Upload test response:", res.status, await res.text());
}

main().catch(console.error);
