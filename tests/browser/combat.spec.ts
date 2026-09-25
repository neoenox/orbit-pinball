import { test, expect } from '@playwright/test';
import type { CombatStage, Enemy } from '../../src/combat.ts';

test('First Contact uses the restored portrait pinball board with a readable enemy wave', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.locator('#stage-start').click();
  await expect(page.locator('#combat-hud')).toBeVisible();
  await expect(page.locator('#combat-wave')).toHaveText('WAVE 1 / 4');
  await expect(page.locator('#combat-hp-text')).toHaveText('100 / 100');
  await expect(page.locator('#start')).toBeHidden();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/combat-mode/);
  const table = await page.locator('#table').boundingBox();
  expect(table!.width).toBeGreaterThan(350);
  expect(table!.width / table!.height).toBeLessThan(0.75);
  await expect(page.locator('#nova-state')).toContainText('AUTO CATCH');
  await page.waitForTimeout(350);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/first-contact.png', fullPage: true });
});

test('the combat stage remains readable on a short phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#stage-start').click();
  await expect(page.locator('#combat-hud')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const controls = await page.locator('.touch-controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThan(844);
  await expect(page.locator('#combat-wave')).toBeVisible();
});

test('clearing a wave presents three skills and applies the selected upgrade', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.evaluate(async () => {
    const { CombatStage } = await import('/src/combat.ts');
    const step = CombatStage.prototype.step;
    CombatStage.prototype.step = function (this: CombatStage, dt, balls) {
      step.call(this, dt, balls);
      if (this.status === 'playing' && this.wave === 1) {
        const hit = (this as unknown as { hit: (enemy: Enemy, damage: number) => void }).hit;
        for (const enemy of [...this.enemies]) hit.call(this, enemy, enemy.hp);
      }
    };
  });
  await page.locator('#stage-start').click();
  await expect(page.locator('#skill-choice')).toBeVisible();
  await expect(page.locator('.skill-card')).toHaveCount(3);
  await page.locator('.skill-card[data-skill="POWER"]').click();
  await expect(page.locator('#skill-choice')).toBeHidden();
  await expect(page.locator('#combat-wave')).toHaveText('WAVE 2 / 4');
  await expect(page.locator('#combat-skills')).toContainText('POWER Lv1');
});
