import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const grammarCheckPluginKey = new PluginKey("grammarCheck");

interface GrammarIssue {
  from: number;
  to: number;
  message: string;
  suggestion: string;
}

/**
 * Grammar check extension that:
 * - Debounces 5s after last edit
 * - Sends the changed paragraph to the grammar API
 * - Creates red squiggly underline decorations on issues
 * - Shows tooltip on hover
 */
export const GrammarCheck = Extension.create({
  name: "grammarCheck",

  addStorage() {
    return {
      enabled: false,
      issues: [] as GrammarIssue[],
      timeout: null as ReturnType<typeof setTimeout> | null,
      tooltip: null as HTMLDivElement | null,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: grammarCheckPluginKey,

        state: {
          init() {
            return { decorations: DecorationSet.empty, issues: [] as GrammarIssue[] };
          },
          apply(tr, oldState, _oldEditorState, newEditorState) {
            const meta = tr.getMeta(grammarCheckPluginKey);
            if (meta?.issues) {
              const issues: GrammarIssue[] = meta.issues;
              const decos: Decoration[] = [];
              for (const issue of issues) {
                if (issue.from >= 0 && issue.to <= newEditorState.doc.content.size && issue.from < issue.to) {
                  decos.push(
                    Decoration.inline(issue.from, issue.to, {
                      class: "grammar-error",
                      "data-grammar-message": issue.message,
                      "data-grammar-suggestion": issue.suggestion,
                    })
                  );
                }
              }
              return { decorations: DecorationSet.create(newEditorState.doc, decos), issues };
            }
            if (meta?.clear) {
              return { decorations: DecorationSet.empty, issues: [] };
            }
            // Map decorations through document changes
            if (tr.docChanged) {
              return {
                decorations: oldState.decorations.map(tr.mapping, tr.doc),
                issues: oldState.issues,
              };
            }
            return oldState;
          },
        },

        props: {
          decorations(state) {
            return grammarCheckPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList?.contains("grammar-error")) {
                // Remove existing tooltip
                if (storage.tooltip?.parentNode) {
                  storage.tooltip.parentNode.removeChild(storage.tooltip);
                  storage.tooltip = null;
                }
                return false;
              }

              const message = target.getAttribute("data-grammar-message") || "";
              const suggestion = target.getAttribute("data-grammar-suggestion") || "";

              if (storage.tooltip?.parentNode) {
                storage.tooltip.parentNode.removeChild(storage.tooltip);
              }

              const tooltip = document.createElement("div");
              tooltip.className = "grammar-tooltip";
              tooltip.innerHTML = `
                <div style="font-size:12px;font-weight:500;color:#b91c1c;margin-bottom:2px">${message}</div>
                ${suggestion ? `<div style="font-size:11px;color:#4b5563">Suggestion: <em>${suggestion}</em></div>` : ""}
              `;
              const rect = target.getBoundingClientRect();
              tooltip.style.cssText = `
                position:fixed;
                top:${rect.bottom + 4}px;
                left:${rect.left}px;
                z-index:1000;
                background:white;
                border:1px solid #e5e7eb;
                border-radius:8px;
                padding:8px 12px;
                box-shadow:0 4px 12px rgba(0,0,0,0.1);
                max-width:300px;
                pointer-events:none;
              `;
              document.body.appendChild(tooltip);
              storage.tooltip = tooltip;
              return false;
            },
            mouseout(_view, event) {
              const target = event.target as HTMLElement;
              if (target.classList?.contains("grammar-error") && storage.tooltip?.parentNode) {
                storage.tooltip.parentNode.removeChild(storage.tooltip);
                storage.tooltip = null;
              }
              return false;
            },
          },
        },

        view(editorView) {
          function scheduleCheck() {
            if (!storage.enabled) return;

            if (storage.timeout) clearTimeout(storage.timeout);

            storage.timeout = setTimeout(async () => {
              if (!storage.enabled) return;

              const { state } = editorView;
              const { $from } = state.selection;

              // Get the text of the paragraph the cursor is in
              const paragraph = $from.parent;
              if (paragraph.type.name !== "paragraph" && paragraph.type.name !== "heading") return;

              const text = paragraph.textContent;
              if (!text || text.trim().length < 10) return;

              // Calculate the absolute position of the paragraph start
              const paragraphStart = $from.start();

              try {
                const res = await fetch("/api/agent/grammar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!data.issues || !Array.isArray(data.issues)) return;

                // Map relative positions to absolute document positions
                const issues: GrammarIssue[] = data.issues
                  .filter((i: { start: number; end: number }) =>
                    typeof i.start === "number" && typeof i.end === "number" &&
                    i.start >= 0 && i.end <= text.length && i.start < i.end
                  )
                  .map((i: { start: number; end: number; message: string; suggestion: string }) => ({
                    from: paragraphStart + i.start,
                    to: paragraphStart + i.end,
                    message: i.message || "Grammar issue",
                    suggestion: i.suggestion || "",
                  }));

                editorView.dispatch(
                  editorView.state.tr.setMeta(grammarCheckPluginKey, { issues })
                );
              } catch {
                // silently fail
              }
            }, 5000);
          }

          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc) {
                scheduleCheck();
              }
            },
            destroy() {
              if (storage.timeout) clearTimeout(storage.timeout);
              if (storage.tooltip?.parentNode) {
                storage.tooltip.parentNode.removeChild(storage.tooltip);
              }
            },
          };
        },
      }),
    ];
  },
});
