export const CURSOR_COLORS = [
  "#f97316", // orange
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#22c55e", // green
  "#ec4899", // pink
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#e11d48", // rose
];

/**
 * Assign a consistent color to a user based on a hash of their name.
 * Same name always gets the same color.
 */
export function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
