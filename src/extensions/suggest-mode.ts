import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import * as Y from "yjs";
import { ySyncPluginKey } from "y-prosemirror";
import { addSuggestion } from "@/lib/suggestion-store";
import type { Suggestion } from "@/types";

export interface SuggestModePluginState {
  enabled: boolean;
}

export const suggestModePluginKey = new PluginKey<SuggestModePluginState>(
  "suggestMode",
);

export interface SuggestModeOptions {
  initialEnabled: boolean;
  authorName: string;
  authorType: "human" | "agent";
  documentId: string;
  ydoc: Y.Doc | null;
}

const SUGGESTION_WRAP_META = "suggestionWrap";
const AI_SUGGESTION_META = "aiSuggestion";

function randomSuggestionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sug-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const SuggestModeExtension = Extension.create<SuggestModeOptions>({
  name: "suggestMode",

  addOptions() {
    return {
      initialEnabled: false,
      authorName: "anonymous",
      authorType: "human",
      documentId: "",
      ydoc: null,
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<SuggestModePluginState>({
        key: suggestModePluginKey,
        state: {
          init: () => ({ enabled: opts.initialEnabled }),
          apply: (tr, value) => {
            const meta = tr.getMeta(suggestModePluginKey) as
              | { enabled?: boolean }
              | undefined;
            if (meta && typeof meta.enabled === "boolean") {
              return { enabled: meta.enabled };
            }
            return value;
          },
        },
        appendTransaction(transactions, oldState, newState) {
          const pluginState = suggestModePluginKey.getState(newState);
          if (!pluginState?.enabled) return null;
          if (transactions.length !== 1) return null;
          const tr = transactions[0];
          if (!tr.docChanged) return null;
          if (tr.getMeta(SUGGESTION_WRAP_META)) return null;
          if (tr.getMeta(AI_SUGGESTION_META)) return null;
          if (tr.getMeta(ySyncPluginKey)) return null;
          if (tr.getMeta(suggestModePluginKey)) return null;

          if (tr.steps.length !== 1) return null;
          const step = tr.steps[0];
          if (!(step instanceof ReplaceStep)) return null;

          const stepFrom = (step as unknown as { from: number }).from;
          const stepTo = (step as unknown as { to: number }).to;
          const stepSlice = (step as unknown as { slice: { size: number } }).slice;
          const insertedSize = stepSlice.size;
          const deletedSize = stepTo - stepFrom;

          if (insertedSize === 0 && deletedSize === 0) return null;

          const markType = newState.schema.marks.suggestionMark;
          if (!markType) return null;

          const suggestionId = randomSuggestionId();
          const followup = newState.tr;
          followup.setMeta(SUGGESTION_WRAP_META, true);
          followup.setMeta("addToHistory", false);

          const originalText =
            deletedSize > 0 ? oldState.doc.textBetween(stepFrom, stepTo, " ") : "";
          const suggestedText =
            insertedSize > 0
              ? newState.doc.textBetween(stepFrom, stepFrom + insertedSize, " ")
              : "";

          let markEnd = stepFrom + insertedSize;

          if (deletedSize > 0) {
            const deletedSlice = oldState.doc.slice(stepFrom, stepTo);
            try {
              followup.insert(stepFrom, deletedSlice.content);
            } catch {
              return null;
            }
            followup.addMark(
              stepFrom,
              stepFrom + deletedSize,
              markType.create({ suggestionId, type: "delete" }),
            );
            markEnd = stepFrom + deletedSize + insertedSize;
          }

          if (insertedSize > 0) {
            const addFrom = deletedSize > 0 ? stepFrom + deletedSize : stepFrom;
            followup.addMark(
              addFrom,
              markEnd,
              markType.create({ suggestionId, type: "add" }),
            );
          }

          if (opts.ydoc) {
            try {
              const yxml = opts.ydoc.getXmlFragment("default");
              const startRel = Y.encodeRelativePosition(
                Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, stepFrom - 1)),
              );
              const endRel = Y.encodeRelativePosition(
                Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, markEnd - 1)),
              );
              const suggestion: Suggestion = {
                id: suggestionId,
                documentId: opts.documentId,
                authorName: opts.authorName,
                authorType: opts.authorType,
                originalText,
                suggestedText,
                rationale: "",
                status: "pending",
                startRelPos: startRel,
                endRelPos: endRel,
                contentHash: "",
                createdAt: new Date().toISOString(),
                resolvedAt: null,
              };
              addSuggestion(opts.ydoc, suggestion);
            } catch (err) {
              console.warn("SuggestMode: failed to persist suggestion to Yjs", err);
            }
          }

          return followup;
        },
      }),
    ];
  },
});

export function setSuggestModeEnabled(
  editor: { view: { state: unknown; dispatch: (tr: unknown) => void } },
  enabled: boolean,
): void {
  // Using a relaxed type to avoid importing full Tiptap editor type here.
  const view = editor.view as unknown as {
    state: { tr: { setMeta: (k: unknown, v: unknown) => unknown } };
    dispatch: (tr: unknown) => void;
  };
  const tr = view.state.tr.setMeta(suggestModePluginKey, { enabled });
  view.dispatch(tr);
}
