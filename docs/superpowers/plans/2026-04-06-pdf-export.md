# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add PDF export with server-side HTML-to-PDF conversion via Puppeteer.

**Architecture:** New export-html.ts converts Yjs to styled HTML. Puppeteer renders HTML to PDF. New API endpoint at /api/documents/[id]/export/pdf. Export dropdown in TopBar.

**Tech Stack:** Puppeteer, HTML/CSS

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `puppeteer` dependency |
| `src/lib/export-html.ts` | New — `xmlFragmentToHtml()` converts Yjs XmlFragment to styled HTML |
| `src/lib/__tests__/export-html.test.ts` | New — unit tests for HTML conversion |
| `src/app/api/documents/[id]/export/pdf/route.ts` | New — GET endpoint returns PDF |
| `src/components/TopBar.tsx` | Replace Export link with dropdown (Markdown + PDF) |

---

## Task 1: Install Puppeteer

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install puppeteer**

```bash
cd /Users/ronica/projects/markdown-collab
npm install puppeteer
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/ronica/projects/markdown-collab
node -e "const p = require('puppeteer'); console.log('puppeteer version:', p.default ? 'ok' : 'ok')"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add package.json package-lock.json
git commit -m "feat: add puppeteer dependency for PDF export"
```

---

## Task 2: Create export-html.ts with Tests (TDD)

**Files:**
- New: `src/lib/__tests__/export-html.test.ts`
- New: `src/lib/export-html.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/__tests__/export-html.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { xmlFragmentToHtml, wrapInHtmlTemplate } from "../export-html";

function buildFragment(setup: (frag: Y.XmlFragment, doc: Y.Doc) => void): Y.XmlFragment {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("default");
  setup(frag, doc);
  return frag;
}

describe("xmlFragmentToHtml", () => {
  it("converts a heading to <h1>", () => {
    const frag = buildFragment((f) => {
      const h = new Y.XmlElement("heading");
      h.setAttribute("level", 1);
      h.insert(0, [new Y.XmlText("Hello World")]);
      f.insert(0, [h]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<h1>Hello World</h1>");
  });

  it("converts headings at levels 1-6", () => {
    const frag = buildFragment((f) => {
      for (let level = 1; level <= 6; level++) {
        const h = new Y.XmlElement("heading");
        h.setAttribute("level", level);
        h.insert(0, [new Y.XmlText(`Level ${level}`)]);
        f.insert(f.length, [h]);
      }
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toContain("<h1>Level 1</h1>");
    expect(html).toContain("<h3>Level 3</h3>");
    expect(html).toContain("<h6>Level 6</h6>");
  });

  it("converts a paragraph to <p>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Some text")]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p>Some text</p>");
  });

  it("converts bold text to <strong>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "bold text", { bold: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p><strong>bold text</strong></p>");
  });

  it("converts italic text to <em>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "italic text", { italic: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p><em>italic text</em></p>");
  });

  it("converts code to <code>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "inline code", { code: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p><code>inline code</code></p>");
  });

  it("converts strikethrough to <del>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "struck", { strike: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p><del>struck</del></p>");
  });

  it("converts links to <a>", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "click here", { link: { href: "https://example.com" } });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe('<p><a href="https://example.com">click here</a></p>');
  });

  it("converts bullet lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("bulletList");
      const item1 = new Y.XmlElement("listItem");
      const p1 = new Y.XmlElement("paragraph");
      p1.insert(0, [new Y.XmlText("Item one")]);
      item1.insert(0, [p1]);
      const item2 = new Y.XmlElement("listItem");
      const p2 = new Y.XmlElement("paragraph");
      p2.insert(0, [new Y.XmlText("Item two")]);
      item2.insert(0, [p2]);
      list.insert(0, [item1, item2]);
      f.insert(0, [list]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<ul><li>Item one</li><li>Item two</li></ul>");
  });

  it("converts ordered lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("orderedList");
      const item = new Y.XmlElement("listItem");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("First")]);
      item.insert(0, [p]);
      list.insert(0, [item]);
      f.insert(0, [list]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<ol><li>First</li></ol>");
  });

  it("converts blockquotes", () => {
    const frag = buildFragment((f) => {
      const bq = new Y.XmlElement("blockquote");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Quoted text")]);
      bq.insert(0, [p]);
      f.insert(0, [bq]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<blockquote><p>Quoted text</p></blockquote>");
  });

  it("converts code blocks with language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.setAttribute("language", "javascript");
      cb.insert(0, [new Y.XmlText("const x = 1;")]);
      f.insert(0, [cb]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe('<pre><code class="language-javascript">const x = 1;</code></pre>');
  });

  it("converts code blocks without language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.insert(0, [new Y.XmlText("plain code")]);
      f.insert(0, [cb]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<pre><code>plain code</code></pre>");
  });

  it("converts horizontal rules", () => {
    const frag = buildFragment((f) => {
      const hr = new Y.XmlElement("horizontalRule");
      f.insert(0, [hr]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<hr>");
  });

  it("skips suggestion-delete marks", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "keep this");
      text.insert(9, "delete this", { suggestionMark: { type: "delete" } });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p>keep this</p>");
  });

  it("returns empty string for empty fragment", () => {
    const frag = buildFragment(() => {});
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("");
  });

  it("escapes HTML entities in text", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("a < b & c > d")]);
      f.insert(0, [p]);
    });
    const html = xmlFragmentToHtml(frag);
    expect(html).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });
});

describe("wrapInHtmlTemplate", () => {
  it("wraps content in a full HTML page", () => {
    const html = wrapInHtmlTemplate("<h1>Test</h1>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<h1>Test</h1>");
    expect(html).toContain("font-family");
    expect(html).toContain("</html>");
  });
});
```

- [ ] **Step 2: Run tests (should fail — no implementation yet)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/export-html.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement export-html.ts**

Create `src/lib/export-html.ts`:

```typescript
import * as Y from "yjs";

/**
 * Escape HTML special characters to prevent XSS and rendering issues.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert a Yjs XmlFragment (ProseMirror/Tiptap document) to HTML string.
 * Walks the Yjs CRDT tree directly.
 */
export function xmlFragmentToHtml(fragment: Y.XmlFragment): string {
  let html = "";

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);

    if (child instanceof Y.XmlText) {
      html += xmlTextToHtml(child);
    } else if (child instanceof Y.XmlElement) {
      const tag = child.nodeName;

      if (tag === "heading") {
        const level = Math.min(Math.max(Number(child.getAttribute("level") || 1), 1), 6);
        html += `<h${level}>${getElementHtml(child)}</h${level}>`;
      } else if (tag === "paragraph") {
        const inner = getElementHtml(child);
        if (inner.length > 0) {
          html += `<p>${inner}</p>`;
        }
      } else if (tag === "bulletList") {
        html += `<ul>${listItemsToHtml(child)}</ul>`;
      } else if (tag === "orderedList") {
        html += `<ol>${listItemsToHtml(child)}</ol>`;
      } else if (tag === "blockquote") {
        html += `<blockquote>${xmlFragmentToHtml(child)}</blockquote>`;
      } else if (tag === "codeBlock") {
        const language = child.getAttribute("language") || "";
        const text = escapeHtml(getPlainText(child));
        if (language) {
          html += `<pre><code class="language-${escapeHtml(language)}">${text}</code></pre>`;
        } else {
          html += `<pre><code>${text}</code></pre>`;
        }
      } else if (tag === "horizontalRule") {
        html += "<hr>";
      } else {
        // Unknown block — just extract content
        const inner = getElementHtml(child);
        if (inner) html += inner;
      }
    }
  }

  return html;
}

/**
 * Extract HTML from an XmlElement's children, handling inline marks.
 */
function getElementHtml(element: Y.XmlElement): string {
  let html = "";
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      html += xmlTextToHtml(child);
    } else if (child instanceof Y.XmlElement) {
      html += getElementHtml(child);
    }
  }
  return html;
}

/**
 * Extract plain text from an element (no formatting).
 */
function getPlainText(element: Y.XmlElement): string {
  let text = "";
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      const delta = child.toDelta();
      for (const op of delta) {
        if (typeof op.insert === "string") {
          const attrs = op.attributes || {};
          if (attrs.suggestionMark && attrs.suggestionMark.type === "delete") continue;
          text += op.insert;
        }
      }
    } else if (child instanceof Y.XmlElement) {
      text += getPlainText(child);
    }
  }
  return text;
}

/**
 * Convert XmlText with formatting deltas to inline HTML.
 */
function xmlTextToHtml(xmlText: Y.XmlText): string {
  const delta = xmlText.toDelta();
  let html = "";
  for (const op of delta) {
    if (typeof op.insert !== "string") continue;
    const attrs = op.attributes || {};

    // Skip suggestion-delete marks
    if (attrs.suggestionMark && attrs.suggestionMark.type === "delete") continue;

    let segment = escapeHtml(op.insert);

    if (attrs.code) segment = `<code>${segment}</code>`;
    if (attrs.bold) segment = `<strong>${segment}</strong>`;
    if (attrs.italic) segment = `<em>${segment}</em>`;
    if (attrs.strike) segment = `<del>${segment}</del>`;
    if (attrs.link) segment = `<a href="${escapeHtml(attrs.link.href)}">${segment}</a>`;

    html += segment;
  }
  return html;
}

/**
 * Convert list items to HTML <li> elements.
 */
function listItemsToHtml(listElement: Y.XmlElement): string {
  let html = "";
  for (let i = 0; i < listElement.length; i++) {
    const child = listElement.get(i);
    if (child instanceof Y.XmlElement && child.nodeName === "listItem") {
      let liContent = "";
      for (let j = 0; j < child.length; j++) {
        const inner = child.get(j);
        if (inner instanceof Y.XmlElement) {
          if (inner.nodeName === "paragraph") {
            liContent += getElementHtml(inner);
          } else if (inner.nodeName === "bulletList") {
            liContent += `<ul>${listItemsToHtml(inner)}</ul>`;
          } else if (inner.nodeName === "orderedList") {
            liContent += `<ol>${listItemsToHtml(inner)}</ol>`;
          }
        }
      }
      html += `<li>${liContent}</li>`;
    }
  }
  return html;
}

/**
 * Wrap HTML content in a styled HTML page template suitable for PDF rendering.
 */
export function wrapInHtmlTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; line-height: 1.6; color: #333; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.2em; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f9f9f9; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>${content}</body>
</html>`;
}
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/export-html.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/export-html.ts src/lib/__tests__/export-html.test.ts
git commit -m "feat: add HTML export from Yjs XmlFragment for PDF pipeline"
```

---

## Task 3: Create PDF Export API Endpoint

**Files:**
- New: `src/app/api/documents/[id]/export/pdf/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/documents/[id]/export/pdf/route.ts`:

```typescript
import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToHtml, wrapInHtmlTemplate } from "@/lib/export-html";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // Connect to Yjs and extract HTML
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const htmlContent = xmlFragmentToHtml(yxml);
    const fullHtml = wrapInHtmlTemplate(htmlContent);

    // Render to PDF via Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 });
  } finally {
    cleanup?.();
    if (browser) {
      await browser.close();
    }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/ronica/projects/markdown-collab
npx tsc --noEmit src/app/api/documents/\[id\]/export/pdf/route.ts 2>&1 || echo "Check for errors above"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add -f src/app/api/documents/\[id\]/export/pdf/route.ts
git commit -m "feat: add PDF export API endpoint with Puppeteer rendering"
```

---

## Task 4: Add Export Dropdown to TopBar

**Files:**
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Replace the Export link with a dropdown**

In `src/components/TopBar.tsx`, replace the existing Export `<a>` block (lines 144-153):

```tsx
{/* Export — icon-only on mobile, text on sm+ */}
<a
  href={`/api/documents/${documentId}/export`}
  className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
  title="Export"
>
  <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
  <span className="hidden sm:inline">Export</span>
</a>
```

Replace with:

```tsx
{/* Export dropdown */}
<div className="relative">
  <button
    onClick={() => setExportOpen((v) => !v)}
    className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
    title="Export"
  >
    <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
    <span className="hidden sm:inline">Export</span>
    <svg className="hidden sm:block h-3 w-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  {exportOpen && (
    <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a19] border border-white/10 rounded-lg shadow-xl z-50 py-1">
      <a
        href={`/api/documents/${documentId}/export`}
        onClick={() => setExportOpen(false)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
      >
        <span>Markdown (.md)</span>
      </a>
      <a
        href={`/api/documents/${documentId}/export/pdf`}
        onClick={() => setExportOpen(false)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
      >
        <span>PDF (.pdf)</span>
      </a>
    </div>
  )}
</div>
```

- [ ] **Step 2: Add the `exportOpen` state variable**

Add this line after the existing `const [showShareModal, setShowShareModal] = useState(false);` (around line 45):

```typescript
const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 3: Add click-outside handler to close the dropdown**

Add this useEffect after the existing `useEffect` blocks (after the `commitTitle` function, around line 58):

```typescript
useEffect(() => {
  if (!exportOpen) return;
  function handleClick() {
    setExportOpen(false);
  }
  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}, [exportOpen]);
```

- [ ] **Step 4: Manually test**

Open http://100.109.228.117:3000/ in a browser. Open a document. Click the Export button. Verify dropdown shows two options. Click "PDF (.pdf)" and verify a PDF downloads.

- [ ] **Step 5: Run existing tests to check for regressions**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/TopBar.tsx
git commit -m "feat: add export dropdown with Markdown and PDF options in TopBar"
```
