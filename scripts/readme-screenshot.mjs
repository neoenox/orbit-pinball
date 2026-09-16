// Captures a mid-game README screenshot of the real game via headless Edge.
// Usage: node .bench/readme-screenshot.mjs [output-path]
// Starts its own Vite dev server on a dedicated port, plays a few real seconds
// (launch + flipper taps so score/trails are live), then crops to .machine-area.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = process.argv[2] ?? 'docs/screenshot.png';
const port = 5197; // dedicated to this script; check for stale listeners first
const scriptDir = dirname(fileURLToPath(import.meta.url));
const url = `http://127.0.0.1:${port}/`;

const vite = spawn(process.execPath, [join(scriptDir, '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: join(scriptDir, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
vite.stdout.on('data', () => {}); vite.stderr.on('data', () => {});
async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try { const res = await fetch(url); if (res.ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('vite did not start');
}

try {
  await waitReady();
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#score'); // main.ts has booted and injected the UI

  // Start a game, launch, then keep the ball alive with gentle flipper taps.
  await page.click('#overlay-start');
  await page.keyboard.press('Space', { delay: 300 }); // hold-and-release = launch
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  for (const key of ['a', 'd', 'a', 'd']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(90);
    await page.keyboard.up(key);
    await page.waitForTimeout(240);
  }
  await page.waitForTimeout(900); // let trails/neon settle for the shot
  const state = await page.evaluate(() => ({
    score: document.querySelector('#score')?.textContent,
    multiplier: document.querySelector('#multiplier')?.textContent,
    balls: document.querySelector('canvas')?.dataset.ballCount,
    overlayHidden: document.querySelector('#overlay')?.classList.contains('hidden'),
  }));
  console.log('game state:', JSON.stringify(state));
  await page.locator('.machine-area').screenshot({ path: out });
  console.log(`saved ${out}`);
  await browser.close();
} finally {
  vite.kill();
}
