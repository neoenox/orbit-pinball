# Benchmarks

Deterministic performance harnesses for tracking the physics/render hot paths
across changes. All numbers are machine-dependent — compare only runs from the
same machine, and re-run both sides in the same session.

```sh
npm run bench           # current tree: physics steps/s + per-frame ms (JSON lines)
npm run bench:compare   # same, plus a table against a baseline git ref
```

`bench:compare` materializes the baseline snapshot on first use (gitignored at
`bench/baseline-app/`, default ref `37957b1`, the pre-optimization base). Pass a
different ref (`npm run bench:compare -- <ref>`) or `--refresh` to rebuild it.

## What is measured

- **`bench-physics.mjs`** — pure-Node physics at a deterministic gameplay load:
  launches, alternating flipper windows, rails/bumpers/drains for 8 s of wall
  time after JIT warmup, best of 3 runs. Reports `stepsPerSec` and the drains
  count (a sanity check that the workload stayed realistic).
- **`bench-frames.mjs`** — the real game in headless Edge with Playwright's fake
  clock driving the rAF loop, so both variants process the *identical* 600-frame
  sequence (same trajectories and draw calls, since Physics is deterministic);
  wall time measures CPU cost per frame independent of headless frame pacing.

The free-running fps harness (`bench-render.mjs`) is kept for ad-hoc use but is
deliberately not wired into `npm run bench`: headless frame pacing proved too
noisy for regression tracking (40–120 fps swings on identical code).

## Regression practice

Before/after a change expected to touch `src/physics.ts`, `src/orbit.ts`, or
frame-time-sensitive rendering:

1. `npm run bench` on the current tree and note the numbers.
2. Make the change; `npm run bench` again.
3. For a formal comparison, `npm run bench:compare -- <ref-of-before>`.

Treat anything under ~10% as suspect and re-run: physics is deterministic but
steps/s swings with background machine load; frame ms wobbles more. Comparisons
are only meaningful between runs taken close together in time.
