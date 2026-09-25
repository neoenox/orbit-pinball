import type { Ball } from './physics.ts';

export type Skill = 'MULTIBALL' | 'POWER' | 'CHAIN' | 'SHIELD';
export type EnemyKind = 'Drone' | 'Shooter' | 'Tank' | 'Guardian Core';
export type Enemy = { id: number; kind: EnemyKind; x: number; y: number; hp: number; maxHp: number; attackEvery: number; attackDamage: number; attackIn: number; hitFlash: number };
export type Projectile = { x: number; y: number; vx: number; vy: number; damage: number };
export type CombatStatus = 'ready' | 'playing' | 'choice' | 'clear' | 'gameover';

const stats: Record<EnemyKind, { hp: number; every: number; damage: number }> = {
  Drone: { hp: 20, every: 3, damage: 5 }, Shooter: { hp: 35, every: 5, damage: 10 },
  Tank: { hp: 80, every: 8, damage: 20 }, 'Guardian Core': { hp: 300, every: 5, damage: 10 },
};
const waves: EnemyKind[][] = [
  ['Drone', 'Drone'], ['Drone', 'Drone', 'Shooter'], ['Shooter', 'Shooter', 'Tank'], ['Guardian Core'],
];
const skillOrder: Skill[] = ['MULTIBALL', 'POWER', 'CHAIN', 'SHIELD'];
const skillText: Record<Skill, string> = {
  MULTIBALL: '追加ボール +1', POWER: 'ボールダメージ +50%', CHAIN: '近くの敵へ50%連鎖', SHIELD: '被ダメージ -30%',
};

export class CombatStage {
  status: CombatStatus = 'ready';
  hp = 100;
  wave = 1;
  combo = 0;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  skills: Record<Skill, number> = { MULTIBALL: 0, POWER: 0, CHAIN: 0, SHIELD: 0 };
  choices: Skill[] = [];
  lastDamage = 0;
  onHit: (enemy: Enemy, damage: number, killed: boolean) => void = () => {};
  onAttack: (enemy: Enemy) => void = () => {};
  onPlayerHit: (damage: number) => void = () => {};
  onWave: (wave: number) => void = () => {};
  onCombo: (combo: number) => void = () => {};
  private hitCooldown = new Map<Ball, number>();

  start() { this.hp = 100; this.wave = 1; this.combo = 0; this.lastDamage = 0; this.projectiles = []; this.hitCooldown.clear(); this.skills = { MULTIBALL: 0, POWER: 0, CHAIN: 0, SHIELD: 0 }; this.status = 'playing'; this.spawnWave(); }
  private spawnWave() {
    this.enemies = waves[this.wave - 1].map((kind, i) => {
      const s = stats[kind];
      return { id: i, kind, x: kind === 'Guardian Core' ? 228 : [130, 228, 326][i], y: kind === 'Guardian Core' ? 190 : 168 + (i % 2) * 78, hp: s.hp, maxHp: s.hp, attackEvery: s.every, attackDamage: s.damage, attackIn: s.every, hitFlash: 0 };
    });
    this.onWave(this.wave);
  }
  get damage() { return 10 * (1 + this.skills.POWER * 0.5); }
  get enemyDamageScale() { return Math.pow(0.7, this.skills.SHIELD); }
  get extraBalls() { return this.skills.MULTIBALL; }
  get skillSummary() { return skillOrder.filter(skill => this.skills[skill] > 0).map(skill => `${skill} Lv${this.skills[skill]} · ${skillText[skill]}`); }

  step(dt: number, balls: readonly Ball[]) {
    if (this.status !== 'playing') return;
    for (const enemy of this.enemies) {
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackIn -= dt;
      if (enemy.attackIn <= 0) {
        enemy.attackIn += enemy.kind === 'Guardian Core' && enemy.hp <= enemy.maxHp / 2 ? 3 : enemy.attackEvery;
        const shotY = enemy.y + 15, shotSpeed = 240, travelTime = (650 - shotY) / shotSpeed;
        this.projectiles.push({ x: enemy.x, y: shotY, vx: (228 - enemy.x) / travelTime, vy: shotSpeed, damage: enemy.attackDamage });
        this.onAttack(enemy);
      }
      if (enemy.kind === 'Guardian Core') enemy.attackEvery = enemy.hp <= enemy.maxHp / 2 ? 3 : 5;
    }
    for (const shot of this.projectiles) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; }
    for (const [ball, cooldown] of this.hitCooldown) cooldown <= dt ? this.hitCooldown.delete(ball) : this.hitCooldown.set(ball, cooldown - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      if (shot.y >= 650) {
        const damage = shot.damage * this.enemyDamageScale;
        this.hp = Math.max(0, Math.round((this.hp - damage) * 10) / 10); this.lastDamage = 0.45; this.onPlayerHit(damage); this.projectiles.splice(i, 1);
        if (this.hp === 0) { this.status = 'gameover'; return; }
      } else if (shot.y > 760 || shot.x < 24 || shot.x > 436) this.projectiles.splice(i, 1);
    }
    this.lastDamage = Math.max(0, this.lastDamage - dt);
    for (const ball of balls) {
      if (this.hitCooldown.has(ball)) continue;
      const target = this.enemies.find(enemy => Math.hypot(ball.x - enemy.x, ball.y - enemy.y) < (enemy.kind === 'Guardian Core' ? 55 : 34));
      if (!target) continue;
      this.hit(target, this.damage);
      ball.vy = -Math.abs(ball.vy || 420) * 0.85;
      ball.vx += (ball.x - target.x) * 4 + (target.id % 2 ? 70 : -70);
      this.hitCooldown.set(ball, 0.28);
      if (this.status !== 'playing') break;
    }
  }
  private hit(target: Enemy, damage: number, allowChain = true) {
    target.hp = Math.max(0, target.hp - damage); target.hitFlash = 0.16; this.combo++; this.onCombo(this.combo);
    const killed = target.hp === 0;
    this.onHit(target, damage, killed);
    if (killed) this.enemies = this.enemies.filter(enemy => enemy !== target);
    if (allowChain && this.skills.CHAIN > 0) {
      const next = this.enemies.filter(enemy => enemy !== target).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
      if (next && Math.hypot(next.x - target.x, next.y - target.y) < 175) this.hit(next, Math.max(1, Math.round(damage * 0.5)), false);
    }
    if (this.enemies.length === 0) {
      if (this.wave === 4) this.status = 'clear';
      else { this.status = 'choice'; this.choices = [...skillOrder].sort((a, b) => this.skills[a] - this.skills[b]).slice(0, 3); }
    }
  }
  choose(skill: Skill) {
    if (this.status !== 'choice' || !this.choices.includes(skill)) return false;
    this.skills[skill]++; this.wave++; this.status = 'playing'; this.spawnWave(); return true;
  }
}

export { skillText };
