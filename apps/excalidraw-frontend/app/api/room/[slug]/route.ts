import { NextResponse } from "next/server";
import { prismaClient } from "@repo/db/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await prismaClient.room.findFirst({ where: { slug } });
  if (!room) return NextResponse.json({ room: null });

  return NextResponse.json({
    room: { id: room.id, slug: room.slug, name: room.name, hasPassword: !!room.password },
  });
}
