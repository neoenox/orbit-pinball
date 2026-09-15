import type { Ball, Vec } from './physics.ts';
import { orbitAward, type OrbitAward } from './scoring.ts';

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
type Lap = { side: Side; path: Vec[]; segment: number; offset: number; speed: number; award: OrbitAward };

export class OrbitCourse {
  down = [false, false, false];
  openRemaining = 0;
  laps = 0;
  private flights = new Map<Ball, Lap>();
  supernova = false;
  get active(): Lap | null { return this.flights.values().next().value ?? null; }
  get isOpen() { return this.supernova || this.openRemaining > 0; }
  hasFlight(ball: Ball) { return this.flights.has(ball); }
  hasFlightOn(side: Side) {
    for (const lap of this.flights.values()) if (lap.side === side) return true;
    return false;
  }
  onTarget: (index: number) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  onEnter: (side: Side) => void = () => {};
  onComplete: (award: OrbitAward, ball: Ball) => void = () => {};
  onNormalLap: () => void = () => {};

  reset() {
    this.down.fill(false); this.openRemaining = 0; this.laps = 0; this.flights.clear(); this.supernova = false;
  }

  setSupernova(enabled: boolean) {
    this.supernova = enabled; this.down.fill(enabled); this.openRemaining = 0; this.laps = 0;
    // A surviving ball already on a ramp completes the lap at its admitted award.
  }

  hitTarget(index: number) {
    if (index < 0 || index >= this.down.length || this.down[index] || this.isOpen) return;
    this.down[index] = true; this.onTarget(index);
    if (this.down.every(Boolean)) { this.openRemaining = 15; this.laps = 0; this.onOpen(); }
  }

  tick(dt: number) {
    if (this.supernova || this.openRemaining <= 0) return;
    this.openRemaining = Math.max(0, this.openRemaining - dt);
    if (this.openRemaining < 1e-9) {
      this.openRemaining = 0; this.down.fill(false); this.laps = 0; this.onClose();
    }
  }

  tryEnter(ball: Ball, previous: Vec): boolean {
    if (!this.isOpen || this.hasFlight(ball) || ball.vy >= -80) return false;
    for (const side of ['left', 'right'] as const) {
      const mouth = entrances[side];
      if (previous.y < mouth.y || ball.y > mouth.y || Math.abs(ball.x - mouth.x) > 24 - ball.radius) continue;
      // Use the actual crossing point so an off-centre shot never snaps to a rail.
      const path = smooth([{ x: ball.x, y: ball.y }, ...controlPoints(side).slice(1)]);
      // Left ramp grows shared points escalation; right ramp pays a fixed charge instead.
      this.flights.set(ball, { side, path, segment: 0, offset: 0, speed: Math.max(600, Math.min(850, Math.hypot(ball.vx, ball.vy))), award: orbitAward(side, this.laps, this.supernova) });
      this.onEnter(side); return true;
    }
    return false;
  }

  advance(ball: Ball, dt: number): boolean {
    const lap = this.flights.get(ball);
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
    this.flights.delete(ball);
    // Only the left (points) ramp grows the escalation; the right (charge) ramp leaves it alone.
    if (this.openRemaining > 0 && lap.side === 'left') this.laps++;
    if (!lap.award.jackpot) this.onNormalLap();
    this.onComplete(lap.award, ball);
    return true;
  }
}
