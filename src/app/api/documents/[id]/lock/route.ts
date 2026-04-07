import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCK_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function isLockExpired(lockedAt: Date | null): boolean {
  if (!lockedAt) return true;
  return Date.now() - lockedAt.getTime() > LOCK_EXPIRY_MS;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { lockedBy: true, lockedAt: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  const expired = isLockExpired(doc.lockedAt);
  return NextResponse.json({
    locked: !!doc.lockedBy && !expired,
    lockedBy: expired ? null : doc.lockedBy,
    lockedAt: expired ? null : doc.lockedAt,
  });
}

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userName = session?.user?.name ?? "Anonymous";

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { lockedBy: true, lockedAt: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const expired = isLockExpired(doc.lockedAt);
  const currentlyLocked = !!doc.lockedBy && !expired;

  if (currentlyLocked && doc.lockedBy === userName) {
    // Unlock — same user toggling off
    const updated = await prisma.document.update({
      where: { id },
      data: { lockedBy: null, lockedAt: null },
    });
    return NextResponse.json({ locked: false, lockedBy: null, lockedAt: null });
  }

  if (currentlyLocked && doc.lockedBy !== userName) {
    // Someone else holds the lock
    return NextResponse.json(
      { error: `Document is locked by ${doc.lockedBy}` },
      { status: 409 }
    );
  }

  // Lock — currently unlocked or expired
  const updated = await prisma.document.update({
    where: { id },
    data: { lockedBy: userName, lockedAt: new Date() },
  });

  return NextResponse.json({
    locked: true,
    lockedBy: updated.lockedBy,
    lockedAt: updated.lockedAt,
  });
}
