import { prismaClient } from "@/lib/prisma";

const PER_MINUTE = Number(process.env.AI_CALLS_PER_MINUTE ?? 6);

// Counted from AIUsage rather than process memory so the limit still holds
// when the app runs on more than one instance.
export async function overRateLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000);
  const recent = await prismaClient.aIUsage.count({ where: { userId, createdAt: { gte: since } } });
  return recent >= PER_MINUTE;
}
