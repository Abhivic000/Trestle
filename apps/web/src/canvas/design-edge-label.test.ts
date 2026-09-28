import { describe, expect, it } from 'vitest';
import { maxLabelCharsForZoom, shortenEdgeLabel } from './edge-label';

describe('shortenEdgeLabel', () => {
  it('leaves a short label alone', () => {
    expect(shortenEdgeLabel('reads/writes', 24)).toBe('reads/writes');
  });

  it('shortens a long label to the room available', () => {
    const shortened = shortenEdgeLabel('Authenticated API requests (posts, feeds)', 18);

    expect(shortened.length).toBeLessThanOrEqual(18);
    expect(shortened.endsWith('…')).toBe(true);
  });

  it('breaks at a word boundary rather than mid-word', () => {
    expect(shortenEdgeLabel('play events from clients', 14)).toBe('play events…');
  });

  it('cuts mid-word rather than losing more than half the text', () => {
    // "Authentication" has no space to break at, so it becomes "Auth…" rather
    // than disappearing entirely.
    expect(shortenEdgeLabel('Authentication', 6)).toBe('Authe…');
  });
});

describe('maxLabelCharsForZoom', () => {
  it('shows more of the label the further in you zoom', () => {
    const zoomedOut = maxLabelCharsForZoom(0.6);
    const middle = maxLabelCharsForZoom(0.9);
    const zoomedIn = maxLabelCharsForZoom(1.5);

    expect(zoomedOut).toBeLessThan(middle);
    expect(middle).toBeLessThan(zoomedIn);
  });
});
