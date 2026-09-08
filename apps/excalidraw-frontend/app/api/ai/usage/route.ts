import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await prismaClient.aIUsage.groupBy({
    by: ["task"],
    where: { userId, createdAt: { gte: since } },
    _count: true,
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const freeUsedToday = await prismaClient.aIUsage.count({
    where: { userId, credentialId: null, createdAt: { gte: today } },
  });

  return NextResponse.json({
    freeUsedToday,
    byTask: rows.map((r) => ({
      task: r.task,
      calls: r._count,
      costUsd: r._sum.costUsd ?? 0,
      tokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
    })),
  });
}
