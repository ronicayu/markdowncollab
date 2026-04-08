import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return ((session?.user as any)?.id as string) ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Build the folder path chain (walk up parent pointers)
  const path: { id: string; name: string }[] = [];
  let currentId: string | null = id;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    });
    if (!folder) break;
    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return NextResponse.json(path);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folder = await prisma.folder.findFirst({
    where: { id, ownerId: userId },
  });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name: name.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folder = await prisma.folder.findFirst({
    where: { id, ownerId: userId },
  });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Move documents in this folder to the parent folder (or root)
  await prisma.document.updateMany({
    where: { folderId: id },
    data: { folderId: folder.parentId ?? null },
  });

  // Move child folders to the parent folder (or root)
  await prisma.folder.updateMany({
    where: { parentId: id },
    data: { parentId: folder.parentId ?? null },
  });

  await prisma.folder.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
