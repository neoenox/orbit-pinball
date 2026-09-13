import type { Ball, Vec } from './physics.ts';

export type Side = 'left' | 'right';
export const targets = [174, 228, 282].map(x => ({ x, y: 411, width: 28 }));
export const entrances = { left: { x: 82, y: 375 }, right: { x: 373, y: 375 } };
const leftRoute = [
  { x: 82, y: 375 }, { x: 72, y: 200 }, { x: 98, y: 124 },
  { x: 175, y: 91 }, { x: 280, y: 91 }, { x: 357, y: 124 },
  { x: 383, y: 200 }, { x: 373, y: 375 }, { x: 369, y: 480 },
  { x: 338, y: 557 }, { x: 282, y: 620 },
];

function smooth(points: Vec[]): Vec[] {
  const result: Vec[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i];
    const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const value = (k: 'x' | 'y') => 0.5 * ((2 * b[k]) + (-a[k] + c[k]) * t +
        (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
      result.push({ x: value('x'), y: value('y') });
    }
  }
  return [...result, points[points.length - 1]];
}
const controlPoints = (side: Side) => side === 'left' ? leftRoute : leftRoute.map(p => ({ x: 455 - p.x, y: p.y }));
export const orbitPaths = { left: smooth(controlPoints('left')), right: smooth(controlPoints('right')) };
type Lap = { side: Side; path: Vec[]; segment: number; offset: number; speed: number; award: number };

export class OrbitCourse {
  down = [false, false, false];
  openRemaining = 0;
  laps = 0;
  active: Lap | null = null;
  onTarget: (index: number) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  onEnter: (side: Side) => void = () => {};
  onComplete: (points: number, side: Side) => void = () => {};

  reset() {
    this.down.fill(false); this.openRemaining = 0; this.laps = 0; this.active = null;
  }

  hitTarget(index: number) {
    if (index < 0 || index >= this.down.length || this.down[index] || this.openRemaining > 0) return;
    this.down[index] = true; this.onTarget(index);
    if (this.down.every(Boolean)) { this.openRemaining = 15; this.laps = 0; this.onOpen(); }
  }

  tick(dt: number) {
    if (this.openRemaining <= 0) return;
    this.openRemaining = Math.max(0, this.openRemaining - dt);
    if (this.openRemaining < 1e-9) {
      this.openRemaining = 0; this.down.fill(false); this.laps = 0; this.onClose();
    }
  }

  tryEnter(ball: Ball, previous: Vec): boolean {
    if (this.openRemaining <= 0 || this.active || ball.vy >= -80) return false;
    for (const side of ['left', 'right'] as const) {
      const mouth = entrances[side];
      if (previous.y < mouth.y || ball.y > mouth.y || Math.abs(ball.x - mouth.x) > 24 - ball.radius) continue;
      // Use the actual crossing point so an off-centre shot never snaps to a rail.
      const path = smooth([{ x: ball.x, y: ball.y }, ...controlPoints(side).slice(1)]);
      this.active = { side, path, segment: 0, offset: 0, speed: Math.max(600, Math.min(850, Math.hypot(ball.vx, ball.vy))), award: 500 * Math.min(4, this.laps + 1) };
      this.onEnter(side); return true;
    }
    return false;
  }

  advance(ball: Ball, dt: number): boolean {
    const lap = this.active;
    if (!lap) return false;
    let remaining = lap.speed * dt;
    while (lap.segment < lap.path.length - 1) {
      const a = lap.path[lap.segment], b = lap.path[lap.segment + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const available = length - lap.offset;
      if (remaining < available && length > 0) {
        lap.offset += remaining;
        ball.x = a.x + (b.x - a.x) * lap.offset / length;
        ball.y = a.y + (b.y - a.y) * lap.offset / length;
        ball.vx = (b.x - a.x) / length * lap.speed; ball.vy = (b.y - a.y) / length * lap.speed;
        return true;
      }
      remaining -= available; lap.segment++; lap.offset = 0;
    }
    const end = lap.path[lap.path.length - 1];
    ball.x = end.x; ball.y = end.y;
    ball.vx = lap.side === 'left' ? -130 : 130; ball.vy = 290;
    this.active = null;
    if (this.openRemaining > 0) this.laps++;
    this.onComplete(lap.award, lap.side);
    return true;
  }
}
