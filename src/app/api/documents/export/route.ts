import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";
import archiver from "archiver";
import { PassThrough } from "stream";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * GET /api/documents/export?ids=id1,id2,id3 or ?all=true
 * Returns a ZIP archive of markdown files.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const idsParam = req.nextUrl.searchParams.get("ids");
  const allParam = req.nextUrl.searchParams.get("all");

  let documentIds: string[] = [];

  if (allParam === "true") {
    // Fetch all documents the user has access to
    const where: any = userId
      ? { OR: [{ ownerId: userId }, { ownerId: null }], deletedAt: null }
      : { ownerId: null, deletedAt: null };

    const docs = await prisma.document.findMany({
      where,
      select: { id: true },
    });
    documentIds = docs.map((d) => d.id);
  } else if (idsParam) {
    documentIds = idsParam.split(",").filter(Boolean);
  }

  if (documentIds.length === 0) {
    return NextResponse.json({ error: "No documents specified" }, { status: 400 });
  }

  // Cap at 50 documents to prevent abuse
  if (documentIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 documents per export" }, { status: 400 });
  }

  // Fetch document titles
  const docs = await prisma.document.findMany({
    where: { id: { in: documentIds }, deletedAt: null },
    select: { id: true, title: true },
  });

  if (docs.length === 0) {
    return NextResponse.json({ error: "No documents found" }, { status: 404 });
  }

  // Create ZIP archive
  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(passthrough);

  // Export each document as markdown
  const usedNames = new Set<string>();
  for (const doc of docs) {
    let cleanup: (() => void) | null = null;
    try {
      const conn = await connectYjsServer(WS_URL, doc.id);
      cleanup = conn.cleanup;
      const fragment = conn.ydoc.getXmlFragment("default");
      const markdown = xmlFragmentToMarkdown(fragment);

      // Generate a safe unique filename
      let baseName = (doc.title || "Untitled")
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80);
      if (!baseName) baseName = "document";

      let fileName = `${baseName}.md`;
      let counter = 1;
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseName}-${counter}.md`;
        counter++;
      }
      usedNames.add(fileName.toLowerCase());

      archive.append(markdown, { name: fileName });
    } catch (err) {
      // Skip documents that fail to export
      console.error(`Failed to export doc ${doc.id}:`, err);
    } finally {
      cleanup?.();
    }
  }

  await archive.finalize();

  // Collect the stream into a buffer
  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const zipBuffer = Buffer.concat(chunks);

  const timestamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${timestamp}.zip"`,
    },
  });
}
