import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * PUT — Set or remove the document password (owner only).
 * Body: { password: string | null }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.ownerId && doc.ownerId !== userId) {
    return NextResponse.json({ error: "Only the owner can set a password" }, { status: 403 });
  }

  const body = await req.json();
  const { password } = body;

  let hashed: string | null = null;
  if (password && typeof password === "string" && password.length > 0) {
    hashed = await bcrypt.hash(password, 10);
  }

  await prisma.document.update({
    where: { id },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true, hasPassword: !!hashed });
}

/**
 * POST — Verify a password for a document.
 * Body: { password: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { password: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!doc.password) {
    return NextResponse.json({ verified: true });
  }

  const body = await req.json();
  const { password } = body;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ verified: false, error: "Password required" }, { status: 401 });
  }

  const match = await bcrypt.compare(password, doc.password);
  if (!match) {
    return NextResponse.json({ verified: false, error: "Incorrect password" }, { status: 401 });
  }

  return NextResponse.json({ verified: true });
}
