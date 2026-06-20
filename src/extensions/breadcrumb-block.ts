/**
 * BreadcrumbBlock — a custom Tiptap atom node that renders the current
 * document's folder path as clickable navigation links.
 *
 * Usage in Editor.tsx:
 *   import { BreadcrumbBlock } from "@/extensions/breadcrumb-block";
 *   extensions: [ ..., BreadcrumbBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect } from "react";
import React from "react";

interface BreadcrumbSegment {
  id: string;
  name: string;
}

function BreadcrumbNodeView() {
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([]);
  const [docTitle, setDocTitle] = useState("Untitled");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract document ID from URL: /doc/{id}
    const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
    if (!docId) {
      setLoading(false);
      return;
    }

    fetch(`/api/documents/${docId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (doc?.title) setDocTitle(doc.title);
        if (doc?.folderId) {
          fetch(`/api/folders/${doc.folderId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((path: BreadcrumbSegment[]) => {
              if (Array.isArray(path)) setSegments(path);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  return React.createElement(
    NodeViewWrapper,
    { className: "breadcrumb-block", contentEditable: false },
    React.createElement(
      "nav",
      {
        className: "breadcrumb-nav",
        style: {
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 12px",
          backgroundColor: "#f5f0e8",
          borderRadius: "8px",
          fontSize: "13px",
          margin: "8px 0",
          flexWrap: "wrap" as const,
        },
      },
      loading
        ? React.createElement("span", { style: { color: "#9ca3af" } }, "Loading...")
        : [
            React.createElement(
              "a",
              {
                key: "home",
                href: "/",
                style: { color: "#0075de", textDecoration: "none", fontWeight: 500 },
              },
              "Home"
            ),
            ...segments.map((seg) =>
              React.createElement(
                React.Fragment,
                { key: seg.id },
                React.createElement(
                  "span",
                  { style: { color: "#9ca3af", fontSize: "11px" } },
                  "/"
                ),
                React.createElement(
                  "a",
                  {
                    href: `/?folder=${seg.id}`,
                    style: { color: "#0075de", textDecoration: "none" },
                  },
                  seg.name
                )
              )
            ),
            React.createElement(
              "span",
              { key: "sep-doc", style: { color: "#9ca3af", fontSize: "11px" } },
              "/"
            ),
            React.createElement(
              "span",
              { key: "doc", style: { color: "#6b7280", fontWeight: 500 } },
              docTitle
            ),
          ]
    )
  );
}

export const BreadcrumbBlock = Node.create({
  name: "breadcrumbBlock",

  group: "block",

  atom: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="breadcrumb-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "breadcrumb-block",
        class: "breadcrumb-block",
      }),
      "Breadcrumb",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BreadcrumbNodeView);
  },
});
