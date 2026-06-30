import { PrismaClient } from "../src/generated/prisma/index.js";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}
