import { NextResponse } from "next/server";
import { prismaClient } from "@repo/db/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const id = Number(roomId);
  if (isNaN(id)) return NextResponse.json({ message: "Invalid room ID" }, { status: 400 });

  const room = await prismaClient.room.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ room: null }, { status: 404 });

  return NextResponse.json({
    room: { id: room.id, slug: room.slug, name: room.name, hasPassword: !!room.password },
  });
}
