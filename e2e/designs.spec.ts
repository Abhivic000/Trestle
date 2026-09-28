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
  // The name is an editable field now that the canvas supports editing.
  await expect(panel.getByLabel('Component name')).toHaveValue('API service');
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

test('editing the canvas saves a new version, and an old one can be restored', async ({ page }) => {
  await signInAsNewUser(page);
  await page.goto('/designs/new');
  await page.getByLabel('Core features').fill('playback');
  await page.getByRole('button', { name: 'Create design' }).click();
  await page.waitForURL(/\/designs\/[0-9a-f-]{36}$/);
  // Exact match: "v1" also appears inside the model name "fake-model-v1".
  await expect(page.getByText('v1', { exact: true })).toBeVisible();

  // Add a component by hand.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Name').fill('Recommendation Service');
  await page.getByRole('button', { name: 'Add component' }).click();

  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(page.getByText('Recommendation Service').first()).toBeVisible();

  // Discarding puts it back.
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText('Unsaved changes')).toBeHidden();
  await expect(page.getByText('Recommendation Service')).toBeHidden();

  // Add it again and save it as v2.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Name').fill('Recommendation Service');
  await page.getByRole('button', { name: 'Add component' }).click();
  await page.getByRole('button', { name: 'Save version' }).click();

  await expect(page.getByText('v2', { exact: true })).toBeVisible();
  await expect(page.getByText('Unsaved changes')).toBeHidden();

  // The edit survives a reload, so it really was saved.
  await page.reload();
  await expect(page.getByText('Recommendation Service').first()).toBeVisible();

  // History lists both versions; restoring v1 removes the added component.
  await page.getByRole('button', { name: 'Version history' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('v1', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Added 1 component')).toBeVisible();
  await drawer.getByRole('button', { name: 'Restore' }).click();

  await expect(page.getByText('v3', { exact: true })).toBeVisible();
  await expect(page.getByText('Recommendation Service')).toBeHidden();
});

test('a change request is previewed and applied only when accepted', async ({ page }) => {
  await signInAsNewUser(page);
  await page.goto('/designs/new');
  await page.getByLabel('Core features').fill('playback');
  await page.getByRole('button', { name: 'Create design' }).click();
  await page.waitForURL(/\/designs\/[0-9a-f-]{36}$/);

  // Ask for a change.
  await page.getByLabel('Describe a change').fill('add live chat between users');
  await page.getByRole('button', { name: 'Suggest' }).click();

  // It is shown as a proposal, not applied: still v1.
  const review = page.getByRole('region', { name: 'Proposed changes' });
  await expect(review).toBeVisible();
  await expect(review.getByText('Add Live Chat Service')).toBeVisible();
  await expect(page.getByText('v1', { exact: true })).toBeVisible();
  // The proposed component is drawn on the canvas as a pending change.
  await expect(page.getByText('proposed').first()).toBeVisible();

  // Rejecting leaves the design untouched.
  await review.getByRole('button', { name: 'Reject all' }).click();
  await expect(review).toBeHidden();
  await expect(page.getByText('v1', { exact: true })).toBeVisible();
  await expect(page.getByText('Live Chat Service')).toBeHidden();

  // Ask again, then accept only some of it.
  await page.getByLabel('Describe a change').fill('add live chat between users');
  await page.getByRole('button', { name: 'Suggest' }).click();
  await expect(review).toBeVisible();

  const checkboxes = review.getByRole('checkbox');
  const total = await checkboxes.count();
  await checkboxes.last().uncheck();
  await review
    .getByRole('button', { name: `Accept ${String(total - 1)} of ${String(total)}` })
    .click();

  // Now it is saved as v2 and the accepted component is on the canvas.
  await expect(page.getByText('v2', { exact: true })).toBeVisible();
  await expect(review).toBeHidden();
  await expect(page.getByText('Live Chat Service').first()).toBeVisible();

  // The version history records what was asked for.
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByRole('dialog').getByText(/add live chat between users/)).toBeVisible();
});

test('the Compare tab shows a real system, or admits there is no close match', async ({ page }) => {
  await signInAsNewUser(page);
  await page.goto('/designs/new');
  await page.getByLabel('Core features').fill('uploads');
  await page.getByRole('button', { name: 'Create design' }).click();
  await page.waitForURL(/\/designs\/[0-9a-f-]{36}$/);

  const panel = page.getByRole('complementary', { name: 'Component details' });

  // A storage component has a matching case study in the reference library.
  await page.getByText('Object Storage for Media Files').click();
  await panel.getByRole('tab', { name: 'Compare' }).click();
  await expect(panel.getByRole('heading', { name: /Dropbox/ })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Read the original/ }).first()).toBeVisible();

  // A plain client has nothing worth comparing, and the panel says so rather
  // than offering the nearest unrelated entry.
  await page.getByText('Web & Mobile Clients').click();
  await expect(panel.getByText(/No close match in the reference library/)).toBeVisible();
});

test('the Cost tab estimates traffic and spend, with its assumptions', async ({ page }) => {
  await signInAsNewUser(page);
  await page.goto('/designs/new');
  await page.getByLabel('Core features').fill('playback');
  await page.getByRole('button', { name: 'Create design' }).click();
  await page.waitForURL(/\/designs\/[0-9a-f-]{36}$/);

  // The whole-design total sits on the canvas.
  await expect(page.getByText(/\/ month estimated/)).toBeVisible();

  const panel = page.getByRole('complementary', { name: 'Component details' });
  await page.getByText('Primary database').click();
  await panel.getByRole('tab', { name: 'Cost' }).click();

  await expect(panel.getByText('Running cost')).toBeVisible();
  await expect(panel.getByText(/req\/s/).first()).toBeVisible();
  // The assumptions must be on screen with the numbers, never implied.
  await expect(panel.getByText(/actions per user per day/)).toBeVisible();
  await expect(panel.getByText(/not a quote from any provider/)).toBeVisible();

  // A client costs nothing to serve, and we say so rather than inventing a price.
  await page.getByText('Web & Mobile Clients').click();
  await expect(panel.getByText(/costs you nothing to serve/)).toBeVisible();
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
