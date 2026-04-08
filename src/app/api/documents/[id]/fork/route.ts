import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  // Check read access to original document
  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch original document
  const original = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, templateId: true },
  });
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create forked document
  const forked = await prisma.document.create({
    data: {
      title: `${original.title || "Untitled"} (fork)`,
      ownerId: userId ?? null,
      templateId: original.templateId,
      forkedFrom: original.id,
    },
  });

  // Try to copy Yjs content via the latest version snapshot
  const latestVersion = await prisma.documentVersion.findFirst({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: { snapshot: true, title: true },
  });

  if (latestVersion) {
    await prisma.documentVersion.create({
      data: {
        documentId: forked.id,
        snapshot: latestVersion.snapshot,
        title: forked.title,
        createdBy: userId,
        type: "fork",
      },
    });
  }

  return NextResponse.json({ ...forked, role: "owner" }, { status: 201 });
}
