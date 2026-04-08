"use client";

import React from "react";

interface SectionLock {
  lockedBy: string;
  lockedAt: number;
}

interface SectionLockIndicatorProps {
  headingText: string;
  lock: SectionLock | null;
  onToggle: (headingText: string) => void;
  currentUser: string;
}

export default function SectionLockIndicator({
  headingText,
  lock,
  onToggle,
  currentUser,
}: SectionLockIndicatorProps) {
  const isLocked = !!lock;
  const isOwnLock = lock?.lockedBy === currentUser;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(headingText);
      }}
      className={`p-0.5 rounded transition-colors shrink-0 ${
        isLocked
          ? isOwnLock
            ? "text-amber-500 hover:text-amber-600"
            : "text-red-400 hover:text-red-500 cursor-not-allowed"
          : "text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"
      }`}
      title={
        isLocked
          ? isOwnLock
            ? `Unlock section "${headingText}"`
            : `Locked by ${lock.lockedBy}`
          : `Lock section "${headingText}"`
      }
      disabled={isLocked && !isOwnLock}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isLocked ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        )}
      </svg>
    </button>
  );
}
