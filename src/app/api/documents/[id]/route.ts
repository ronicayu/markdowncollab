import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { unlink, rm } from "fs/promises";
import { join } from "path";

const YJS_DIR = process.env.YPERSISTENCE || "./yjs-data";
const MD_DIR = process.env.MARKDOWN_DIR || "./documents";

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
    select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
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

  const { title } = await req.json();
  const doc = await prisma.document.update({ where: { id }, data: { title } });
  return NextResponse.json({ ...doc, role: access.role });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.document.delete({ where: { id } });
  const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
    rm(join(UPLOADS_DIR, id), { recursive: true, force: true }),
  ]);
  return NextResponse.json({ ok: true });
}
