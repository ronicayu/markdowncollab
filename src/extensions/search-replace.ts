import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findTextMatches, type SearchMatch } from "@/lib/search-utils";

export interface SearchReplaceState {
  query: string;
  caseSensitive: boolean;
  matches: SearchMatch[];
  currentIndex: number;
}

export const searchReplacePluginKey = new PluginKey<SearchReplaceState>(
  "searchReplace"
);

const MATCH_CLASS = "search-match";
const CURRENT_MATCH_CLASS = "search-match-current";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchQuery: (query: string) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      toggleCaseSensitive: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

type SearchReplaceMeta =
  | { type: "setQuery"; query: string }
  | { type: "findNext" }
  | { type: "findPrevious" }
  | { type: "toggleCase" }
  | { type: "clear" };

function recomputeMatches(
  doc: import("@tiptap/pm/model").Node,
  query: string,
  caseSensitive: boolean
): SearchMatch[] {
  return findTextMatches(doc, query, caseSensitive);
}

export const SearchReplace = Extension.create({
  name: "searchReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchReplaceState>({
        key: searchReplacePluginKey,
        state: {
          init(): SearchReplaceState {
            return {
              query: "",
              caseSensitive: false,
              matches: [],
              currentIndex: 0,
            };
          },
          apply(tr, prev): SearchReplaceState {
            const meta = tr.getMeta(searchReplacePluginKey) as
              | SearchReplaceMeta
              | undefined;

            if (!meta) {
              // Doc changed without a search command — recompute matches
              if (tr.docChanged && prev.query) {
                const matches = recomputeMatches(
                  tr.doc,
                  prev.query,
                  prev.caseSensitive
                );
                const currentIndex =
                  matches.length === 0
                    ? 0
                    : Math.min(prev.currentIndex, matches.length - 1);
                return { ...prev, matches, currentIndex };
              }
              return prev;
            }

            switch (meta.type) {
              case "setQuery": {
                const matches = recomputeMatches(
                  tr.doc,
                  meta.query,
                  prev.caseSensitive
                );
                return {
                  ...prev,
                  query: meta.query,
                  matches,
                  currentIndex: 0,
                };
              }
              case "findNext": {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex:
                    (prev.currentIndex + 1) % prev.matches.length,
                };
              }
              case "findPrevious": {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex:
                    (prev.currentIndex - 1 + prev.matches.length) %
                    prev.matches.length,
                };
              }
              case "toggleCase": {
                const caseSensitive = !prev.caseSensitive;
                const matches = recomputeMatches(
                  tr.doc,
                  prev.query,
                  caseSensitive
                );
                return {
                  ...prev,
                  caseSensitive,
                  matches,
                  currentIndex: 0,
                };
              }
              case "clear": {
                return {
                  query: "",
                  caseSensitive: false,
                  matches: [],
                  currentIndex: 0,
                };
              }
            }
          },
        },
        props: {
          decorations(state) {
            const pluginState = searchReplacePluginKey.getState(state);
            if (!pluginState || pluginState.matches.length === 0) {
              return DecorationSet.empty;
            }

            const decorations = pluginState.matches.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class:
                  i === pluginState.currentIndex
                    ? CURRENT_MATCH_CLASS
                    : MATCH_CLASS,
              })
            );

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchQuery:
        (query: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "setQuery",
              query,
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      findNext:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "findNext",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      findPrevious:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "findPrevious",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      replaceCurrent:
        (replacement: string) =>
        ({ editor, tr, dispatch }) => {
          const state = searchReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          const match = state.matches[state.currentIndex];
          if (dispatch) {
            tr.insertText(replacement, match.from, match.to);
            dispatch(tr);
          }
          return true;
        },

      replaceAll:
        (replacement: string) =>
        ({ editor, tr, dispatch }) => {
          const state = searchReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          if (dispatch) {
            // Replace in reverse order to preserve positions
            const sorted = [...state.matches].sort(
              (a, b) => b.from - a.from
            );
            for (const match of sorted) {
              tr.insertText(replacement, match.from, match.to);
            }
            dispatch(tr);
          }
          return true;
        },

      toggleCaseSensitive:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "toggleCase",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "clear",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        // Handled by React component — this just prevents browser default
        return true;
      },
      "Mod-h": () => {
        // Handled by React component — this just prevents browser default
        return true;
      },
    };
  },
});
