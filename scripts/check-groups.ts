import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function run() {
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      groupNo: true,
      status: true,
      pdfPermission: true,
      isSponsored: true,
      projectTitle: true,
      members: {
        select: {
          id: true,
          userId: true,
          name: true,
          memberType: true,
          user: { select: { email: true } },
        },
      },
    },
  });
  console.log("Found", groups.length, "groups:");
  for (const g of groups) {
    console.log(`- ${g.groupNo} (${g.id}): status=${g.status}, pdfPermission=${g.pdfPermission}, members=${g.members.length}`);
    for (const m of g.members) {
      console.log(`    member: ${m.name} (${m.user?.email}) [${m.memberType}]`);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
