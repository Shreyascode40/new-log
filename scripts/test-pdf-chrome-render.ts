import puppeteer from "puppeteer-core";
import * as path from "node:path";
import * as fs from "node:fs";

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const pdfPath = path.resolve("scripts/sample-logbook.pdf");

  console.log("Launching Chrome to render and inspect PDF...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

  // Load the PDF via file URL
  const fileUrl = `file:///${pdfPath.replace(/\\/g, "/")}`;
  console.log(`Navigating to: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: "networkidle0" });

  // Take a full screenshot
  const screenshotPath = path.resolve("scripts/sample-logbook-preview.png");
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
