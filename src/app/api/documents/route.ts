import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!userId) {
    // Unauthenticated: only return legacy docs (no owner) for backward compatibility
    const docs = await prisma.document.findMany({
      where: { ownerId: null },
      select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(docs.map((d) => ({ ...d, role: "editor" })));
  }

  // Get documents the user has explicit shares on
  const shares = await prisma.documentShare.findMany({
    where: {
      OR: [
        { userId },
        ...(userEmail ? [{ email: userEmail.toLowerCase() }] : []),
      ],
    },
    select: { documentId: true, role: true },
  });
  const sharedDocIds = shares.map((s) => s.documentId);
  const shareRoleMap = new Map(shares.map((s) => [s.documentId, s.role]));

  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: userId },            // docs I own
        { ownerId: null },               // legacy docs (no owner)
        { id: { in: sharedDocIds } },    // docs shared with me
      ],
    },
    select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const result = docs.map((d) => {
    let role: string;
    if (d.ownerId === userId) {
      role = "owner";
    } else if (!d.ownerId) {
      role = "editor"; // legacy doc
    } else {
      role = shareRoleMap.get(d.id) ?? "viewer";
    }
    return { ...d, role };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const { title } = await req.json();
  const doc = await prisma.document.create({
    data: {
      title: title || "Untitled",
      ownerId: userId ?? null,
    },
  });
  return NextResponse.json({ ...doc, role: "owner" }, { status: 201 });
}
