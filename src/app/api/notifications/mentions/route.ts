import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const { documentId, mentionedUserIds, actorName, actorId } = await req.json();

    if (!documentId || !Array.isArray(mentionedUserIds) || !actorName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Look up document title
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Create a notification for each mentioned user
    for (const userId of mentionedUserIds) {
      await createNotification({
        userId,
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
