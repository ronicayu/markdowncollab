import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentIds, folderId } = await req.json();
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds required" }, { status: 400 });
  }

  await prisma.document.updateMany({
    where: { id: { in: documentIds }, ownerId: userId },
    data: { folderId: folderId || null },
  });

  return NextResponse.json({ ok: true, moved: documentIds.length });
}
