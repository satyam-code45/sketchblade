import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prismaClient } from "@repo/db/client";
import { CreateUserSchema } from "@repo/common/types";
import { signToken } from "@/lib/api-auth";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Incorrect Inputs" }, { status: 400 });
  }

  const existing = await prismaClient.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ message: "User already exists!" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 5);
  const user = await prismaClient.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
    },
  });

  const token = signToken(user.id);
  return NextResponse.json({ token, name: user.name, userId: user.id });
}
