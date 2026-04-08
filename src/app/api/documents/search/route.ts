import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const markdownDir = process.env.MARKDOWN_DIR || "./documents";

/**
 * Escape HTML special chars to prevent XSS in snippets.
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Extract a ~100 char snippet around the first match, with the match highlighted in <mark> tags.
 */
function extractSnippet(content: string, query: string): string | null {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx === -1) return null;

  const contextChars = 50;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);

  let snippet = content.slice(start, end);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  // Find the match within the snippet and wrap it
  const matchStart = idx - start;
  const matchEnd = matchStart + query.length;
  const before = escapeHtml(snippet.slice(0, matchStart));
  const match = escapeHtml(snippet.slice(matchStart, matchEnd));
  const after = escapeHtml(snippet.slice(matchEnd));

  return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  // Advanced filter params
  const tagName = url.searchParams.get("tag")?.trim() || null;
  const folderId = url.searchParams.get("folderId")?.trim() || null;
  const dateFrom = url.searchParams.get("dateFrom")?.trim() || null;
  const dateTo = url.searchParams.get("dateTo")?.trim() || null;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  // Build additional where clauses for filters
  const extraFilters: Record<string, unknown>[] = [];
  if (folderId) {
    extraFilters.push({ folderId });
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      extraFilters.push({ updatedAt: { gte: fromDate } });
    }
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      // Set to end of day
      toDate.setHours(23, 59, 59, 999);
      extraFilters.push({ updatedAt: { lte: toDate } });
    }
  }

  // If tag filter is set, find document IDs with that tag
  let tagFilterDocIds: Set<string> | null = null;
  if (tagName) {
    const tag = await prisma.documentTag.findMany({
      where: {
        tagId: {
          in: (
            await prisma.tag.findMany({
              where: { name: { equals: tagName } },
              select: { id: true },
            })
          ).map((t) => t.id),
        },
      },
      select: { documentId: true },
    });
    tagFilterDocIds = new Set(tag.map((t) => t.documentId));
  }

  // Get accessible document IDs for this user
  let accessibleDocs: { id: string; title: string; updatedAt: Date }[];

  const baseWhere: Record<string, unknown> = { deletedAt: null };
  if (extraFilters.length > 0) {
    (baseWhere as any).AND = extraFilters;
  }

  if (!userId) {
    // Unauthenticated: only legacy docs
    accessibleDocs = await prisma.document.findMany({
      where: { ...baseWhere, ownerId: null },
      select: { id: true, title: true, updatedAt: true },
    });
  } else {
    const shares = await prisma.documentShare.findMany({
      where: {
        OR: [
          { userId },
          ...(userEmail ? [{ email: userEmail.toLowerCase() }] : []),
        ],
      },
      select: { documentId: true },
    });
    const sharedDocIds = shares.map((s) => s.documentId);

    accessibleDocs = await prisma.document.findMany({
      where: {
        ...baseWhere,
        OR: [
          { ownerId: userId },
          { ownerId: null },
          { id: { in: sharedDocIds } },
        ],
      },
      select: { id: true, title: true, updatedAt: true },
    });
  }

  // Apply tag filter if set
  if (tagFilterDocIds) {
    accessibleDocs = accessibleDocs.filter((d) => tagFilterDocIds!.has(d.id));
  }

  const lowerQuery = query.toLowerCase();

  // Build a map of accessible docs for quick lookup
  const docMap = new Map(accessibleDocs.map((d) => [d.id, d]));

  // Collect markdown file contents for accessible docs
  const mdFiles = new Set<string>();
  if (existsSync(markdownDir)) {
    try {
      const files = readdirSync(markdownDir);
      for (const f of files) {
        if (f.endsWith(".md")) {
          const docId = f.replace(/\.md$/, "");
          if (docMap.has(docId)) {
            mdFiles.add(docId);
          }
        }
      }
    } catch {
      // Directory read failed, skip content search
    }
  }

  // Pagination params
  const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
  const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

  const results: { id: string; title: string; snippet: string; updatedAt: string; score: number }[] = [];
  const addedIds = new Set<string>();

  for (const doc of accessibleDocs) {
    const lowerTitle = doc.title.toLowerCase();
    const titleExact = lowerTitle === lowerQuery;
    const titleContains = !titleExact && lowerTitle.includes(lowerQuery);

    let contentSnippet: string | null = null;
    if (mdFiles.has(doc.id)) {
      try {
        const content = readFileSync(join(markdownDir, `${doc.id}.md`), "utf-8");
        contentSnippet = extractSnippet(content, query);
      } catch {
        // File read failed, skip
      }
    }

    if (titleExact || titleContains || contentSnippet) {
      if (!addedIds.has(doc.id)) {
        addedIds.add(doc.id);
        let score = 0;
        if (titleExact) score += 100;
        else if (titleContains) score += 50;
        if (contentSnippet) score += 10;

        results.push({
          id: doc.id,
          title: doc.title,
          snippet: contentSnippet || "",
          updatedAt: doc.updatedAt.toISOString(),
          score,
        });
      }
    }
  }

  // Sort by score descending, then updatedAt descending
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const pagedResults = results.slice(start, start + pageSize);

  return NextResponse.json({ items: pagedResults, total, page, pageSize });
}
