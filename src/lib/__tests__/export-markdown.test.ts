import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { xmlFragmentToMarkdown } from "../export-markdown";

function buildFragment(
  setup: (frag: Y.XmlFragment, doc: Y.Doc) => void
): Y.XmlFragment {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("default");
  setup(frag, doc);
  return frag;
}

describe("xmlFragmentToMarkdown", () => {
  it("converts H1 heading", () => {
    const frag = buildFragment((f) => {
      const h = new Y.XmlElement("heading");
      h.setAttribute("level", 1);
      h.insert(0, [new Y.XmlText("Hello World")]);
      f.insert(0, [h]);
    });
    expect(xmlFragmentToMarkdown(frag)).toBe("# Hello World\n");
  });

  it("converts H2 and H3 headings", () => {
    const frag = buildFragment((f) => {
      const h2 = new Y.XmlElement("heading");
      h2.setAttribute("level", 2);
      h2.insert(0, [new Y.XmlText("Section")]);
      const h3 = new Y.XmlElement("heading");
      h3.setAttribute("level", 3);
      h3.insert(0, [new Y.XmlText("Subsection")]);
      f.insert(0, [h2, h3]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("## Section");
    expect(md).toContain("### Subsection");
  });

  it("converts a paragraph", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Some text here")]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toBe("Some text here\n");
  });

  it("converts bold inline formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "bold", { bold: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("**bold**");
  });

  it("converts italic inline formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "italic", { italic: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("*italic*");
  });

  it("converts inline code formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "code", { code: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("`code`");
  });

  it("converts strikethrough formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "struck", { strike: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("~~struck~~");
  });

  it("converts links", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "click", { link: { href: "https://example.com" } });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("[click](https://example.com)");
  });

  it("converts bullet lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("bulletList");
      const item = new Y.XmlElement("listItem");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Item one")]);
      item.insert(0, [p]);
      list.insert(0, [item]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("- Item one");
  });

  it("converts ordered lists with numbering", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("orderedList");
      const item1 = new Y.XmlElement("listItem");
      const p1 = new Y.XmlElement("paragraph");
      p1.insert(0, [new Y.XmlText("First")]);
      item1.insert(0, [p1]);
      const item2 = new Y.XmlElement("listItem");
      const p2 = new Y.XmlElement("paragraph");
      p2.insert(0, [new Y.XmlText("Second")]);
      item2.insert(0, [p2]);
      list.insert(0, [item1, item2]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
  });

  it("converts nested lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("bulletList");
      const item = new Y.XmlElement("listItem");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Parent")]);
      const nested = new Y.XmlElement("bulletList");
      const nestedItem = new Y.XmlElement("listItem");
      const nestedP = new Y.XmlElement("paragraph");
      nestedP.insert(0, [new Y.XmlText("Child")]);
      nestedItem.insert(0, [nestedP]);
      nested.insert(0, [nestedItem]);
      item.insert(0, [p, nested]);
      list.insert(0, [item]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("- Parent");
    expect(md).toContain("  - Child");
  });

  it("converts blockquotes", () => {
    const frag = buildFragment((f) => {
      const bq = new Y.XmlElement("blockquote");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Quoted text")]);
      bq.insert(0, [p]);
      f.insert(0, [bq]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("> Quoted text");
  });

  it("converts code blocks with language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.setAttribute("language", "typescript");
      cb.insert(0, [new Y.XmlText("const x = 1;")]);
      f.insert(0, [cb]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("```typescript");
    expect(md).toContain("const x = 1;");
    expect(md).toContain("```");
  });

  it("converts code blocks without language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.insert(0, [new Y.XmlText("plain code")]);
      f.insert(0, [cb]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("```\nplain code\n```");
  });

  it("converts horizontal rules", () => {
    const frag = buildFragment((f) => {
      f.insert(0, [new Y.XmlElement("horizontalRule")]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("---");
  });

  it("filters out suggestion-delete marks", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "keep this");
      text.insert(9, "remove this", {
        suggestionMark: { type: "delete" },
      });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("keep this");
    expect(md).not.toContain("remove this");
  });

  it("handles empty document", () => {
    const frag = buildFragment(() => {});
    expect(xmlFragmentToMarkdown(frag)).toBe("\n");
  });

  it("handles empty paragraphs without adding extra whitespace", () => {
    const frag = buildFragment((f) => {
      const p1 = new Y.XmlElement("paragraph");
      p1.insert(0, [new Y.XmlText("First")]);
      const p2 = new Y.XmlElement("paragraph");
      // empty paragraph
      const p3 = new Y.XmlElement("paragraph");
      p3.insert(0, [new Y.XmlText("Third")]);
      f.insert(0, [p1, p2, p3]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("First");
    expect(md).toContain("Third");
    // Should not have more than 2 consecutive newlines
    expect(md).not.toMatch(/\n{3,}/);
  });
});
