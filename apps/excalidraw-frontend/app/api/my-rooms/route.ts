import { NextResponse } from "next/server";
import { prismaClient } from "@repo/db/client";
import { getUserId } from "@/lib/api-auth";

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const rooms = await prismaClient.room.findMany({
    where: { adminId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      adminId: true,
      password: true,
      createdAt: true,
      updateAt: true,
    },
  });

  return NextResponse.json({ rooms });
}
