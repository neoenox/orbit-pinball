// Benchmark orchestrator.
//   npm run bench          → current tree: physics steps/s + frame ms (JSON lines)
//   npm run bench:compare  → also materializes bench/baseline-app (gitignored) at the
//                            given ref (default: the pre-optimization base) and prints
//                            a baseline vs. current comparison table.
// Usage: node bench/run.mjs [--compare] [--refresh] [git-ref]
// Numbers are machine-dependent; compare only runs from the same machine/session.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const compare = args.includes('--compare');
const refresh = args.includes('--refresh');
const ref = args.find(a => !a.startsWith('--')) ?? '37957b1';

const run = (script, variant, nodeArgs = []) => {
  const res = spawnSync(process.execPath, [...nodeArgs, join('bench', script), variant], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) {
    console.error(`${script} (${variant}) failed`);
    process.exit(res.status ?? 1);
  }
  return JSON.parse(res.stdout.trim().split('\n').pop());
};

const physics = variant => run('bench-physics.mjs', variant, ['--experimental-strip-types']);
const frames = variant => run('bench-frames.mjs', variant);

const current = { physics: physics('current'), frames: frames('current') };
console.log('current:', JSON.stringify(current));
if (!compare) process.exit(0);

const sentinel = join(root, 'bench', 'baseline-app', 'src', 'main.ts');
if (refresh || !existsSync(sentinel)) {
  const made = spawnSync(process.execPath, [join('bench', 'make-baseline.mjs'), ref], { cwd: root, stdio: 'inherit' });
  if (made.status !== 0) process.exit(made.status ?? 1);
} else {
  console.log(`reusing existing bench/baseline-app (use --refresh to rebuild at ${ref})`);
}

const baseline = { physics: physics('baseline'), frames: frames('baseline') };
const pct = (b, c) => `${c >= b ? '+' : ''}${(((c - b) / b) * 100).toFixed(1)}%`;
console.log('\nbaseline vs current (same machine, higher steps/s and lower ms/frame are better):');
console.log(`  physics steps/s : ${baseline.physics.stepsPerSec} → ${current.physics.stepsPerSec}  (${pct(baseline.physics.stepsPerSec, current.physics.stepsPerSec)})`);
console.log(`  frame ms        : ${baseline.frames.msPerFrame} → ${current.frames.msPerFrame}  (${pct(baseline.frames.msPerFrame, current.frames.msPerFrame)})`);
