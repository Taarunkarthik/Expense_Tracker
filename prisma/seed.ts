import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Housing", color: "#ef4444" },
  { name: "Food", color: "#f97316" },
  { name: "Transport", color: "#eab308" },
  { name: "Utilities", color: "#22c55e" },
  { name: "Health", color: "#06b6d4" },
  { name: "Savings", color: "#3b82f6" },
  { name: "Subscriptions", color: "#8b5cf6" },
  { name: "Other", color: "#64748b" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { color: category.color },
      create: category,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
