// Materializes a read-only snapshot of the app at a git ref into bench/baseline-app/
// (gitignored) so the benches can compare the current tree against that revision.
// Usage: node bench/make-baseline.mjs [git-ref]
// The default ref is the pre-optimization base the original perf work was measured against.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] ?? '37957b1';
const dest = join(root, 'bench', 'baseline-app');

if (spawnSync('git', ['cat-file', '-e', `${ref}^{commit}`], { cwd: root }).status !== 0) {
  console.error(`unknown git ref: ${ref}`);
  process.exit(1);
}
// Relative paths only: GNU tar on Windows misreads drive-colon paths as remote
// "host:path" archives, and relative names work on every tar (bsdtar/GNU).
const archive = '.bench-tmp.tar';
const destRel = 'bench/baseline-app';
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
if (spawnSync('git', ['archive', '--format=tar', '--output', archive, ref], { cwd: root, stdio: 'inherit' }).status !== 0) {
  console.error('git archive failed');
  process.exit(1);
}
if (spawnSync('tar', ['-xf', archive, '-C', destRel], { cwd: root, stdio: 'inherit' }).status !== 0) {
  rmSync(archive, { force: true });
  console.error('tar extraction failed (requires tar/bsdtar on PATH)');
  process.exit(1);
}
rmSync(archive, { force: true });
console.log(`baseline ready: bench/baseline-app @ ${ref}`);
