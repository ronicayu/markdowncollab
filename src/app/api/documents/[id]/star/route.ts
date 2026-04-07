import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify document exists
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Toggle: if star exists, remove it; otherwise create it
  const existing = await prisma.documentStar.findUnique({
    where: { documentId_userId: { documentId: id, userId } },
  });

  if (existing) {
    await prisma.documentStar.delete({ where: { id: existing.id } });
    return NextResponse.json({ starred: false });
  } else {
    await prisma.documentStar.create({
      data: { documentId: id, userId },
    });
    return NextResponse.json({ starred: true });
  }
}
