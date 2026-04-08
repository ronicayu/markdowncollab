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
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.documentPin.count({ where: { userId } });

  const existing = await prisma.documentPin.findUnique({
    where: { documentId_userId: { documentId: id, userId } },
  });

  if (existing) {
    await prisma.documentPin.delete({ where: { id: existing.id } });
    return NextResponse.json({ pinned: false });
  }

  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 pinned documents" }, { status: 400 });
  }

  await prisma.documentPin.create({ data: { documentId: id, userId } });
  return NextResponse.json({ pinned: true });
}
