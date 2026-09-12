import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Physics, STEP, collideRail, bumpers } from '../src/physics.ts';

test('a launch at either power enters the table and remains finite', () => {
  for (const power of [0, 0.5, 1]) {
    const p = new Physics();
    p.launch(power);
    for (let i = 0; i < 300; i++) p.step(STEP, false, false);
    assert.equal(p.inLane, false);
    assert.ok(p.ball.x < 402);
    assert.ok(Number.isFinite(p.ball.vx + p.ball.vy));
  }
});

test('wall collision separates the ball and reflects its incoming velocity', () => {
  const ball = { x: 8, y: 60, vx: -100, vy: 20, radius: 8 };
  assert.equal(collideRail(ball, { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, bounce: 0.8 }), true);
  assert.equal(ball.x, 12); assert.equal(ball.vx, 80); assert.equal(ball.vy, 20);
});

test('a bumper awards a hit and pushes the ball away without repeated scoring', () => {
  const p = new Physics(); let hits = 0;
  p.onHit = () => hits++;
  p.launched = true; p.inLane = false;
  p.ball = { x: bumpers[0].x, y: bumpers[0].y - 35, vx: 0, vy: 100, radius: 8 };
  p.step(STEP, false, false);
  assert.equal(hits, 1); assert.ok(p.ball.vy < 0);
  for (let i = 0; i < 10; i++) p.step(STEP, false, false);
  assert.equal(hits, 1);
});

test('both moving flippers propel a contacting ball upward', () => {
  for (const left of [true, false]) {
    const p = new Physics(); p.launched = true; p.inLane = false;
    const f = p.flipper(left);
    const x = f.a.x + (f.b.x - f.a.x) * 0.65;
    const y = f.a.y + (f.b.y - f.a.y) * 0.65 - 15;
    p.ball = { x, y, vx: 0, vy: 50, radius: 8 };
    for (let i = 0; i < 8; i++) p.step(STEP, left, !left);
    assert.ok(p.ball.vy < -100, `${left ? 'left' : 'right'} flipper vy=${p.ball.vy}`);
  }
});

test('drain fires once and reset prepares a fresh ball', () => {
  const p = new Physics(); let drains = 0;
  p.onDrain = () => drains++;
  p.launched = true; p.inLane = false; p.ball.y = 790;
  for (let i = 0; i < 5; i++) p.step(STEP, false, false);
  assert.equal(drains, 1);
  p.resetBall(); assert.equal(p.launched, false); assert.equal(p.inLane, true); assert.equal(p.ball.y, 683);
});

test('extended play stays finite and inside side boundaries', () => {
  const p = new Physics(); let drains = 0, hits = 0;
  p.onDrain = () => { drains++; p.resetBall(); p.launch(0.7); };
  p.onHit = () => hits++;
  p.launch(0.7);
  for (let i = 0; i < 240 * 120; i++) {
    p.step(STEP, i % 130 < 45, i % 170 < 50);
    assert.ok(Number.isFinite(p.ball.x + p.ball.y + p.ball.vx + p.ball.vy));
    assert.ok(p.ball.x > 0 && p.ball.x < 460);
  }
  assert.ok(hits > 0); assert.ok(drains > 0);
});
