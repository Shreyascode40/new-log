
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
  console.log(".env loaded");
} catch (error) {
  console.log("Could not load root .env:", String(error));
}

async function main() {
  // Import Prisma only after loading environment variables
  const { prisma } = await import("../apps/api/src/db.js");

  try {
    // Identify the database connection without printing credentials
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      const parsed = new URL(dbUrl);

      console.log("\n=== CONNECTION INFO ===");
      console.log("Database host:", parsed.hostname);
      console.log("Database name:", parsed.pathname);
    } else {
      console.log("DATABASE_URL is not set");
    }

    // Identify the actual database and schema
    const connection = await prisma.$queryRaw`
      SELECT
        current_database() AS database_name,
        current_schema() AS current_schema,
        current_user AS database_user
    `;

    console.log("\n=== ACTIVE DATABASE ===");
    console.log(connection);

    // List all tables visible to this database connection
    const tables = await prisma.$queryRaw`
      SELECT
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN (
          'pg_catalog',
          'information_schema'
        )
      ORDER BY table_schema, table_name
    `;

    console.log("\n=== DATABASE TABLES ===");
    console.log(tables);

    // Existing database audit
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    console.log("\n=== DATABASE AUDIT SUMMARY ===");
    console.log("Total Users:", users.length);

    for (const u of users) {
      console.log(
        ` - ${u.role}: ${u.name} (${u.email}) [Active: ${u.active}]`
      );
    }

    console.log("Groups:", await prisma.group.count());
    console.log("Group Members:", await prisma.groupMember.count());
    console.log("Activity Entries:", await prisma.activityEntry.count());
    console.log("Review Forms:", await prisma.reviewForm.count());
    console.log("Marks Sheets:", await prisma.marksSheet.count());
    console.log("Competitions:", await prisma.competition.count());
    console.log("Papers:", await prisma.paperPublication.count());
    console.log("PDF Exports:", await prisma.pdfExport.count());
    console.log("Audit Logs:", await prisma.auditLog.count());

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
