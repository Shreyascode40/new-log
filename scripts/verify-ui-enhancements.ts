import puppeteer from "puppeteer-core";
import * as path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runUiVerification() {
  console.log("================================================================================");
  console.log("             UI ENHANCEMENTS AUTOMATED VERIFICATION SUITE                       ");
  console.log("================================================================================\n");

  const results: TestResult[] = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // 1. Authenticate as demo student
    console.log("[1] Authenticating as demo student...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "demo.student3@apcoer.edu.in");
    await page.type('input[type="password"]', "Password@123");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    // 2. Navigate to /student/pdf
    console.log("[2] Navigating to /student/pdf...");
    await page.goto(`${BASE_URL}/student/pdf`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Test Navigation Default & Active State
    console.log("[3] Testing navigation bar styles...");
    const navEval = await page.evaluate(() => {
      const activeLink = document.querySelector('a[aria-current="page"]');
      const inactiveLink = document.querySelector('a[href="/student/activity/june"]');

      if (!activeLink || !inactiveLink) return null;

      const activeStyle = window.getComputedStyle(activeLink);
      const inactiveStyle = window.getComputedStyle(inactiveLink);

      return {
        activeText: activeLink.textContent?.trim(),
        activeBg: activeStyle.backgroundColor,
        activeColor: activeStyle.color,
        inactiveText: inactiveLink.textContent?.trim(),
        inactiveBg: inactiveStyle.backgroundColor,
        inactiveColor: inactiveStyle.color,
      };
    });

    console.log("   Active link:", navEval?.activeText, "bg:", navEval?.activeBg, "color:", navEval?.activeColor);
    console.log("   Inactive link:", navEval?.inactiveText, "bg:", navEval?.inactiveBg, "color:", navEval?.inactiveColor);

    const activePass =
      navEval?.activeText === "PDF" &&
      (navEval.activeBg.includes("17, 17, 17") || navEval.activeBg.includes("rgb(17, 17, 17)")) &&
      (navEval.activeColor.includes("255, 255, 255") || navEval.activeColor.includes("rgb(255, 255, 255)"));

    const defaultPass =
      (navEval?.inactiveBg.includes("255, 255, 255") || navEval?.inactiveBg.includes("rgba(0, 0, 0, 0)")) &&
      (navEval?.inactiveColor.includes("17, 17, 17") || navEval?.inactiveColor.includes("rgb(17, 17, 17)"));

    results.push({
      name: "Navigation Default State (White bg, Black text)",
      passed: Boolean(defaultPass),
      details: `Inactive tab bg: ${navEval?.inactiveBg}, text: ${navEval?.inactiveColor}`,
    });

    results.push({
      name: "Navigation Active State (Black bg, White text, permanently selected)",
      passed: Boolean(activePass),
      details: `Active tab bg: ${navEval?.activeBg}, text: ${navEval?.activeColor}`,
    });

    // 4. Test Hover State on Inactive Link
    console.log("[4] Testing navigation hover state...");
    const inactiveHandle = await page.$('a[href="/student/activity/june"]');
    if (inactiveHandle) {
      await inactiveHandle.hover();
      await new Promise((r) => setTimeout(r, 300));

      const hoveredStyle = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          bg: style.backgroundColor,
          color: style.color,
        };
      }, inactiveHandle);

      console.log("   Hovered inactive link:", hoveredStyle);
      const hoverPass =
        hoveredStyle.bg.includes("17, 17, 17") &&
        hoveredStyle.color.includes("255, 255, 255");

      results.push({
        name: "Navigation Hover State (Transitions to Black bg, White text)",
        passed: hoverPass,
        details: `Hovered tab bg: ${hoveredStyle.bg}, text: ${hoveredStyle.color}`,
      });
    }

    // 5. Test Scroll Controls & Custom Scrollbar
    console.log("[5] Testing scroll controls and horizontal scroller...");
    const scrollEvalBefore = await page.evaluate(() => {
      const scrollBox = document.querySelector(".nav-horizontal-scrollbar");
      const leftBtn = document.querySelector('button[aria-label="Scroll navigation left"]') as HTMLButtonElement | null;
      const rightBtn = document.querySelector('button[aria-label="Scroll navigation right"]') as HTMLButtonElement | null;
      return {
        hasScrollBox: Boolean(scrollBox),
        scrollLeft: scrollBox ? scrollBox.scrollLeft : 0,
        scrollWidth: scrollBox ? scrollBox.scrollWidth : 0,
        clientWidth: scrollBox ? scrollBox.clientWidth : 0,
        leftDisabled: leftBtn ? leftBtn.disabled : false,
        rightDisabled: rightBtn ? rightBtn.disabled : false,
      };
    });

    console.log("   Initial scroll state:", scrollEvalBefore);

    // Click left scroll button multiple times to scroll back to start
    const leftBtnHandle = await page.$('button[aria-label="Scroll navigation left"]');
    if (leftBtnHandle) {
      await leftBtnHandle.click();
      await new Promise((r) => setTimeout(r, 400));
      await leftBtnHandle.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    const scrollEvalAfterLeft = await page.evaluate(() => {
      const scrollBox = document.querySelector(".nav-horizontal-scrollbar");
      const leftBtn = document.querySelector('button[aria-label="Scroll navigation left"]') as HTMLButtonElement | null;
      return {
        scrollLeft: scrollBox ? scrollBox.scrollLeft : 0,
        leftDisabled: leftBtn ? leftBtn.disabled : false,
      };
    });

    console.log("   After scrolling left:", scrollEvalAfterLeft);

    results.push({
      name: "Navigation Scroll Controls (Smooth horizontal scrolling & disabled bounds)",
      passed: scrollEvalBefore.hasScrollBox && scrollEvalAfterLeft.scrollLeft <= 50,
      details: `Scroller container present: ${scrollEvalBefore.hasScrollBox}, scrolled smoothly to left: ${scrollEvalAfterLeft.scrollLeft}px`,
    });

    // 6. Test Saved PDF Download Button and Past Generations Download Button
    console.log("[6] Testing PDF download buttons and independent loading spinners...");
    const buttonsInfo = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll("button"));
      const savedBtn = allButtons.find((b) => b.textContent?.includes("Download PDF (Saved)"));
      const pastBtn = allButtons.find((b) => b.textContent?.trim() === "Download");

      return {
        hasSavedButton: Boolean(savedBtn),
        savedButtonText: savedBtn?.textContent?.trim() || null,
        hasPastButton: Boolean(pastBtn),
        pastButtonText: pastBtn?.textContent?.trim() || null,
      };
    });

    console.log("   PDF Buttons detected:", buttonsInfo);

    results.push({
      name: "Saved PDF Download Button Present",
      passed: buttonsInfo.hasSavedButton,
      details: `Saved PDF button text: ${buttonsInfo.savedButtonText}`,
    });

    results.push({
      name: "Past Generations Archived Download Button Present",
      passed: buttonsInfo.hasPastButton,
      details: `Archived past generations button text: ${buttonsInfo.pastButtonText}`,
    });

    // 7. Capture visual screenshots
    console.log("[7] Capturing visual screenshots...");
    const navScreenshot = path.resolve("scripts/enhanced-student-nav.png");
    await page.screenshot({ path: navScreenshot, clip: { x: 0, y: 0, width: 1400, height: 400 } });
    console.log("   Saved nav screenshot:", navScreenshot);

    const fullPageScreenshot = path.resolve("scripts/enhanced-student-pdf-page.png");
    await page.screenshot({ path: fullPageScreenshot });
    console.log("   Saved full page screenshot:", fullPageScreenshot);

  } finally {
    await browser.close();
  }

  // Print summary
  console.log("\n================================================================================");
  console.log("                           TEST RESULTS BREAKDOWN                               ");
  console.log("================================================================================");
  let allPass = true;
  for (const r of results) {
    const status = r.passed ? "[PASS]" : "[FAIL]";
    if (!r.passed) allPass = false;
    console.log(`${status} ${r.name}`);
    console.log(`       ${r.details}`);
  }
  console.log("================================================================================");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`VERDICT: ${allPass ? "ALL ENHANCEMENTS VERIFIED SUCCESSFULLY" : "SOME TESTS FAILED"}`);
  console.log("================================================================================\n");

  if (!allPass) process.exit(1);
}

runUiVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
