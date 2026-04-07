import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["draft"],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { status: true, approvedBy: true, approvedAt: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userName = session?.user?.name ?? "Unknown";

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.ownerId !== userId) {
    return NextResponse.json({ error: "Only the document owner can change status" }, { status: 403 });
  }

  const body = await req.json();
  const newStatus = body.status as string;

  if (!newStatus || !["draft", "in_review", "approved"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status. Must be: draft, in_review, or approved" }, { status: 400 });
  }

  const currentStatus = doc.status || "draft";
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { status: newStatus };

  if (newStatus === "approved") {
    updateData.approvedBy = userName;
    updateData.approvedAt = new Date();
  } else {
    // Clear approval info when moving back to draft or in_review
    updateData.approvedBy = null;
    updateData.approvedAt = null;
  }

  const updated = await prisma.document.update({
    where: { id },
    data: updateData,
  });

  // Log to activity log
  const actionMap: Record<string, string> = {
    in_review: "submitted_for_review",
    approved: "approved",
    draft: "requested_changes",
  };

  await prisma.activityLog.create({
    data: {
      documentId: id,
      userId,
      userName,
      action: actionMap[newStatus] || "status_changed",
      detail: `Status changed from ${currentStatus} to ${newStatus}`,
    },
  });

  return NextResponse.json({
    status: updated.status,
    approvedBy: updated.approvedBy,
    approvedAt: updated.approvedAt,
  });
}
