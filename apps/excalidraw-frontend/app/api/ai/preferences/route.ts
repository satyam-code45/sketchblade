import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

const MODEL_FIELDS = ["modelDiagram", "modelEvaluate", "modelEdit", "modelChat"] as const;

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const pref = await prismaClient.aIPreference.findUnique({ where: { userId } });
  return NextResponse.json({ preference: pref });
}

export async function PUT(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, string | null> = {};
  if ("credentialId" in body) data.credentialId = body.credentialId ?? null;
  for (const f of MODEL_FIELDS) if (f in body) data[f] = body[f] ?? null;

  // A credential can only be selected if it belongs to this user.
  if (data.credentialId) {
    const owned = await prismaClient.aICredential.count({ where: { id: data.credentialId, userId } });
    if (owned === 0) return NextResponse.json({ message: "Unknown credential" }, { status: 400 });
  }

  const preference = await prismaClient.aIPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json({ preference });
}
