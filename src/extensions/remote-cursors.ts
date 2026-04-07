import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";

export interface RemoteCursorsOptions {
  provider: WebsocketProvider | null;
  currentUser: string;
}

const remoteCursorsPluginKey = new PluginKey("remoteCursors");

export const RemoteCursors = Extension.create<RemoteCursorsOptions>({
  name: "remoteCursors",

  addOptions() {
    return {
      provider: null,
      currentUser: "Anonymous",
    };
  },

  addProseMirrorPlugins() {
    const provider = this.options.provider;
    const currentUser = this.options.currentUser;

    if (!provider) return [];

    const ydoc = provider.doc;
    const yxml = ydoc.getXmlFragment("default");

    // Plugin that broadcasts the local cursor position via awareness
    const cursorSyncPlugin = new Plugin({
      key: new PluginKey("remoteCursorSync"),
      view() {
        return {
          update(view) {
            const { state } = view;
            const { selection } = state;
            const anchor = selection.anchor;
            const head = selection.head;

            // Convert ProseMirror positions to Yjs relative positions
            // ProseMirror positions are 1-indexed from the doc root, Yjs is 0-indexed from the fragment
            try {
              const relAnchor = Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, anchor - 1));
              const relHead = Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, head - 1));

              provider.awareness.setLocalStateField("cursor", {
                anchor: Y.encodeRelativePosition(relAnchor),
                head: Y.encodeRelativePosition(relHead),
              });
            } catch {
              // Ignore errors from invalid positions during initial sync
            }
          },
        };
      },
    });

    // Plugin that renders remote cursors as decorations
    const cursorRenderPlugin = new Plugin({
      key: remoteCursorsPluginKey,
      state: {
        init() {
          return DecorationSet.empty;
        },
        apply(tr, decorationSet) {
          // Map existing decorations through document changes
          decorationSet = decorationSet.map(tr.mapping, tr.doc);

          // Check for our meta flag to rebuild decorations
          const meta = tr.getMeta(remoteCursorsPluginKey);
          if (meta === "update") {
            return buildDecorations(tr.doc);
          }
          return decorationSet;
        },
      },
      props: {
        decorations(state) {
          return remoteCursorsPluginKey.getState(state);
        },
      },
      view(editorView) {
        const onChange = () => {
          // Trigger a decoration rebuild by dispatching a meta transaction
          const tr = editorView.state.tr.setMeta(remoteCursorsPluginKey, "update");
          editorView.dispatch(tr);
        };

        provider.awareness.on("change", onChange);

        // Also rebuild on initial sync
        setTimeout(onChange, 100);

        return {
          destroy() {
            provider.awareness.off("change", onChange);
          },
        };
      },
    });

    function buildDecorations(doc: import("@tiptap/pm/model").Node): DecorationSet {
      const decorations: Decoration[] = [];
      const states = provider!.awareness.getStates();

      states.forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return; // Skip self

        const user = state.user;
        const cursor = state.cursor;
        if (!user?.name || !cursor?.head) return;

        try {
          const headRelPos = Y.decodeRelativePosition(cursor.head);
          const headAbs = Y.createAbsolutePositionFromRelativePosition(headRelPos, ydoc);

          if (!headAbs) return;

          // Convert Yjs index to ProseMirror position (add 1 for doc root offset)
          const pmPos = Math.min(headAbs.index + 1, doc.content.size);

          const color = user.color || "#6366f1";
          const name = user.name;

          // Caret decoration (widget)
          const caretWidget = Decoration.widget(pmPos, () => {
            const caret = document.createElement("span");
            caret.className = "remote-cursor-caret";
            caret.style.borderColor = color;
            caret.setAttribute("data-user", name);

            // Name label
            const label = document.createElement("span");
            label.className = "remote-cursor-label";
            label.style.backgroundColor = color;
            label.textContent = name;
            caret.appendChild(label);

            return caret;
          }, { side: 1, key: `cursor-${clientId}` });

          decorations.push(caretWidget);

          // Selection highlight (if anchor differs from head)
          if (cursor.anchor) {
            try {
              const anchorRelPos = Y.decodeRelativePosition(cursor.anchor);
              const anchorAbs = Y.createAbsolutePositionFromRelativePosition(anchorRelPos, ydoc);
              if (anchorAbs) {
                const anchorPm = Math.min(anchorAbs.index + 1, doc.content.size);
                if (anchorPm !== pmPos) {
                  const from = Math.min(anchorPm, pmPos);
                  const to = Math.max(anchorPm, pmPos);
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: "remote-cursor-selection",
                      style: `background-color: ${color}30;`,
                    })
                  );
                }
              }
            } catch {
              // Ignore anchor resolution errors
            }
          }
        } catch {
          // Ignore errors from invalid cursor positions
        }
      });

      return DecorationSet.create(doc, decorations);
    }

    return [cursorSyncPlugin, cursorRenderPlugin];
  },
});
