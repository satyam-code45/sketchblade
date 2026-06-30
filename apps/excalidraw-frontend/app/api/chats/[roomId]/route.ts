import { NextResponse } from "next/server";
import { prismaClient } from "@repo/db/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  const messages = await prismaClient.chat.findMany({
    where: { roomId: id },
    orderBy: { id: "asc" },
    take: 200,
  });

  return NextResponse.json({ messages });
}
