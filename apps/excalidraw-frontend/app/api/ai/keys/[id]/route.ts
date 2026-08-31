import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scoped by userId so one user cannot delete another's credential.
  const { count } = await prismaClient.aICredential.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prismaClient.aIPreference.updateMany({
    where: { userId, credentialId: id },
    data: { credentialId: null },
  });

  return NextResponse.json({ ok: true });
}
