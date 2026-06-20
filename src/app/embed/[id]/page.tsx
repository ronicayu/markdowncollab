import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import * as Y from "yjs";
import { xmlFragmentToHtml } from "@/lib/export-html";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: doc?.title || "Embedded Document" };
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, password: true },
  });
  if (!doc) notFound();
  if (doc.password) {
    return (
      <html>
        <body
          style={{
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            padding: 40,
            textAlign: "center",
            color: "#615d59",
            background: "#ffffff",
          }}
        >
          <p>This document is password protected and cannot be embedded.</p>
        </body>
      </html>
    );
  }

  // Fetch latest version snapshot to render HTML
  const version = await prisma.documentVersion.findFirst({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: { snapshot: true },
  });

  let htmlContent = "<p style='color:#a39e98'>This document is empty.</p>";
  if (version?.snapshot) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, new Uint8Array(version.snapshot));
      const fragment = ydoc.getXmlFragment("default");
      htmlContent = xmlFragmentToHtml(fragment);
      ydoc.destroy();
    } catch {
      htmlContent = "<p style='color:#a39e98'>Unable to render document.</p>";
    }
  }

  // Styles use DESIGN.md palette literals (CSS vars from globals.css don't
  // reach this sandboxed iframe document).
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Inter, -apple-system, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-feature-settings: 'lnum', 'locl';
      max-width: 700px;
      margin: 0 auto;
      padding: 24px 20px 60px;
      line-height: 1.5;
      color: rgba(0,0,0,0.95);
      background: #ffffff;
      font-size: 16px;
      font-weight: 400;
      -webkit-font-smoothing: antialiased;
    }
    h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.0625em; line-height: 1.1; margin-bottom: 0.5em; }
    h2 { font-size: 1.625rem; font-weight: 700; letter-spacing: -0.024em; line-height: 1.23; margin-top: 1.5em; }
    h3 { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.011em; line-height: 1.27; }
    code {
      background: #f6f5f4;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    pre {
      background: #f6f5f4;
      border: 1px solid rgba(0,0,0,0.1);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    pre code { background: none; padding: 0; border: 0; }
    blockquote {
      border-left: 3px solid rgba(0,0,0,0.16);
      margin-left: 0;
      padding-left: 16px;
      color: #615d59;
    }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td {
      border: 1px solid rgba(0,0,0,0.1);
      padding: 8px;
      text-align: left;
    }
    th { background: #f6f5f4; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 2em 0; }
    a { color: #0075de; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .embed-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #ffffff;
      border-top: 1px solid rgba(0,0,0,0.1);
      padding: 6px 16px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.125px;
      color: #615d59;
    }
    .embed-footer a {
      color: #0075de;
      text-decoration: none;
      font-weight: 600;
    }
    .embed-footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${htmlContent}
  <div class="embed-footer">
    Powered by <a href="/" target="_blank" rel="noopener">MarkdownCollab</a>
  </div>
</body>
</html>`;

  return (
    <iframe
      srcDoc={fullHtml}
      style={{ width: "100%", height: "100vh", border: "none" }}
      title={doc.title || "Embedded document"}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
