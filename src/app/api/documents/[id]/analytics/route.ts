import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
  };
}

/**
 * GET /api/documents/[id]/analytics
 * Returns view count, edit count, collaborator count, created/updated dates.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [doc, editCount, collaboratorCount] = await Promise.all([
    prisma.document.findUnique({
      where: { id },
      select: { viewCount: true, createdAt: true, updatedAt: true },
    }),
    prisma.activityLog.count({
      where: { documentId: id },
    }),
    prisma.documentShare.count({
      where: { documentId: id },
    }),
  ]);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    viewCount: doc.viewCount,
    editCount,
    collaboratorCount,
    createdAt: doc.createdAt,
    lastEditedAt: doc.updatedAt,
  });
}

/**
 * POST /api/documents/[id]/analytics
 * Increments the view count by 1 (called on document open).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.document.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Document may not exist yet (created via Yjs before DB record)
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
