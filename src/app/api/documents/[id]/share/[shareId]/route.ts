import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { logActivity } from "@/lib/activity-log";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can remove shares" }, { status: 403 });
  }

  const share = await prisma.documentShare.findUnique({ where: { id: shareId, documentId: id } });
  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  await prisma.documentShare.delete({ where: { id: shareId, documentId: id } });

  const userName = session?.user?.name ?? "Unknown";
  await logActivity(id, userId ?? null, userName, "share_removed", `Removed share for ${share.email ?? share.id}`);

  return NextResponse.json({ ok: true });
}
