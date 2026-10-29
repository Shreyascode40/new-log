const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

process.loadEnvFile(".env");

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || "hod@apcoer.edu.in").trim().toLowerCase();
  const password = args[1] || "Password@123";
  const name = args[2] || "Dr. Anil Deshmukh";

  console.log(`Setting up HOD account...`);
  console.log(`Email: ${email}`);
  console.log(`Name:  ${name}`);

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "HOD",
      passwordHash,
      emailVerifiedAt: now,
      active: true,
    },
    create: {
      email,
      name,
      role: "HOD",
      passwordHash,
      emailVerifiedAt: now,
      active: true,
      createdVia: "HOD_CREATED",
    },
  });

  console.log("\n SUCCESS! HOD account is live in the database:");
  console.log("---------------------------------------------");
  console.log(` User ID:  ${user.id}`);
  console.log(` Name:     ${user.name}`);
  console.log(` Email:    ${user.email}`);
  console.log(` Password: ${password}`);
  console.log(` Role:     ${user.role}`);
  console.log("---------------------------------------------");
}

main()
  .catch((err) => {
    console.error("Failed to upsert HOD account:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
