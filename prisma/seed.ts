import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoEmail = "demo@career-forge.local";

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo User",
      currentRole: "Marketing Coordinator (3 years)",
      currentSkills: JSON.stringify([
        "Content writing",
        "Google Analytics",
        "Basic HTML/CSS",
        "Email campaign management",
      ]),
    },
  });

  console.log(`Seeded demo user: ${user.email} (id=${user.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
