"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface FocusTimerProps {
  documentId: string;
}

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds

function getSessionCount(documentId: string): number {
  if (typeof window === "undefined") return 0;
  const key = `focusSessions:${documentId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return 0;
  try {
    const data = JSON.parse(stored);
    const today = new Date().toDateString();
    if (data.date === today) return data.count;
    return 0;
  } catch {
    return 0;
  }
}

function incrementSessionCount(documentId: string): number {
  const key = `focusSessions:${documentId}`;
  const today = new Date().toDateString();
  let count = 0;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) count = data.count;
    }
  } catch {
    // ignore
  }
  count += 1;
  localStorage.setItem(key, JSON.stringify({ date: today, count }));
  return count;
}

export default function FocusTimer({ documentId }: FocusTimerProps) {
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_DURATION);
  const [sessionCount, setSessionCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load session count on mount
  useEffect(() => {
    setSessionCount(getSessionCount(documentId));
  }, [documentId]);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Timer complete
          setRunning(false);
          setCompleted(true);
          const newCount = incrementSessionCount(documentId);
          setSessionCount(newCount);
          // Browser notification
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Focus session complete!", {
              body: `Great work! You've completed ${newCount} session${newCount === 1 ? "" : "s"} today.`,
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, documentId]);

  const handleStart = useCallback(() => {
    // Request notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setCompleted(false);
    setSecondsLeft(FOCUS_DURATION);
    setRunning(true);
  }, []);

  const handleReset = useCallback(() => {
    setRunning(false);
    setSecondsLeft(FOCUS_DURATION);
    setCompleted(false);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = ((FOCUS_DURATION - secondsLeft) / FOCUS_DURATION) * 100;

  return (
    <div className="flex items-center gap-2">
      {running ? (
        <>
          {/* Progress bar */}
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden" title="Focus timer progress">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums font-medium text-amber-600">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <button
            onClick={handleReset}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Reset timer"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : completed ? (
        <>
          <span className="text-green-600 font-medium">Done!</span>
          <button
            onClick={handleStart}
            className="text-gray-400 hover:text-amber-600 transition-colors"
            title="Start another session"
          >
            Again
          </button>
        </>
      ) : (
        <button
          onClick={handleStart}
          className="text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
          title="Start a 25-minute focus session"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Focus
        </button>
      )}
      {sessionCount > 0 && (
        <span className="text-gray-300" title={`${sessionCount} focus session${sessionCount === 1 ? "" : "s"} today`}>
          {sessionCount} session{sessionCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
