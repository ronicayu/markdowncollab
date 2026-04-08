"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";

interface EditorMinimapProps {
  editor: Editor | null;
}

export default function EditorMinimap({ editor }: EditorMinimapProps) {
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState("");
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(20);
  const minimapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Load preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("minimap:enabled");
      if (stored === "true") setEnabled(true);
    } catch {}
  }, []);

  // Toggle handler
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("minimap:enabled", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Update content from editor
  useEffect(() => {
    if (!editor || !enabled) return;

    const updateContent = () => {
      const text = editor.getText();
      setContent(text);
    };

    editor.on("update", updateContent);
    updateContent();
    return () => {
      editor.off("update", updateContent);
    };
  }, [editor, enabled]);

  // Track scroll position of the editor container
  useEffect(() => {
    if (!editor || !enabled) return;

    const scrollContainer = document.querySelector(".flex-1.overflow-auto") as HTMLElement;
    if (!scrollContainer) return;

    const updateViewport = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight <= 0) return;

      const minimapEl = minimapRef.current;
      if (!minimapEl) return;

      const minimapHeight = minimapEl.clientHeight;
      const contentEl = contentRef.current;
      const contentHeight = contentEl ? contentEl.scrollHeight : minimapHeight;

      // Map scroll position to minimap coordinates
      const ratio = contentHeight > 0 ? minimapHeight / Math.max(contentHeight, minimapHeight) : 1;
      const vpTop = (scrollTop / scrollHeight) * contentHeight * ratio;
      const vpH = (clientHeight / scrollHeight) * contentHeight * ratio;

      setViewportTop(Math.max(0, vpTop));
      setViewportHeight(Math.max(10, vpH));
    };

    scrollContainer.addEventListener("scroll", updateViewport, { passive: true });
    const observer = new ResizeObserver(updateViewport);
    observer.observe(scrollContainer);
    updateViewport();

    return () => {
      scrollContainer.removeEventListener("scroll", updateViewport);
      observer.disconnect();
    };
  }, [editor, enabled, content]);

  // Handle click/drag on minimap to scroll
  const handleMinimapInteraction = useCallback(
    (clientY: number) => {
      const minimapEl = minimapRef.current;
      const scrollContainer = document.querySelector(".flex-1.overflow-auto") as HTMLElement;
      if (!minimapEl || !scrollContainer) return;

      const rect = minimapEl.getBoundingClientRect();
      const clickY = clientY - rect.top;
      const ratio = clickY / rect.height;

      const { scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = scrollHeight - clientHeight;
      scrollContainer.scrollTo({
        top: ratio * maxScroll,
        behavior: "smooth",
      });
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      handleMinimapInteraction(e.clientY);

      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
          handleMinimapInteraction(e.clientY);
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleMinimapInteraction]
  );

  if (!enabled) {
    return (
      <button
        onClick={toggle}
        className="fixed right-2 top-1/2 -translate-y-1/2 z-30 p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors opacity-0 hover:opacity-100"
        title="Show minimap"
        style={{ writingMode: "vertical-rl" }}
      >
        <span className="text-[9px] tracking-wider">MINIMAP</span>
      </button>
    );
  }

  return (
    <div
      ref={minimapRef}
      className="fixed right-0 top-24 bottom-8 w-24 z-30 cursor-pointer select-none"
      style={{ backgroundColor: "rgba(245, 240, 232, 0.9)" }}
      onMouseDown={handleMouseDown}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="absolute top-0 left-0 z-10 p-0.5 text-gray-400 hover:text-gray-600 text-xs"
        title="Hide minimap"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content rendered as tiny text */}
      <div
        ref={contentRef}
        className="w-full h-full overflow-hidden px-1 pt-4"
        style={{
          fontSize: "1.5px",
          lineHeight: "2px",
          fontFamily: "monospace",
          color: "#6b7280",
          wordBreak: "break-all",
          whiteSpace: "pre-wrap",
          pointerEvents: "none",
        }}
      >
        {content}
      </div>

      {/* Viewport indicator */}
      <div
        className="absolute left-0 right-0 border border-[#B8692A]/30 bg-[#B8692A]/10 rounded-sm pointer-events-none"
        style={{
          top: `${viewportTop}px`,
          height: `${viewportHeight}px`,
        }}
      />
    </div>
  );
}
