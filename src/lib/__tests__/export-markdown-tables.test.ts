import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { xmlFragmentToMarkdown } from "../export-markdown";

/**
 * Helper: build a Yjs document with a table structure.
 * Tiptap tables use these node names: table, tableRow, tableHeader, tableCell.
 * Each cell contains a paragraph with text.
 */
function createTableDoc(headers: string[], rows: string[][]): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");

  const table = new Y.XmlElement("table");

  // Header row
  const headerRow = new Y.XmlElement("tableRow");
  for (const header of headers) {
    const th = new Y.XmlElement("tableHeader");
    const p = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, header);
    p.insert(0, [text]);
    th.insert(0, [p]);
    headerRow.push([th]);
  }
  table.push([headerRow]);

  // Data rows
  for (const row of rows) {
    const tr = new Y.XmlElement("tableRow");
    for (const cell of row) {
      const td = new Y.XmlElement("tableCell");
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, cell);
      p.insert(0, [text]);
      td.insert(0, [p]);
      tr.push([td]);
    }
    table.push([tr]);
  }

  fragment.push([table]);
  return doc;
}

describe("xmlFragmentToMarkdown - table support", () => {
  it("exports a simple 2-column table with header", () => {
    const doc = createTableDoc(
      ["Name", "Age"],
      [
        ["Alice", "30"],
        ["Bob", "25"],
      ]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| Name | Age |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| Alice | 30 |");
    expect(md).toContain("| Bob | 25 |");
  });

  it("exports a single-row table (header only)", () => {
    const doc = createTableDoc(["Col A", "Col B"], []);
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| Col A | Col B |");
    expect(md).toContain("| --- | --- |");
  });

  it("handles empty cell content", () => {
    const doc = createTableDoc(
      ["X", "Y"],
      [["", "data"]]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("|  | data |");
  });

  it("handles a 3-column table", () => {
    const doc = createTableDoc(
      ["A", "B", "C"],
      [["1", "2", "3"]]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| A | B | C |");
    expect(md).toContain("| --- | --- | --- |");
    expect(md).toContain("| 1 | 2 | 3 |");
  });

  it("exports table with bold text in cells", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("default");
    const table = new Y.XmlElement("table");
    const headerRow = new Y.XmlElement("tableRow");
    const th = new Y.XmlElement("tableHeader");
    const p1 = new Y.XmlElement("paragraph");
    const t1 = new Y.XmlText();
    t1.insert(0, "Header", { bold: true });
    p1.insert(0, [t1]);
    th.insert(0, [p1]);
    headerRow.push([th]);
    table.push([headerRow]);

    const dataRow = new Y.XmlElement("tableRow");
    const td = new Y.XmlElement("tableCell");
    const p2 = new Y.XmlElement("paragraph");
    const t2 = new Y.XmlText();
    t2.insert(0, "Normal");
    p2.insert(0, [t2]);
    td.insert(0, [p2]);
    dataRow.push([td]);
    table.push([dataRow]);

    fragment.push([table]);

    const md = xmlFragmentToMarkdown(fragment);
    expect(md).toContain("| **Header** |");
    expect(md).toContain("| Normal |");
  });
});
