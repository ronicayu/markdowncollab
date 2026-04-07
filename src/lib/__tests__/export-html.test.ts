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
      h.setAttribute("level", "1");
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
        h.setAttribute("level", String(level));
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
