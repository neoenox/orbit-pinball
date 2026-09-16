// Headless physics benchmark: deterministic gameplay load, steps counted by wall clock.
// Usage: node --experimental-strip-types bench-physics.mjs <baseline|current>
const variant = process.argv[2];
const { Physics, STEP } = await import(variant === 'baseline' ? './baseline-app/src/physics.ts' : '../src/physics.ts');

const LAUNCH_SEEDS = [0.31, 0.62, 0.85];

function runGame() {
  const p = new Physics();
  const drains = { count: 0 };
  p.onDrain = () => { drains.count++; p.resetBall(); p.launch(LAUNCH_SEEDS[drains.count % LAUNCH_SEEDS.length]); };
  p.resetGame();
  p.launch(LAUNCH_SEEDS[0]);
  // Deterministic flipper pattern: alternating press windows keep the ball
  // alive and exercise rail, bumper, flipper and drain paths continuously.
  let steps = 0;
  const run = (total) => {
    for (let i = 0; i < total; i++) {
      p.step(STEP, (i % 130) < 45, (i % 170) < 50);
      steps++;
    }
  };
  run(240 * 4); // warmup: JIT + allocation steady state
  const start = performance.now();
  while (performance.now() - start < 8000) run(240); // measure in 1-second blocks
  const elapsed = (performance.now() - start) / 1000;
  return { stepsPerSec: steps / elapsed, drains: drains.count };
}

const rounds = [runGame(), runGame(), runGame()];
const best = Math.max(...rounds.map(r => r.stepsPerSec));
console.log(JSON.stringify({ variant, stepsPerSec: Math.round(best), simulatedSecondsPerSecond: (best * STEP).toFixed(2), drains: rounds[0].drains }, null, 0));
