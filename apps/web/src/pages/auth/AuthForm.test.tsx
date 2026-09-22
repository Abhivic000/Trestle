import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';

// Renders an auth page inside a fake router + fake auth, so the form can be
// tested without Supabase or a browser.
function renderAuthPage(
  page: 'login' | 'signup',
  auth: Partial<AuthContextValue> = {},
  from?: string,
) {
  const value: AuthContextValue = {
    session: null,
    user: null,
    loading: false,
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: false }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...auth,
  };
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/designs', element: <h1>Designs page</h1> },
      { path: '/designs/:id', element: <h1>Design detail page</h1> },
    ],
    { initialEntries: [{ pathname: `/${page}`, state: from ? { from } : null }] },
  );
  render(
    <AuthContext value={value}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  return { auth: value, user: userEvent.setup() };
}

describe('login form', () => {
  it('shows field errors and does not call Supabase when inputs are invalid', async () => {
    const { auth, user } = renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('signs in and goes to My designs', async () => {
    const { auth, user } = renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(auth.signIn).toHaveBeenCalledWith('ada@example.com', 'correct horse');
    expect(await screen.findByRole('heading', { name: 'Designs page' })).toBeInTheDocument();
  });

  it('returns to the page that required sign-in', async () => {
    const { user } = renderAuthPage('login', {}, '/designs/abc');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Design detail page' })).toBeInTheDocument();
  });

  it('shows the error message when sign-in fails', async () => {
    const { user } = renderAuthPage('login', {
      signIn: vi.fn().mockRejectedValue(new Error('Invalid login credentials')),
    });

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});

describe('sign-up form', () => {
  it('requires passwords of at least 8 characters', async () => {
    const { auth, user } = renderAuthPage('signup');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('tells the user to check their inbox when confirmation is required', async () => {
    const { user } = renderAuthPage('signup', {
      signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: true }),
    });

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'long enough');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox');
  });
});
