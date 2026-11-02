import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { prisma } from "../apps/api/src/db.js";

async function main() {
  const nullMembers = await prisma.groupMember.findMany({
    where: { photoUrl: null },
    include: { group: true },
  });
  console.log(`Found ${nullMembers.length} members with null photoUrl:`);
  for (const m of nullMembers) {
    console.log(`- Member: ${m.name} (${m.id}) in group ${m.group.groupNo}`);
  }

  // Sample valid photos available in var/uploads/group-members
  const samples = [
    "/media/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg",
    "/media/group-members/cmv0x2kup000jtmhla7onvof1-1791550138705.png",
    "/media/group-members/cmv0x2kup000ktmhlzlpz0naf-1791550151969.png",
  ];

  let i = 0;
  for (const m of nullMembers) {
    const photoUrl = samples[i % samples.length];
    await prisma.groupMember.update({
      where: { id: m.id },
      data: { photoUrl },
    });
    console.log(`Updated member ${m.name} with photoUrl: ${photoUrl}`);
    i++;
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
