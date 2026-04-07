import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const docTags = await prisma.documentTag.findMany({
    where: { documentId },
  });
  const tagIds = docTags.map((dt) => dt.tagId);
  if (tagIds.length === 0) return NextResponse.json([]);

  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const { tagId } = await req.json();
  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  // Check if already linked
  const existing = await prisma.documentTag.findFirst({
    where: { documentId, tagId },
  });
  if (existing) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    return NextResponse.json(tag);
  }

  await prisma.documentTag.create({
    data: { documentId, tagId },
  });
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  return NextResponse.json(tag, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const { tagId } = await req.json();
  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  await prisma.documentTag.deleteMany({
    where: { documentId, tagId },
  });
  return NextResponse.json({ success: true });
}
