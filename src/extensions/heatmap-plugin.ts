import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const heatmapPluginKey = new PluginKey("heatmap");

/**
 * Per-session edit frequency tracker.
 * Maps node position (start of block) to edit count.
 * Reset on page reload.
 */
const editCounts = new Map<number, number>();

function getHeatColor(count: number, maxCount: number): string | null {
  if (count === 0 || maxCount === 0) return null;
  const ratio = count / maxCount;
  if (ratio < 0.2) return "rgba(255, 248, 220, 0.5)"; // very light yellow
  if (ratio < 0.4) return "rgba(255, 243, 191, 0.6)"; // light yellow
  if (ratio < 0.6) return "rgba(255, 228, 150, 0.5)"; // yellow
  if (ratio < 0.8) return "rgba(255, 213, 110, 0.5)"; // light orange
  return "rgba(255, 193, 70, 0.5)"; // orange
}

function buildDecorations(
  doc: import("@tiptap/pm/model").Node,
  enabled: boolean
): DecorationSet {
  if (!enabled) return DecorationSet.empty;

  const maxCount = Math.max(0, ...editCounts.values());
  if (maxCount === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  doc.forEach((node, offset) => {
    if (
      node.type.name === "paragraph" ||
      node.type.name === "heading" ||
      node.type.name === "blockquote" ||
      node.type.name === "codeBlock" ||
      node.type.name === "listItem"
    ) {
      const count = editCounts.get(offset) || 0;
      const color = getHeatColor(count, maxCount);
      if (color) {
        decorations.push(
          Decoration.node(offset, offset + node.nodeSize, {
            style: `background-color: ${color}; transition: background-color 0.3s ease;`,
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function createHeatmapPlugin() {
  return new Plugin({
    key: heatmapPluginKey,
    state: {
      init() {
        return { enabled: false };
      },
      apply(tr, value) {
        const meta = tr.getMeta(heatmapPluginKey);
        if (meta !== undefined) {
          return { enabled: meta.enabled };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const pluginState = heatmapPluginKey.getState(state);
        return buildDecorations(state.doc, pluginState?.enabled ?? false);
      },
    },
    appendTransaction(transactions, _oldState, newState) {
      // Track edits: for each transaction that has doc changes,
      // increment the edit count for affected top-level blocks
      let changed = false;
      for (const tr of transactions) {
        if (!tr.docChanged) continue;
        tr.steps.forEach((step) => {
          const map = step.getMap();
          map.forEach((oldStart, oldEnd) => {
            // Find the top-level block that contains this range
            const resolvedPos = newState.doc.resolve(
              Math.min(oldStart, newState.doc.content.size)
            );
            // Walk up to find the top-level node (depth 1)
            if (resolvedPos.depth >= 1) {
              const blockStart = resolvedPos.before(1);
              editCounts.set(
                blockStart,
                (editCounts.get(blockStart) || 0) + 1
              );
              changed = true;
            }
          });
        });
      }

      // No need to return a transaction -- decorations are re-computed
      // via the decorations prop on every state update
      return null;
    },
  });
}
