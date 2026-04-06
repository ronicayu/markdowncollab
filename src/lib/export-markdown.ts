import * as Y from "yjs";

/**
 * Convert a Yjs XmlFragment (ProseMirror/Tiptap document) to clean markdown.
 * Walks the Yjs CRDT tree directly instead of relying on toJSON().
 */
export function xmlFragmentToMarkdown(fragment: Y.XmlFragment): string {
  let md = "";

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);

    if (child instanceof Y.XmlText) {
      md += xmlTextToMarkdown(child);
    } else if (child instanceof Y.XmlElement) {
      const tag = child.nodeName;

      if (tag === "heading") {
        const level = child.getAttribute("level") || 1;
        const prefix = "#".repeat(Number(level));
        md += `${prefix} ${getElementText(child)}\n\n`;
      } else if (tag === "paragraph") {
        const text = getElementText(child);
        if (text.length > 0) {
          md += `${text}\n\n`;
        } else {
          md += "\n";
        }
      } else if (tag === "bulletList") {
        md += listToMarkdown(child, "- ", 0);
        md += "\n";
      } else if (tag === "orderedList") {
        md += listToMarkdown(child, "1. ", 0);
        md += "\n";
      } else if (tag === "blockquote") {
        const inner = xmlFragmentToMarkdown(child);
        md += inner
          .split("\n")
          .map((line) => (line.trim() ? `> ${line}` : ">"))
          .join("\n");
        md += "\n\n";
      } else if (tag === "codeBlock") {
        const language = child.getAttribute("language") || "";
        md += `\`\`\`${language}\n${getElementText(child)}\n\`\`\`\n\n`;
      } else if (tag === "horizontalRule") {
        md += "---\n\n";
      } else if (tag === "table") {
        md += tableToMarkdown(child);
        md += "\n";
      } else {
        // Unknown block — just extract text
        const text = getElementText(child);
        if (text) md += `${text}\n\n`;
      }
    }
  }

  return md.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Extract text from an XmlElement, handling inline marks.
 */
function getElementText(element: Y.XmlElement): string {
  let text = "";
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      text += xmlTextToMarkdown(child);
    } else if (child instanceof Y.XmlElement) {
      text += getElementText(child);
    }
  }
  return text;
}

/**
 * Convert XmlText with formatting deltas to inline markdown.
 */
function xmlTextToMarkdown(xmlText: Y.XmlText): string {
  const delta = xmlText.toDelta();
  let text = "";
  for (const op of delta) {
    if (typeof op.insert !== "string") continue;
    let segment = op.insert;
    const attrs = op.attributes || {};

    // Skip suggestion-delete marks (text being removed)
    if (attrs.suggestionMark && attrs.suggestionMark.type === "delete") continue;

    if (attrs.code) segment = `\`${segment}\``;
    if (attrs.bold) segment = `**${segment}**`;
    if (attrs.italic) segment = `*${segment}*`;
    if (attrs.strike) segment = `~~${segment}~~`;
    if (attrs.link) segment = `[${segment}](${attrs.link.href})`;

    text += segment;
  }
  return text;
}

/**
 * Convert list elements to markdown with proper indentation.
 */
function listToMarkdown(
  listElement: Y.XmlElement,
  prefix: string,
  indent: number
): string {
  let md = "";
  const spaces = "  ".repeat(indent);
  let itemNum = 1;

  for (let i = 0; i < listElement.length; i++) {
    const child = listElement.get(i);
    if (child instanceof Y.XmlElement && child.nodeName === "listItem") {
      for (let j = 0; j < child.length; j++) {
        const inner = child.get(j);
        if (inner instanceof Y.XmlElement) {
          if (inner.nodeName === "paragraph") {
            const bullet = prefix === "1. " ? `${itemNum}. ` : prefix;
            md += `${spaces}${bullet}${getElementText(inner)}\n`;
            itemNum++;
          } else if (inner.nodeName === "bulletList") {
            md += listToMarkdown(inner, "- ", indent + 1);
          } else if (inner.nodeName === "orderedList") {
            md += listToMarkdown(inner, "1. ", indent + 1);
          }
        }
      }
    }
  }

  return md;
}

/**
 * Convert a Tiptap table XmlElement to pipe-delimited markdown.
 * Expects children: tableRow elements, each containing tableHeader or tableCell elements.
 * Each cell contains a paragraph element with text.
 */
function tableToMarkdown(table: Y.XmlElement): string {
  const rows: string[][] = [];
  let headerRowIndex = -1;

  for (let i = 0; i < table.length; i++) {
    const row = table.get(i);
    if (!(row instanceof Y.XmlElement) || row.nodeName !== "tableRow") continue;

    const cells: string[] = [];
    let isHeaderRow = false;

    for (let j = 0; j < row.length; j++) {
      const cell = row.get(j);
      if (!(cell instanceof Y.XmlElement)) continue;

      if (cell.nodeName === "tableHeader") {
        isHeaderRow = true;
      }

      // Extract text from cell (cells contain paragraph elements)
      cells.push(getElementText(cell).replace(/\n/g, " ").trim());
    }

    if (isHeaderRow && headerRowIndex === -1) {
      headerRowIndex = rows.length;
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  // Determine column count from the widest row
  const colCount = Math.max(...rows.map((r) => r.length));

  let md = "";
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    // Pad row to colCount
    while (cells.length < colCount) cells.push("");
    md += "| " + cells.join(" | ") + " |\n";

    // Insert separator after header row
    if (i === headerRowIndex) {
      md += "| " + cells.map(() => "---").join(" | ") + " |\n";
    }
  }

  // If no header row was detected, insert separator after first row
  if (headerRowIndex === -1 && rows.length > 0) {
    const firstRowLine = md.split("\n")[0] + "\n";
    const separator = "| " + rows[0].map(() => "---").join(" | ") + " |\n";
    md = firstRowLine + separator + md.split("\n").slice(1).join("\n");
  }

  return md;
}

/**
 * Legacy function kept for backward compatibility.
 * Converts HTML string to markdown using regex (less reliable).
 */
export function cleanMarkdown(html: string): string {
  let cleaned = html.replace(
    /<mark[^>]*data-suggestion-type="delete"[^>]*>[\s\S]*?<\/mark>/g,
    ""
  );
  cleaned = cleaned.replace(
    /<mark[^>]*data-suggestion-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );
  cleaned = cleaned.replace(
    /<mark[^>]*data-comment-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1\n\n");
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1\n\n");
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/g, "### $1\n\n");
  cleaned = cleaned.replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n");
  cleaned = cleaned.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  cleaned = cleaned.replace(/<em>(.*?)<\/em>/g, "*$1*");
  cleaned = cleaned.replace(/<code>(.*?)<\/code>/g, "`$1`");
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}
