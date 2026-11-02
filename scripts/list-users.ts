import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function main() {
  const users = await prisma.user.findMany({
    include: { memberships: { include: { group: true } } },
  });
  for (const u of users) {
    console.log(u.id, u.email, u.name, u.role, u.memberships.map((m) => ({
      groupNo: m.group.groupNo,
      groupId: m.groupId,
      name: m.name,
      photoUrl: m.photoUrl,
    })));
  }

  const logs = await prisma.auditLog.findMany({
    where: { action: { contains: "PHOTO" } },
  });
  console.log("\nPHOTO LOGS:", logs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
