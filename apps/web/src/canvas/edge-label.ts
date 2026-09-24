/**
 * Longest label that fits in the gap between two columns. React Flow paints
 * nodes ABOVE edge labels, so anything wider is hidden behind a box rather than
 * overlapping it: the text must be shortened, not just clipped with CSS.
 */
const MAX_LABEL_CHARS = 14;

/** Below this zoom the labels would be unreadable anyway, so they are hidden. */
export const LABEL_MIN_ZOOM = 0.55;

export function shortenEdgeLabel(text: string): string {
  if (text.length <= MAX_LABEL_CHARS) return text;

  const cut = text.slice(0, MAX_LABEL_CHARS - 1);
  // Prefer breaking at a word boundary, but never lose more than half the text.
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > MAX_LABEL_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
