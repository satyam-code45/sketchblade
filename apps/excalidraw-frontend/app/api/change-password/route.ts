import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ message: "New password must be at least 6 characters" }, { status: 400 });
  }

  const user = await prismaClient.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 5);
  await prismaClient.user.update({ where: { id: userId }, data: { password: hashedPassword } });

  return NextResponse.json({ message: "Password changed successfully" });
}
