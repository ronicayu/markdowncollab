import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

/**
 * GET /api/documents/[id]/changelog
 * Aggregates version history + activity log, groups by date, returns formatted markdown.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null,
    undefined,
    "viewer"
  );
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "Not authorized to view this document" },
      { status: 403 }
    );
  }

  // Fetch versions and activities
  const [versions, activities] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        type: true,
        createdByName: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        userName: true,
        action: true,
        detail: true,
        createdAt: true,
      },
    }),
  ]);

  // Merge and sort by date
  interface ChangelogEntry {
    date: Date;
    type: "version" | "activity";
    text: string;
  }

  const entries: ChangelogEntry[] = [];

  for (const v of versions) {
    const byLine = v.createdByName ? ` by ${v.createdByName}` : "";
    const typeLabel = v.type === "manual" ? "Manual save" : v.type === "restore" ? "Restore" : "Auto-save";
    entries.push({
      date: new Date(v.createdAt),
      type: "version",
      text: `**${typeLabel}**${byLine}: ${v.title}`,
    });
  }

  for (const a of activities) {
    const action = a.action.replace(/_/g, " ");
    const detail = a.detail ? ` - ${a.detail}` : "";
    entries.push({
      date: new Date(a.createdAt),
      type: "activity",
      text: `**${a.userName}** ${action}${detail}`,
    });
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Group by date
  const grouped = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const dateKey = entry.date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(entry);
  }

  // Format as markdown
  let markdown = "# Changelog\n\n";

  for (const [date, items] of grouped.entries()) {
    markdown += `## ${date}\n\n`;
    for (const item of items) {
      const time = item.date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      markdown += `- ${time}: ${item.text}\n`;
    }
    markdown += "\n";
  }

  if (entries.length === 0) {
    markdown += "_No changes recorded yet._\n";
  }

  return NextResponse.json({ markdown, entryCount: entries.length });
}
