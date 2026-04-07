import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const markdownDir = process.env.MARKDOWN_DIR || "./documents";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get this document's title for wiki-link matching
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Get all documents for cross-referencing
  const allDocs = await prisma.document.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
  });

  const backlinks: { id: string; title: string; snippet: string }[] = [];
  const addedIds = new Set<string>();

  if (!existsSync(markdownDir)) {
    return NextResponse.json(backlinks);
  }

  let files: string[];
  try {
    files = readdirSync(markdownDir).filter((f) => f.endsWith(".md"));
  } catch {
    return NextResponse.json(backlinks);
  }

  // Build a map of docId -> title for all docs
  const docMap = new Map(allDocs.map((d) => [d.id, d.title]));

  // Patterns to match:
  // 1. [[Title]] wiki-links matching this doc's title
  // 2. /doc/{id} URL patterns matching this doc's id
  const titlePattern = doc.title
    ? new RegExp(`\\[\\[${escapeRegExp(doc.title)}\\]\\]`, "gi")
    : null;
  const urlPattern = new RegExp(`/doc/${escapeRegExp(id)}(?:[\\s\\])"']|$)`, "g");

  for (const file of files) {
    const docId = file.replace(/\.md$/, "");
    if (docId === id) continue; // Skip self
    if (addedIds.has(docId)) continue;

    const docTitle = docMap.get(docId);
    if (!docTitle) continue; // Skip files without a matching document

    try {
      const content = readFileSync(join(markdownDir, file), "utf-8");

      let matched = false;
      let snippetText = "";

      // Check for [[Title]] pattern
      if (titlePattern) {
        titlePattern.lastIndex = 0;
        const titleMatch = titlePattern.exec(content);
        if (titleMatch) {
          matched = true;
          snippetText = extractSnippet(content, titleMatch.index, titleMatch[0].length);
        }
      }

      // Check for /doc/{id} URL pattern
      if (!matched) {
        urlPattern.lastIndex = 0;
        const urlMatch = urlPattern.exec(content);
        if (urlMatch) {
          matched = true;
          snippetText = extractSnippet(content, urlMatch.index, urlMatch[0].length);
        }
      }

      if (matched) {
        addedIds.add(docId);
        backlinks.push({
          id: docId,
          title: docTitle,
          snippet: snippetText,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return NextResponse.json(backlinks);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippet(content: string, matchIndex: number, matchLength: number): string {
  const contextChars = 60;
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + matchLength + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}
