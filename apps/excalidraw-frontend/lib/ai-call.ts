import type { ZodType } from "zod";
import { prismaClient } from "@/lib/prisma";
import { generate, resolveCredential, AIError, type AITask } from "@repo/ai";

const PER_MINUTE = Number(process.env.AI_CALLS_PER_MINUTE ?? 6);

// Shared path for every AI route: resolve whose key pays, reserve a slot, call,
// then fill in what it actually cost.
export async function callAI<T>(opts: {
  userId: string;
  task: AITask;
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
}) {
  const [pref, credential] = await Promise.all([
    prismaClient.aIPreference.findUnique({ where: { userId: opts.userId } }),
    activeCredential(opts.userId),
  ]);

  const { usageId, resolved } = await reserve(opts.userId, opts.task, pref, credential);

  const result = await generate({
    task: opts.task,
    system: opts.system,
    user: opts.user,
    schema: opts.schema,
    schemaName: opts.schemaName,
    apiKey: resolved.apiKey,
    model: resolved.model,
  });

  await prismaClient.aIUsage.update({
    where: { id: usageId },
    data: {
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
    },
  });

  if (resolved.credentialId) {
    await prismaClient.aICredential.update({
      where: { id: resolved.credentialId },
      data: { lastUsedAt: new Date() },
    });
  }

  return { result, onPlatformKey: resolved.onPlatformKey };
}

// Counting then inserting races: eight concurrent requests all read zero. An
// advisory lock serialises the whole check per user instead.
async function reserve(
  userId: string,
  task: AITask,
  pref: Awaited<ReturnType<typeof prismaClient.aIPreference.findUnique>>,
  credential: Awaited<ReturnType<typeof activeCredential>>,
) {
  return prismaClient.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const minuteAgo = new Date(Date.now() - 60_000);
    const recent = await tx.aIUsage.count({ where: { userId, createdAt: { gte: minuteAgo } } });
    if (recent >= PER_MINUTE) {
      throw new AIError("rate_limit", "Slow down a moment — too many AI requests.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const platformCallsToday = await tx.aIUsage.count({
      where: { userId, credentialId: null, createdAt: { gte: today } },
    });

    const resolved = resolveCredential(task, pref, credential, platformCallsToday);

    const row = await tx.aIUsage.create({
      data: {
        userId,
        task,
        provider: "openai",
        model: resolved.model ?? "pending",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        credentialId: resolved.credentialId,
      },
      select: { id: true },
    });

    return { usageId: row.id, resolved };
  }, {
    // The advisory lock serialises a burst, so queued callers need longer than
    // Prisma's 5s default before they even get to run.
    maxWait: 20_000,
    timeout: 20_000,
  });
}

async function activeCredential(userId: string) {
  const pref = await prismaClient.aIPreference.findUnique({ where: { userId } });
  const where = pref?.credentialId ? { id: pref.credentialId, userId } : { userId };
  const row = await prismaClient.aICredential.findFirst({ where, orderBy: { createdAt: "desc" } });
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    ciphertext: Buffer.from(row.ciphertext),
    iv: Buffer.from(row.iv),
    authTag: Buffer.from(row.authTag),
    keyVersion: row.keyVersion,
  };
}
