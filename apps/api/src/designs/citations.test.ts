import { describe, expect, it } from 'vitest';
import { resolveCitations, stripInlineCitations } from './citations';
import { layoutComponents } from '@trestle/shared';

const entries = [
  { id: '11111111-1111-4111-8111-111111111111', slug: 'caching-read-through' },
  { id: '22222222-2222-4222-8222-222222222222', slug: 'cdn-serve-static-and-media' },
];

describe('resolveCitations', () => {
  it('turns supplied slugs into library ids', () => {
    const { components, invented } = resolveCitations(
      [{ sources: ['caching-read-through'] }],
      entries,
    );

    expect(components[0]?.sources).toEqual(['11111111-1111-4111-8111-111111111111']);
    expect(invented).toEqual([]);
  });

  it('drops slugs that were never supplied to the model', () => {
    const { components, invented } = resolveCitations(
      [{ sources: ['caching-read-through', 'kleppmann-chapter-42'] }],
      entries,
    );

    expect(components[0]?.sources).toEqual(['11111111-1111-4111-8111-111111111111']);
    expect(invented).toEqual(['kleppmann-chapter-42']);
  });

  it('leaves a component with no valid citations ungrounded rather than guessing', () => {
    const { components, invented } = resolveCitations([{ sources: ['made-up-source'] }], entries);

    expect(components[0]?.sources).toEqual([]);
    expect(invented).toEqual(['made-up-source']);
  });

  it('removes duplicate citations of the same entry', () => {
    const { components } = resolveCitations(
      [{ sources: ['caching-read-through', 'caching-read-through'] }],
      entries,
    );

    expect(components[0]?.sources).toHaveLength(1);
  });
});

describe('stripInlineCitations', () => {
  it('removes a slug the model pasted into a sentence', () => {
    expect(
      stripInlineCitations(
        'A managed provider frees the team from building auth [auth-use-managed-identity-provider].',
      ),
    ).toBe('A managed provider frees the team from building auth.');
  });

  it('removes several slugs, in brackets or parentheses', () => {
    expect(
      stripInlineCitations(
        'Caching absorbs repeated reads [caching-read-through, replication-read-replicas] and cuts cost (cost-back-of-envelope-capacity).',
      ),
    ).toBe('Caching absorbs repeated reads and cuts cost.');
  });

  it('removes "(source: ...)" style notes', () => {
    expect(stripInlineCitations('Shard by tenant (source: Notion blog).')).toBe('Shard by tenant.');
  });

  it('leaves ordinary prose alone, including hyphenated words', () => {
    const text = 'A read-heavy workload benefits from read replicas (about 45 minutes per month).';
    expect(stripInlineCitations(text)).toBe(text);
  });

  it('keeps text that merely contains brackets with a single word', () => {
    expect(stripInlineCitations('Use a cache (Redis) in front.')).toBe(
      'Use a cache (Redis) in front.',
    );
  });
});

describe('layoutComponents', () => {
  it('places components left to right by role', () => {
    const positions = layoutComponents([
      { id: 'client-app', kind: 'client' },
      { id: 'gateway', kind: 'gateway' },
      { id: 'api', kind: 'service' },
      { id: 'db', kind: 'database' },
    ]);

    expect(positions['client-app']?.x).toBeLessThan(positions.gateway?.x ?? 0);
    expect(positions.gateway?.x).toBeLessThan(positions.api?.x ?? 0);
    expect(positions.api?.x).toBeLessThan(positions.db?.x ?? 0);
  });

  it('stacks components of the same role without overlapping', () => {
    const positions = layoutComponents([
      { id: 'a', kind: 'service' },
      { id: 'b', kind: 'service' },
      { id: 'c', kind: 'service' },
    ]);

    const ys = ['a', 'b', 'c'].map((id) => positions[id]?.y ?? 0);
    expect(new Set(ys).size).toBe(3);
    expect(positions.a?.x).toBe(positions.b?.x);
  });

  it('leaves no empty column for a role the design does not use', () => {
    // client (role column 0) and database (role column 4), nothing between:
    // the two should end up in adjacent columns, not four apart.
    const positions = layoutComponents([
      { id: 'client-app', kind: 'client' },
      { id: 'db', kind: 'database' },
    ]);

    const gap = (positions.db?.x ?? 0) - (positions['client-app']?.x ?? 0);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(400);
  });

  it('gives every component a position', () => {
    const positions = layoutComponents([
      { id: 'x', kind: 'cache' },
      { id: 'y', kind: 'external' },
    ]);

    expect(Object.keys(positions)).toEqual(['x', 'y']);
  });
});
