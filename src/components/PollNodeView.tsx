"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState, useCallback } from "react";
import type { NodeViewProps } from "@tiptap/react";

interface PollVotes {
  votes: Record<string, string[]>; // optionIndex -> voter names
}

export default function PollNodeView({ node, editor }: NodeViewProps) {
  const { pollId, question, options: optionsStr } = node.attrs;
  const options: string[] = JSON.parse(optionsStr || "[]");

  // Get the Yjs doc from the Collaboration extension
  const ydoc = (editor.extensionManager.extensions.find(
    (e) => e.name === "collaboration"
  ) as any)?.options?.document;

  const pollsMap = ydoc?.getMap("polls");

  // Get current user name from awareness
  const awareness = (editor.extensionManager.extensions.find(
    (e) => e.name === "remoteCursors"
  ) as any)?.options?.provider?.awareness;
  const userName: string =
    awareness?.getLocalState()?.user?.name || "Anonymous";

  const [votes, setVotes] = useState<PollVotes>({ votes: {} });

  const syncVotes = useCallback(() => {
    if (!pollsMap) return;
    const data = pollsMap.get(pollId) as PollVotes | undefined;
    if (data) {
      setVotes(structuredClone(data));
    }
  }, [pollsMap, pollId]);

  useEffect(() => {
    if (!pollsMap) return;
    syncVotes();
    const handler = () => syncVotes();
    pollsMap.observe(handler);
    return () => pollsMap.unobserve(handler);
  }, [pollsMap, syncVotes]);

  const totalVotes = Object.values(votes.votes).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  // Check if current user already voted
  const userVotedIndex = Object.entries(votes.votes).find(([, voters]) =>
    voters.includes(userName)
  )?.[0];

  function handleVote(optIndex: number) {
    if (!pollsMap) return;
    const key = String(optIndex);

    // Clone current votes
    const current = (pollsMap.get(pollId) as PollVotes) || { votes: {} };
    const next: PollVotes = { votes: { ...current.votes } };

    // Remove user from any previous vote
    for (const k of Object.keys(next.votes)) {
      next.votes[k] = next.votes[k].filter((n) => n !== userName);
      if (next.votes[k].length === 0) delete next.votes[k];
    }

    // If clicking the same option again, just remove (toggle off)
    if (userVotedIndex !== key) {
      if (!next.votes[key]) next.votes[key] = [];
      next.votes[key].push(userName);
    }

    pollsMap.set(pollId, next);
  }

  return (
    <NodeViewWrapper className="poll-block" data-type="poll-block">
      <div className="poll-block-inner">
        <div className="poll-block-question">{question}</div>
        <div className="poll-block-options">
          {options.map((opt, i) => {
            const key = String(i);
            const count = votes.votes[key]?.length || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = userVotedIndex === key;

            return (
              <button
                key={i}
                className={`poll-block-option ${isSelected ? "poll-block-option-selected" : ""}`}
                onClick={() => handleVote(i)}
                type="button"
              >
                <div className="poll-block-option-bar" style={{ width: `${pct}%` }} />
                <span className="poll-block-option-label">{opt}</span>
                <span className="poll-block-option-count">
                  {count} ({pct}%)
                </span>
              </button>
            );
          })}
        </div>
        <div className="poll-block-footer">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
