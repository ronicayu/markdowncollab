import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const headingAnchorKey = new PluginKey("headingAnchor");

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Extension that adds anchor links to headings.
 * On hover, a link icon appears to the left.
 * Clicking it copies the URL with #heading-slug to clipboard.
 * Headings get id attributes for smooth scroll navigation.
 */
export const HeadingAnchor = Extension.create({
  name: "headingAnchor",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: headingAnchorKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name === "heading") {
                const text = node.textContent;
                const slug = generateSlug(text);

                if (slug) {
                  // Add id attribute to the heading node
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      id: slug,
                      class: "heading-anchor-target",
                      "data-slug": slug,
                    })
                  );
                }
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * On the client side, handle smooth scrolling to anchors.
 * Call this once on page load.
 */
export function initAnchorScrolling() {
  if (typeof window === "undefined") return;

  // Smooth scroll on initial load if URL has a hash
  const hash = window.location.hash;
  if (hash) {
    setTimeout(() => {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 500);
  }

  // Listen for hashchange
  window.addEventListener("hashchange", () => {
    const newHash = window.location.hash;
    if (newHash) {
      const target = document.getElementById(newHash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
}
