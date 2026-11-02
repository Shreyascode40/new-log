import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { removeDemoGroup } from "./seed-demo-group.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Removing demo group and associated demo accounts...");
  await removeDemoGroup();
  console.log("Demo group removed successfully without altering any other data.");
}

main()
  .catch((err) => {
    console.error("Removal failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
