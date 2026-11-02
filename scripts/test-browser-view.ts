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

async function main() {
  const chromePath = await resolveChrome();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    const sessionToken = await encode({
      token: {
        id: "cmvulwio10008g0cvppdqlw95", // Shreyas
        name: "Shreyas Deshmukh",
        email: "shreyas.deshmukh@abmspcoerpune.org",
        role: "STUDENT",
        sub: "cmvulwio10008g0cvppdqlw95",
      },
      secret: process.env.NEXTAUTH_SECRET || "dev-only-secret-change-me-0123456789abcdef",
    });

    await page.setCookie({
      name: "next-auth.session-token",
      value: sessionToken,
      url: "http://localhost:3000",
      path: "/",
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (req) =>
      console.log("REQUEST FAILED:", req.url(), req.failure()?.errorText)
    );
    page.on("response", (res) => {
      if (res.url().includes("/media/") || res.url().includes(".jpg") || res.url().includes(".png")) {
        console.log("RESPONSE:", res.status(), res.url(), res.headers()["content-type"]);
      }
    });

    console.log("Navigating to http://localhost:3000/student/members...");
    const res = await page.goto("http://localhost:3000/student/members", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    console.log("Response status:", res?.status());
    console.log("Final URL:", page.url());

    await page.waitForSelector(".paper-page", { timeout: 10000 });

    // Inspect all images in the document
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.map((img) => ({
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        displayedWidth: img.clientWidth,
        displayedHeight: img.clientHeight,
        visible: img.offsetParent !== null,
      }));
    });

    console.log("Images found on page:", JSON.stringify(images, null, 2));

    // Also check PhotoBox text if any
    const photoBoxes = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll(".paper-photo-box"));
      return boxes.map((b) => b.textContent?.trim());
    });
    console.log("Empty photo boxes count:", photoBoxes.length, photoBoxes);

    // Save screenshot
    await page.screenshot({ path: "var/student-members-screenshot.png" });
    console.log("Screenshot saved to var/student-members-screenshot.png");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
