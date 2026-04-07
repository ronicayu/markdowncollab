/**
 * EmbedBlock — a custom Tiptap Node that renders YouTube and Loom videos
 * as responsive 16:9 iframes. Supports paste detection and a /embed slash command.
 *
 * Usage in Editor.tsx:
 *   import { EmbedBlock, parseEmbedUrl } from "@/extensions/embed-block";
 *   extensions: [ ..., EmbedBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";

export type EmbedProvider = "youtube" | "loom";

interface EmbedUrlResult {
  provider: EmbedProvider;
  embedUrl: string;
}

/**
 * Parse a YouTube or Loom URL and return the embed URL + provider.
 * Returns null if the URL doesn't match any supported pattern.
 */
export function parseEmbedUrl(url: string): EmbedUrlResult | null {
  const trimmed = url.trim();

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytLong = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/
  );
  if (ytLong) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytLong[1]}`,
    };
  }

  const ytShort = trimmed.match(
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/
  );
  if (ytShort) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytShort[1]}`,
    };
  }

  // Loom: loom.com/share/ID
  const loom = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?loom\.com\/share\/([a-zA-Z0-9]+)/
  );
  if (loom) {
    return {
      provider: "loom",
      embedUrl: `https://www.loom.com/embed/${loom[1]}`,
    };
  }

  return null;
}

export const EmbedBlock = Node.create({
  name: "embedBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      provider: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || "";
    const provider = HTMLAttributes.provider || "";
    return [
      "div",
      mergeAttributes(
        { "data-type": "embed-block", "data-provider": provider, class: "embed-block" },
        HTMLAttributes
      ),
      [
        "iframe",
        {
          src,
          frameborder: "0",
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attrs: { src: string; provider: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
