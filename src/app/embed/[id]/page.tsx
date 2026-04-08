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
        <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center", color: "#666" }}>
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

  let htmlContent = "<p style='color:#999'>This document is empty.</p>";
  if (version?.snapshot) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, new Uint8Array(version.snapshot));
      const fragment = ydoc.getXmlFragment("default");
      htmlContent = xmlFragmentToHtml(fragment);
      ydoc.destroy();
    } catch {
      htmlContent = "<p style='color:#999'>Unable to render document.</p>";
    }
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, serif;
      max-width: 700px;
      margin: 0 auto;
      padding: 24px 20px 60px;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 1.8em; margin-bottom: 0.5em; }
    h2 { font-size: 1.4em; margin-top: 1.5em; }
    h3 { font-size: 1.15em; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f9f9f9; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    .embed-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fafafa;
      border-top: 1px solid #eee;
      padding: 6px 16px;
      text-align: center;
      font-size: 11px;
    }
    .embed-footer a {
      color: #B8692A;
      text-decoration: none;
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
