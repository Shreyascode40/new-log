import puppeteer from "puppeteer-core";
import * as path from "node:path";

async function main() {
  const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Page 3: Members 1 & 2
    const p3Pdf = path.resolve("scripts/page-3.pdf");
    const fileUrlP3 = `file:///${p3Pdf.replace(/\\/g, "/")}`;
    console.log(`Navigating to ${fileUrlP3}...`);
    await page.goto(fileUrlP3, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));
    const p3Path = path.resolve("scripts/page-3-members-1-2.png");
    await page.screenshot({ path: p3Path });
    console.log(`Saved screenshot: ${p3Path}`);

    // Page 4: Members 3 & 4
    const p4Pdf = path.resolve("scripts/page-4.pdf");
    const fileUrlP4 = `file:///${p4Pdf.replace(/\\/g, "/")}`;
    console.log(`Navigating to ${fileUrlP4}...`);
    await page.goto(fileUrlP4, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));
    const p4Path = path.resolve("scripts/page-4-members-3-4.png");
    await page.screenshot({ path: p4Path });
    console.log(`Saved screenshot: ${p4Path}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error).finally(() => process.exit(0));
