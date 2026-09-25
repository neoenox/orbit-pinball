import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Physics, STEP, collideRail, bumpers, combatBumpers } from '../src/physics.ts';

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

test('launch travels continuously around the shooter bend at every power', () => {
  const exitSpeeds: number[] = [];
  for (const power of [0, 0.5, 1]) {
    const p = new Physics(); p.launch(power);
    let exited = false;
    for (let i = 0; i < 480 && !exited; i++) {
      const before = { x: p.ball.x, y: p.ball.y };
      p.step(STEP, false, false);
      const distance = Math.hypot(p.ball.x - before.x, p.ball.y - before.y);
      assert.ok(distance < 9, `power ${power}: ball jumped ${distance.toFixed(2)}px`);
      if (!p.inLane) { exited = true; exitSpeeds.push(Math.hypot(p.ball.vx, p.ball.vy)); }
    }
    assert.ok(exited, `power ${power} failed to exit the shooter lane`);
  }
  assert.ok(exitSpeeds[2] > exitSpeeds[0] + 150, 'charge strength must survive the shooter bend');
});

test('flippers accelerate into a stroke and return more gently', () => {
  const p = new Physics();
  const start = p.leftAngle;
  p.step(STEP, true, true);
  const first = start - p.leftAngle;
  p.step(STEP, true, true);
  const second = start - p.leftAngle - first;
  assert.ok(second > first * 1.3, 'a stroke should accelerate instead of jumping to full speed');
  for (let i = 0; i < 80; i++) p.step(STEP, true, true);
  const raised = p.leftAngle;
  for (let i = 0; i < 12; i++) p.step(STEP, false, false);
  assert.ok(p.leftAngle - raised < 0.45, 'return should not hit as hard as a powered stroke');
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

test('flipper contact position changes shot power and stroke timing changes direction', () => {
  const shot = (left: boolean, position: number, delay: number) => {
    const p = new Physics();
    for (let i = 0; i < delay; i++) p.step(STEP, left, !left);
    const f = p.flipper(left);
    p.launched = true; p.inLane = false;
    p.ball = { x: f.a.x + (f.b.x - f.a.x) * position, y: f.a.y + (f.b.y - f.a.y) * position - 15, vx: 0, vy: 50, radius: 8 };
    for (let i = 0; i < 12; i++) p.step(STEP, left, !left);
    return p.ball;
  };
  for (const left of [true, false]) {
    const base = shot(left, 0.3, 0), tip = shot(left, 0.9, 0), later = shot(left, 0.9, 10);
    assert.ok(tip.vy < base.vy - 250, 'the faster tip should produce a stronger shot');
    const difference = Math.abs(Math.atan2(tip.vy, tip.vx) - Math.atan2(later.vy, later.vx));
    assert.ok(difference > 0.15, 'different contact timing must produce a different aim');
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

test('an early drain saves the ball once and automatically relaunches at the same power', () => {
  const p = new Physics(); let saves = 0, drains = 0;
  p.onSave = () => saves++; p.onDrain = () => drains++;
  p.launch(0.65); const launchSpeed = p.ball.vy;
  p.inLane = false; p.ball.y = 790;
  p.step(STEP, false, false);
  assert.equal(saves, 1); assert.equal(drains, 0);
  assert.equal(p.launched, false); assert.ok(p.relaunchIn > 0);
  assert.equal(p.launch(1), false, 'manual launch must not skip the rescue countdown');
  for (let i = 0; i < 240 && !p.launched; i++) p.step(STEP, false, false);
  assert.equal(p.launched, true); assert.equal(p.ball.vy, launchSpeed);
  assert.equal(p.saveRemaining, 0, 'the rescue must not grant another save');
  p.inLane = false; p.ball.y = 790;
  p.step(STEP, false, false);
  assert.equal(saves, 1); assert.equal(drains, 1);
});

test('the five-second save expires on simulation time, not wall clock', () => {
  const p = new Physics(); let saves = 0, drains = 0;
  p.onSave = () => saves++; p.onDrain = () => drains++;
  p.launch(0.5); p.inLane = false;
  assert.equal(p.saveRemaining, 5);
  for (let i = 0; i < 240 * 5; i++) {
    p.ball = { x: 228, y: 450, vx: 0, vy: 0, radius: 8 };
    p.step(STEP, false, false);
  }
  assert.equal(p.saveRemaining, 0);
  p.ball.y = 790; p.step(STEP, false, false);
  assert.equal(saves, 0); assert.equal(drains, 1);
});

test('a new ball clears a pending rescue and earns its own save on launch', () => {
  const p = new Physics();
  p.launch(0.5); p.inLane = false; p.ball.y = 790;
  p.step(STEP, false, false);
  assert.ok(p.relaunchIn > 0);
  p.resetBall();
  assert.equal(p.relaunchIn, 0); assert.equal(p.saveRemaining, 0);
  for (let i = 0; i < 240; i++) p.step(STEP, false, false);
  assert.equal(p.launched, false);
  p.launch(0.2); assert.equal(p.saveRemaining, 5);
});

test('combat mode always catches balls that pass below the flippers and relaunches them', () => {
  const p = new Physics(); let saves = 0, drains = 0;
  p.combatSafety = true; p.onSave = () => saves++; p.onDrain = () => drains++;
  p.launched = true; p.inLane = false;
  p.ball = { x: 228, y: 709, vx: 0, vy: 600, radius: 8 };
  p.step(STEP, false, false);
  assert.equal(saves, 1); assert.equal(drains, 0);
  assert.equal(p.inLane, true); assert.equal(p.launched, false);
  for (let i = 0; i < 240 && !p.launched; i++) p.step(STEP, false, false);
  assert.equal(p.launched, true);
  p.ball = { x: 228, y: 709, vx: 0, vy: 600, radius: 8 };
  p.step(STEP, false, false);
  assert.equal(saves, 2, 'the catch must remain available after a previous rescue');
  assert.equal(drains, 0);
});

test('combat bumpers visibly kick the ball without awarding classic mode score hits', () => {
  const p = new Physics(); let bumperHits = 0, classicHits = 0;
  p.combatSafety = true; p.onCombatBumper = () => bumperHits++; p.onHit = () => classicHits++;
  p.launched = true; p.inLane = false;
  const bumper = combatBumpers[0];
  p.ball = { x: bumper.x, y: bumper.y - bumper.radius - 6, vx: 0, vy: 160, radius: 8 };
  for (let i = 0; i < 10; i++) p.step(STEP, false, false);
  assert.equal(bumperHits, 1); assert.equal(classicHits, 0);
  assert.ok(p.ball.vy < 0, 'the energy bumper should return the ball to the field');
});
