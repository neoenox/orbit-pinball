import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Physics, STEP } from '../src/physics.ts';

function qualify(p: Physics) {
  p.launched = true; p.inLane = false;
  [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
  p.ball = { x: 82, y: 376, vx: 0, vy: -700, radius: 8 };
  for (let i = 0; i < 1000 && !p.blackHoleReady; i++) p.step(STEP, false, false);
  assert.equal(p.blackHoleReady, true);
}
function capture(p: Physics) {
  p.ball = { x: 228, y: 480, vx: 0, vy: -160, radius: 8 };
  p.step(STEP, false, false);
  assert.ok(p.captureRemaining > 0);
}
function startNova(p = new Physics()) {
  qualify(p); capture(p);
  for (let i = 0; i < 400; i++) p.step(STEP, false, false);
  qualify(p); capture(p);
  for (let i = 0; i < 300 && !p.multiball; i++) p.step(STEP, false, false);
  assert.equal(p.multiball, true); return p;
}

test('a normal lap arms the hole and a lock auto-launches a replacement without losing a life', () => {
  const p = new Physics(); let drains = 0, locks = 0;
  p.onDrain = () => drains++; p.onLock = () => locks++;
  assert.equal(p.blackHoleReady, false);
  qualify(p); capture(p);
  assert.equal(p.lockedBalls, 1); assert.equal(p.blackHoleReady, false);
  assert.equal(p.launch(1), false, 'manual input must not interrupt the capture');
  for (let i = 0; i < 400; i++) p.step(STEP, false, false);
  assert.equal(p.launched, true); assert.equal(p.balls.length, 1);
  assert.equal(p.saveRemaining, 0, 'a replacement cannot renew the life save');
  assert.equal(drains, 0); assert.equal(locks, 1);
});

test('two locks release three independently moving balls and keep the gates open', () => {
  const p = startNova();
  assert.equal(p.balls.length, 3); assert.equal(p.lockedBalls, 0); assert.equal(p.orbit.isOpen, true);
  const before = p.balls.map(b => ({ ...b }));
  p.step(STEP, true, false);
  p.balls.forEach((b, i) => assert.ok(Math.hypot(b.x - before[i].x, b.y - before[i].y) > 0));
  p.orbit.tick(30); assert.equal(p.orbit.isOpen, true);
});

test('losing bonus balls costs no lives; the final ball drains exactly once', () => {
  const p = startNova(); let drains = 0, endings = 0;
  p.onDrain = () => drains++; p.onMultiballEnd = () => endings++;
  p.balls[0].y = 790; p.balls[0].vy = 100;
  p.step(STEP, false, false);
  assert.equal(p.balls.length, 2); assert.equal(p.multiball, true); assert.equal(drains, 0);
  p.balls[0].y = 790; p.balls[0].vy = 100;
  p.step(STEP, false, false);
  assert.equal(p.balls.length, 1); assert.equal(p.multiball, false); assert.equal(endings, 1); assert.equal(drains, 0);
  p.balls[0].y = 790; p.balls[0].vy = 100;
  for (let i = 0; i < 10; i++) p.step(STEP, false, false);
  assert.equal(drains, 1);
});

test('simultaneous drains consume one life, not three', () => {
  const p = startNova(); let drains = 0;
  p.onDrain = () => { drains++; p.resetBall(); };
  for (const b of p.balls) { b.y = 790; b.vy = 100; }
  p.step(STEP, false, false);
  assert.equal(drains, 1); assert.equal(p.multiball, false); assert.equal(p.balls.length, 1);
  assert.equal(p.launched, false);
});

test('each ball can run its own ramp and score its own jackpot', () => {
  const p = startNova(); const awards: number[] = [];
  p.orbit.onComplete = award => awards.push(award.points);
  p.balls[0].x = 82; p.balls[0].y = 376; p.balls[0].vx = 0; p.balls[0].vy = -700;
  p.balls[1].x = 373; p.balls[1].y = 376; p.balls[1].vx = 0; p.balls[1].vy = -700;
  const runners = p.balls.slice(0, 2);
  p.step(STEP, false, false);
  runners.forEach(b => assert.equal(p.orbit.hasFlight(b), true));
  for (let i = 0; i < 1000 && awards.length < 2; i++) p.step(STEP, false, false);
  assert.deepEqual(awards, [5000, 10000]);
  assert.equal(p.blackHoleReady, false, 'jackpots must not qualify another lock');
});

test('stored locks survive a life change, but restarting clears every pending state', () => {
  const p = new Physics(); qualify(p); capture(p);
  p.resetBall(); assert.equal(p.lockedBalls, 1); assert.equal(p.captureRemaining, 0);
  assert.equal(p.blackHoleReady, false);
  p.resetGame(); assert.equal(p.lockedBalls, 0); assert.equal(p.balls.length, 1);
  startNova(p); p.resetGame();
  for (let i = 0; i < 500; i++) p.step(STEP, false, false);
  assert.equal(p.multiball, false); assert.equal(p.balls.length, 1); assert.equal(p.launched, false);
  assert.equal(p.orbit.active, null); assert.equal(p.orbit.isOpen, false);
});

test('a surviving ramp ball completes its admitted jackpot after supernova ends', () => {
  const p = startNova(); const awards: number[] = [];
  p.orbit.onComplete = award => awards.push(award.points);
  Object.assign(p.balls[0], { x: 82, y: 376, vx: 0, vy: -700 });
  p.step(STEP, false, false);
  const runner = p.balls[0];
  p.balls.slice(1).forEach(b => Object.assign(b, { y: 790, vy: 100 }));
  p.step(STEP, false, false);
  assert.equal(p.multiball, false); assert.equal(p.orbit.isOpen, false);
  assert.equal(p.orbit.hasFlight(runner), true);
  for (let i = 0; i < 1000 && awards.length === 0; i++) p.step(STEP, false, false);
  assert.deepEqual(awards, [5000]); assert.equal(p.blackHoleReady, false);
  assert.equal(p.balls[0], runner);
});

test('balls bounce off one another without overlap or explosive acceleration', () => {
  const p = startNova();
  Object.assign(p.balls[0], { x: 210, y: 560, vx: 200, vy: 0 });
  Object.assign(p.balls[1], { x: 225, y: 560, vx: -200, vy: 0 });
  Object.assign(p.balls[2], { x: 280, y: 560, vx: 0, vy: 0 });
  p.step(STEP, false, false);
  const [a, b] = p.balls;
  assert.ok(a.vx < 0 && b.vx > 0);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-9);
  assert.ok(Math.abs(a.vx) <= 200 && Math.abs(b.vx) <= 200);
});

test('either flipper can shoot a ball into the armed black hole', () => {
  for (const [left, position] of [[true, 0.29], [false, 0.27]] as const) {
    const p = new Physics(); p.launched = true; p.inLane = false; p.blackHoleReady = true;
    const f = p.flipper(left);
    Object.assign(p.ball, { x: f.a.x + (f.b.x - f.a.x) * position, y: f.a.y + (f.b.y - f.a.y) * position - 15, vx: 0, vy: 70 });
    for (let i = 0; i < 480 && p.lockedBalls === 0; i++) p.step(STEP, left, !left);
    assert.equal(p.lockedBalls, 1);
  }
});
