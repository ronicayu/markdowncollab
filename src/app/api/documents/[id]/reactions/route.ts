import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/documents/[id]/reactions — list grouped reactions
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reactions = await prisma.documentReaction.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
  });

  // Group by emoji: { emoji, count, userIds }
  const grouped: Record<string, { emoji: string; count: number; userIds: string[] }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].userIds.push(r.userId);
  }

  return NextResponse.json(Object.values(grouped));
}

// POST /api/documents/[id]/reactions — toggle a reaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { emoji } = body;

  if (!emoji || typeof emoji !== "string") {
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  }

  // Check if reaction exists — toggle
  const existing = await prisma.documentReaction.findUnique({
    where: {
      documentId_userId_emoji: {
        documentId: id,
        userId,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.documentReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ action: "removed", emoji });
  } else {
    await prisma.documentReaction.create({
      data: { documentId: id, userId, emoji },
    });
    return NextResponse.json({ action: "added", emoji });
  }
}
