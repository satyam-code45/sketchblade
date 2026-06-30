import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prismaClient } from "@repo/db/client";
import { verifyResetToken } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { token, newPassword } = await req.json();
  if (!token || !newPassword) {
    return NextResponse.json({ message: "Token and new password are required" }, { status: 400 });
  }

  const email = verifyResetToken(token);
  if (!email) {
    return NextResponse.json({ message: "Invalid or expired reset token" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 5);
  await prismaClient.user.update({ where: { email }, data: { password: hashedPassword } });

  return NextResponse.json({ message: "Password reset successfully" });
}
