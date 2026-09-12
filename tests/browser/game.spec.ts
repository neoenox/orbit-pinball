import { test, expect } from '@playwright/test';

test('keyboard launch, scoring, pause, three balls, restart and saved best', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.clock.install();
  await page.locator('#overlay-start').click();
  await expect(page.locator('#status')).toHaveText('HOLD SPACE');
  await page.keyboard.down('Space');
  await page.clock.runFor(800);
  expect(parseFloat(await page.locator('#charge').evaluate(e => (e as HTMLElement).style.width))).toBeGreaterThan(50);
  await page.keyboard.up('Space');
  await expect(page.locator('#status')).toHaveText('IN ORBIT');
  await page.clock.runFor(1200);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(100);
  await expect(page.locator('#left')).toHaveClass('pressed');
  await expect(page.locator('#right')).toHaveClass('pressed');
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight');
  await page.keyboard.press('p');
  await expect(page.locator('#status')).toHaveText('TAKE A BREATHER');
  const paused = await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(1000);
  expect(await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL())).toEqual(paused);
  await page.locator('#overlay-start').click();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  // Advance actual browser animation frames until each natural drain, launching the next ball through the keyboard.
  for (let i = 0; i < 90; i++) {
    const status = await page.locator('#status').textContent();
    if (status === 'GAME OVER') break;
    if (status === 'HOLD SPACE') {
      await page.keyboard.down('Space'); await page.clock.runFor(800); await page.keyboard.up('Space');
    }
    await page.clock.runFor(2000);
  }
  await expect(page.locator('#status')).toHaveText('GAME OVER');
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り0球');
  const best = await page.locator('#best').textContent();
  expect(Number(best)).toBeGreaterThan(0);
  await page.locator('#overlay-start').click();
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  await page.reload();
  await expect(page.locator('#best')).toHaveText(best!);
  expect(errors).toEqual([]);
});

test('mobile layout and pointer controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.clock.install();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const controls = await page.locator('.touch-controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThan(844);
  await page.locator('#overlay-start').click();
  const launch = await page.locator('#launch').boundingBox();
  await page.mouse.move(launch!.x + launch!.width / 2, launch!.y + launch!.height / 2);
  await page.mouse.down(); await page.clock.runFor(800); await page.mouse.up();
  await expect(page.locator('#status')).toHaveText('IN ORBIT');
  const left = await page.locator('#left').boundingBox();
  await page.mouse.move(left!.x + left!.width / 2, left!.y + left!.height / 2);
  await page.mouse.down(); await page.clock.runFor(100);
  await expect(page.locator('#left')).toHaveClass('pressed');
  await page.mouse.up();
  await expect(page.locator('#left')).not.toHaveClass('pressed');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
