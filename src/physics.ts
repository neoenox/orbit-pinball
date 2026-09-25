import { OrbitCourse, targets, entrances } from './orbit.ts';

export type Vec = { x: number; y: number };
export type Ball = Vec & { vx: number; vy: number; radius: number };
export type Rail = { a: Vec; b: Vec; bounce?: number; color?: string };
export const WIDTH = 460;
export const HEIGHT = 760;
export const STEP = 1 / 240;
export const bumpers = [
  { x: 163, y: 240, radius: 30 },
  { x: 293, y: 240, radius: 30 },
  { x: 228, y: 335, radius: 33 },
];
const rail = (x: number, y: number, x2: number, y2: number, bounce = 0.78, color?: string): Rail => ({ a: { x, y }, b: { x: x2, y: y2 }, bounce, color });
// Concentric rails turn the ball using contact forces, preserving launch momentum.
const shooterArc = (radius: number): Rail[] => Array.from({ length: 16 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 32;
  const b = a + Math.PI / 32;
  return rail(350 + Math.cos(a) * radius, 132 + Math.sin(a) * radius,
    350 + Math.cos(b) * radius, 132 + Math.sin(b) * radius, 0.25);
});
export const shooterGate = rail(350, 40, 350, 78, 0.5, '#e8b571');
// Scratch vectors reused by the hot collision path; step() runs 240 times per
// second per ball, so per-call allocations add up under garbage collection.
const scratch = { x: 0, y: 0 };
const flipperResult: [number, number] = [0, 0];
const flipperRailA: Rail = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, bounce: 0.5 };
const flipperRailB: Rail = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, bounce: 0.5 };
const flipperSurfaceA = { x: 0, y: 0 };
const flipperSurfaceB = { x: 0, y: 0 };
const gateRails = Object.values(entrances).map(mouth => rail(mouth.x - 24, mouth.y, mouth.x + 24, mouth.y, 0.7));
const targetRails = targets.map(target => rail(target.x - target.width / 2, target.y, target.x + target.width / 2, target.y, 0.7));
export const rails: Rail[] = [
  rail(28, 590, 28, 150), rail(28, 150, 50, 85), rail(50, 85, 115, 40),
  rail(115, 40, 350, 40), ...shooterArc(92), ...shooterArc(54),
  rail(442, 132, 442, 735), rail(404, 132, 402, 180, 0.25), rail(402, 180, 402, 735),
  rail(28, 590, 105, 683), rail(105, 683, 158, 704),
  rail(402, 590, 351, 674), rail(351, 674, 298, 704),
  rail(72, 460, 72, 574, 0.8, '#6ce8d2'), rail(72, 574, 128, 620, 0.8, '#6ce8d2'),
  rail(380, 460, 380, 574, 0.8, '#6ce8d2'), rail(380, 574, 328, 620, 0.8, '#6ce8d2'),
  rail(113, 515, 113, 566, 0.8, '#ff795f'), rail(113, 566, 166, 610, 1.13, '#ff795f'), rail(166, 610, 113, 515, 1.13, '#ff795f'),
  rail(341, 515, 341, 566, 0.8, '#ff795f'), rail(341, 566, 288, 610, 1.13, '#ff795f'), rail(288, 610, 341, 515, 1.13, '#ff795f'),
  rail(134, 105, 134, 151, 0.85, '#6ce8d2'), rail(217, 90, 217, 148, 0.85, '#6ce8d2'), rail(300, 105, 300, 151, 0.85, '#6ce8d2'),
];

export function collideRail(ball: Ball, wall: Rail, surface: Vec = scratch, thickness = 4): boolean {
  const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
  const t = Math.max(0, Math.min(1, ((ball.x - wall.a.x) * dx + (ball.y - wall.a.y) * dy) / (dx * dx + dy * dy)));
  const px = wall.a.x + t * dx, py = wall.a.y + t * dy;
  const ox = ball.x - px, oy = ball.y - py, dist = Math.hypot(ox, oy);
  const min = ball.radius + thickness;
  if (dist >= min) return false;
  const nx = dist > 0.001 ? ox / dist : -dy / Math.hypot(dx, dy);
  const ny = dist > 0.001 ? oy / dist : dx / Math.hypot(dx, dy);
  ball.x = px + nx * min; ball.y = py + ny * min;
  const vn = (ball.vx - surface.x) * nx + (ball.vy - surface.y) * ny;
  if (vn >= 0) return false;
  ball.vx -= (1 + (wall.bounce ?? 0.8)) * vn * nx;
  ball.vy -= (1 + (wall.bounce ?? 0.8)) * vn * ny;
  return true;
}

export const BLACK_HOLE = { x: 228, y: 465, radius: 20 };
type BallState = {
  ball: Ball; launched: boolean; inLane: boolean; saveRemaining: number; relaunchIn: number;
  saveAvailable: boolean; launchPower: number; bumperCooldown: number[]; drained: boolean;
};
const newBall = (): BallState => ({
  ball: { x: 423, y: 683, vx: 0, vy: 0, radius: 8 }, launched: false, inLane: true,
  saveRemaining: 0, relaunchIn: 0, saveAvailable: true, launchPower: 0, bumperCooldown: [0, 0, 0], drained: false,
});

export class Physics {
  readonly orbit = new OrbitCourse();
  private actors: BallState[] = [newBall()];
  /** First actor only: valid while a single ball is live. Use balls[] during multiball. */
  get ball() { return this.actors[0].ball; }
  set ball(value: Ball) { this.actors[0].ball = value; }
  get launched() { return this.actors[0].launched; }
  set launched(value: boolean) { this.actors[0].launched = value; }
  get inLane() { return this.actors[0].inLane; }
  set inLane(value: boolean) { this.actors[0].inLane = value; }
  get saveRemaining() { return this.actors[0].saveRemaining; }
  get relaunchIn() { return this.actors[0].relaunchIn; }
  get balls() {
    const result: Ball[] = [];
    for (const actor of this.actors) if (!actor.drained) result.push(actor.ball);
    return result;
  }
  get liveBallCount() {
    let count = 0;
    for (const actor of this.actors) if (actor.launched && !actor.drained) count++;
    return count;
  }
  get busy() { return this.captureRemaining > 0 || this.replacingLockedBall; }
  lockedBalls = 0;
  blackHoleReady = false;
  multiball = false;
  captureRemaining = 0;
  replacingLockedBall = false;
  private captureOrigin: Vec = { x: 0, y: 0 };
  leftAngle = 0.42;
  rightAngle = Math.PI - 0.42;
  private leftVelocity = 0;
  private rightVelocity = 0;
  onHit: (index: number) => void = () => {};
  onRail: () => void = () => {};
  onDrain: () => void = () => {};
  onFlipper: (left: boolean, speed: number, x?: number, y?: number) => void = () => {};
  onSave: () => void = () => {};
  onLaunch: () => void = () => {};
  onBlackHoleReady: () => void = () => {};
  onLock: (count: number) => void = () => {};
  onMultiballStart: () => void = () => {};
  onMultiballEnd: () => void = () => {};
  onBallLost: (remaining: number) => void = () => {};

  constructor() {
    this.orbit.onNormalLap = () => {
      if (!this.multiball && !this.blackHoleReady) { this.blackHoleReady = true; this.onBlackHoleReady(); }
    };
  }

  private placeBall(actor: BallState) {
    actor.ball = newBall().ball; actor.launched = false; actor.inLane = true;
    actor.bumperCooldown.fill(0);
  }

  resetBall() {
    this.actors = [newBall()]; this.captureRemaining = 0; this.replacingLockedBall = false;
    this.blackHoleReady = false; this.multiball = false;
    this.orbit.reset();
  }

  resetGame() { this.lockedBalls = 0; this.resetBall(); }

  launch(power: number) {
    if (this.launched || this.relaunchIn > 0 || this.busy || this.multiball) return false;
    this.launchActor(this.actors[0], power);
    return true;
  }

  /** Adds a launched ball for combat skills without changing the classic game's ball stock. */
  addCombatBall() {
    const actor = newBall();
    actor.launched = true; actor.inLane = false; actor.saveAvailable = false;
    const direction = this.actors.length % 2 ? -1 : 1;
    actor.ball = { x: 228 + direction * 24, y: 620, vx: direction * 210, vy: -620, radius: 8 };
    this.actors.push(actor); this.onLaunch();
  }

  private launchActor(actor: BallState, power: number) {
    actor.launched = true; actor.launchPower = Math.min(1, Math.max(0, power));
    actor.ball.vy = -(980 + actor.launchPower * 340);
    actor.saveRemaining = actor.saveAvailable ? 5 : 0;
    this.onLaunch();
  }

  private capture(actor: BallState) {
    this.blackHoleReady = false; this.lockedBalls++; this.captureRemaining = 0.65;
    this.captureOrigin = { x: actor.ball.x, y: actor.ball.y };
    actor.ball.vx = 0; actor.ball.vy = 0; actor.saveRemaining = 0;
    this.onLock(this.lockedBalls);
  }

  private startMultiball() {
    this.multiball = true; this.lockedBalls = 0; this.blackHoleReady = false;
    this.orbit.setSupernova(true);
    this.actors = [newBall(), newBall(), newBall()];
    for (let i = 0; i < 3; i++) {
      const direction = i - 1;
      const actor = this.actors[i];
      actor.launched = true; actor.inLane = false; actor.saveAvailable = false;
      actor.ball = { x: BLACK_HOLE.x + direction * 36, y: BLACK_HOLE.y - (direction === 0 ? 38 : 0), vx: direction === 0 ? 70 : direction * 320, vy: direction === 0 ? -580 : -420, radius: 8 };
    }
    this.onMultiballStart();
  }

  flipper(left: boolean, result: Rail = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }): Rail {
    const angle = left ? this.leftAngle : this.rightAngle;
    result.a.x = left ? 145 : 310; result.a.y = 659;
    result.b.x = result.a.x + Math.cos(angle) * 70; result.b.y = result.a.y + Math.sin(angle) * 70;
    result.bounce = 0.5;
    return result;
  }

  private moveFlipper(angle: number, velocity: number, target: number, powered: boolean, dt: number, out: [number, number]) {
    const distance = target - angle;
    const maxSpeed = powered ? 18 : 7;
    const acceleration = powered ? 300 : 110;
    const desired = Math.sign(distance) * Math.min(maxSpeed, Math.sqrt(2 * acceleration * Math.abs(distance)));
    velocity += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - velocity));
    const next = angle + velocity * dt;
    if ((target - next) * distance <= 0) { out[0] = target; out[1] = 0; } else { out[0] = next; out[1] = velocity; }
  }

  step(dt: number, left: boolean, right: boolean) {
    let anyLive = false;
    for (const actor of this.actors) if (!actor.drained) { anyLive = true; break; }
    if (!anyLive) return;
    const oldLeft = this.leftAngle, oldRight = this.rightAngle;
    this.moveFlipper(this.leftAngle, this.leftVelocity, left ? -0.5 : 0.42, left, dt, flipperResult);
    this.leftAngle = flipperResult[0]; this.leftVelocity = flipperResult[1];
    this.moveFlipper(this.rightAngle, this.rightVelocity, right ? Math.PI + 0.5 : Math.PI - 0.42, right, dt, flipperResult);
    this.rightAngle = flipperResult[0]; this.rightVelocity = flipperResult[1];
    this.orbit.tick(dt);
    if (this.captureRemaining > 0) {
      this.captureRemaining = Math.max(0, this.captureRemaining - dt);
      const t = 1 - this.captureRemaining / 0.65;
      this.ball.x = this.captureOrigin.x + (BLACK_HOLE.x - this.captureOrigin.x) * t;
      this.ball.y = this.captureOrigin.y + (BLACK_HOLE.y - this.captureOrigin.y) * t;
      if (this.captureRemaining < 1e-9) {
        this.captureRemaining = 0;
        if (this.lockedBalls >= 2) this.startMultiball();
        else {
          const replacement = newBall(); replacement.relaunchIn = 0.65; replacement.launchPower = 0.7; replacement.saveAvailable = false;
          this.actors = [replacement]; this.replacingLockedBall = true;
        }
      }
      return;
    }
    const leftOmega = (this.leftAngle - oldLeft) / dt, rightOmega = (this.rightAngle - oldRight) / dt;
    for (const actor of this.actors) {
      this.stepBall(actor, dt, leftOmega, rightOmega);
      if (this.captureRemaining > 0) return;
    }
    const remaining = this.actors.filter(actor => !actor.drained);
    if (remaining.length !== this.actors.length) {
      const wasMultiball = this.multiball;
      if (remaining.length > 0) this.actors = remaining;
      if (wasMultiball && remaining.length <= 1) {
        this.multiball = false; this.orbit.setSupernova(false); this.onMultiballEnd();
      }
      if (remaining.length === 0) {
        // Keep one inactive record for compatibility; emit a life loss just once.
        this.actors = [newBall()]; this.actors[0].drained = true;
        this.onDrain();
      } else if (wasMultiball) this.onBallLost(remaining.length);
    }
    this.collideBalls();
  }

  private collideBalls() {
    for (let i = 0; i < this.actors.length; i++) for (let j = i + 1; j < this.actors.length; j++) {
      const a = this.actors[i].ball, b = this.actors[j].ball;
      if (this.orbit.hasFlight(a) || this.orbit.hasFlight(b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), min = a.radius + b.radius;
      if (distance >= min) continue;
      const nx = distance > 0.001 ? dx / distance : 1, ny = distance > 0.001 ? dy / distance : 0;
      const overlap = (min - distance) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const velocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (velocity < 0) {
        const impulse = -velocity * 0.93;
        a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
      }
    }
  }

  private stepBall(actor: BallState, dt: number, leftOmega: number, rightOmega: number) {
    if (actor.drained) return;
    if (actor.relaunchIn > 0) {
      actor.relaunchIn = Math.max(0, actor.relaunchIn - dt);
      if (actor.relaunchIn < 1e-9) {
        actor.relaunchIn = 0; this.replacingLockedBall = false; this.launchActor(actor, actor.launchPower);
      }
      return;
    }
    if (!actor.launched) return;
    actor.saveRemaining = Math.max(0, actor.saveRemaining - dt);
    if (actor.saveRemaining < 1e-9) actor.saveRemaining = 0;
    const b = actor.ball;
    if (this.orbit.advance(b, dt)) return;
    const previous = { x: b.x, y: b.y };
    b.vy += 610 * dt;
    b.vx *= Math.exp(-0.055 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (actor.inLane && b.x < shooterGate.a.x - b.radius - 4) actor.inLane = false;
    if (!actor.inLane && this.orbit.tryEnter(b, previous)) return;
    if (!actor.inLane && !this.multiball && this.blackHoleReady && Math.hypot(b.x - BLACK_HOLE.x, b.y - BLACK_HOLE.y) < BLACK_HOLE.radius - 3) {
      this.capture(actor); return;
    }
    if (!actor.inLane) collideRail(b, shooterGate);
    for (const wall of rails) {
      if (collideRail(b, wall) && wall.bounce === 1.13) {
        b.vy -= 95; this.onRail();
      }
    }
    if (!this.orbit.isOpen) for (const gate of gateRails) collideRail(b, gate);
    for (let i = 0; i < targetRails.length; i++) {
      if (!this.orbit.down[i] && collideRail(b, targetRails[i], undefined, 5)) this.orbit.hitTarget(i);
    }
    bumpers.forEach((bumper, i) => {
      actor.bumperCooldown[i] = Math.max(0, actor.bumperCooldown[i] - dt);
      const dx = b.x - bumper.x, dy = b.y - bumper.y, d = Math.hypot(dx, dy);
      if (d < bumper.radius + b.radius) {
        const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
        b.x = bumper.x + nx * (bumper.radius + b.radius + 0.5);
        b.y = bumper.y + ny * (bumper.radius + b.radius + 0.5);
        const speed = Math.max(440, Math.hypot(b.vx, b.vy) * 1.02);
        b.vx = nx * speed; b.vy = ny * speed;
        if (actor.bumperCooldown[i] === 0) { this.onHit(i); actor.bumperCooldown[i] = 0.12; }
      }
    });
    const leftFlipper = this.flipper(true, flipperRailA);
    const rightFlipper = this.flipper(false, flipperRailB);
    for (let i = 0; i < 2; i++) {
      const isLeft = i === 0;
      const f = isLeft ? leftFlipper : rightFlipper;
      const surface = isLeft ? flipperSurfaceA : flipperSurfaceB;
      const omega = isLeft ? leftOmega : rightOmega;
      const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y;
      const contact = Math.max(0, Math.min(1, ((b.x - f.a.x) * dx + (b.y - f.a.y) * dy) / (70 * 70)));
      surface.x = -omega * dy * contact; surface.y = omega * dx * contact;
      if (collideRail(b, f, surface, 9) && Math.abs(omega) > 1) {
        this.onFlipper(isLeft, Math.hypot(surface.x, surface.y), b.x, b.y);
      }
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 1350) { b.vx *= 1350 / speed; b.vy *= 1350 / speed; }
    if (actor.inLane && b.y > 683 && b.vy > 0) {
      // A failed shot is still the same ball, including whether its save was used.
      this.placeBall(actor); actor.saveRemaining = 0;
    } else if (b.y > HEIGHT + 22) {
      if (actor.saveRemaining > 0 && !this.multiball) {
        this.placeBall(actor); actor.saveAvailable = false; actor.saveRemaining = 0;
        actor.relaunchIn = 0.75; this.onSave();
      } else { actor.launched = false; actor.drained = true; }
    }
  }
}
