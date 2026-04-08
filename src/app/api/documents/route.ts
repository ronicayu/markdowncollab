import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auto-publish: promote documents whose publishAt has passed
  try {
    await prisma.document.updateMany({
      where: {
        publishAt: { lte: new Date() },
        status: { not: "approved" },
        deletedAt: null,
      },
      data: { status: "approved" },
    });
  } catch {
    // Non-critical — silently ignore
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;
  const showTrash = req.nextUrl.searchParams.get("trash") === "true";
  const folderIdParam = req.nextUrl.searchParams.get("folderId");

  if (!userId) {
    // Unauthenticated: only return legacy docs (no owner) for backward compatibility
    const unauthWhere: any = { ownerId: null, deletedAt: null };
    if (folderIdParam) unauthWhere.folderId = folderIdParam;
    const docs = await prisma.document.findMany({
      where: unauthWhere,
      select: { id: true, title: true, ownerId: true, visibility: true, status: true, deletedAt: true, folderId: true, createdAt: true, updatedAt: true },
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

  const trashFilter = showTrash ? { deletedAt: { not: null } } : { deletedAt: null };

  const folderFilter = folderIdParam !== null ? { folderId: folderIdParam === "root" ? null : folderIdParam } : {};

  const docs = await prisma.document.findMany({
    where: {
      AND: [
        trashFilter,
        folderFilter,
        {
          OR: [
            { ownerId: userId },            // docs I own
            ...(showTrash ? [] : [{ ownerId: null }]),  // legacy docs (not in trash view)
            { id: { in: sharedDocIds } },    // docs shared with me
          ],
        },
      ],
    },
    select: { id: true, title: true, ownerId: true, visibility: true, status: true, deletedAt: true, folderId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch user's starred document IDs
  const stars = await prisma.documentStar.findMany({
    where: { userId },
    select: { documentId: true },
  });
  const starredIds = new Set(stars.map((s) => s.documentId));

  const result = docs.map((d) => {
    let role: string;
    if (d.ownerId === userId) {
      role = "owner";
    } else if (!d.ownerId) {
      role = "editor"; // legacy doc
    } else {
      role = shareRoleMap.get(d.id) ?? "viewer";
    }
    return { ...d, role, starred: starredIds.has(d.id) };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const { title, templateId, templateVariables } = await req.json();
  const doc = await prisma.document.create({
    data: {
      title: title || "Untitled",
      ownerId: userId ?? null,
      templateId: templateId ?? null,
    },
  });

  let templateContent: string | null = null;
  if (templateId) {
    const { getTemplateById, substituteVariables } = await import("@/lib/templates");
    const template = getTemplateById(templateId);
    if (template && template.content) {
      templateContent = substituteVariables(template.content, templateVariables);
    }
  }

  return NextResponse.json({ ...doc, role: "owner", templateContent }, { status: 201 });
}
