import type { ComponentKind } from './design';

/**
 * Positions components left to right by role: clients, then entry points, then
 * services, then the stores they use. Models are poor at coordinates, so the
 * server computes them; the user can rearrange once editing lands (step 6.5).
 */
/** Human name for each column, shown as a lane caption on the canvas. */
export const LANE_LABELS: Record<number, string> = {
  0: 'Clients',
  1: 'Edge',
  2: 'Services',
  3: 'Caching & async',
  4: 'Data & storage',
  5: 'External',
};

/*
 * Left-to-right reading order, the way architecture diagrams are usually drawn:
 * clients → edge (CDN, gateway) → services → caches and queues → data stores,
 * with third-party services in their own lane at the end.
 */
export const COLUMN_BY_KIND: Record<ComponentKind, number> = {
  client: 0,
  cdn: 1,
  gateway: 1,
  service: 2,
  worker: 2,
  cache: 3,
  queue: 3,
  database: 4,
  storage: 4,
  search: 4,
  external: 5,
};

/** Width of a component box. The canvas must render nodes at exactly this width. */
export const NODE_WIDTH = 216;

/*
 * Columns are spaced so a connection label sits in the GAP between two boxes
 * with clear air either side, never on top of one. An earlier 296px column left
 * only 80px between boxes, which is narrower than a label, so labels were drawn
 * over the components and the diagram looked cluttered.
 *
 * A wider graph is the right trade here: "fit to view" refuses to zoom below
 * 0.6, so a big design opens scrollable at a readable size rather than shrunk.
 */
export const COLUMN_WIDTH = 420;
const ROW_HEIGHT = 200;

/** Clear space between one column of boxes and the next. */
export const COLUMN_GAP = COLUMN_WIDTH - NODE_WIDTH;

/**
 * Centre of the gap nearest to `x`.
 *
 * A connection between columns that are not neighbours has its midpoint on top
 * of whatever sits between them, so the canvas pins such labels to the middle
 * of a gap instead, where nothing is drawn.
 */
export function nearestColumnGapCentre(x: number): number {
  const firstGapCentre = NODE_WIDTH + COLUMN_GAP / 2;
  const gap = Math.max(0, Math.round((x - firstGapCentre) / COLUMN_WIDTH));
  return gap * COLUMN_WIDTH + firstGapCentre;
}

export function layoutComponents<T extends { id: string; kind: ComponentKind }>(
  components: T[],
): Record<string, { x: number; y: number }> {
  // Roles that aren't in this design must not leave empty columns behind, or the
  // graph is wider than it needs to be and "fit to view" shrinks the text.
  const usedRoleColumns = [...new Set(components.map((c) => COLUMN_BY_KIND[c.kind]))].sort(
    (a, b) => a - b,
  );
  const columnIndex = new Map(usedRoleColumns.map((role, index) => [role, index]));

  const rowsUsed = new Map<number, number>();
  const positions: Record<string, { x: number; y: number }> = {};

  for (const component of components) {
    const column = columnIndex.get(COLUMN_BY_KIND[component.kind]) ?? 0;
    const row = rowsUsed.get(column) ?? 0;
    rowsUsed.set(column, row + 1);
    positions[component.id] = { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT };
  }

  // Centre each column vertically against the tallest one, so the graph reads evenly.
  const tallest = Math.max(...rowsUsed.values(), 1);
  for (const component of components) {
    const column = columnIndex.get(COLUMN_BY_KIND[component.kind]) ?? 0;
    const count = rowsUsed.get(column) ?? 1;
    const offset = ((tallest - count) * ROW_HEIGHT) / 2;
    const position = positions[component.id];
    if (position) position.y += offset;
  }

  return positions;
}
