import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import puppeteer from "puppeteer-core";
import { encode } from "next-auth/jwt";
import { existsSync } from "node:fs";

async function resolveChrome(): Promise<string> {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("Chrome not found");
}

async function testUser(browser: any, user: { id: string; name: string; email: string; label: string }) {
  console.log(`\n========================================`);
  console.log(`Testing user: ${user.name} (${user.email}) - ${user.label}`);
  console.log(`========================================`);

  const page = await browser.newPage();
  try {
    const token = await encode({
      token: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "STUDENT",
        sub: user.id,
      },
      secret: process.env.NEXTAUTH_SECRET || "dev-only-secret-change-me-0123456789abcdef",
    });

    await page.setCookie({
      name: "next-auth.session-token",
      value: token,
      url: "http://localhost:3000",
      path: "/",
    });

    let networkErrors = 0;
    page.on("response", (res: any) => {
      if (res.url().includes("/media/") || res.url().includes("/api/files/")) {
        console.log(`  [HTTP ${res.status()}] ${res.url()}`);
        if (res.status() >= 400) networkErrors++;
      }
    });

    await page.goto("http://localhost:3000/student/members", { waitUntil: "networkidle0" });

    // Inspect sheet 1 images
    const imagesSheet1 = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      }));
    });

    console.log(`  Sheet 1 images count: ${imagesSheet1.length}`);
    for (const img of imagesSheet1) {
      console.log(`    - ${img.alt || "image"}: ${img.src} (natural: ${img.naturalWidth}x${img.naturalHeight}, complete: ${img.complete})`);
    }

    // Now test clicking Sheet 2 thumbnail if available
    const hasSheet2 = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("button, a"));
      const s2 = items.find((el) => el.textContent?.includes("Group Information (3–4)") || el.textContent?.includes("3–4"));
      if (s2) {
        (s2 as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (hasSheet2) {
      await new Promise((r) => setTimeout(r, 1000));
      const imagesSheet2 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("img")).map((img) => ({
          src: img.src,
          alt: img.alt,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
        }));
      });
      console.log(`  Sheet 2 images count: ${imagesSheet2.length}`);
      for (const img of imagesSheet2) {
        console.log(`    - ${img.alt || "image"}: ${img.src} (natural: ${img.naturalWidth}x${img.naturalHeight}, complete: ${img.complete})`);
      }
    }

    console.log(`  Total network errors on media: ${networkErrors}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const chromePath = await resolveChrome();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
  });

  try {
    // 1. Shreyas More (Group 01)
    await testUser(browser, {
      id: "cmvuoj5v0000mmbtgvyidmbh1",
      name: "Shreyas More",
      email: "shreyasvmore803@gmail.com",
      label: "Group 01",
    });

    // 2. Aditya Shirole (Group 12)
    await testUser(browser, {
      id: "cmvuoltgo0010mbtg59bu9vy1",
      name: "Aditya shirole",
      email: "adityashirole898@gmail.com",
      label: "Group 12",
    });

    // 3. Shreyas Deshmukh (Group COMP-BE-2025-01)
    await testUser(browser, {
      id: "cmvulwfgf0004g0cv5528cf2v",
      name: "Shreyas Deshmukh",
      email: "shreyas.deshmukh@abmspcoerpune.org",
      label: "Group COMP-BE-2025-01",
    });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
