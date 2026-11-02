import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { readStoredUpload, readPrivateUpload } from "../apps/web/lib/upload.js";

async function main() {
  const r1 = await readStoredUpload("group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg");
  console.log("readStoredUpload result:", r1 ? { bytesLen: r1.bytes.byteLength, type: r1.contentType } : null);

  const fileUrl = "/api/files/bG9nYm9vay11cGxvYWRzL2dyb3VwLW1lbWJlcnMvY212MHgya3VwMDAwaHRtaGxuY2Z0ZHZ2di0xNzkxNTQ4NDA3OTg5LmpwZw.jpg";
  try {
    const r2 = await readPrivateUpload(fileUrl);
    console.log("readPrivateUpload result:", { bytesLen: r2.bytes.byteLength, type: r2.contentType });
  } catch (e: any) {
    console.log("readPrivateUpload error:", e.message);
  }
}
main().catch(console.error);
