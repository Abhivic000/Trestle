import { expect, type Page } from '@playwright/test';
import { createUser } from './test-users.ts';

/** Creates a fresh account and signs into the app through the UI. */
export async function signInAsNewUser(page: Page) {
  const { email, password } = await createUser();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/designs$/);

  return { email, password };
}
