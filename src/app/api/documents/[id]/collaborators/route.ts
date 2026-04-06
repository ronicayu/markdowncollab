import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null
  );
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the document with its owner
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Collect user IDs: owner + share recipients
  const userIds = new Set<string>();
  if (doc.ownerId) userIds.add(doc.ownerId);

  const shares = await prisma.documentShare.findMany({
    where: { documentId: id, userId: { not: null } },
    select: { userId: true },
  });
  for (const share of shares) {
    if (share.userId) userIds.add(share.userId);
  }

  // Also look up users by email from shares
  const emailShares = await prisma.documentShare.findMany({
    where: { documentId: id, email: { not: null }, userId: null },
    select: { email: true },
  });
  const emails = emailShares
    .map((s) => s.email)
    .filter((e): e is string => e !== null);

  // Fetch all users by ID or email
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: Array.from(userIds) } },
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
      ],
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(users);
}
