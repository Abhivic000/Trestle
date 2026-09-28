import {
  DESIGN_SCHEMA_VERSION,
  designComponentSchema,
  designSchema,
  estimateCapacity,
  requirementsSchema,
  type DesignComponent,
} from '@trestle/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ComponentPanel } from './ComponentPanel';

// The panel's only server dependency is the comparison lookup, which the
// Compare tab makes when it opens. Replace it so the panel can be tested
// without a backend.
const { comparisonsQuery } = vi.hoisted(() => ({
  comparisonsQuery: vi.fn(),
}));
vi.mock('@/lib/queries', () => ({
  useComponentComparisons: () => comparisonsQuery() as unknown,
}));

const loaded = (comparisons: unknown[]) => ({
  data: { componentId: 'cache-redis', comparisons },
  isPending: false,
  isFetching: false,
  error: null,
});

const sampleComparison = {
  id: '6f5b1f3c-9f2a-4f6e-8a1d-2c3b4d5e6f70',
  slug: 'comparison-facebook-memcache-lookaside',
  kind: 'comparison',
  patternType: 'caching',
  title: 'Facebook: running memcached as a look-aside cache at scale',
  summary: 'Facebook put a large fleet of memcached servers in front of its databases.',
  whenToUse: 'Read-heavy workloads where the same rows are fetched constantly.',
  whenNotToUse: 'Write-heavy or strongly consistent workloads.',
  tradeoffs: ['Every cache adds an invalidation problem.'],
  sourceNote: 'Based on: Scaling Memcache at Facebook.',
  sourceUrl: 'https://example.com/memcache',
  similarity: 0.74,
};

const component: DesignComponent = designComponentSchema.parse({
  id: 'cache-redis',
  kind: 'cache',
  label: 'Redis cache',
  technology: 'Redis',
  responsibility: 'Keeps hot playlists and tracks in memory.',
  rationale: 'Playback traffic concentrates on a small share of the catalogue.',
  alternatives: [{ option: 'No cache', whyNot: 'Every read would hit the database.' }],
  tradeoffs: ['Cached data can be briefly out of date.'],
  sources: ['4f0c9a5e-2b7d-4c1e-9a3f-8d6b5e4c3a21'],
  position: { x: 0, y: 0 },
});

// A real estimate over a small design, so the Cost tab is exercised against
// the same calculator the app uses rather than a hand-made stub.
const capacity = estimateCapacity(
  designSchema.parse({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    origin: 'generated',
    summary: 'A design used for panel tests.',
    components: [
      {
        id: 'cache-redis',
        kind: 'cache',
        label: 'Redis cache',
        responsibility: 'Keeps hot playlists and tracks in memory.',
        rationale: 'Playback traffic concentrates on a small share of the catalogue.',
        position: { x: 0, y: 0 },
      },
      {
        id: 'db',
        kind: 'database',
        label: 'Primary database',
        responsibility: 'Stores the catalogue and user data.',
        rationale: 'Relational storage fits the consistency needs.',
        position: { x: 296, y: 0 },
      },
    ],
    connections: [],
    dataModel: [],
  }),
  requirementsSchema.parse({
    projectType: 'streaming',
    features: ['playback'],
    dailyActiveUsers: 500_000,
    trafficShape: 'read_heavy',
    latencySensitivity: 'medium',
    consistency: 'eventual',
    availability: '99.9',
    budget: 'startup',
  }),
);

describe('ComponentPanel', () => {
  beforeEach(() => {
    comparisonsQuery.mockReset();
    comparisonsQuery.mockReturnValue(loaded([]));
  });

  it('prompts the user to pick a component when nothing is selected', () => {
    render(<ComponentPanel component={null} />);
    expect(screen.getByText('Select a component to see its details.')).toBeInTheDocument();
  });

  it('shows the rationale, alternatives and tradeoffs of the selected component', () => {
    render(<ComponentPanel component={component} />);

    expect(screen.getByRole('heading', { name: 'Redis cache' })).toBeInTheDocument();
    expect(screen.getByText(/concentrates on a small share/)).toBeInTheDocument();
    expect(screen.getByText('No cache')).toBeInTheDocument();
    expect(screen.getByText('Cached data can be briefly out of date.')).toBeInTheDocument();
  });

  it('flags a rationale with no sources as ungrounded', () => {
    const ungrounded = { ...component, sources: [] };
    render(<ComponentPanel component={ungrounded} />);

    expect(screen.getByText(/Ungrounded/)).toBeInTheDocument();
  });

  it('does not flag a rationale that cites a source', () => {
    render(<ComponentPanel component={component} />);
    expect(screen.queryByText(/Ungrounded/)).not.toBeInTheDocument();
  });

  it('switches to the Compare and Cost tabs', async () => {
    const user = userEvent.setup();
    render(<ComponentPanel component={component} projectId="p1" />);

    await user.click(screen.getByRole('tab', { name: 'Compare' }));
    expect(await screen.findByText(/No close match in the reference library/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(await screen.findByText(/Estimates appear once this design/)).toBeInTheDocument();
  });

  it('shows traffic, a cost band and the assumptions behind them', async () => {
    const user = userEvent.setup();
    render(<ComponentPanel component={component} projectId="p1" capacity={capacity} />);

    await user.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(await screen.findByText('Running cost')).toBeInTheDocument();
    // The figures are computed, so assert the shape rather than exact numbers.
    expect(screen.getAllByText(/req\/s/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$\d/)).toBeInTheDocument();
    // The assumptions must always travel with the numbers.
    expect(screen.getByText(/30 actions per user per day/)).toBeInTheDocument();
    expect(screen.getByText(/not a quote from any provider/)).toBeInTheDocument();
  });

  it('warns on the component that growth will strain first', async () => {
    const user = userEvent.setup();
    const database = capacity.byComponentId.db;
    expect(capacity.bottleneck?.componentId).toBe('db');
    expect(database).toBeDefined();

    render(
      <ComponentPanel
        component={{ ...component, id: 'db', kind: 'database', label: 'Primary database' }}
        projectId="p1"
        capacity={capacity}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(await screen.findByText('First to feel growth')).toBeInTheDocument();
  });

  it('shows a matched real system, with its tradeoffs and a link to the source', async () => {
    comparisonsQuery.mockReturnValue(loaded([sampleComparison]));
    const user = userEvent.setup();
    render(<ComponentPanel component={component} projectId="p1" />);

    await user.click(screen.getByRole('tab', { name: 'Compare' }));

    expect(await screen.findByText(/running memcached as a look-aside cache/)).toBeInTheDocument();
    expect(screen.getByText('Every cache adds an invalidation problem.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read the original/ })).toHaveAttribute(
      'href',
      'https://example.com/memcache',
    );
  });

  it('explains that an unsaved component cannot be compared yet', async () => {
    comparisonsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      error: new ApiError(404, 'not_found', 'Component not found.'),
    });
    const user = userEvent.setup();
    render(<ComponentPanel component={component} projectId="p1" />);

    await user.click(screen.getByRole('tab', { name: 'Compare' }));

    expect(await screen.findByText(/Save this component first/)).toBeInTheDocument();
  });
});
