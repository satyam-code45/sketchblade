import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prismaClient } from "@/lib/prisma";
import { SignInSchema } from "@repo/common/types";
import { signToken } from "@/lib/api-auth";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Incorrect Inputs" }, { status: 400 });
  }

  const user = await prismaClient.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json({ message: "User does not exist!" }, { status: 404 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) {
    return NextResponse.json({ message: "Incorrect email or password!" }, { status: 401 });
  }

  const token = signToken(user.id);
  return NextResponse.json({ message: "Signed in successfully!", token, name: user.name, userId: user.id });
}
