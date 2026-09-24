import { describe, expect, it } from 'vitest';
import { shortenEdgeLabel } from './edge-label';

describe('shortenEdgeLabel', () => {
  it('leaves a short label alone', () => {
    expect(shortenEdgeLabel('reads/writes')).toBe('reads/writes');
  });

  it('shortens a long label so it fits between two columns', () => {
    // React Flow paints nodes above edge labels, so an over-long label would be
    // hidden behind a box rather than overlapping it.
    const shortened = shortenEdgeLabel('Authenticated API requests (posts, feeds)');
    expect(shortened.length).toBeLessThanOrEqual(14);
    expect(shortened.endsWith('…')).toBe(true);
  });

  it('breaks at a word boundary rather than mid-word', () => {
    expect(shortenEdgeLabel('play events from clients')).toBe('play events…');
  });
});
