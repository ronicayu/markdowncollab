import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ratings = await prisma.rating.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
  });

  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  const average = ratings.length > 0 ? total / ratings.length : 0;

  return NextResponse.json({
    average: Math.round(average * 10) / 10,
    count: ratings.length,
    ratings,
  });
}

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
  const score = Number(body.score);
  if (!score || score < 1 || score > 5) {
    return NextResponse.json({ error: "Score must be 1-5" }, { status: 400 });
  }

  const rating = await prisma.rating.upsert({
    where: {
      documentId_userId: { documentId: id, userId },
    },
    create: {
      documentId: id,
      userId,
      score,
      comment: body.comment || null,
    },
    update: {
      score,
      comment: body.comment || null,
    },
  });

  return NextResponse.json(rating);
}
