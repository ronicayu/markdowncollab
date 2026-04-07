import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await prisma.folder.findMany({
    where: { ownerId: userId },
    orderBy: { name: "asc" },
  });

  // Build tree structure
  interface FolderNode {
    id: string;
    name: string;
    parentId: string | null;
    children: FolderNode[];
  }

  const map = new Map<string, FolderNode>();
  for (const f of folders) {
    map.set(f.id, { id: f.id, name: f.name, parentId: f.parentId, children: [] });
  }

  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json(roots);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, parentId } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Verify parent folder belongs to user if provided
  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, ownerId: userId },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      parentId: parentId ?? null,
      ownerId: userId,
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
