import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/documents/[id]/schedule
 * Set or clear a scheduled publish time.
 * Body: { publishAt: string | null }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { publishAt } = body;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        publishAt: publishAt ? new Date(publishAt) : null,
      },
    });

    return NextResponse.json({
      publishAt: updated.publishAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("Schedule error:", err);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/schedule
 * Get the current scheduled publish time.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { publishAt: true, status: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      publishAt: doc.publishAt?.toISOString() ?? null,
      status: doc.status,
    });
  } catch (err) {
    console.error("Schedule fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}
