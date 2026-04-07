import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    // Auth check — require authenticated session
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    const userEmail = session?.user?.email ?? undefined;

    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, mentionedUserIds } = await req.json();

    if (!documentId || !Array.isArray(mentionedUserIds)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate caller has access to the document
    const access = await checkDocumentAccess(documentId, userId, userEmail ?? null);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Derive actor info from session — never trust client-supplied values
    const actorName = session.user?.name || session.user?.email || "Unknown";
    const actorId = userId;

    // Look up document title
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Create a notification for each mentioned user
    for (const mentionedUserId of mentionedUserIds) {
      await createNotification({
        userId: mentionedUserId,
        type: "mention",
        documentId,
        documentTitle: doc.title,
        actorName,
        actorId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mention notification error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
