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
export const rails: Rail[] = [
  rail(28, 590, 28, 150), rail(28, 150, 50, 85), rail(50, 85, 115, 40),
  rail(115, 40, 350, 40), rail(350, 40, 407, 73), rail(407, 73, 442, 140),
  rail(442, 140, 442, 735), rail(402, 180, 402, 735),
  rail(28, 590, 105, 683), rail(105, 683, 158, 704),
  rail(402, 590, 351, 674), rail(351, 674, 298, 704),
  rail(72, 460, 72, 574, 0.8, '#6ce8d2'), rail(72, 574, 128, 620, 0.8, '#6ce8d2'),
  rail(380, 460, 380, 574, 0.8, '#6ce8d2'), rail(380, 574, 328, 620, 0.8, '#6ce8d2'),
  rail(113, 515, 113, 566, 0.8, '#ff795f'), rail(113, 566, 166, 610, 1.13, '#ff795f'), rail(166, 610, 113, 515, 1.13, '#ff795f'),
  rail(341, 515, 341, 566, 0.8, '#ff795f'), rail(341, 566, 288, 610, 1.13, '#ff795f'), rail(288, 610, 341, 515, 1.13, '#ff795f'),
  rail(134, 105, 134, 151, 0.85, '#6ce8d2'), rail(217, 90, 217, 148, 0.85, '#6ce8d2'), rail(300, 105, 300, 151, 0.85, '#6ce8d2'),
];

export function collideRail(ball: Ball, wall: Rail, surface: Vec = { x: 0, y: 0 }, thickness = 4): boolean {
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

export class Physics {
  ball: Ball = { x: 423, y: 683, vx: 0, vy: 0, radius: 8 };
  launched = false;
  inLane = true;
  leftAngle = 0.42;
  rightAngle = Math.PI - 0.42;
  bumperCooldown = [0, 0, 0];
  onHit: (index: number) => void = () => {};
  onRail: () => void = () => {};
  onDrain: () => void = () => {};

  resetBall() {
    this.ball = { x: 423, y: 683, vx: 0, vy: 0, radius: 8 };
    this.launched = false; this.inLane = true;
    this.bumperCooldown.fill(0);
  }

  launch(power: number) {
    if (this.launched) return;
    this.launched = true;
    this.ball.vy = -(980 + Math.min(1, Math.max(0, power)) * 340);
  }

  flipper(left: boolean): Rail {
    const angle = left ? this.leftAngle : this.rightAngle;
    const a = { x: left ? 145 : 310, y: 659 };
    return { a, b: { x: a.x + Math.cos(angle) * 70, y: a.y + Math.sin(angle) * 70 }, bounce: 0.78 };
  }

  step(dt: number, left: boolean, right: boolean) {
    const oldLeft = this.leftAngle, oldRight = this.rightAngle;
    const move = (current: number, target: number) => current + Math.max(-dt * 16, Math.min(dt * 16, target - current));
    this.leftAngle = move(this.leftAngle, left ? -0.5 : 0.42);
    this.rightAngle = move(this.rightAngle, right ? Math.PI + 0.5 : Math.PI - 0.42);
    if (!this.launched) return;
    const b = this.ball;
    b.vy += 610 * dt;
    b.vx *= Math.exp(-0.055 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (this.inLane && b.y < 163) {
      this.inLane = false; b.x = 386; b.vx = -340; b.vy = -250;
    }
    // A one-way gate closes the shooter lane after the ball enters the table.
    if (!this.inLane && b.x > 388 && b.y < 190) { b.x = 388; b.vx = -Math.abs(b.vx); }
    for (const wall of rails) {
      if (collideRail(b, wall) && wall.bounce === 1.13) {
        b.vy -= 95; this.onRail();
      }
    }
    bumpers.forEach((bumper, i) => {
      this.bumperCooldown[i] = Math.max(0, this.bumperCooldown[i] - dt);
      const dx = b.x - bumper.x, dy = b.y - bumper.y, d = Math.hypot(dx, dy);
      if (d < bumper.radius + b.radius) {
        const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
        b.x = bumper.x + nx * (bumper.radius + b.radius + 0.5);
        b.y = bumper.y + ny * (bumper.radius + b.radius + 0.5);
        const speed = Math.max(440, Math.hypot(b.vx, b.vy) * 1.02);
        b.vx = nx * speed; b.vy = ny * speed;
        if (this.bumperCooldown[i] === 0) { this.onHit(i); this.bumperCooldown[i] = 0.12; }
      }
    });
    for (const isLeft of [true, false]) {
      const f = this.flipper(isLeft);
      const omega = ((isLeft ? this.leftAngle : this.rightAngle) - (isLeft ? oldLeft : oldRight)) / dt;
      const surface = { x: -omega * (b.y - f.a.y), y: omega * (b.x - f.a.x) };
      collideRail(b, f, surface, 9);
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 1350) { b.vx *= 1350 / speed; b.vy *= 1350 / speed; }
    if (this.inLane && b.y > 683 && b.vy > 0) this.resetBall();
    else if (b.y > HEIGHT + 22) { this.launched = false; this.onDrain(); }
  }
}
