import { expect, test, type Page } from '@playwright/test';
import { createUser, uniqueEmail } from './support/test-users.ts';

// End-to-end: a real browser, the real web app and API, the trestle-test project.

async function fillCredentials(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
}

test('visiting a protected page while signed out redirects to sign in', async ({ page }) => {
  await page.goto('/designs');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a new user can sign up, reach My designs and sign out', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/');
  await page.getByRole('link', { name: 'Start designing', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await fillCredentials(page, email, 'a-long-test-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Signed in: the protected page loads data from the API with the new token.
  await expect(page).toHaveURL(/\/designs$/);
  await expect(page.getByRole('heading', { name: 'My designs' })).toBeVisible();
  await expect(page.getByText('No designs yet')).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.goto('/designs');
  await expect(page).toHaveURL(/\/login$/);
});

test('signing in returns you to the page you originally asked for', async ({ page }) => {
  const { email, password } = await createUser();

  await page.goto('/designs/new');
  await expect(page).toHaveURL(/\/login$/);

  await fillCredentials(page, email, password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/designs\/new$/);
  await expect(page.getByRole('heading', { name: 'Describe your project' })).toBeVisible();
});

test('a wrong password shows an error and stays on sign in', async ({ page }) => {
  const { email } = await createUser();

  await page.goto('/login');
  await fillCredentials(page, email, 'definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
  await expect(page).toHaveURL(/\/login$/);
});

test('signed-in users skip the sign-in page', async ({ page }) => {
  const { email, password } = await createUser();

  await page.goto('/login');
  await fillCredentials(page, email, password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/designs$/);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/designs$/);
});
