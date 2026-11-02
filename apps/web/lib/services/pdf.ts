import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { backendApi } from "@/lib/backend-api";
import { AppError } from "@/lib/errors";
import { saveGeneratedPdf } from "@/lib/upload";
import type { CurrentUser } from "@/lib/permissions";
import type { GroupCompletion } from "@/lib/completion/index";

/**
 * Final PDF generation (F16).
 *
 * Puppeteer prints the SAME sheet components via /print/[groupId] (no separate PDF template).
 * Authorization, completion checks, group locking, and export auditing run on the backend API.
 */

export type PdfActor = Pick<CurrentUser, "id" | "role">;

export type PdfGateResult = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
    pdfPermission: boolean;
    isSponsored: boolean;
  };
  completion: GroupCompletion;
};

export async function checkPdfGate(actor: PdfActor, groupId: string): Promise<PdfGateResult> {
  return backendApi<PdfGateResult>(`/v1/pdf/groups/${encodeURIComponent(groupId)}/gate`);
}

type ChromeLaunch = {
  executablePath: string;
  args: string[];
  headless: true | "shell";
};

async function resolveChrome(): Promise<ChromeLaunch> {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        return { executablePath: candidate, args: [], headless: true };
      }
    } catch {
      // try the next candidate
    }
  }
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      // @sparticuz/chromium ships a headless-shell binary. It does not support
      // Puppeteer's `headless: true` (new headless mode) and fails to launch on
      // serverless hosts such as Vercel.
      headless: "shell",
    };
  } catch {
    throw new AppError(
      "PDF_UNAVAILABLE",
      "No Chrome browser found. Configure CHROME_PATH locally or deploy with the bundled serverless Chromium.",
    );
  }
}

export type PdfTransport = { cookie: string; baseUrl: string };

/** Renders /print/[groupId] to A4 PDF bytes with the caller's session. */
export async function renderGroupPdf(groupId: string, transport: PdfTransport): Promise<Buffer> {
  const chrome = await resolveChrome();
  const browser = await puppeteer
    .launch({
      executablePath: chrome.executablePath,
      headless: chrome.headless,
      args: [...chrome.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      protocolTimeout: 180000,
    })
    .catch((error: unknown) => {
      console.error("pdf browser launch failed", error);
      throw new AppError(
        "PDF_UNAVAILABLE",
        "The PDF browser could not be started on this server. Please try again.",
      );
    });
  try {
    const page = await browser.newPage();
    const printUrl = new URL(`/print/${encodeURIComponent(groupId)}`, transport.baseUrl);

    if (transport.cookie) {
      const cookieList = transport.cookie
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const eqIdx = c.indexOf("=");
          if (eqIdx === -1) return null;
          const name = c.slice(0, eqIdx).trim();
          return {
            name,
            value: c.slice(eqIdx + 1).trim(),
            domain: printUrl.hostname,
            path: "/",
            secure: printUrl.protocol === "https:" || name.startsWith("__Secure-"),
            sameSite: "Lax" as const,
          };
        })
        .filter(Boolean) as Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        secure: boolean;
        sameSite: "Lax";
      }>;

      if (cookieList.length > 0) {
        await page.setCookie(...cookieList);
      }
      await page.setExtraHTTPHeaders({ cookie: transport.cookie });
    }

    const response = await page.goto(printUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    if (!response) {
      throw new AppError("PDF_RENDER_FAILED", "The print page did not respond.");
    }
    if (!response.ok()) {
      throw new AppError(
        "PDF_RENDER_FAILED",
        `The print page returned HTTP ${response.status()}.`,
      );
    }
    const finalUrl = new URL(response.url());
    if (finalUrl.origin !== printUrl.origin || finalUrl.pathname !== printUrl.pathname) {
      throw new AppError(
        "PDF_RENDER_FAILED",
        "The print page redirected away. The session may have expired; please sign in and try again.",
      );
    }
    // The print page renders every sheet in one server pass. On a cold
    // serverless instance that can take longer than 30 seconds.
    await page.waitForSelector('[data-pdf-ready="1"]', { timeout: 120000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      // Member photos are part of the printed page. Wait for them so the PDF
      // does not capture blank photo boxes; a failed image still resolves.
      await Promise.all(
        Array.from(document.images).map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              const done = () => resolve();
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
              setTimeout(done, 10000);
            }),
        ),
      );
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateGroupPdf(
  actor: PdfActor,
  groupId: string,
  transport: PdfTransport,
): Promise<{ bytes: Buffer; fileName: string; url: string }> {
  const { group } = await checkPdfGate(actor, groupId);
  const bytes = await renderGroupPdf(groupId, transport);

  const slug = (group.groupNo ?? group.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "group";
  const fileName = `${slug}-${Date.now()}.pdf`;
  const storageRef = await saveGeneratedPdf(fileName, bytes);

  const saved = await backendApi<{ exportId: string; downloadUrl: string }>("/v1/pdf/exports", {
    method: "POST",
    body: JSON.stringify({ groupId, storageRef }),
  });

  return { bytes, fileName, url: saved.downloadUrl };
}

export type PdfExportItem = {
  id: string;
  groupId: string;
  fileUrl: string;
  generatedAt: Date;
};

export async function listPdfExports(groupId: string): Promise<PdfExportItem[]> {
  const list = await backendApi<Array<{ id: string; groupId: string; fileUrl: string; generatedAt: string }>>(
    `/v1/pdf/groups/${encodeURIComponent(groupId)}/exports`,
  );
  return list.map((item) => ({
    ...item,
    generatedAt: new Date(item.generatedAt),
  }));
}
