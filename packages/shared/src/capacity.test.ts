import { describe, expect, it } from 'vitest';
import { estimateCapacity, estimateTraffic, formatCostBand } from './capacity';
import { DESIGN_SCHEMA_VERSION, designSchema, type Design } from './design';
import { requirementsSchema, type Requirements } from './requirements';

const requirements: Requirements = requirementsSchema.parse({
  projectType: 'social',
  features: ['posting', 'feeds'],
  dailyActiveUsers: 100_000,
  trafficShape: 'read_heavy',
  latencySensitivity: 'medium',
  consistency: 'eventual',
  availability: '99.9',
  budget: 'startup',
});

function designWith(
  components: { id: string; kind: string; label: string }[],
  overrides: Partial<Requirements> = {},
): { design: Design; requirements: Requirements } {
  const design = designSchema.parse({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    origin: 'generated',
    summary: 'A design used for capacity tests.',
    components: components.map((component, index) => ({
      ...component,
      responsibility: 'Does a part of the work for this system.',
      rationale: 'Included so the estimate has something to work with.',
      position: { x: index * 296, y: 0 },
    })),
    connections: [],
    dataModel: [],
  });
  return { design, requirements: { ...requirements, ...overrides } };
}

describe('estimateTraffic', () => {
  it('turns daily users into requests per second', () => {
    // 100,000 users x 30 actions / 86,400 seconds = ~34.7 req/s, x5 at peak.
    // Rates of 100 and above are reported as whole numbers, hence 174.
    const traffic = estimateTraffic(requirements);

    expect(traffic.averageRps).toBe(34.7);
    expect(traffic.peakRps).toBe(174);
  });

  it('scales linearly with the number of users', () => {
    const small = estimateTraffic({ ...requirements, dailyActiveUsers: 10_000 });
    const large = estimateTraffic({ ...requirements, dailyActiveUsers: 100_000 });

    expect(large.averageRps / small.averageRps).toBeCloseTo(10);
  });
});

describe('estimateCapacity', () => {
  it('sends fewer reads to the database when a cache is present', () => {
    const withoutCache = designWith([
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ]);
    const withCache = designWith([
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'cache', kind: 'cache', label: 'Redis cache' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ]);

    const before = estimateCapacity(withoutCache.design, withoutCache.requirements);
    const after = estimateCapacity(withCache.design, withCache.requirements);

    expect(after.byComponentId.db?.peakRps).toBeLessThan(before.byComponentId.db?.peakRps ?? 0);
  });

  it('sends fewer reads to the origin when a CDN is present', () => {
    const withCdn = designWith([
      { id: 'cdn', kind: 'cdn', label: 'CDN' },
      { id: 'api', kind: 'service', label: 'API service' },
    ]);
    const without = designWith([{ id: 'api', kind: 'service', label: 'API service' }]);

    const withCdnEstimate = estimateCapacity(withCdn.design, withCdn.requirements);
    const withoutEstimate = estimateCapacity(without.design, without.requirements);

    expect(withCdnEstimate.byComponentId.api?.peakRps).toBeLessThan(
      withoutEstimate.byComponentId.api?.peakRps ?? 0,
    );
    expect(withCdnEstimate.byComponentId.cdn?.peakRps).toBeGreaterThan(0);
  });

  it('splits a kind of traffic across the components sharing that role', () => {
    const one = designWith([{ id: 'api', kind: 'service', label: 'API service' }]);
    const two = designWith([
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'api2', kind: 'service', label: 'Media service' },
    ]);

    const single = estimateCapacity(one.design, one.requirements);
    const pair = estimateCapacity(two.design, two.requirements);

    expect(pair.byComponentId.api?.peakRps).toBeCloseTo(
      (single.byComponentId.api?.peakRps ?? 0) / 2,
      1,
    );
  });

  it('shifts load towards the database when traffic is write heavy', () => {
    const readHeavy = designWith(
      [
        { id: 'cache', kind: 'cache', label: 'Cache' },
        { id: 'db', kind: 'database', label: 'Primary database' },
      ],
      { trafficShape: 'read_heavy' },
    );
    const writeHeavy = designWith(
      [
        { id: 'cache', kind: 'cache', label: 'Cache' },
        { id: 'db', kind: 'database', label: 'Primary database' },
      ],
      { trafficShape: 'write_heavy' },
    );

    const reads = estimateCapacity(readHeavy.design, readHeavy.requirements);
    const writes = estimateCapacity(writeHeavy.design, writeHeavy.requirements);

    expect(writes.byComponentId.db?.peakRps).toBeGreaterThan(reads.byComponentId.db?.peakRps ?? 0);
    expect(writes.byComponentId.cache?.peakRps).toBeLessThan(
      reads.byComponentId.cache?.peakRps ?? 0,
    );
  });

  it('costs nothing for the client and declines to guess for third parties', () => {
    const { design, requirements: reqs } = designWith([
      { id: 'web', kind: 'client', label: 'Web client' },
      { id: 'idp', kind: 'external', label: 'Managed Identity Provider' },
    ]);

    const estimate = estimateCapacity(design, reqs);

    expect(estimate.byComponentId.web?.monthlyCost).toBeNull();
    expect(estimate.byComponentId.web?.note).toMatch(/device/);
    expect(estimate.byComponentId.idp?.monthlyCost).toBeNull();
    expect(estimate.byComponentId.idp?.note).toMatch(/provider/);
    // Neither is guessed at, so neither inflates the total.
    expect(estimate.totalMonthlyCost).toEqual({ low: 0, high: 0 });
  });

  it('totals the bands of the components it can price', () => {
    const { design, requirements: reqs } = designWith([
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ]);

    const estimate = estimateCapacity(design, reqs);
    const parts = [estimate.byComponentId.api, estimate.byComponentId.db];
    const low = parts.reduce((sum, part) => sum + (part?.monthlyCost?.low ?? 0), 0);

    expect(estimate.totalMonthlyCost.low).toBe(low);
    expect(estimate.totalMonthlyCost.high).toBeGreaterThan(estimate.totalMonthlyCost.low);
  });

  it('gets more expensive as the product grows', () => {
    const components = [
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ];
    const small = designWith(components, { dailyActiveUsers: 1_000 });
    const large = designWith(components, { dailyActiveUsers: 10_000_000 });

    const cheap = estimateCapacity(small.design, small.requirements);
    const dear = estimateCapacity(large.design, large.requirements);

    expect(dear.totalMonthlyCost.high).toBeGreaterThan(cheap.totalMonthlyCost.high);
  });

  it('names the constrained store as the bottleneck, not the busiest component', () => {
    // Read-heavy, so the cache takes far MORE traffic than the database. It is
    // still not the bottleneck, because it is using much less of what it can
    // handle: that distinction is the whole point of the estimate.
    const { design, requirements: reqs } = designWith([
      { id: 'web', kind: 'client', label: 'Web client' },
      { id: 'api', kind: 'service', label: 'API service' },
      { id: 'cache', kind: 'cache', label: 'Redis cache' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ]);

    const estimate = estimateCapacity(design, reqs);

    expect(estimate.byComponentId.cache?.peakRps).toBeGreaterThan(
      estimate.byComponentId.db?.peakRps ?? 0,
    );
    expect(estimate.bottleneck?.componentId).toBe('db');
    // Ten times the users means ten times the traffic through it.
    expect(estimate.bottleneck?.peakRpsAtTenTimes).toBeCloseTo(
      (estimate.byComponentId.db?.peakRps ?? 0) * 10,
      0,
    );
  });

  it('reports how much of its ceiling the bottleneck would be using', () => {
    const components = [
      { id: 'cache', kind: 'cache', label: 'Redis cache' },
      { id: 'db', kind: 'database', label: 'Primary database' },
    ];
    const modest = designWith(components, { dailyActiveUsers: 10_000 });
    const huge = designWith(components, { dailyActiveUsers: 50_000_000 });

    const small = estimateCapacity(modest.design, modest.requirements);
    const large = estimateCapacity(huge.design, huge.requirements);

    // A small product has room to spare; a very large one is well past what a
    // single database copes with, which is the warning worth giving.
    expect(small.bottleneck?.utilisationAtTenTimes).toBeLessThan(1);
    expect(large.bottleneck?.utilisationAtTenTimes).toBeGreaterThan(1);
    expect(large.bottleneck?.softCeilingRps).toBe(5_000);
  });

  it('has no bottleneck to report when nothing in the design can be one', () => {
    // A client runs on the user's own device, so it is never the limit.
    const { design, requirements: reqs } = designWith([
      { id: 'web', kind: 'client', label: 'Web client' },
    ]);
    expect(estimateCapacity(design, reqs).bottleneck).toBeNull();
  });
});

describe('formatCostBand', () => {
  it('shows a range, or a single figure when both ends agree', () => {
    expect(formatCostBand({ low: 25, high: 60 })).toBe('$25–60');
    expect(formatCostBand({ low: 0, high: 0 })).toBe('$0');
  });
});
