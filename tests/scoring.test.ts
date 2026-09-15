import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scoring, BUMPER_POINTS, DANGER_BONUS, MAX_MULTIPLIER } from '../src/scoring.ts';

test('the multiplier grows one tier per ten bumper hits and caps at five', () => {
  const scoring = new Scoring();
  assert.equal(scoring.multiplier, 1);
  for (let i = 0; i < 9; i++) scoring.addHits(1);
  assert.equal(scoring.multiplier, 1, 'nine hits must not reach the second tier');
  scoring.addHits(1);
  assert.equal(scoring.multiplier, 2);
  for (let i = 0; i < 30; i++) scoring.addHits(1);
  assert.equal(scoring.multiplier, 5);
  scoring.addHits(1);
  assert.equal(scoring.multiplier, MAX_MULTIPLIER, 'the multiplier must not exceed five');
  assert.equal(scoring.multiplierOf(0), 1);
  assert.equal(scoring.multiplierOf(45), 5);
  assert.equal(scoring.multiplierOf(999), 5);
});

test('addHits reports exactly the steps where a tier boundary was crossed', () => {
  const scoring = new Scoring();
  assert.equal(scoring.addHits(9).tierIncreased, false);
  assert.equal(scoring.addHits(1).tierIncreased, true);
  assert.equal(scoring.addHits(1).tierIncreased, false);
  assert.equal(scoring.addHits(5).tierIncreased, false, 'the right-ramp charge only pays off across a boundary');
  assert.equal(scoring.addHits(5).tierIncreased, true);
});

test('a bumper scores 100 at the multiplier earned before the hit, with the hit counted after', () => {
  const scoring = new Scoring();
  const first = scoring.bumper(false);
  assert.equal(first.points, BUMPER_POINTS);
  assert.equal(first.multiplier, 1);
  assert.equal(first.tierIncreased, false);
  for (let i = 0; i < 9; i++) scoring.bumper(false);
  assert.equal(scoring.multiplier, 2, 'ten registered hits reach the next tier');
  const scored = scoring.bumper(false);
  assert.equal(scored.points, 200, 'the eleventh hit is scored at the ×2 tier reached on the tenth');
  assert.equal(scored.tierIncreased, false, 'the tier boundary was already crossed on the tenth hit');
  for (let i = 0; i < 8; i++) scoring.bumper(false);
  const crossing = scoring.bumper(false);
  assert.equal(crossing.points, 200, 'the twentieth hit is scored at the pre-hit ×2');
  assert.equal(crossing.tierIncreased, true, 'the twentieth hit crosses into ×3');
  assert.equal(scoring.multiplier, 3);
});

test('the last ball doubles bumper points without changing the multiplier', () => {
  const scoring = new Scoring();
  assert.equal(scoring.bumper(true).points, 200);
  for (let i = 0; i < 9; i++) scoring.bumper(true);
  assert.equal(scoring.bumper(true).points, 400, 'last-ball doubling stacks with the ×2 multiplier');
  for (let i = 0; i < 30; i++) scoring.bumper(true);
  assert.equal(scoring.bumper(true).points, 1000, 'capped ×5 doubling yields 1000');
});

test('the DANGER bonus is a flat award, doubled on the last ball and independent of the multiplier', () => {
  const scoring = new Scoring();
  assert.equal(scoring.danger(false), DANGER_BONUS);
  assert.equal(scoring.danger(true), 100);
  for (let i = 0; i < 45; i++) scoring.addHits(1);
  assert.equal(scoring.multiplier, 5);
  assert.equal(scoring.danger(false), DANGER_BONUS, 'the multiplier must not inflate the DANGER award');
  assert.equal(scoring.danger(true), 100);
});

test('reset returns to a fresh ×1 game with no pending tier increase', () => {
  const scoring = new Scoring();
  for (let i = 0; i < 25; i++) scoring.addHits(1);
  assert.equal(scoring.multiplier, 3);
  scoring.reset();
  assert.equal(scoring.multiplier, 1);
  assert.equal(scoring.addHits(1).tierIncreased, false);
});
