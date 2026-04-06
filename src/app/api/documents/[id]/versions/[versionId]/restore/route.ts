import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot, restoreSnapshot } from "@/lib/version-snapshot";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "editor");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;

  try {
    // Fetch the version to restore
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId, documentId: id },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Get current document title
    const dbDoc = await prisma.document.findUnique({
      where: { id },
      select: { title: true },
    });

    // Connect to the live Yjs document
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;

    // Create a "before restore" snapshot of the current state
    const restoreDate = version.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    await createSnapshot({
      doc: conn.ydoc,
      documentId: id,
      title: `Before restore to ${restoreDate}`,
      type: "restore",
      createdByName: "System",
    });

    // Restore the snapshot — this modifies the live Yjs doc,
    // which broadcasts updates to all connected clients via the WS server
    restoreSnapshot(conn.ydoc, version.snapshot);

    return NextResponse.json({
      ok: true,
      restoredVersionId: versionId,
      message: `Restored to version from ${restoreDate}`,
    });
  } catch (error) {
    console.error("Failed to restore version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  } finally {
    // Small delay to let the Yjs update propagate to connected clients
    await new Promise((resolve) => setTimeout(resolve, 500));
    cleanup?.();
  }
}
