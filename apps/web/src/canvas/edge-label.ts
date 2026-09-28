/**
 * How much of a connection label to show, given the current zoom.
 *
 * Labels are drawn inside the viewport, so they shrink with it. Zoomed out, a
 * long label is both unreadable and wide enough to crowd the diagram, so it is
 * cut back to a few words; zoomed in, there is room for the whole thing. The
 * full text is always available in the hover tooltip.
 */
export function maxLabelCharsForZoom(zoom: number): number {
  if (zoom >= 1.1) return 34;
  if (zoom >= 0.85) return 24;
  if (zoom >= 0.7) return 18;
  return 12;
}

/** Below this zoom the text would be illegible whatever its length. */
export const LABEL_MIN_ZOOM = 0.45;

export function shortenEdgeLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const cut = text.slice(0, maxChars - 1);
  // Prefer breaking at a word boundary, but never lose more than half the text.
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
