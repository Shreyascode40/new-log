import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function main() {
  const user = await prisma.user.findFirstOrThrow({
    where: { email: "shreyas.deshmukh@abmspcoerpune.org" },
  });

  // Log in
  const csrfRes = await fetch("http://localhost:3000/api/auth/csrf");
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = csrfRes.headers.getSetCookie();
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");

  const loginRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
    },
    body: new URLSearchParams({
      csrfToken,
      email: user.email,
      password: "Password@123",
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  const loginCookies = loginRes.headers.getSetCookie();
  const allCookies = [...csrfCookies, ...loginCookies].map((c) => c.split(";")[0]).join("; ");

  console.log("Fetching http://localhost:3000/student/members...");
  const res = await fetch("http://localhost:3000/student/members", {
    headers: { cookie: allCookies },
  });
  console.log("Status:", res.status);
  const html = await res.text();
  console.log("HTML contains img:", html.includes("<img"));
  console.log("HTML contains /media/group-members:", html.includes("/media/group-members"));

  const matches = html.match(/src="[^"]+"/g);
  console.log("Image src matches:", matches);
}

main().catch(console.error).finally(() => prisma.$disconnect());
