"use client";

import { useState, useEffect } from "react";

const STEPS = [
  {
    title: "Welcome to MarkdownCollab",
    description:
      "A collaborative markdown editor built for teams. Write, comment, and share documents in real time with your collaborators.",
    icon: (
      <svg className="h-12 w-12 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "Use / Commands",
    description:
      "Type / anywhere in the editor to open the slash command menu. Quickly insert headings, lists, code blocks, tables, Mermaid diagrams, and more without leaving the keyboard.",
    icon: (
      <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-[var(--code-bg)] border border-[var(--code-border)] text-lg font-mono font-bold text-[var(--accent)]">
        /
      </div>
    ),
  },
  {
    title: "Collaborate in Real Time",
    description:
      "Share documents with teammates using the Share button. See live cursors, leave comments on text selections, and invite an AI agent to suggest improvements.",
    icon: (
      <svg className="h-12 w-12 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem("onboarding-complete");
    if (!done) {
      setOpen(true);
    }
  }, []);

  function handleDone() {
    localStorage.setItem("onboarding-complete", "true");
    setOpen(false);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDone();
    }
  }

  function handlePrevious() {
    if (step > 0) setStep(step - 1);
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className="bg-[var(--dialog-bg)] rounded-2xl shadow-2xl mx-4 max-w-md w-full p-8 text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">{current.icon}</div>

        {/* Title */}
        <h2
          id="welcome-modal-title"
          className="text-xl font-bold text-[var(--text-primary)] mb-2"
        >
          {current.title}
        </h2>

        {/* Description */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
          {current.description}
        </p>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-6" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]/30"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={handleDone}
            className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip onboarding
          </button>
        )}
      </div>
    </div>
  );
}
