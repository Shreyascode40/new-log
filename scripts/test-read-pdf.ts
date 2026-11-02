import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";
import { readGeneratedPdf } from "../apps/web/lib/upload.js";

async function main() {
  const exports = await prisma.pdfExport.findMany();
  console.log(`Found ${exports.length} PDF exports in DB:`);
  for (const exp of exports) {
    try {
      const bytes = await readGeneratedPdf(exp.fileUrl);
      console.log(`OK: Export ${exp.id} (${exp.fileUrl}) -> read ${bytes.byteLength} bytes`);
    } catch (err: any) {
      console.log(`FAIL: Export ${exp.id} (${exp.fileUrl}) -> ${err.message}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
