import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * POST /api/documents/merge
 * Merges two documents by appending source content after target content.
 * Body: { sourceId: string, targetId: string, mode?: "append" }
 * Returns the newly created merged document.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const body = await req.json();
  const { sourceId, targetId } = body;

  if (!sourceId || !targetId) {
    return NextResponse.json(
      { error: "Both sourceId and targetId are required" },
      { status: 400 }
    );
  }

  if (sourceId === targetId) {
    return NextResponse.json(
      { error: "Cannot merge a document with itself" },
      { status: 400 }
    );
  }

  // Verify both documents exist
  const [sourceMeta, targetMeta] = await Promise.all([
    prisma.document.findUnique({
      where: { id: sourceId, deletedAt: null },
      select: { id: true, title: true },
    }),
    prisma.document.findUnique({
      where: { id: targetId, deletedAt: null },
      select: { id: true, title: true },
    }),
  ]);

  if (!sourceMeta) {
    return NextResponse.json({ error: "Source document not found" }, { status: 404 });
  }
  if (!targetMeta) {
    return NextResponse.json({ error: "Target document not found" }, { status: 404 });
  }

  // Fetch markdown content from both documents
  let sourceMarkdown: string;
  let targetMarkdown: string;
  let sourceCleanup: (() => void) | null = null;
  let targetCleanup: (() => void) | null = null;

  try {
    const [sourceConn, targetConn] = await Promise.all([
      connectYjsServer(WS_URL, sourceId),
      connectYjsServer(WS_URL, targetId),
    ]);
    sourceCleanup = sourceConn.cleanup;
    targetCleanup = targetConn.cleanup;

    sourceMarkdown = xmlFragmentToMarkdown(sourceConn.ydoc.getXmlFragment("default"));
    targetMarkdown = xmlFragmentToMarkdown(targetConn.ydoc.getXmlFragment("default"));
  } catch (err) {
    console.error("Failed to fetch document content for merge:", err);
    return NextResponse.json(
      { error: "Failed to retrieve document content" },
      { status: 500 }
    );
  } finally {
    sourceCleanup?.();
    targetCleanup?.();
  }

  // Create merged document
  const mergedTitle = `${targetMeta.title} + ${sourceMeta.title}`;
  const mergedContent = `${targetMarkdown}\n\n---\n\n${sourceMarkdown}`;

  const newDoc = await prisma.document.create({
    data: {
      title: mergedTitle,
      ownerId: userId ?? null,
    },
  });

  // Store the merged content via the markdown import endpoint pattern:
  // We'll write it as initial content that the Yjs server will pick up
  // For now, return the merged doc info + content for the client to initialize
  return NextResponse.json(
    {
      id: newDoc.id,
      title: newDoc.title,
      mergedContent,
      sourceTitle: sourceMeta.title,
      targetTitle: targetMeta.title,
    },
    { status: 201 }
  );
}
