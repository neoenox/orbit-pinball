import { test, expect } from '@playwright/test';

test('physical targets open ramps, laps score, pause freezes the course, and expiry closes it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.clock.install({ time: new Date('2026-09-13T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-13T00:00:01Z'));
  await page.locator('#overlay-start').click();
  await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space');

  const placeBall = async (x: number, y: number, vy: number) => {
    // Reproducible shot setup; use real collision, gate, scoring and rendering code.
    await page.evaluate(async ({ x, y, vy }) => {
      const { Physics } = await import('/src/physics.ts');
      const original = Physics.prototype.step;
      Physics.prototype.step = function (...args: [number, boolean, boolean]) {
        Physics.prototype.step = original;
        this.inLane = false; this.ball.x = x; this.ball.y = y; this.ball.vx = 0; this.ball.vy = vy;
        return original.apply(this, args);
      };
    }, { x, y, vy });
    await page.clock.runFor(30);
  };
  for (const [index, x] of [174, 228, 282].entries()) {
    await placeBall(x, 423, -200);
    if (index < 2) await expect(page.locator('#orbit-state')).toHaveText(`SHIELD ${index + 1}/3`);
  }
  await expect(page.locator('#orbit-state')).toHaveAttribute('data-mode', 'open');
  await expect(page.locator('#score')).toHaveText('000300');
  await page.screenshot({ path: 'test-results/orbit-open.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'test-results/orbit-open-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const [index, x] of [82, 373].entries()) {
    await placeBall(x, 376, -650);
    await expect(page.locator('#status')).toHaveText('ORBIT RUN');
    await page.clock.runFor(750);
    if (index === 0) {
      await page.screenshot({ path: 'test-results/orbit-running.png', fullPage: true });
      await page.keyboard.press('p');
      const frozen = await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL());
      await page.clock.runFor(5000);
      expect(await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL())).toBe(frozen);
      await page.keyboard.press('p');
    }
    for (let i = 0; i < 40 && await page.locator('#status').textContent() === 'ORBIT RUN'; i++) await page.clock.runFor(50);
    await expect(page.locator('#status')).toHaveText('IN ORBIT');
    await expect(page.locator('#score')).toHaveText(index === 0 ? '000800' : '001800');
    await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  }

  // Keep the live ball away from obstacles while observing the real 15-second timer.
  await page.evaluate(async () => {
    const { Physics } = await import('/src/physics.ts');
    const original = Physics.prototype.step;
    Physics.prototype.step = function (...args: [number, boolean, boolean]) {
      this.ball.x = 228; this.ball.y = 450; this.ball.vx = 0; this.ball.vy = 0;
      const result = original.apply(this, args);
      if (this.orbit.openRemaining === 0) Physics.prototype.step = original;
      return result;
    };
  });
  await page.clock.runFor(15000);
  await expect(page.locator('#orbit-state')).toHaveText('SHIELD 0/3');
  await expect(page.locator('#orbit-state')).toHaveAttribute('data-mode', 'locked');
  await page.locator('#start').click();
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('#orbit-state')).toHaveText('SHIELD 0/3');
  expect(errors).toEqual([]);
});
