import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { unlink, rm } from "fs/promises";
import { join } from "path";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, ownerId: true, visibility: true, status: true, approvedBy: true, approvedAt: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...doc, role: access.role });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "editor");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, any> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.folderId !== undefined) data.folderId = body.folderId;
  const doc = await prisma.document.update({ where: { id }, data });
  return NextResponse.json({ ...doc, role: access.role });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete: set deletedAt instead of removing the record
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
