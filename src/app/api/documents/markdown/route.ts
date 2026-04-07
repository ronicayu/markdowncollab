import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * GET /api/documents/markdown?id=xxx
 * Returns { title, markdown } for a single document.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, title: true, ownerId: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let cleanup: (() => void) | null = null;
  try {
    const conn = await connectYjsServer(WS_URL, doc.id);
    cleanup = conn.cleanup;
    const fragment = conn.ydoc.getXmlFragment("default");
    const markdown = xmlFragmentToMarkdown(fragment);
    return NextResponse.json({ title: doc.title || "Untitled", markdown });
  } catch (err) {
    console.error(`Failed to get markdown for doc ${id}:`, err);
    return NextResponse.json({ error: "Failed to retrieve document content" }, { status: 500 });
  } finally {
    cleanup?.();
  }
}
