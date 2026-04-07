import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  // All non-deleted documents (scoped to user if authenticated)
  const whereClause: any = { deletedAt: null };
  if (userId) {
    whereClause.OR = [{ ownerId: userId }, { ownerId: null }];
  }

  const documents = await prisma.document.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const totalDocs = documents.length;

  // Docs per folder
  const folderCounts: Record<string, number> = {};
  for (const doc of documents) {
    const key = doc.folderId ?? "__root__";
    folderCounts[key] = (folderCounts[key] || 0) + 1;
  }

  // Fetch folder names
  const folderIds = Object.keys(folderCounts).filter((k) => k !== "__root__");
  const folders = folderIds.length
    ? await prisma.folder.findMany({
        where: { id: { in: folderIds } },
        select: { id: true, name: true },
      })
    : [];
  const folderNameMap: Record<string, string> = { __root__: "No Folder" };
  for (const f of folders) folderNameMap[f.id] = f.name;

  const docsPerFolder = Object.entries(folderCounts).map(([id, count]) => ({
    folderId: id,
    folderName: folderNameMap[id] || "Unknown",
    count,
  }));

  // Most active documents (by activity log count)
  const docIds = documents.map((d) => d.id);
  const activityCounts = await prisma.activityLog.groupBy({
    by: ["documentId"],
    where: { documentId: { in: docIds } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const docTitleMap = new Map(documents.map((d) => [d.id, d.title]));
  const mostActiveDocs = activityCounts.map((a) => ({
    documentId: a.documentId,
    title: docTitleMap.get(a.documentId) || "Untitled",
    activityCount: a._count.id,
  }));

  // Top collaborators (by activity log userName)
  const topCollaborators = await prisma.activityLog.groupBy({
    by: ["userName"],
    where: { documentId: { in: docIds } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const collaborators = topCollaborators.map((c) => ({
    name: c.userName,
    activityCount: c._count.id,
  }));

  // Docs created per week (last 12 weeks)
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  const recentDocs = documents.filter(
    (d) => new Date(d.createdAt) >= twelveWeeksAgo
  );

  const weeklyCreation: Record<string, number> = {};
  for (const doc of recentDocs) {
    const d = new Date(doc.createdAt);
    // Get Monday of that week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    weeklyCreation[key] = (weeklyCreation[key] || 0) + 1;
  }

  const docsPerWeek = Object.entries(weeklyCreation)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  return NextResponse.json({
    totalDocs,
    docsPerFolder,
    mostActiveDocs,
    collaborators,
    docsPerWeek,
  });
}
