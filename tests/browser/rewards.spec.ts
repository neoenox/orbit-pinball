import { test, expect, type Page } from '@playwright/test';

// Exercise the real event handlers while the unlaunched ball remains safely in its lane.
async function event(page: Page, kind: 'hit' | 'save' | 'drain' | 'targets' | 'nova' | 'small', count = 1) {
  await page.evaluate(async ({ kind, count }) => {
    const { Physics } = await import('/src/physics.ts');
    const original = Physics.prototype.step;
    Physics.prototype.step = function (...args: [number, boolean, boolean]) {
      Physics.prototype.step = original;
      if (kind === 'hit') for (let i = 0; i < count; i++) this.onHit(i % 3);
      if (kind === 'save') this.onSave();
      if (kind === 'drain') this.onDrain();
      if (kind === 'targets') for (let i = 0; i < count; i++) this.orbit.hitTarget(i);
      if (kind === 'nova') this.onMultiballStart();
      if (kind === 'small') this.onRail();
      return original.apply(this, args);
    };
  }, { kind, count });
  await page.clock.runFor(80);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  await page.goto('/');
  await page.clock.install({ time: new Date('2026-09-16T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-16T00:00:01Z'));
  await page.locator('#overlay-start').click();
});

test('combo awards, expiry, save/drain resets, multiplier distance and restart', async ({ page }) => {
  await expect(page.locator('#multiplier-progress')).toHaveText('×2まであと10 HIT');
  for (const [count, title, total] of [[3, '3 COMBO', 800], [2, 'RUSH!', 2000], [3, 'FEVER!!', 4800], [4, 'OVERDRIVE!!!', 10400]] as const) {
    // Let each banner expire without letting the 2.2 second chain expire.
    if (count !== 3 || title !== '3 COMBO') await page.clock.runFor(1200);
    await event(page, 'hit', count);
    await expect(page.locator('#reward-title')).toHaveText(title);
    await expect(page.locator('#score')).toHaveText(String(total).padStart(6, '0'));
  }
  await expect(page.locator('#score-gain')).toContainText('+5,600');
  await expect(page.locator('#multiplier-progress')).toHaveText('×3まであと8 HIT');
  await event(page, 'hit');
  await expect(page.locator('#score')).toHaveText('010600');
  await page.clock.runFor(2300);
  await expect(page.locator('#reward')).toBeHidden();
  await expect(page.locator('#chain')).toBeHidden();
  await event(page, 'hit', 3);
  await expect(page.locator('#score')).toHaveText('011700');
  await event(page, 'save');
  await expect(page.locator('#reward')).toBeHidden();
  await event(page, 'hit', 2);
  await expect(page.locator('#score')).toHaveText('012100');
  await event(page, 'drain');
  await event(page, 'hit', 3);
  await expect(page.locator('#score')).toHaveText('013300');
  await page.clock.runFor(1800);
  await event(page, 'hit', 20);
  await expect(page.locator('#multiplier-progress')).toHaveText('×5 MAX!!');
  await page.locator('#start').click(); await page.clock.runFor(80);
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('#reward')).toBeHidden();
  await expect(page.locator('#score-gain')).toBeHidden();
});

test('gate countdown becomes urgent, pauses and clears on expiry', async ({ page }) => {
  await event(page, 'targets', 2);
  await expect(page.locator('#mission-progress')).toHaveText('ONE MORE TARGET');
  await event(page, 'targets', 3);
  await page.clock.runFor(10500);
  await expect(page.locator('#orbit-state')).toHaveClass(/urgent/);
  await expect(page.locator('#orbit-state')).toContainText('OPEN 4.');
  await page.keyboard.press('p');
  const text = await page.locator('#orbit-state').textContent();
  await page.clock.runFor(6000);
  await expect(page.locator('#orbit-state')).toHaveText(text!);
  await page.keyboard.press('p'); await page.clock.runFor(5000);
  await expect(page.locator('#orbit-state')).not.toHaveClass(/urgent/);
  await expect(page.locator('#mission-progress')).toHaveText('GATESまであと3 TARGETS');
});

for (const mode of ['max', 'light', 'reduce'] as const) {
  test(`${mode}: nova priority, flash, score punch and brief banner lifetime`, async ({ page }) => {
    if (mode === 'light') await page.setViewportSize({ width: 390, height: 844 });
    if (mode === 'light') await page.locator('#effects').click();
    if (mode === 'reduce') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#effects').click(); // OS preference still wins over MAX.
    }
    await event(page, 'nova');
    await event(page, 'hit', 3);
    await expect(page.locator('#reward-title')).toHaveText('SUPERNOVA');
    const flash = await page.locator('.playfield').evaluate(el => getComputedStyle(el, '::after').opacity);
    const transform = await page.locator('#score').evaluate(el => getComputedStyle(el).transform);
    if (mode === 'max') {
      expect(Number(flash)).toBeGreaterThan(0);
      expect(transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
    } else {
      expect(Number(flash)).toBe(0);
      expect(transform).toBe('none');
    }
    await page.screenshot({ path: `test-results/rewards-${mode}.png`, fullPage: true });
    if (mode === 'light') {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      const controls = await page.locator('.touch-controls').boundingBox();
      expect(controls!.y + controls!.height).toBeLessThan(844);
      const title = await page.locator('#reward-title').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
      expect(title.content).toBeLessThanOrEqual(title.width);
    }
    await page.clock.runFor(2300);
    await expect(page.locator('#reward')).toBeHidden();
  });
}

test('game over shows the previous best gap and immediate retry', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('orbit-best', '1240'));
  await page.reload(); await page.locator('#overlay-start').click();
  await event(page, 'drain'); await event(page, 'drain'); await event(page, 'drain');
  await expect(page.locator('#overlay-text')).toContainText('BESTまであと1,240点');
  await page.locator('#overlay-start').click(); await page.clock.runFor(80);
  await expect(page.locator('#status')).toHaveText('HOLD SPACE');
  await event(page, 'hit', 5);
  await event(page, 'drain'); await event(page, 'drain'); await event(page, 'drain');
  await expect(page.locator('#overlay-kicker')).toHaveText('PERSONAL BEST!');
});
