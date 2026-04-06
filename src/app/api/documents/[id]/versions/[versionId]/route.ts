import { NextResponse } from "next/server";
import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId, documentId: id },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Reconstruct the Yjs doc from the snapshot and convert to markdown
  const tempDoc = new Y.Doc();
  try {
    Y.applyUpdate(tempDoc, new Uint8Array(version.snapshot));
    const yxml = tempDoc.getXmlFragment("default");
    const markdown = yxml.length > 0 ? xmlFragmentToMarkdown(yxml) : "";

    return NextResponse.json({
      id: version.id,
      documentId: version.documentId,
      title: version.title,
      createdByName: version.createdByName,
      type: version.type,
      createdAt: version.createdAt,
      markdown,
    });
  } finally {
    tempDoc.destroy();
  }
}
