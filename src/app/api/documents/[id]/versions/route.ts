import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot } from "@/lib/version-snapshot";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
    userName: session?.user?.name ?? undefined,
  };
}

const PAGE_SIZE = 20;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [versions, total] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        createdByName: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.documentVersion.count({ where: { documentId: id } }),
  ]);

  return NextResponse.json({ versions, total, page, pageSize: PAGE_SIZE });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail, userName } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "editor");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name || null;

    // Get current document title
    const dbDoc = await prisma.document.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!dbDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Connect to Yjs to get current state
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;

    const version = await createSnapshot({
      doc: conn.ydoc,
      documentId: id,
      title: name || dbDoc.title,
      type: "manual",
      createdByName: body.createdByName || userName || "Anonymous",
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Failed to create manual snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  } finally {
    cleanup?.();
  }
}
