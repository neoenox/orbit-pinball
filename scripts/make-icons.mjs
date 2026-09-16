// Rasterizes public/favicon.svg into the PWA icon set using headless Edge.
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const sizes = [192, 512];
const maskablePad = 0.72; // maskable icons need ~20% safe-zone padding

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
mkdirSync(join(root, 'public', 'icons'), { recursive: true });
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:#101f2b}</style>
     <div id="art" style="width:${size}px;height:${size}px">${svg.replace('viewBox="0 0 64 64"', `viewBox="0 0 64 64" width="${size}" height="${size}"`)}</div>`,
  );
  const png = await page.locator('#art').screenshot();
  writeFileSync(join(root, 'public', 'icons', `icon-${size}.png`), png);
  console.log(`icon-${size}.png`, png.length, 'bytes');
  if (size === 512) {
    const inner = Math.round(512 * maskablePad);
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:#101f2b}</style>
       <div id="art" style="width:512px;height:512px;display:flex;align-items:center;justify-content:center">
         ${svg.replace('viewBox="0 0 64 64"', `viewBox="0 0 64 64" width="${inner}" height="${inner}"`)}
       </div>`,
    );
    const masked = await page.locator('#art').screenshot();
    writeFileSync(join(root, 'public', 'icons', 'icon-maskable-512.png'), masked);
    console.log('icon-maskable-512.png', masked.length, 'bytes');
  }
}
await browser.close();
