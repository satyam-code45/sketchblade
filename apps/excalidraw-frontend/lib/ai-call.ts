import type { ZodType } from "zod";
import { prismaClient } from "@/lib/prisma";
import { generate, resolveCredential, type AITask } from "@repo/ai";

// Shared path for every AI route: resolve whose key pays, call, record usage.
export async function callAI<T>(opts: {
  userId: string;
  task: AITask;
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
}) {
  const [pref, credential, platformCallsToday] = await Promise.all([
    prismaClient.aIPreference.findUnique({ where: { userId: opts.userId } }),
    resolveActiveCredential(opts.userId),
    countPlatformCallsToday(opts.userId),
  ]);

  const resolved = resolveCredential(opts.task, pref, credential, platformCallsToday);

  const result = await generate({
    task: opts.task,
    system: opts.system,
    user: opts.user,
    schema: opts.schema,
    schemaName: opts.schemaName,
    apiKey: resolved.apiKey,
    model: resolved.model,
  });

  await prismaClient.aIUsage.create({
    data: {
      userId: opts.userId,
      task: opts.task,
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      credentialId: resolved.credentialId,
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

async function resolveActiveCredential(userId: string) {
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

function countPlatformCallsToday(userId: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return prismaClient.aIUsage.count({
    where: { userId, credentialId: null, createdAt: { gte: since } },
  });
}
