import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  Table as DocxTable,
  WidthType,
  BorderStyle,
} from "docx";
import * as Y from "yjs";

/**
 * Convert a Yjs XmlFragment (ProseMirror/Tiptap document) to a DOCX buffer.
 */
export async function xmlFragmentToDocx(fragment: Y.XmlFragment): Promise<Buffer> {
  const paragraphs: (Paragraph | DocxTable)[] = [];

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);

    if (child instanceof Y.XmlElement) {
      const elements = convertElement(child);
      paragraphs.push(...elements);
    } else if (child instanceof Y.XmlText) {
      const text = child.toString();
      if (text.trim()) {
        paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      }
    }
  }

  // If no content, add an empty paragraph
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({}));
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function convertElement(el: Y.XmlElement): (Paragraph | DocxTable)[] {
  const tag = el.nodeName;

  if (tag === "heading") {
    const level = Number(el.getAttribute("level") || 1);
    const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };
    return [
      new Paragraph({
        heading: headingMap[level] || HeadingLevel.HEADING_1,
        children: getTextRuns(el),
      }),
    ];
  }

  if (tag === "paragraph") {
    return [
      new Paragraph({
        children: getTextRuns(el),
      }),
    ];
  }

  if (tag === "blockquote") {
    const items: (Paragraph | DocxTable)[] = [];
    for (let i = 0; i < el.length; i++) {
      const child = el.get(i);
      if (child instanceof Y.XmlElement) {
        const converted = convertElement(child);
        for (const p of converted) {
          if (p instanceof Paragraph) {
            items.push(
              new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: "\u201C ", italics: true }),
                  ...getTextRuns(child as Y.XmlElement),
                  new TextRun({ text: " \u201D", italics: true }),
                ],
              })
            );
          } else {
            items.push(p);
          }
        }
      }
    }
    return items.length > 0 ? items : [new Paragraph({})];
  }

  if (tag === "bulletList" || tag === "orderedList") {
    return convertList(el, tag === "orderedList", 0);
  }

  if (tag === "codeBlock") {
    const text = getElementText(el);
    return [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Courier New",
            size: 20,
          }),
        ],
        spacing: { before: 120, after: 120 },
      }),
    ];
  }

  if (tag === "horizontalRule") {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "\u2500".repeat(40) })],
      }),
    ];
  }

  if (tag === "table") {
    return [convertTable(el)];
  }

  if (tag === "image") {
    const src = el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    return [
      new Paragraph({
        children: [new TextRun({ text: `[Image: ${alt || src}]`, italics: true })],
      }),
    ];
  }

  // Default: try to extract text
  const text = getElementText(el);
  if (text.trim()) {
    return [new Paragraph({ children: [new TextRun(text)] })];
  }
  return [];
}

function convertList(el: Y.XmlElement, ordered: boolean, depth: number): Paragraph[] {
  const items: Paragraph[] = [];
  let counter = 0;

  for (let i = 0; i < el.length; i++) {
    const child = el.get(i);
    if (!(child instanceof Y.XmlElement)) continue;

    if (child.nodeName === "listItem" || child.nodeName === "taskItem") {
      counter++;
      const prefix = ordered ? `${counter}. ` : "\u2022 ";
      const indent = 360 * (depth + 1);

      // Get the first paragraph in the list item
      let text = "";
      for (let j = 0; j < child.length; j++) {
        const innerChild = child.get(j);
        if (innerChild instanceof Y.XmlElement) {
          if (innerChild.nodeName === "paragraph") {
            text = getElementText(innerChild);
            break;
          } else if (innerChild.nodeName === "bulletList" || innerChild.nodeName === "orderedList") {
            // Nested list
            items.push(
              ...convertList(innerChild, innerChild.nodeName === "orderedList", depth + 1)
            );
            continue;
          }
        }
      }

      if (text || child.nodeName === "taskItem") {
        const checked = child.getAttribute("checked") === "true" || (child.getAttribute("checked") as any) === true;
        const taskPrefix = child.nodeName === "taskItem" ? (checked ? "\u2611 " : "\u2610 ") : "";
        items.push(
          new Paragraph({
            indent: { left: indent },
            children: [new TextRun({ text: `${prefix}${taskPrefix}${text}` })],
          })
        );
      }

      // Process nested lists
      for (let j = 0; j < child.length; j++) {
        const innerChild = child.get(j);
        if (innerChild instanceof Y.XmlElement) {
          if (innerChild.nodeName === "bulletList" || innerChild.nodeName === "orderedList") {
            items.push(
              ...convertList(innerChild, innerChild.nodeName === "orderedList", depth + 1)
            );
          }
        }
      }
    }
  }

  return items;
}

function convertTable(el: Y.XmlElement): DocxTable {
  const rows: DocxTableRow[] = [];

  for (let i = 0; i < el.length; i++) {
    const rowEl = el.get(i);
    if (!(rowEl instanceof Y.XmlElement) || rowEl.nodeName !== "tableRow") continue;

    const cells: DocxTableCell[] = [];
    for (let j = 0; j < rowEl.length; j++) {
      const cellEl = rowEl.get(j);
      if (!(cellEl instanceof Y.XmlElement)) continue;

      const text = getElementText(cellEl);
      cells.push(
        new DocxTableCell({
          children: [new Paragraph({ children: [new TextRun(text)] })],
          width: { size: 3000, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      );
    }

    if (cells.length > 0) {
      rows.push(new DocxTableRow({ children: cells }));
    }
  }

  if (rows.length === 0) {
    // Return a minimal 1x1 table
    rows.push(
      new DocxTableRow({
        children: [
          new DocxTableCell({
            children: [new Paragraph({})],
            width: { size: 3000, type: WidthType.DXA },
          }),
        ],
      })
    );
  }

  return new DocxTable({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function getTextRuns(el: Y.XmlElement): TextRun[] {
  const runs: TextRun[] = [];

  for (let i = 0; i < el.length; i++) {
    const child = el.get(i);
    if (child instanceof Y.XmlText) {
      const delta = child.toDelta();
      for (const op of delta) {
        if (typeof op.insert === "string") {
          const attrs = op.attributes || {};
          runs.push(
            new TextRun({
              text: op.insert,
              bold: !!attrs.bold,
              italics: !!attrs.italic,
              strike: !!attrs.strike,
              underline: attrs.underline ? {} : undefined,
              font: attrs.code ? "Courier New" : undefined,
              superScript: !!attrs.superscript,
              subScript: !!attrs.subscript,
            })
          );
        }
      }
    } else if (child instanceof Y.XmlElement) {
      // Nested element (e.g. inline elements)
      const text = getElementText(child);
      if (text) {
        runs.push(new TextRun(text));
      }
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun(""));
  }

  return runs;
}

function getElementText(el: Y.XmlElement): string {
  let text = "";
  for (let i = 0; i < el.length; i++) {
    const child = el.get(i);
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += getElementText(child);
    }
  }
  return text;
}
