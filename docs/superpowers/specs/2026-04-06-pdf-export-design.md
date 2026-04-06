# PDF Export

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Required for sharing docs externally

## Problem

Documents can only be exported as markdown. Teams need PDF for sharing with managers, clients, or stakeholders who don't have access to the app. PDF is the universal document format.

## Design

### Approach

Server-side HTML-to-PDF conversion. Convert the Yjs doc to HTML (extending the existing markdown export), then use a headless browser (Puppeteer) to render it as PDF with proper styling.

### Dependencies

```bash
npm install puppeteer
```

### Pipeline

1. Connect to Yjs doc via WebSocket (reuse `yjs-server-connect.ts`)
2. Convert XmlFragment to HTML (new function, extends export logic)
3. Wrap in a styled HTML template (typography, margins, page breaks)
4. Render to PDF via Puppeteer
5. Return PDF as downloadable file

### API

**`GET /api/documents/[id]/export/pdf`**
- Returns PDF with `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="{title}.pdf"`
- Requires viewer role

### HTML Template

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; line-height: 1.6; color: #333; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.2em; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f9f9f9; font-weight: 600; }
    img { max-width: 100%; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>{{content}}</body>
</html>
```

### HTML Conversion

New function `xmlFragmentToHtml()` in `src/lib/export-html.ts`:
- Similar to `xmlFragmentToMarkdown()` but outputs HTML tags
- Handles: headings, paragraphs, lists, blockquotes, code blocks, tables, images, horizontal rules
- Inline: bold → `<strong>`, italic → `<em>`, code → `<code>`, link → `<a>`, strikethrough → `<del>`
- Mermaid blocks → rendered as `<pre>` (SVG rendering in PDF is complex, defer)

### Puppeteer Configuration

```typescript
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html);
const pdf = await page.pdf({
  format: 'A4',
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
});
await browser.close();
return pdf;
```

### UI

Add "Export as PDF" option alongside the existing "Export" link in TopBar:
- Dropdown with two options: "Markdown (.md)" and "PDF (.pdf)"
- Or: two separate buttons/links

### Performance

Puppeteer launch takes ~1-2 seconds. For a 10-person team, this is acceptable. No caching needed for v1.

## Team Debate Notes

**SWE 2 challenged:** "Puppeteer is heavy. Can we use a lighter library like jsPDF?"
**SWE 1 response:** "jsPDF can't render HTML with CSS reliably. It works for simple text but breaks on tables, code blocks, and mixed formatting. Puppeteer gives pixel-perfect PDFs because it uses a real browser engine."
**Consensus:** Puppeteer. The quality justifies the dependency.

**PM challenged:** "Should we render Mermaid diagrams as SVG in the PDF?"
**SWE 1 response:** "That requires running mermaid.render() server-side which needs a DOM. Puppeteer could do it but it adds complexity. Export as code block for v1."
**Consensus:** Mermaid as `<pre>` code blocks in PDF. SVG rendering later.

## Testing Strategy

- Unit test HTML conversion (all block types, inline formatting)
- API test: request PDF, verify Content-Type and non-empty response
- Manual test: open PDF, verify formatting matches editor content
