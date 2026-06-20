import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { unlink, rm } from "fs/promises";
import { join } from "path";
import { checkRateLimit } from "@/lib/rate-limiter";

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
    select: { id: true, title: true, ownerId: true, visibility: true, status: true, approvedBy: true, approvedAt: true, folderId: true, forkedFrom: true, coverImage: true, password: true, expiresAt: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
    return NextResponse.json({ error: "This document has expired" }, { status: 410 });
  }

  // Expose hasPassword flag but never the hash itself
  const { password: _pw, ...rest } = doc;
  return NextResponse.json({ ...rest, hasPassword: !!_pw, role: access.role });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "editor");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 60 updates per minute per user
  const rateLimitKey = `doc-update:${userId || userEmail || "anonymous"}`;
  const rateResult = checkRateLimit(rateLimitKey, 60, 1_000);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateResult.retryAfter },
      { status: 429 }
    );
  }

  const body = await req.json();
  const data: Record<string, any> = {};
  if (body.title !== undefined) data.title = String(body.title).trim().substring(0, 500);
  if (body.folderId !== undefined) data.folderId = body.folderId;
  if (body.coverImage !== undefined) data.coverImage = body.coverImage;
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

  // Rate limit: 30 deletes per minute per user
  const delRateLimitKey = `doc-delete:${userId || userEmail || "anonymous"}`;
  const delRateResult = checkRateLimit(delRateLimitKey, 30, 2_000);
  if (!delRateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: delRateResult.retryAfter },
      { status: 429 }
    );
  }

  // Soft delete: set deletedAt instead of removing the record
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
