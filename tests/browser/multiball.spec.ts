import { test, expect, type Page } from '@playwright/test';

async function place(page: Page, shots: { x: number; y: number; vy: number }[]) {
  await page.evaluate(async shots => {
    const { Physics } = await import('/src/physics.ts');
    const original = Physics.prototype.step;
    Physics.prototype.step = function (...args: [number, boolean, boolean]) {
      Physics.prototype.step = original;
      this.inLane = false;
      shots.forEach((shot, i) => Object.assign(this.balls[i], shot, { vx: 0 }));
      return original.apply(this, args);
    };
  }, shots);
  await page.clock.runFor(30);
}

async function qualify(page: Page) {
  if ((await page.locator('#orbit-state').textContent())?.startsWith('SHIELD')) {
    for (const x of [174, 228, 282]) await place(page, [{ x, y: 423, vy: -200 }]);
  }
  await place(page, [{ x: 82, y: 376, vy: -650 }]);
  await expect(page.locator('#status')).toHaveText('ORBIT RUN');
  for (let i = 0; i < 80 && await page.locator('#status').textContent() === 'ORBIT RUN'; i++) await page.clock.runFor(50);
  await expect(page.locator('#nova-state')).toContainText('中央の穴を狙え');
}

test('two real captures start supernova, parallel jackpots score, pause and life accounting work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.clock.install({ time: new Date('2026-09-15T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-15T00:00:01Z'));
  await page.locator('#overlay-start').click();
  await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space');
  await qualify(page);
  await page.screenshot({ path: 'test-results/black-hole-open.png', fullPage: true });
  await place(page, [{ x: 228, y: 480, vy: -160 }]);
  await expect(page.locator('#status')).toHaveText('BALL LOCKED');
  await expect(page.locator('#nova-state')).toContainText('LOCK 1/2');
  await expect(page.locator('#ball-save')).toBeHidden();
  await page.clock.runFor(1400);
  await expect(page.locator('#status')).toHaveText('IN ORBIT');
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  await qualify(page);
  await place(page, [{ x: 228, y: 480, vy: -160 }]);
  await page.clock.runFor(700);
  await expect(page.locator('#status')).toHaveText('SUPERNOVA · 3 BALLS');
  await expect(page.locator('canvas')).toHaveAttribute('data-ball-count', '3');
  await expect(page.locator('#orbit-state')).toHaveText('✦ JACKPOT +5,000');
  await page.screenshot({ path: 'test-results/supernova.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'test-results/supernova-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press('p');
  const frozen = await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(5000);
  expect(await page.locator('canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL())).toBe(frozen);
  await page.keyboard.press('p');

  // Two balls enter separate courses at once; keep the third clear of obstacles.
  await place(page, [{ x: 82, y: 376, vy: -650 }, { x: 373, y: 376, vy: -650 }, { x: 228, y: 560, vy: 0 }]);
  const before = Number(await page.locator('#score').textContent());
  await page.evaluate(async () => {
    const { Physics } = await import('/src/physics.ts');
    const original = Physics.prototype.step;
    Physics.prototype.step = function (...args: [number, boolean, boolean]) {
      Object.assign(this.balls[2], { x: 228, y: 560, vx: 0, vy: 0 });
      const result = original.apply(this, args);
      if (!this.orbit.active) Physics.prototype.step = original;
      return result;
    };
  });
  await page.clock.runFor(2400);
  expect(Number(await page.locator('#score').textContent()) - before).toBe(10000);
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  await place(page, [{ x: 228, y: 810, vy: 100 }, { x: 190, y: 560, vy: 0 }, { x: 270, y: 560, vy: 0 }]);
  await expect(page.locator('#status')).toHaveText('SUPERNOVA · 2 BALLS');
  await expect(page.locator('canvas')).toHaveAttribute('data-ball-count', '2');
  await place(page, [{ x: 228, y: 810, vy: 100 }, { x: 270, y: 560, vy: 0 }]);
  await expect(page.locator('#status')).toHaveText('IN ORBIT');
  await expect(page.locator('canvas')).toHaveAttribute('data-ball-count', '1');
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  await place(page, [{ x: 228, y: 810, vy: 100 }]);
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り2球');
  await expect(page.locator('#status')).toHaveText('HOLD SPACE');
  await page.locator('#start').click();
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('#nova-state')).toContainText('LOCK 0/2');
  await expect(page.locator('#balls')).toHaveAttribute('aria-label', '残り3球');
  expect(errors).toEqual([]);
});

test('restart cancels a pending locked ball and automatic replacement', async ({ page }) => {
  await page.goto('/');
  await page.clock.install({ time: new Date('2026-09-15T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-15T00:00:01Z'));
  await page.locator('#overlay-start').click();
  await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space');
  await qualify(page);
  await place(page, [{ x: 228, y: 480, vy: -160 }]);
  await page.locator('#start').click();
  await page.clock.runFor(3000);
  await expect(page.locator('#status')).toHaveText('HOLD SPACE');
  await expect(page.locator('#nova-state')).toContainText('LOCK 0/2');
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('canvas')).toHaveAttribute('data-ball-count', '1');
});
