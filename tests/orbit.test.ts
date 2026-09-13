import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Physics, STEP } from '../src/physics.ts';
import { OrbitCourse, targets, entrances } from '../src/orbit.ts';

test('three distinct shield targets open the gate; duplicate hits do not count', () => {
  const course = new OrbitCourse(); let hits = 0, opens = 0;
  course.onTarget = () => hits++; course.onOpen = () => opens++;
  course.hitTarget(0); course.hitTarget(0); course.hitTarget(1);
  assert.equal(hits, 2); assert.equal(course.openRemaining, 0);
  course.hitTarget(2);
  assert.equal(opens, 1); assert.equal(course.openRemaining, 15);
  course.hitTarget(2); assert.equal(opens, 1);
});

test('the gate rearms after 15 seconds and a new ball resets progress', () => {
  const course = new OrbitCourse();
  [0, 1, 2].forEach(i => course.hitTarget(i));
  for (let i = 0; i < 3600; i++) course.tick(STEP);
  assert.equal(course.openRemaining, 0); assert.deepEqual(course.down, [false, false, false]);
  course.hitTarget(1); course.reset();
  assert.deepEqual(course.down, [false, false, false]); assert.equal(course.active, null);
});

test('shield targets are physical and award each target only once', () => {
  const p = new Physics(); let hits = 0;
  p.launched = true; p.inLane = false; p.orbit.onTarget = () => hits++;
  const target = targets[0];
  p.ball = { x: target.x, y: target.y + 12, vx: 0, vy: -200, radius: 8 };
  p.step(STEP, false, false);
  assert.equal(hits, 1); assert.ok(p.ball.vy > 0);
  p.ball = { x: target.x, y: target.y + 12, vx: 0, vy: -200, radius: 8 };
  p.step(STEP, false, false); assert.equal(hits, 1);
});

test('closed entrances bounce the ball; open entrances admit upward shots only', () => {
  for (const side of ['left', 'right'] as const) {
    const mouth = entrances[side]; const p = new Physics();
    p.launched = true; p.inLane = false;
    p.ball = { x: mouth.x, y: mouth.y + 13, vx: 0, vy: -500, radius: 8 };
    for (let i = 0; i < 8; i++) p.step(STEP, false, false);
    assert.equal(p.orbit.active, null); assert.ok(p.ball.vy > 0);
    [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
    p.ball = { x: mouth.x, y: mouth.y - 1, vx: 0, vy: 200, radius: 8 };
    p.step(STEP, false, false); assert.equal(p.orbit.active, null);
    p.ball = { x: mouth.x, y: mouth.y + 13, vx: 0, vy: -500, radius: 8 };
    for (let i = 0; i < 10; i++) p.step(STEP, false, false);
    assert.equal(p.orbit.active?.side, side);
  }
});

test('both ramps are continuous and return the ball to the opposite flipper', () => {
  for (const side of ['left', 'right'] as const) {
    const p = new Physics(); let awarded = 0;
    p.launched = true; p.inLane = false;
    [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
    p.orbit.onComplete = points => awarded += points;
    const mouth = entrances[side];
    p.ball = { x: mouth.x + 3, y: mouth.y + 1, vx: 0, vy: -500, radius: 8 };
    let top = false;
    for (let i = 0; i < 1200 && awarded === 0; i++) {
      const before = { ...p.ball }; p.step(STEP, true, true);
      assert.ok(Math.hypot(p.ball.x - before.x, p.ball.y - before.y) < 9);
      if (p.ball.y < 120) top = true;
    }
    assert.ok(top); assert.equal(awarded, 500); assert.equal(p.orbit.active, null);
    assert.ok(p.ball.y >= 619 && p.ball.y <= 622);
    assert.ok(side === 'left' ? p.ball.x > 270 : p.ball.x < 185);
    assert.ok(p.ball.vy > 0);
  }
});

test('an admitted lap finishes even if the gate expires midway', () => {
  const p = new Physics(); let points = 0;
  p.launched = true; p.inLane = false;
  [0, 1, 2].forEach(i => p.orbit.hitTarget(i)); p.orbit.tick(14.9);
  p.orbit.onComplete = award => points += award;
  p.ball = { x: entrances.left.x, y: entrances.left.y + 1, vx: 0, vy: -500, radius: 8 };
  for (let i = 0; i < 1200 && points === 0; i++) p.step(STEP, false, false);
  assert.equal(points, 500); assert.equal(p.orbit.openRemaining, 0); assert.equal(p.orbit.active, null);
});

test('repeated laps in one opening increase awards up to 2000 points', () => {
  const p = new Physics(); const awards: number[] = [];
  p.launched = true; p.inLane = false; [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
  p.orbit.onComplete = points => awards.push(points);
  for (let lap = 0; lap < 5; lap++) {
    p.ball = { x: entrances.left.x, y: entrances.left.y + 1, vx: 0, vy: -850, radius: 8 };
    for (let i = 0; i < 1000 && awards.length === lap; i++) p.step(STEP, false, false);
  }
  assert.deepEqual(awards, [500, 1000, 1500, 2000, 2000]);
  assert.ok(p.orbit.openRemaining > 0);
});

test('ordinary flipper shots can reach each ramp entrance', () => {
  for (const [side, delay, position] of [['left', 12, 0.9], ['right', 2, 0.9]] as const) {
    const p = new Physics();
    for (let i = 0; i < delay; i++) p.step(STEP, true, false);
    p.launched = true; p.inLane = false;
    [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
    const f = p.flipper(true);
    p.ball = { x: f.a.x + (f.b.x - f.a.x) * position, y: f.a.y + (f.b.y - f.a.y) * position - 15, vx: 0, vy: 70, radius: 8 };
    for (let i = 0; i < 480 && !p.orbit.active; i++) p.step(STEP, true, false);
    assert.equal(p.orbit.active?.side, side);
  }
});

test('ball rescue preserves target progress but a new ball clears it', () => {
  const p = new Physics(); p.launch(0.5); p.inLane = false;
  p.orbit.hitTarget(0); p.ball.y = 790; p.step(STEP, false, false);
  assert.ok(p.relaunchIn > 0); assert.deepEqual(p.orbit.down, [true, false, false]);
  p.resetBall(); assert.deepEqual(p.orbit.down, [false, false, false]);
  p.launched = true; p.inLane = false; [0, 1, 2].forEach(i => p.orbit.hitTarget(i));
  p.ball = { x: entrances.left.x, y: entrances.left.y + 1, vx: 0, vy: -500, radius: 8 };
  p.step(STEP, false, false); assert.ok(p.orbit.active);
  p.resetBall(); assert.equal(p.orbit.active, null); assert.equal(p.orbit.openRemaining, 0);
  assert.equal(p.launched, false); assert.equal(p.ball.y, 683);
});
