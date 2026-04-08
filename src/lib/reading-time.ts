const WPM = 200;

export function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / WPM));
  return `${minutes} min read`;
}
