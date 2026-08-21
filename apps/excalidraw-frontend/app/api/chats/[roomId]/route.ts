import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  // No `take` here on purpose. These rows are an event log, not a message list —
  // the client replays all of them to rebuild the board, so windowing from either
  // end drops shapes. Bounded properly by snapshot compaction (spec 01).
  const messages = await prismaClient.chat.findMany({
    where: { roomId: id },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ messages });
}
