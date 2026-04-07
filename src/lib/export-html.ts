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
      } else if (tag === "image") {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "";
        html += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
      } else if (tag === "table") {
        html += tableToHtml(child);
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
 * Convert a Tiptap table XmlElement to an HTML table.
 * Expects children: tableRow elements, each containing tableHeader or tableCell elements.
 */
function tableToHtml(table: Y.XmlElement): string {
  let html = "<table>";

  for (let i = 0; i < table.length; i++) {
    const row = table.get(i);
    if (!(row instanceof Y.XmlElement) || row.nodeName !== "tableRow") continue;

    html += "<tr>";
    for (let j = 0; j < row.length; j++) {
      const cell = row.get(j);
      if (!(cell instanceof Y.XmlElement)) continue;

      const isHeader = cell.nodeName === "tableHeader";
      const tag = isHeader ? "th" : "td";
      const content = getElementHtml(cell);
      html += `<${tag}>${content}</${tag}>`;
    }
    html += "</tr>";
  }

  html += "</table>";
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
