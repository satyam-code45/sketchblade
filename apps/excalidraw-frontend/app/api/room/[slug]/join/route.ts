import { NextResponse } from "next/server";
import { prismaClient } from "@repo/db/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { password } = await req.json();

  const room = await prismaClient.room.findFirst({ where: { slug } });
  if (!room) return NextResponse.json({ message: "Room not found." }, { status: 404 });

  if (room.password) {
    if (!password) {
      return NextResponse.json({ message: "This room is password protected." }, { status: 401 });
    }
    if (password !== room.password) {
      return NextResponse.json({ message: "Incorrect room password." }, { status: 401 });
    }
  }

  return NextResponse.json({ roomId: room.id });
}
