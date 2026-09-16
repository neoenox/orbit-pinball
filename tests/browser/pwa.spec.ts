import { test, expect } from '@playwright/test';

test('the manifest is linked, parseable, and every icon resolves', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveCount(1);
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();

  const manifest = await (await page.request.get(new URL(href!, page.url()).href)).json();
  expect(manifest.name).toContain('ORBIT');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toMatch(/orbit-pinball\/$/);
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, page.url()).href);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});

test('the service worker activates and the game boots and plays offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#score')).toBeVisible();

  // Registration in main.ts is production-gated, so register the real sw.js here
  // against the dev server — this exercises the exact worker that ships.
  await page.evaluate(() => navigator.serviceWorker.register('./sw.js', { scope: './' }));
  const active = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  expect(active).toBe(true);

  // One reload under the worker caches the shell for this origin.
  await page.reload();
  await expect(page.locator('#score')).toBeVisible();

  // Offline: the app shell and game modules must come from the cache.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#overlay-start')).toBeVisible();

  // And the game is fully playable offline, not just paintable.
  await page.click('#overlay-start');
  await expect(page.locator('#score')).toBeVisible();
  await expect(page.locator('#overlay')).toBeHidden();
  await context.setOffline(false);
});
