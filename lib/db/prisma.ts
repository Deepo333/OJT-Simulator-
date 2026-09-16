import { PrismaClient } from "@prisma/client";

// Prisma client singleton — avoids exhausting DB connections in Next.js dev
// where the module graph is re-evaluated on every HMR pass.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
