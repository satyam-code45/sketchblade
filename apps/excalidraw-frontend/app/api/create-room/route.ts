import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { CreateRoomSchema } from "@repo/common/types";
import { getUserId } from "@/lib/api-auth";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Incorrect Inputs" },
      { status: 400 }
    );
  }

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug: string;
  do {
    slug = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (await prismaClient.room.findUnique({ where: { slug } }));

  const room = await prismaClient.room.create({
    data: {
      slug,
      name: parsed.data.name,
      adminId: userId,
      password: parsed.data.password ?? null,
    },
  });

  return NextResponse.json({ roomId: room.id, slug: room.slug, password: room.password });
}
