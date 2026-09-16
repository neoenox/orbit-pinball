// Deterministic per-frame cost benchmark: Playwright's fake clock drives the real game's
// rAF loop, so both variants process the identical frame sequence (same trajectories and
// draw calls, since Physics is deterministic); wall time measures CPU cost per frame,
// independent of headless frame pacing. Includes Node-to-browser protocol overhead, which
// is identical for both variants and cancels out in the comparison.
// Usage: node bench-frames.mjs <baseline|current>
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const variant = process.argv[2];
const root = variant === 'baseline' ? 'bench/baseline-app' : '.';
const port = variant === 'baseline' ? 5199 : 5198;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const url = `http://127.0.0.1:${port}/`;
const BATCHES = 60;          // 60 batches x 10 frames = 600 frames (~10 simulated seconds)
const BATCH_MS = 1000 / 6;   // 10 frames of 16.67ms per runFor call

const vite = spawn(process.execPath, [join(scriptDir, '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.clock.install();
  await page.goto(url);
  await page.locator('#overlay-start').click();
  await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space');
  await page.clock.runFor(1200);
  for (let i = 0; i < 10; i++) await page.clock.runFor(BATCH_MS); // warmup
  const start = process.hrtime.bigint();
  for (let i = 0; i < BATCHES; i++) await page.clock.runFor(BATCH_MS);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(JSON.stringify({ variant, totalMs: +elapsedMs.toFixed(0), msPerFrame: +(elapsedMs / (BATCHES * 10)).toFixed(3) }));
  await browser.close();
} finally {
  vite.kill();
}
