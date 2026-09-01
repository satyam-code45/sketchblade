import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";
import { seal, fingerprint, last4, validateKey } from "@repo/ai";

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const keys = await prismaClient.aICredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    // Never select the ciphertext: nothing outside the server needs it.
    select: { id: true, provider: true, label: true, last4: true, lastUsedAt: true, lastValidAt: true, createdAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { provider = "openai", label, key } = await req.json();
  if (typeof key !== "string" || key.length < 20) {
    return NextResponse.json({ message: "That does not look like an API key." }, { status: 400 });
  }

  // Never store a key we have not proved works.
  const check = await validateKey(key);
  if (!check.ok) {
    const message = check.kind === "auth"
      ? "That key was rejected by the provider."
      : "Could not reach the provider to check that key. Try again.";
    return NextResponse.json({ message }, { status: check.kind === "auth" ? 400 : 502 });
  }

  const sealed = seal(key);
  try {
    const created = await prismaClient.aICredential.create({
      data: {
        userId,
        provider,
        label: (label || "My key").slice(0, 40),
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        keyVersion: sealed.keyVersion,
        fingerprint: fingerprint(key),
        last4: last4(key),
        lastValidAt: new Date(),
      },
      select: { id: true, provider: true, label: true, last4: true, createdAt: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ message: "You have already added that key." }, { status: 409 });
  }
}
