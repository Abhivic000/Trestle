import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewDesignPage } from './NewDesignPage';

// The page's only server dependency is useCreateProject; replace it with a fake
// so the form can be tested without a backend.
const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('@/lib/queries', () => ({
  useCreateProject: () => ({ mutateAsync, isPending: false, isError: false, error: null }),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/designs/new', element: <NewDesignPage /> },
      { path: '/designs/:id', element: <h1>Canvas page</h1> },
      { path: '/designs', element: <h1>My designs</h1> },
    ],
    { initialEntries: ['/designs/new'] },
  );
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

describe('requirement intake form', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: 'project-1' });
    localStorage.clear();
  });

  it('refuses to submit without at least one feature', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'Create design' }));

    expect(await screen.findByText('Add at least one feature.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('asks what "other" means before submitting', async () => {
    const user = renderPage();

    await user.click(screen.getByLabelText('Other'));
    await user.type(screen.getByLabelText('Core features'), 'tracking');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Create design' }));

    expect(await screen.findByText('Describe the project type.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits the filled-in requirements and opens the new design', async () => {
    const user = renderPage();

    await user.click(screen.getByLabelText('Media streaming'));
    await user.type(screen.getByLabelText('Core features'), 'playback');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.clear(screen.getByLabelText('Daily active users'));
    await user.type(screen.getByLabelText('Daily active users'), '500000');
    await user.click(screen.getByRole('button', { name: 'Create design' }));

    expect(await screen.findByRole('heading', { name: 'Canvas page' })).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      projectType: 'streaming',
      features: ['playback'],
      dailyActiveUsers: 500000,
      compliance: [],
    });
  });

  it('keeps a typed feature that was never explicitly added', async () => {
    const user = renderPage();

    // Typed but "Add" never clicked: submitting must not silently drop it.
    await user.type(screen.getByLabelText('Core features'), 'offline downloads');
    await user.click(screen.getByRole('button', { name: 'Create design' }));

    expect(await screen.findByRole('heading', { name: 'Canvas page' })).toBeInTheDocument();
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ features: ['offline downloads'] });
  });

  it('keeps a draft so a refresh does not lose the form', async () => {
    const user = renderPage();

    await user.type(screen.getByLabelText('Core features'), 'offline downloads');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const draft: unknown = JSON.parse(localStorage.getItem('trestle:intake-draft') ?? 'null');
    expect(draft).toMatchObject({ features: ['offline downloads'] });
  });

  it('removes a feature again', async () => {
    const user = renderPage();

    await user.type(screen.getByLabelText('Core features'), 'playlists');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('playlists')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove playlists' }));
    expect(screen.queryByText('playlists')).not.toBeInTheDocument();
  });
});
