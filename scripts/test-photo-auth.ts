import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";
import { authorizeFileAccess } from "../apps/api/src/modules/pdf.js";

async function main() {
  const users = await prisma.user.findMany({
    include: { memberships: { include: { group: true } } }
  });
  for (const u of users) {
    for (const m of u.memberships) {
      if (!m.photoUrl) continue;
      try {
        await authorizeFileAccess({ id: u.id, role: u.role }, m.photoUrl);
        console.log(`OK: ${u.name} (${u.email}) can access own photo: ${m.photoUrl.slice(0, 30)}...`);
      } catch (err: any) {
        console.log(`FAIL: ${u.name} (${u.email}) CANNOT access own photo:`, err.message, err.status);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
