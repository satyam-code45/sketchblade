import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  // No cap: these are replayed from the start to rebuild the board, so
  // dropping events from either end loses shapes.
  const events = await prismaClient.boardEvent.findMany({
    where: { roomId: id },
    orderBy: { id: "asc" },
    select: { payload: true },
  });

  return NextResponse.json({ events: events.map((e) => e.payload) });
}
