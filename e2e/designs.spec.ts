import { expect, test } from '@playwright/test';
import { signInAsNewUser } from './support/sign-in.ts';

test('a signed-in user can create a design from the intake form', async ({ page }) => {
  await signInAsNewUser(page);

  await expect(page.getByText('No designs yet')).toBeVisible();
  await page.getByRole('link', { name: 'New design', exact: true }).click();
  await expect(page).toHaveURL(/\/designs\/new$/);

  // The radio itself is visually hidden inside its label (an accessible pattern),
  // so a real browser clicks the visible label.
  await page.getByText('Media streaming', { exact: true }).click();
  await page.getByLabel('Core features').fill('playback');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByLabel('Core features').fill('playlists');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByLabel('Daily active users').fill('500000');
  await page.getByRole('button', { name: 'Create design' }).click();

  // Lands on the canvas for the new design, showing what was saved.
  await expect(page).toHaveURL(/\/designs\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Media streaming').first()).toBeVisible();
  await expect(page.getByText('v1')).toBeVisible();
  // The diagram renders the generated design, and clicking a box explains it.
  // (The test server runs with USE_FAKE_AI=true, so the design is deterministic.)
  await expect(page.getByText('API service')).toBeVisible();
  await page.getByText('API service').click();
  const panel = page.getByRole('complementary', { name: 'Component details' });
  await expect(panel.getByRole('heading', { name: 'API service' })).toBeVisible();
  await expect(panel.getByText(/simplest thing that meets these requirements/)).toBeVisible();
  await expect(panel.getByText('Microservices')).toBeVisible();

  // And it appears in the list, which is reloaded from the API.
  await page.getByRole('link', { name: 'My designs' }).click();
  await expect(page.getByRole('heading', { name: 'Media streaming' })).toBeVisible();
});

test('the intake form refuses to submit without features', async ({ page }) => {
  await signInAsNewUser(page);

  await page.goto('/designs/new');
  await page.getByRole('button', { name: 'Create design' }).click();

  await expect(page.getByText('Add at least one feature.')).toBeVisible();
  await expect(page).toHaveURL(/\/designs\/new$/);
});

test('the app chrome stays put: only the content area scrolls', async ({ page }) => {
  await signInAsNewUser(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/designs/new');

  // The document itself must not scroll: the top bar is fixed chrome and only
  // the form scrolls. (A visually hidden radio escaping its label used to make
  // the whole page scroll, showing empty background below the layout.)
  const pageScrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(pageScrolls).toBe(false);

  // And the form really is scrollable to its end.
  await page.getByRole('button', { name: 'Create design' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Create design' })).toBeInViewport();
});

test("another user's design is not reachable by URL", async ({ page, browser }) => {
  // First user creates a design and we note its address.
  await signInAsNewUser(page);
  await page.goto('/designs/new');
  await page.getByLabel('Core features').fill('dashboards');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Create design' }).click();
  await expect(page).toHaveURL(/\/designs\/[0-9a-f-]{36}$/);
  const designUrl = page.url();

  // A second user, in a separate browser session, cannot open it.
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signInAsNewUser(otherPage);
  await otherPage.goto(designUrl);

  await expect(otherPage.getByRole('alert')).toContainText('Design not found');
  await expect(otherPage.getByText('API service')).toBeHidden();
  await otherContext.close();
});
