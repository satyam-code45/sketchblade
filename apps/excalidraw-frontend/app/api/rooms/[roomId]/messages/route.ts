import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

const PAGE = 50;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  if (!getUserId(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  // Cursor paging over the [roomId, id] index; before= walks backwards in time.
  const before = Number(new URL(req.url).searchParams.get("before") ?? 0);

  const rows = await prismaClient.chat.findMany({
    where: { roomId: id, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: "desc" },
    take: PAGE,
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user?.name ?? "AI",
      kind: m.kind,
      text: m.message,
      createdAt: m.createdAt,
    })),
    nextCursor: rows.length === PAGE ? rows[0]?.id : null,
  });
}
