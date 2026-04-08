import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  // Check read access
  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    includeComments = false,
    includeVersions = false,
    includeTags = false,
    folderId,
  } = body;

  // Fetch original document
  const original = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      templateId: true,
      folderId: true,
      coverImage: true,
      fontFamily: true,
    },
  });
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newTitle = title || `Copy of ${original.title || "Untitled"}`;

  // Create duplicated document
  const duplicated = await prisma.document.create({
    data: {
      title: newTitle,
      ownerId: userId ?? null,
      templateId: original.templateId,
      folderId: folderId || original.folderId,
      coverImage: original.coverImage,
      fontFamily: original.fontFamily,
    },
  });

  // Copy latest version snapshot (always, for content)
  const latestVersion = await prisma.documentVersion.findFirst({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: { snapshot: true, title: true },
  });

  if (latestVersion) {
    await prisma.documentVersion.create({
      data: {
        documentId: duplicated.id,
        snapshot: latestVersion.snapshot,
        title: newTitle,
        createdBy: userId,
        type: "duplicate",
      },
    });
  }

  // Optionally copy all version history
  if (includeVersions && latestVersion) {
    const allVersions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
    });
    // Skip the latest (already copied) - copy the rest
    for (const v of allVersions.slice(0, -1)) {
      await prisma.documentVersion.create({
        data: {
          documentId: duplicated.id,
          snapshot: v.snapshot,
          title: v.title,
          createdBy: v.createdBy,
          createdByName: v.createdByName,
          type: v.type,
          createdAt: v.createdAt,
        },
      });
    }
  }

  // Optionally copy tags
  if (includeTags) {
    const docTags = await prisma.documentTag.findMany({
      where: { documentId: id },
    });
    for (const dt of docTags) {
      await prisma.documentTag.create({
        data: {
          documentId: duplicated.id,
          tagId: dt.tagId,
        },
      }).catch(() => {}); // ignore duplicate unique constraint
    }
  }

  // Note: comments are stored in Yjs, not Prisma, so includeComments
  // would require Yjs doc content copy (content is already copied via version snapshot)
  // If includeComments is false, comments would need to be stripped from the Yjs doc
  // For simplicity, comments are included when content is copied.

  return NextResponse.json({ ...duplicated, role: "owner" }, { status: 201 });
}
