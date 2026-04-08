/**
 * Section Lock Extension
 *
 * A ProseMirror plugin that prevents edits within locked sections.
 * Uses Yjs Y.Map "sectionLocks" to determine which headings are locked.
 * A locked section spans from the heading to the next heading of same/higher level.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type * as Y from "yjs";

export const sectionLockPluginKey = new PluginKey("sectionLock");

interface SectionLock {
  lockedBy: string;
  lockedAt: number;
}

/**
 * Given a doc and a set of locked heading texts, compute the ranges
 * that are locked (from heading pos to next heading of same/higher level).
 */
function computeLockedRanges(
  doc: any,
  lockedHeadings: Map<string, SectionLock>,
  currentUser: string
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];

  // Collect all headings with positions
  const headings: Array<{ text: string; level: number; pos: number; endPos: number }> = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === "heading") {
      headings.push({
        text: node.textContent,
        level: node.attrs.level,
        pos,
        endPos: pos + node.nodeSize,
      });
    }
  });

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const lock = lockedHeadings.get(h.text);
    if (!lock || lock.lockedBy === currentUser) continue;

    // Find range: from this heading to next heading of same or higher level
    let endPos = doc.content.size;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        endPos = headings[j].pos;
        break;
      }
    }

    ranges.push({ from: h.pos, to: endPos });
  }

  return ranges;
}

export const SectionLockExtension = Extension.create({
  name: "sectionLock",

  addOptions() {
    return {
      ydoc: null as Y.Doc | null,
      currentUser: "",
    };
  },

  addProseMirrorPlugins() {
    const { ydoc, currentUser } = this.options;

    return [
      new Plugin({
        key: sectionLockPluginKey,
        filterTransaction(tr) {
          if (!ydoc || !currentUser) return true;
          if (!tr.docChanged) return true;

          const locksMap = ydoc.getMap("sectionLocks");
          const lockedHeadings = new Map<string, SectionLock>();
          locksMap.forEach((value: any, key: any) => {
            lockedHeadings.set(key, value as SectionLock);
          });

          if (lockedHeadings.size === 0) return true;

          const ranges = computeLockedRanges(tr.before, lockedHeadings, currentUser);
          if (ranges.length === 0) return true;

          // Check if any step modifies a locked range
          for (const step of tr.steps) {
            const stepMap = step.getMap();
            let blocked = false;
            stepMap.forEach((oldStart: number, oldEnd: number) => {
              for (const range of ranges) {
                // Overlap check
                if (oldStart < range.to && oldEnd > range.from) {
                  blocked = true;
                }
              }
            });
            if (blocked) return false;
          }

          return true;
        },
      }),
    ];
  },
});
