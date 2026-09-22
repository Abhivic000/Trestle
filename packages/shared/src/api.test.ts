import { describe, expect, it } from 'vitest';
import { apiErrorSchema, listProjectsResponseSchema, meResponseSchema } from './api';

describe('shared API schemas', () => {
  it('accepts a well-formed error body', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'unauthorized', message: 'Sign in.' } }).success,
    ).toBe(true);
  });

  it('rejects an error body missing its code', () => {
    expect(apiErrorSchema.safeParse({ error: { message: 'Sign in.' } }).success).toBe(false);
  });

  it('allows a user without an email but requires a uuid id', () => {
    const id = '4f0c9a5e-2b7d-4c1e-9a3f-8d6b5e4c3a21';
    expect(meResponseSchema.safeParse({ id, email: null }).success).toBe(true);
    expect(meResponseSchema.safeParse({ id: 'not-a-uuid', email: null }).success).toBe(false);
  });

  it('accepts ISO timestamps with a UTC offset, as Postgres returns them', () => {
    const result = listProjectsResponseSchema.safeParse({
      projects: [
        {
          id: '4f0c9a5e-2b7d-4c1e-9a3f-8d6b5e4c3a21',
          name: 'Music streaming',
          createdAt: '2026-09-22T10:00:00.000Z',
          updatedAt: '2026-09-22T10:00:00.000+00:00',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
