"use client";

export interface Collaborator {
  name: string;
  color: string;
  isAgent?: boolean;
}

interface TopBarProps {
  title: string;
  documentId: string;
  collaborators: Collaborator[];
  onInviteAgent: () => void;
}

export default function TopBar({
  title,
  documentId,
  collaborators,
  onInviteAgent,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 md:px-4">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <span className="font-mono text-sm md:text-lg font-bold text-gray-900 shrink-0">
          MC
        </span>
        <span className="hidden sm:inline text-sm text-gray-500">/</span>
        <span className="hidden sm:inline text-sm font-medium text-gray-700 truncate max-w-[150px] md:max-w-none">
          {title}
        </span>
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 shrink-0">
          Suggesting
        </span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="flex -space-x-2">
          {collaborators.map((collaborator, index) => (
            <div
              key={index}
              className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
              style={{ backgroundColor: collaborator.color }}
              title={collaborator.name}
            >
              {collaborator.isAgent ? (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47"
                  />
                </svg>
              ) : (
                collaborator.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              )}
            </div>
          ))}
        </div>
        <a
          href={`/api/documents/${documentId}/export`}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          Export .md
        </a>
        <button
          onClick={onInviteAgent}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs md:text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Invite Agent
        </button>
      </div>
    </div>
  );
}
