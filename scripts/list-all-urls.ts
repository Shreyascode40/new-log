import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function main() {
  const m = await prisma.groupMember.findMany({ select: { photoUrl: true } });
  const c = await prisma.competition.findMany({ select: { certificateUrl: true } });
  const p = await prisma.paperPublication.findMany({ select: { fileUrl: true } });
  const cp = await prisma.contentPage.findMany({ select: { fileUrl: true } });
  const s = await prisma.sponsorFeedback.findMany({ select: { sealUrl: true } });
  const pdf = await prisma.pdfExport.findMany({ select: { fileUrl: true } });

  console.log("Member photos:", m.map(x => x.photoUrl).filter(Boolean));
  console.log("Competitions:", c.map(x => x.certificateUrl).filter(Boolean));
  console.log("Papers:", p.map(x => x.fileUrl).filter(Boolean));
  console.log("Content pages:", cp.map(x => x.fileUrl).filter(Boolean));
  console.log("Sponsor seals:", s.map(x => x.sealUrl).filter(Boolean));
  console.log("PDF exports:", pdf.map(x => x.fileUrl).filter(Boolean));
}
main().catch(console.error).finally(() => prisma.$disconnect());
