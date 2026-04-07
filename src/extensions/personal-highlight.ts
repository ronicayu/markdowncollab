import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";

export interface HighlightRange {
  from: number;
  to: number;
  color: string;
}

export const HIGHLIGHT_COLORS: { name: string; color: string; bg: string }[] = [
  { name: "Yellow", color: "yellow", bg: "rgba(250, 204, 21, 0.35)" },
  { name: "Blue", color: "blue", bg: "rgba(96, 165, 250, 0.35)" },
  { name: "Pink", color: "pink", bg: "rgba(244, 114, 182, 0.35)" },
  { name: "Green", color: "green", bg: "rgba(74, 222, 128, 0.35)" },
];

function colorToBg(color: string): string {
  const entry = HIGHLIGHT_COLORS.find((c) => c.color === color);
  return entry?.bg ?? "rgba(250, 204, 21, 0.35)";
}

function getStorageKey(docId: string): string {
  return `personalHighlights:${docId}`;
}

function loadHighlights(docId: string): HighlightRange[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(docId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHighlights(docId: string, highlights: HighlightRange[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(docId), JSON.stringify(highlights));
  } catch {
    // storage full
  }
}

export const personalHighlightPluginKey = new PluginKey("personalHighlight");

function buildDecorations(
  highlights: HighlightRange[],
  docSize: number
): DecorationSet {
  const decos: Decoration[] = [];
  for (const h of highlights) {
    // Guard against stale positions that exceed current doc size
    if (h.from >= 0 && h.to <= docSize && h.from < h.to) {
      decos.push(
        Decoration.inline(h.from, h.to, {
          style: `background-color: ${colorToBg(h.color)}; border-radius: 2px;`,
          class: "personal-highlight",
          "data-highlight-color": h.color,
        })
      );
    }
  }
  return DecorationSet.create(
    // We need the doc to create the set, but we don't have it here.
    // Instead, we'll build in the plugin's state init/apply where doc is available.
    // This function is a placeholder; actual creation is done inline.
    undefined as any,
    decos
  );
}

export function createPersonalHighlightPlugin(documentId: string): Plugin {
  return new Plugin({
    key: personalHighlightPluginKey,
    state: {
      init(_, state) {
        const highlights = loadHighlights(documentId);
        const decos: Decoration[] = [];
        const docSize = state.doc.content.size;
        for (const h of highlights) {
          if (h.from >= 0 && h.to <= docSize && h.from < h.to) {
            decos.push(
              Decoration.inline(h.from, h.to, {
                style: `background-color: ${colorToBg(h.color)}; border-radius: 2px;`,
                class: "personal-highlight",
                "data-highlight-color": h.color,
              })
            );
          }
        }
        return {
          highlights,
          decorationSet: DecorationSet.create(state.doc, decos),
        };
      },
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(personalHighlightPluginKey);
        if (meta) {
          // meta is { highlights: HighlightRange[] }
          const highlights: HighlightRange[] = meta.highlights;
          saveHighlights(documentId, highlights);
          const decos: Decoration[] = [];
          const docSize = newState.doc.content.size;
          for (const h of highlights) {
            if (h.from >= 0 && h.to <= docSize && h.from < h.to) {
              decos.push(
                Decoration.inline(h.from, h.to, {
                  style: `background-color: ${colorToBg(h.color)}; border-radius: 2px;`,
                  class: "personal-highlight",
                  "data-highlight-color": h.color,
                })
              );
            }
          }
          return {
            highlights,
            decorationSet: DecorationSet.create(newState.doc, decos),
          };
        }
        // Map decorations through doc changes
        if (tr.docChanged) {
          const mapped = value.decorationSet.map(tr.mapping, tr.doc);
          // Rebuild highlights from mapped decorations (positions may have shifted)
          const newHighlights: HighlightRange[] = [];
          mapped.find().forEach((deco: Decoration) => {
            const color =
              (deco as any).type?.attrs?.["data-highlight-color"] ?? "yellow";
            newHighlights.push({
              from: deco.from,
              to: deco.to,
              color,
            });
          });
          // Debounce save on doc changes (positions shift frequently during collab)
          saveHighlights(documentId, newHighlights);
          return { highlights: newHighlights, decorationSet: mapped };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const pluginState = personalHighlightPluginKey.getState(state);
        return pluginState?.decorationSet ?? DecorationSet.empty;
      },
    },
  });
}

/**
 * Add a personal highlight at the given range with the given color.
 */
export function addPersonalHighlight(
  view: import("@tiptap/pm/view").EditorView,
  from: number,
  to: number,
  color: string
): void {
  const pluginState = personalHighlightPluginKey.getState(view.state);
  const highlights: HighlightRange[] = pluginState?.highlights ?? [];
  const newHighlights = [...highlights, { from, to, color }];
  const tr = view.state.tr.setMeta(personalHighlightPluginKey, {
    highlights: newHighlights,
  });
  view.dispatch(tr);
}

/**
 * Remove all personal highlights that overlap the given range.
 */
export function removePersonalHighlight(
  view: import("@tiptap/pm/view").EditorView,
  from: number,
  to: number
): void {
  const pluginState = personalHighlightPluginKey.getState(view.state);
  const highlights: HighlightRange[] = pluginState?.highlights ?? [];
  const newHighlights = highlights.filter(
    (h) => h.to <= from || h.from >= to
  );
  const tr = view.state.tr.setMeta(personalHighlightPluginKey, {
    highlights: newHighlights,
  });
  view.dispatch(tr);
}

/**
 * Tiptap Extension wrapper so we can register the plugin via the editor config.
 * Usage: PersonalHighlight.configure({ documentId: "doc-123" })
 */
export const PersonalHighlight = Extension.create<{ documentId: string }>({
  name: "personalHighlight",

  addOptions() {
    return { documentId: "" };
  },

  addProseMirrorPlugins() {
    return [createPersonalHighlightPlugin(this.options.documentId)];
  },
});
