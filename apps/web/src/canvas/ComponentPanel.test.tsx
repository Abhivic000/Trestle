import { designComponentSchema, type DesignComponent } from '@trestle/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ComponentPanel } from './ComponentPanel';

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

describe('ComponentPanel', () => {
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
    render(<ComponentPanel component={component} />);

    await user.click(screen.getByRole('tab', { name: 'Compare' }));
    expect(await screen.findByText(/How comparable systems solve this/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(await screen.findByText(/Cost and scaling estimates/)).toBeInTheDocument();
  });
});
