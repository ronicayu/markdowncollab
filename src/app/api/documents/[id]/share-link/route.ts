import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { randomUUID } from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can manage link sharing" }, { status: 403 });
  }

  const { enabled, role } = await req.json();

  if (enabled) {
    if (role && !["viewer", "editor"].includes(role)) {
      return NextResponse.json({ error: "Role must be viewer or editor" }, { status: 400 });
    }

    const shareToken = randomUUID();
    const shareRole = role || "viewer";

    // Remove any existing link shares first
    await prisma.documentShare.deleteMany({
      where: { documentId: id, shareToken: { not: null } },
    });

    // Create the link share
    const share = await prisma.documentShare.create({
      data: {
        documentId: id,
        shareToken,
        role: shareRole,
      },
    });

    // Update document visibility
    await prisma.document.update({
      where: { id },
      data: { visibility: "anyone_with_link" },
    });

    return NextResponse.json({
      shareToken: share.shareToken,
      role: share.role,
      url: `/doc/${id}?token=${share.shareToken}`,
    });
  } else {
    // Disable link sharing — remove all token-based shares
    await prisma.documentShare.deleteMany({
      where: { documentId: id, shareToken: { not: null } },
    });

    await prisma.document.update({
      where: { id },
      data: { visibility: "private" },
    });

    return NextResponse.json({ shareToken: null });
  }
}
