import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  const snapshot = await prismaClient.boardEvent.findFirst({
    where: { roomId: id, kind: "snapshot" },
    orderBy: { id: "desc" },
  });

  // A snapshot records the last event it covers, so a draw that landed while it
  // was being written is still replayed rather than swallowed.
  let upTo = 0;
  let shapes: unknown[] = [];
  if (snapshot) {
    try {
      const parsed = JSON.parse(snapshot.payload);
      upTo = parsed.upTo ?? 0;
      shapes = parsed.shapes ?? [];
    } catch {}
  }

  const events = await prismaClient.boardEvent.findMany({
    where: { roomId: id, kind: { not: "snapshot" }, id: { gt: upTo } },
    orderBy: { id: "asc" },
    select: { id: true, payload: true },
  });

  return NextResponse.json({
    shapes,
    events: events.map((e) => e.payload),
    lastEventId: events.at(-1)?.id ?? upTo,
  });
}
