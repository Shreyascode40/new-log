import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function main() {
  const members = await prisma.groupMember.findMany({
    include: { group: true },
  });
  console.log("=== ALL GROUP MEMBERS ===");
  for (const m of members) {
    console.log(`Group: ${m.group.groupNo} | Member: ${m.name} | Photo: ${m.photoUrl}`);
  }

  const certs = await prisma.competition.findMany({ select: { name: true, certificateUrl: true } });
  console.log("\n=== COMPETITIONS ===");
  for (const c of certs) {
    console.log(`Competition: ${c.name} | Certificate: ${c.certificateUrl}`);
  }

  const papers = await prisma.paper.findMany({ select: { title: true, paperUrl: true } });
  console.log("\n=== PAPERS ===");
  for (const p of papers) {
    console.log(`Paper: ${p.title} | URL: ${p.paperUrl}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
