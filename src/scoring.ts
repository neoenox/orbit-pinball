/** Scoring rules, kept free of DOM, audio and effects so they can be unit-tested. */

export const BUMPER_POINTS = 100;
export const RAIL_BONUS = 10;
export const TARGET_POINTS = 100;
export const DANGER_BONUS = 50;
export const MAX_MULTIPLIER = 5;
export const HITS_PER_MULTIPLIER_TIER = 10;
/** While only the last ball remains, bumper and DANGER awards are doubled. */
export const LAST_BALL_BONUS = 2;

export type HitResult = { tierIncreased: boolean; multiplier: number };
export type BumperResult = HitResult & { points: number };
/** Hits this close together in simulation time continue a chain. */
export const CHAIN_WINDOW_SECONDS = 2.2;

export type ChainResult = { streak: number; chained: boolean };

export class Scoring {
  private hits = 0;
  private streak = 0;
  private lastHitAt = -Infinity;

  reset() { this.hits = 0; this.resetChain(); }

  /** Clears the chain without touching the multiplier, e.g. on ball save or drain. */
  resetChain() { this.streak = 0; this.lastHitAt = -Infinity; }

  get hitStreak() { return this.streak; }

  get multiplier() { return this.multiplierOf(this.hits); }

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
    return { streak: this.streak, chained: this.streak >= 2 };
  }

  /** True while a chain of at least two hits is still within the display window. */
  isChainActive(at: number) { return this.streak >= 2 && at - this.lastHitAt <= CHAIN_WINDOW_SECONDS; }

  /** Bumper award at the current multiplier; the hit registers afterwards, matching real pinball timing. */
  bumper(lastBall: boolean): BumperResult {
    const points = BUMPER_POINTS * this.multiplier * (lastBall ? LAST_BALL_BONUS : 1);
    return { ...this.addHits(1), points };
  }

  /** Deep-catch DANGER award; pure — the 1.5 s cooldown stays with the game loop. */
  danger(lastBall: boolean) {
    return DANGER_BONUS * (lastBall ? LAST_BALL_BONUS : 1);
  }
}
