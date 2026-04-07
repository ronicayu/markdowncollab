"use client";

import { useEffect, useState, useCallback } from "react";

interface PresentationModeProps {
  content: string; // HTML content from editor
  onExit: () => void;
}

/**
 * Splits HTML content into slides at H1 headings or <hr> (horizontal rules).
 * Each slide is a chunk of HTML rendered in fullscreen.
 */
function splitIntoSlides(html: string): string[] {
  // Split on <h1...>...</h1> or <hr> tags
  // We keep the H1 as part of the new slide
  const parts = html.split(/(?=<h1[\s>])|(?:<hr\s*\/?>)/i);
  const slides = parts
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return slides.length > 0 ? slides : [html];
}

export default function PresentationMode({ content, onExit }: PresentationModeProps) {
  const slides = splitIntoSlides(content);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      setFadeState("out");
      setTimeout(() => {
        setCurrentSlide(index);
        setFadeState("in");
      }, 200);
    },
    [slides.length]
  );

  const goNext = useCallback(() => goTo(currentSlide + 1), [goTo, currentSlide]);
  const goPrev = useCallback(() => goTo(currentSlide - 1), [goTo, currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExit, goNext, goPrev]);

  // Click edge navigation
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) {
      goPrev();
    } else if (x > rect.width * 0.7) {
      goNext();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#111110] flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Exit button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
        className="absolute top-4 right-4 z-10 text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
        aria-label="Exit presentation"
        title="Press Escape to exit"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Slide content */}
      <div
        className={`max-w-4xl w-full mx-auto px-8 md:px-16 py-12 transition-opacity duration-200 ${
          fadeState === "in" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="prose prose-invert prose-lg md:prose-xl max-w-none
            prose-headings:text-white prose-p:text-white/90 prose-li:text-white/90
            prose-a:text-amber-400 prose-strong:text-white prose-code:text-amber-300
            prose-blockquote:border-amber-500 prose-blockquote:text-white/70
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10"
          dangerouslySetInnerHTML={{ __html: slides[currentSlide] }}
        />
      </div>

      {/* Navigation arrows */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={currentSlide === 0}
          className="text-white/30 hover:text-white disabled:opacity-0 transition-all p-2"
          aria-label="Previous slide"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Slide counter */}
        <span className="text-white/40 text-sm font-medium tabular-nums">
          {currentSlide + 1} / {slides.length}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={currentSlide === slides.length - 1}
          className="text-white/30 hover:text-white disabled:opacity-0 transition-all p-2"
          aria-label="Next slide"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
