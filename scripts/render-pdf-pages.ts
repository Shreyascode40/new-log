import puppeteer from "puppeteer-core";
import * as path from "node:path";
import * as fs from "node:fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const pdfPath = path.join(process.cwd(), "scripts", "e2e-verified-logbook.pdf");

async function renderMultiplePages() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.5 });

  const outDir = path.join(process.cwd(), "scripts", "pdf-visual-pages");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const pagesToCapture = [
    { pageNum: 1, name: "page-01-cover" },
    { pageNum: 2, name: "page-02-rules" },
    { pageNum: 3, name: "page-03-members" },
    { pageNum: 4, name: "page-04-undertaking" },
    { pageNum: 5, name: "page-05-schedule" },
    { pageNum: 7, name: "page-07-topic1" },
    { pageNum: 9, name: "page-09-activity-june" },
    { pageNum: 19, name: "page-19-review1" },
    { pageNum: 26, name: "page-26-mock-eval" },
    { pageNum: 27, name: "page-27-final-eval" },
    { pageNum: 28, name: "page-28-examiner-t1" },
    { pageNum: 30, name: "page-30-checklist-t1" },
    { pageNum: 32, name: "page-32-competitions" },
    { pageNum: 33, name: "page-33-papers" },
    { pageNum: 34, name: "page-34-notes" },
  ];

  for (const item of pagesToCapture) {
    const fileUrl = `file:///${pdfPath.replace(/\\/g, "/")}#page=${item.pageNum}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });
    // Allow PDF viewer smooth scroll to settle
    await new Promise((r) => setTimeout(r, 600));
    const outPath = path.join(outDir, `${item.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Saved ${item.name}.png`);
  }

  await browser.close();
}

renderMultiplePages().catch(console.error);
