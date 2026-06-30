import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { signResetToken } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 });

  const user = await prismaClient.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({
      message: "If this email is registered, a reset token has been generated.",
    });
  }

  const resetToken = signResetToken(email);
  return NextResponse.json({ message: "Reset token generated.", resetToken });
}
