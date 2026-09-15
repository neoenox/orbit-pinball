import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scoring, BUMPER_POINTS, DANGER_BONUS, MAX_MULTIPLIER, CHAIN_WINDOW_SECONDS, ORBIT_LAP_BASE, ORBIT_LAP_MAX_STEPS, ORBIT_CHARGE_POINTS, ORBIT_CHARGE_HITS, SUPERNOVA_JACKPOT, orbitAward } from '../src/scoring.ts';

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

test('rapid hits chain while slow hits start a new chain', () => {
  const scoring = new Scoring();
  assert.deepEqual(scoring.registerHit(10), { streak: 1, chained: false });
  assert.deepEqual(scoring.registerHit(10 + CHAIN_WINDOW_SECONDS), { streak: 2, chained: true }, 'a hit exactly at the window boundary still chains');
  assert.deepEqual(scoring.registerHit(10 + CHAIN_WINDOW_SECONDS + 0.01), { streak: 3, chained: true });
  assert.deepEqual(scoring.registerHit(15), { streak: 1, chained: false }, 'a gap past the window restarts at one');
});

test('a chain goes stale after the window passes without a hit', () => {
  const scoring = new Scoring();
  scoring.registerHit(0);
  scoring.registerHit(1);
  assert.deepEqual(scoring.registerHit(1 + CHAIN_WINDOW_SECONDS + 0.5), { streak: 1, chained: false });
  assert.equal(scoring.hitStreak, 1);
});

test('isChainActive tracks only live chains of at least two hits', () => {
  const scoring = new Scoring();
  scoring.registerHit(0);
  assert.equal(scoring.isChainActive(1), false, 'a single hit never shows the chain display');
  scoring.registerHit(1);
  assert.equal(scoring.isChainActive(2), true);
  assert.equal(scoring.isChainActive(3), true);
  assert.equal(scoring.isChainActive(1 + CHAIN_WINDOW_SECONDS), true, 'still live exactly at the window edge');
  assert.equal(scoring.isChainActive(1 + CHAIN_WINDOW_SECONDS + 0.001), false, 'the display disappears once the window passes');
});

test('resetChain clears the streak without touching the multiplier', () => {
  const scoring = new Scoring();
  for (let i = 0; i < 15; i++) scoring.addHits(1);
  assert.equal(scoring.multiplier, 2);
  scoring.registerHit(0);
  scoring.registerHit(0.1);
  scoring.resetChain();
  assert.equal(scoring.hitStreak, 0);
  assert.equal(scoring.isChainActive(0.2), false);
  assert.deepEqual(scoring.registerHit(0.3), { streak: 1, chained: false });
  assert.equal(scoring.multiplier, 2, 'the multiplier must survive a ball save or drain');
});

test('orbit lap awards escalate on the left ramp and stay fixed on the right ramp', () => {
  assert.deepEqual(orbitAward('left', 0, false), { side: 'left', points: 500, jackpot: false, charge: false });
  assert.equal(orbitAward('left', 1, false).points, 1000);
  assert.equal(orbitAward('left', 3, false).points, 2000);
  assert.equal(orbitAward('left', 9, false).points, ORBIT_LAP_BASE * ORBIT_LAP_MAX_STEPS, 'escalation must cap at the ×4 lap');
  assert.deepEqual(orbitAward('right', 0, false), { side: 'right', points: ORBIT_CHARGE_POINTS, jackpot: false, charge: true });
  assert.equal(orbitAward('right', 9, false).points, ORBIT_CHARGE_POINTS, 'the right ramp never escalates');
});

test('supernova laps always pay the jackpot regardless of side or escalation', () => {
  assert.deepEqual(orbitAward('left', 0, true), { side: 'left', points: SUPERNOVA_JACKPOT, jackpot: true, charge: false });
  assert.deepEqual(orbitAward('right', 9, true), { side: 'right', points: SUPERNOVA_JACKPOT, jackpot: true, charge: false });
});

test('the scoring constants agree with the award rule', () => {
  assert.equal(orbitAward('right', 0, false).points, ORBIT_CHARGE_POINTS);
  assert.equal(ORBIT_CHARGE_HITS, 5);
});

test('reset clears both the chain and the multiplier state', () => {
  const scoring = new Scoring();
  scoring.addHits(20);
  scoring.registerHit(0);
  scoring.registerHit(0.1);
  scoring.reset();
  assert.equal(scoring.hitStreak, 0);
  assert.equal(scoring.multiplier, 1);
  assert.equal(scoring.isChainActive(5), false);
});
