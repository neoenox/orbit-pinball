/** Scoring rules, kept free of DOM, audio and effects so they can be unit-tested. */

export const BUMPER_POINTS = 100;
export const RAIL_BONUS = 10;
export const TARGET_POINTS = 100;
export const DANGER_BONUS = 50;
/** Minimum simulation seconds between DANGER awards. */
export const DANGER_COOLDOWN_SECONDS = 1.5;
export const MAX_MULTIPLIER = 5;
export const HITS_PER_MULTIPLIER_TIER = 10;
/** While only the last ball remains, bumper and DANGER awards are doubled. */
export const LAST_BALL_BONUS = 2;

export type HitResult = { tierIncreased: boolean; multiplier: number };
export type BumperResult = HitResult & { points: number };
/** Hits this close together in simulation time continue a chain. */
export const CHAIN_WINDOW_SECONDS = 2.2;

export const COMBO_REWARDS = [
  { hits: 3, points: 500, label: '3 COMBO' },
  { hits: 5, points: 1000, label: 'RUSH!' },
  { hits: 8, points: 2500, label: 'FEVER!!' },
  { hits: 12, points: 5000, label: 'OVERDRIVE!!!' },
] as const;
export type ChainResult = { streak: number; chained: boolean; bonus: typeof COMBO_REWARDS[number] | null };

/** Orbit ramp awards: the left ramp escalates per lap, the right pays a fixed charge. */
export const ORBIT_LAP_BASE = 500;
export const ORBIT_LAP_MAX_STEPS = 4;
export const ORBIT_CHARGE_POINTS = 1000;
/** Right-ramp laps credit this many hits toward the bumper multiplier. */
export const ORBIT_CHARGE_HITS = 5;
export const SUPERNOVA_JACKPOT = 5000;
export const JACKPOT_STEPS = [SUPERNOVA_JACKPOT, 10000, 15000, 25000] as const;
export function jackpotPoints(completedLaps: number) {
  return JACKPOT_STEPS[Math.min(JACKPOT_STEPS.length - 1, Math.max(0, Math.floor(completedLaps)))];
}

export type OrbitAward = { side: 'left' | 'right'; points: number; jackpot: boolean; charge: boolean };

/** Pure award rule for a completed orbit lap; `laps` is the escalation counter at admission. */
export function orbitAward(side: 'left' | 'right', laps: number, supernova: boolean, jackpotLaps = 0): OrbitAward {
  if (supernova) return { side, points: jackpotPoints(jackpotLaps), jackpot: true, charge: false };
  if (side === 'left') return { side, points: ORBIT_LAP_BASE * Math.min(ORBIT_LAP_MAX_STEPS, laps + 1), jackpot: false, charge: false };
  return { side, points: ORBIT_CHARGE_POINTS, jackpot: false, charge: true };
}

export class Scoring {
  private hits = 0;
  private streak = 0;
  private lastHitAt = -Infinity;
  private lastDangerAt = -Infinity;

  reset() { this.hits = 0; this.resetChain(); this.resetDanger(); }

  /** Clears the chain without touching the multiplier, e.g. on ball save or drain. */
  resetChain() { this.streak = 0; this.lastHitAt = -Infinity; }

  get hitStreak() { return this.streak; }

  get multiplier() { return this.multiplierOf(this.hits); }
  get hitsToNextMultiplier() {
    return this.multiplier === MAX_MULTIPLIER ? 0 : HITS_PER_MULTIPLIER_TIER - this.hits % HITS_PER_MULTIPLIER_TIER;
  }

  multiplierOf(hits: number) {
    return Math.min(MAX_MULTIPLIER, 1 + Math.floor(hits / HITS_PER_MULTIPLIER_TIER));
  }

  /** Registers hits and reports whether the multiplier tier increased. */
  addHits(count: number): HitResult {
    const before = this.multiplier;
    this.hits += count;
    const multiplier = this.multiplier;
    return { tierIncreased: multiplier > before, multiplier };
  }

  /** Registers a bumper hit at simulation time `at`; hits within the chain window grow the streak. */
  registerHit(at: number): ChainResult {
    this.streak = at - this.lastHitAt <= CHAIN_WINDOW_SECONDS ? this.streak + 1 : 1;
    this.lastHitAt = at;
    return { streak: this.streak, chained: this.streak >= 2, bonus: COMBO_REWARDS.find(reward => reward.hits === this.streak) ?? null };
  }

  /** True while a chain of at least two hits is still within the display window. */
  isChainActive(at: number) { return this.streak >= 2 && at - this.lastHitAt <= CHAIN_WINDOW_SECONDS; }

  /** Bumper award at the current multiplier; the hit registers afterwards, matching real pinball timing. */
  bumper(lastBall: boolean): BumperResult {
    const points = BUMPER_POINTS * this.multiplier * (lastBall ? LAST_BALL_BONUS : 1);
    return { ...this.addHits(1), points };
  }

  /** Deep-catch DANGER award, doubled on the last ball; the pure math behind tryDanger. */
  danger(lastBall: boolean) {
    return DANGER_BONUS * (lastBall ? LAST_BALL_BONUS : 1);
  }

  /** Pays DANGER when the cooldown since the last award has elapsed; failed attempts don't extend it. */
  tryDanger(at: number, lastBall: boolean): number | null {
    if (at - this.lastDangerAt <= DANGER_COOLDOWN_SECONDS) return null;
    this.lastDangerAt = at;
    return this.danger(lastBall);
  }

  /** Clears the DANGER cooldown, e.g. at game start. */
  resetDanger() { this.lastDangerAt = -Infinity; }
}
