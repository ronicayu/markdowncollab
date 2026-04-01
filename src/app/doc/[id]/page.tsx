"use client";

import { use, useEffect, useState } from "react";
import Editor from "@/components/Editor";
import TopBar, { Collaborator } from "@/components/TopBar";

const ADJECTIVES = [
  "Swift",
  "Bright",
  "Calm",
  "Bold",
  "Keen",
  "Warm",
  "Cool",
  "Wild",
];
const ANIMALS = [
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Hawk",
  "Deer",
  "Lynx",
  "Hare",
];

function generateUserName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

function getUserName(): string {
  if (typeof window === "undefined") return "Anonymous";
  const stored = localStorage.getItem("markdown-collab-username");
  if (stored) return stored;
  const name = generateUserName();
  localStorage.setItem("markdown-collab-username", name);
  return name;
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setUserName(getUserName());
  }, []);

  const collaborators: Collaborator[] = userName
    ? [{ name: userName, color: "#3f51b5" }]
    : [];

  const handleInviteAgent = () => {
    console.log("Invite Agent clicked — will be implemented in Task 7");
  };

  if (!userName) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopBar
        title={id}
        collaborators={collaborators}
        onInviteAgent={handleInviteAgent}
      />
      <Editor documentId={id} userName={userName} />
    </div>
  );
}
