import type { ComponentKind, Design } from './design';
import type { Requirements, TrafficShape } from './requirements';

/*
 * Cost and traffic estimates.
 *
 * Every number here is computed in ordinary code, never by the model. Language
 * models are unreliable at arithmetic and will state a confident monthly price
 * with nothing behind it, which is exactly the kind of claim this product is
 * supposed to be able to justify. The tradeoff is that these are OUR
 * assumptions rather than a vendor quote, so they are order-of-magnitude
 * figures and the UI always shows the assumptions alongside them.
 */

/** Requests a typical active user makes in a day. */
export const ACTIONS_PER_USER_PER_DAY = 30;

/** Busy-hour traffic against the daily average. Most consumer products sit near this. */
export const PEAK_MULTIPLIER = 5;

const SECONDS_PER_DAY = 86_400;

/** How traffic splits between reads and writes, by the shape the user chose. */
const READ_SHARE_BY_TRAFFIC_SHAPE: Record<TrafficShape, number> = {
  read_heavy: 0.9,
  balanced: 0.7,
  write_heavy: 0.5,
};

/** Share of read traffic a CDN serves without troubling the origin. */
const CDN_ABSORPTION = 0.5;
/** Share of origin reads a warm cache answers. */
const CACHE_HIT_RATE = 0.8;
/** Share of writes that also kick off background work. */
const ASYNC_SHARE_OF_WRITES = 0.5;
/** Share of origin reads that are searches rather than direct lookups. */
const SEARCH_SHARE_OF_READS = 0.1;
/** Share of all traffic that reads or writes large objects. */
const OBJECT_TRAFFIC_SHARE = 0.05;

export interface TrafficEstimate {
  actionsPerUserPerDay: number;
  peakMultiplier: number;
  averageRps: number;
  peakRps: number;
}

/**
 * Whole-system traffic from the requirements alone.
 *
 * Shared with the generation prompt so the model reasons about the same
 * numbers the user is later shown.
 */
export function estimateTraffic(requirements: Requirements): TrafficEstimate {
  const averageRps = (requirements.dailyActiveUsers * ACTIONS_PER_USER_PER_DAY) / SECONDS_PER_DAY;
  return {
    actionsPerUserPerDay: ACTIONS_PER_USER_PER_DAY,
    peakMultiplier: PEAK_MULTIPLIER,
    averageRps: round(averageRps),
    peakRps: round(averageRps * PEAK_MULTIPLIER),
  };
}

/** Monthly cost as a range, because a point estimate would be false precision. */
export interface CostBand {
  low: number;
  high: number;
}

/** Size tier a component sits in, from the traffic reaching it. */
type SizeTier = 'small' | 'medium' | 'large';

function sizeTier(peakRps: number): SizeTier {
  if (peakRps < 50) return 'small';
  if (peakRps < 500) return 'medium';
  return 'large';
}

/*
 * Provider-neutral monthly bands, in US dollars, for a managed service of each
 * kind at each size. Deliberately not tied to a named vendor's SKU: prices
 * change constantly and the useful lesson is the shape of the cost, not who is
 * cheapest this quarter. `null` means "we will not guess".
 */
const COST_BANDS: Record<ComponentKind, Record<SizeTier, CostBand> | null> = {
  client: null,
  external: null,
  cdn: {
    small: { low: 0, high: 20 },
    medium: { low: 20, high: 100 },
    large: { low: 100, high: 500 },
  },
  gateway: {
    small: { low: 0, high: 20 },
    medium: { low: 20, high: 80 },
    large: { low: 80, high: 300 },
  },
  service: {
    small: { low: 10, high: 30 },
    medium: { low: 40, high: 150 },
    large: { low: 200, high: 800 },
  },
  worker: {
    small: { low: 10, high: 30 },
    medium: { low: 40, high: 150 },
    large: { low: 150, high: 600 },
  },
  cache: {
    small: { low: 10, high: 25 },
    medium: { low: 40, high: 150 },
    large: { low: 200, high: 600 },
  },
  queue: {
    small: { low: 0, high: 20 },
    medium: { low: 30, high: 100 },
    large: { low: 150, high: 500 },
  },
  database: {
    small: { low: 25, high: 60 },
    medium: { low: 100, high: 400 },
    large: { low: 500, high: 2000 },
  },
  storage: {
    small: { low: 5, high: 25 },
    medium: { low: 25, high: 120 },
    large: { low: 120, high: 600 },
  },
  search: {
    small: { low: 20, high: 60 },
    medium: { low: 80, high: 300 },
    large: { low: 300, high: 1200 },
  },
};

/**
 * Roughly how much traffic one instance of each kind takes before you have to
 * change the design rather than just pay for a bigger one, in requests/second.
 *
 * These are order-of-magnitude figures, and the ratios between them matter far
 * more than the absolute values. Stateless kinds sit high because you scale
 * them by running more copies; a relational primary sits low because going
 * past it means sharding or a migration. `null` means the kind cannot be the
 * thing that limits you: a client runs on the user's own device, and a CDN or
 * third-party service is someone else's capacity problem.
 *
 * The busiest component is NOT automatically the bottleneck. In a read-heavy
 * design a cache takes far more traffic than the database behind it while
 * using a much smaller fraction of what it can handle, which is the entire
 * point of putting it there.
 */
const SOFT_CEILING_RPS: Record<ComponentKind, number | null> = {
  client: null,
  external: null,
  cdn: null,
  gateway: 50_000,
  service: 20_000,
  worker: 20_000,
  queue: 50_000,
  cache: 50_000,
  storage: 20_000,
  search: 3_000,
  database: 5_000,
};

export interface ComponentCapacity {
  componentId: string;
  averageRps: number;
  peakRps: number;
  monthlyCost: CostBand | null;
  /** Shown when there is no sensible estimate, e.g. a third-party service. */
  note?: string;
}

export interface Bottleneck {
  componentId: string;
  /** Traffic this component would take at ten times today's users. */
  peakRpsAtTenTimes: number;
  /** Roughly where one of these stops coping, for comparison. */
  softCeilingRps: number;
  /** Fraction of that ceiling ten times today's traffic would use (1 = at it). */
  utilisationAtTenTimes: number;
}

export interface CapacityEstimate {
  traffic: TrafficEstimate;
  readShare: number;
  byComponentId: Record<string, ComponentCapacity>;
  totalMonthlyCost: CostBand;
  /** The component most likely to give way first as the product grows. */
  bottleneck: Bottleneck | null;
}

/**
 * Traffic and cost for every component in a design.
 *
 * Pure, so the browser recomputes it instantly as the design is edited and no
 * estimate is ever stored or goes stale.
 */
export function estimateCapacity(design: Design, requirements: Requirements): CapacityEstimate {
  const traffic = estimateTraffic(requirements);
  const readShare = READ_SHARE_BY_TRAFFIC_SHAPE[requirements.trafficShape];
  const shares = componentTrafficShares(design, readShare);

  const byComponentId: Record<string, ComponentCapacity> = {};
  let totalLow = 0;
  let totalHigh = 0;

  for (const component of design.components) {
    const share = shares.get(component.id) ?? 0;
    const peakRps = round(traffic.peakRps * share);
    const bands = COST_BANDS[component.kind];
    const monthlyCost = bands ? bands[sizeTier(peakRps)] : null;

    if (monthlyCost) {
      totalLow += monthlyCost.low;
      totalHigh += monthlyCost.high;
    }

    byComponentId[component.id] = {
      componentId: component.id,
      averageRps: round(traffic.averageRps * share),
      peakRps,
      monthlyCost,
      note: monthlyCost
        ? undefined
        : component.kind === 'client'
          ? 'Runs on the user’s device, so it costs you nothing to serve.'
          : 'A third-party service: the cost depends on the provider and plan you pick.',
    };
  }

  return {
    traffic,
    readShare,
    byComponentId,
    totalMonthlyCost: { low: totalLow, high: totalHigh },
    bottleneck: findBottleneck(design, shares, traffic.peakRps),
  };
}

/**
 * What fraction of total traffic reaches each component.
 *
 * The model follows a request through the system: a CDN takes some reads
 * before the origin sees them, a cache absorbs most of what is left, and only
 * the misses plus every write reach the database. Components of the same kind
 * share their slice, since the load balances across them.
 */
function componentTrafficShares(design: Design, readShare: number): Map<string, number> {
  const writeShare = 1 - readShare;
  const has = (kind: ComponentKind) =>
    design.components.some((component) => component.kind === kind);

  const cdnTraffic = has('cdn') ? readShare * CDN_ABSORPTION : 0;
  const originReads = readShare - cdnTraffic;
  const databaseReads = has('cache') ? originReads * (1 - CACHE_HIT_RATE) : originReads;

  const shareByKind: Record<ComponentKind, number> = {
    client: 1,
    cdn: cdnTraffic,
    gateway: originReads + writeShare,
    service: originReads + writeShare,
    cache: originReads,
    database: databaseReads + writeShare,
    queue: writeShare * ASYNC_SHARE_OF_WRITES,
    worker: writeShare * ASYNC_SHARE_OF_WRITES,
    search: originReads * SEARCH_SHARE_OF_READS,
    storage: OBJECT_TRAFFIC_SHARE,
    external: writeShare * 0.1,
  };

  const countByKind = new Map<ComponentKind, number>();
  for (const component of design.components) {
    countByKind.set(component.kind, (countByKind.get(component.kind) ?? 0) + 1);
  }

  const shares = new Map<string, number>();
  for (const component of design.components) {
    const count = countByKind.get(component.kind) ?? 1;
    shares.set(component.id, shareByKind[component.kind] / count);
  }
  return shares;
}

/**
 * The component that limits growth: the one using the largest fraction of what
 * it can handle, not simply the one taking the most requests.
 *
 * Ten times the users is the horizon, because it is concrete, roughly one
 * growth stage away, and far enough out that the answer is not just noise.
 */
function findBottleneck(
  design: Design,
  shares: Map<string, number>,
  peakRps: number,
): Bottleneck | null {
  let worst: Bottleneck | null = null;

  for (const component of design.components) {
    const ceiling = SOFT_CEILING_RPS[component.kind];
    if (ceiling === null) continue;

    const share = shares.get(component.id) ?? 0;
    const peakRpsAtTenTimes = peakRps * share * 10;
    const utilisationAtTenTimes = peakRpsAtTenTimes / ceiling;
    if (utilisationAtTenTimes <= 0) continue;

    if (!worst || utilisationAtTenTimes > worst.utilisationAtTenTimes) {
      worst = {
        componentId: component.id,
        peakRpsAtTenTimes: round(peakRpsAtTenTimes),
        softCeilingRps: ceiling,
        utilisationAtTenTimes,
      };
    }
  }

  return worst;
}

/** Keeps small rates readable (0.4 req/s) without printing noise for large ones. */
function round(value: number): number {
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/** "$25–60" or "$0" — one place so the canvas and the panel agree. */
export function formatCostBand(band: CostBand): string {
  if (band.low === band.high) return `$${String(band.low)}`;
  return `$${String(band.low)}–${String(band.high)}`;
}
