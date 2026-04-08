/**
 * ProgressBlock -- a custom Tiptap Node for visual progress bars.
 * Renders as a labeled progress bar with a percentage display.
 * Click the bar to edit value.
 *
 * Usage:
 *   import { ProgressBlock } from "@/extensions/progress-block";
 *   extensions: [ ..., ProgressBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";

export const ProgressBlock = Node.create({
  name: "progressBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      label: {
        default: "Progress",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label") || "Progress",
      },
      value: {
        default: 0,
        parseHTML: (element: HTMLElement) => parseInt(element.getAttribute("data-value") || "0", 10),
      },
      color: {
        default: "#B8692A",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-color") || "#B8692A",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="progress-block"]' }];
  },

  renderHTML({ node, HTMLAttributes }: { node: { attrs: { label: string; value: number; color: string } }; HTMLAttributes: Record<string, unknown> }) {
    const { label, value, color } = node.attrs;
    const clampedValue = Math.max(0, Math.min(100, value));

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "progress-block",
        "data-label": label,
        "data-value": String(clampedValue),
        "data-color": color,
        class: "progress-block-wrapper",
        contenteditable: "false",
      }),
      [
        "div",
        { class: "progress-label" },
        label,
      ],
      [
        "div",
        { class: "progress-track" },
        [
          "div",
          {
            class: "progress-fill",
            style: `width: ${clampedValue}%; background-color: ${color}`,
          },
        ],
      ],
      [
        "div",
        { class: "progress-value" },
        `${clampedValue}%`,
      ],
    ];
  },

  addCommands() {
    return {
      insertProgressBlock:
        (attrs?: { label?: string; value?: number; color?: string }) =>
        ({ chain }: { chain: () => any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                label: attrs?.label ?? "Progress",
                value: attrs?.value ?? 0,
                color: attrs?.color ?? "#B8692A",
              },
            })
            .run();
        },
    } as any;
  },

  addNodeView() {
    return ({ node, getPos, editor }: { node: any; getPos: () => number; editor: any }) => {
      const dom = document.createElement("div");
      dom.className = "progress-block-wrapper";
      dom.setAttribute("data-type", "progress-block");
      dom.contentEditable = "false";

      function render() {
        const { label, value, color } = node.attrs;
        const clampedValue = Math.max(0, Math.min(100, value));

        dom.innerHTML = `
          <div class="progress-label">${escapeHtml(label)}</div>
          <div class="progress-track" style="cursor: pointer" title="Click to set progress value">
            <div class="progress-fill" style="width: ${clampedValue}%; background-color: ${color}"></div>
          </div>
          <div class="progress-value">${clampedValue}%</div>
        `;

        // Click on the track to change value
        const track = dom.querySelector(".progress-track") as HTMLElement;
        if (track) {
          track.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = track.getBoundingClientRect();
            const clickX = (e as MouseEvent).clientX - rect.left;
            const pct = Math.round((clickX / rect.width) * 100);
            const newValue = Math.max(0, Math.min(100, pct));

            if (typeof getPos === "function") {
              editor.chain().focus().command(({ tr }: { tr: any }) => {
                const pos = getPos();
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  value: newValue,
                });
                return true;
              }).run();
            }
          });
        }

        // Click on the label to edit it
        const labelEl = dom.querySelector(".progress-label") as HTMLElement;
        if (labelEl) {
          labelEl.style.cursor = "pointer";
          labelEl.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const newLabel = window.prompt("Progress bar label:", label);
            if (newLabel !== null && typeof getPos === "function") {
              editor.chain().focus().command(({ tr }: { tr: any }) => {
                const pos = getPos();
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  label: newLabel || "Progress",
                });
                return true;
              }).run();
            }
          });
        }
      }

      render();

      return {
        dom,
        update(updatedNode: any) {
          if (updatedNode.type.name !== "progressBlock") return false;
          node = updatedNode;
          render();
          return true;
        },
        stopEvent() {
          return true;
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
