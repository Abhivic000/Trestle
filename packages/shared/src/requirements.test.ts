import { describe, expect, it } from 'vitest';
import { projectNameFromRequirements, requirementsSchema } from './requirements';

const valid = {
  projectType: 'streaming' as const,
  features: ['playback'],
  dailyActiveUsers: 1000,
  trafficShape: 'read_heavy' as const,
  latencySensitivity: 'high' as const,
  consistency: 'eventual' as const,
  availability: '99.9' as const,
  budget: 'startup' as const,
};

describe('requirements schema', () => {
  it('fills in optional fields with sensible defaults', () => {
    const parsed = requirementsSchema.parse(valid);
    expect(parsed.compliance).toEqual([]);
    expect(parsed.constraints).toBe('');
    expect(parsed.notes).toBe('');
  });

  it('requires at least one feature', () => {
    const result = requirementsSchema.safeParse({ ...valid, features: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Add at least one feature.');
  });

  it('rejects a daily-user count that is zero or negative', () => {
    expect(requirementsSchema.safeParse({ ...valid, dailyActiveUsers: 0 }).success).toBe(false);
  });

  it('requires a description when the project type is "other"', () => {
    const missing = requirementsSchema.safeParse({ ...valid, projectType: 'other' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['projectTypeOther']);

    const provided = requirementsSchema.safeParse({
      ...valid,
      projectType: 'other',
      projectTypeOther: 'Fleet tracking platform',
    });
    expect(provided.success).toBe(true);
  });
});

describe('projectNameFromRequirements', () => {
  it('uses the readable label of the chosen type', () => {
    const requirements = requirementsSchema.parse(valid);
    expect(projectNameFromRequirements(requirements)).toBe('Media streaming');
  });

  it('uses the free-text description for "other"', () => {
    const requirements = requirementsSchema.parse({
      ...valid,
      projectType: 'other',
      projectTypeOther: '  Fleet tracking  ',
    });
    expect(projectNameFromRequirements(requirements)).toBe('Fleet tracking');
  });
});
