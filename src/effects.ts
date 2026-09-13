type Particle = { x: number; y: number; vx: number; vy: number; life: number; duration: number; color: string };
type Ring = { x: number; y: number; radius: number; life: number; duration: number; color: string };

/** Decorative effects have bounded lifetimes and never touch the ball simulation. */
export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];

  clear() { this.particles.length = 0; this.rings.length = 0; }

  burst(x: number, y: number, color: string, strength = 1) {
    const count = Math.round(26 + strength * 12);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + Math.random() * 0.13;
      const speed = 90 + Math.random() * 230 * strength;
      const duration = 0.35 + Math.random() * 0.55;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: duration, duration, color: i % 5 === 0 ? '#fff5bc' : color });
    }
    for (let i = 0; i < 2; i++) this.rings.push({ x, y, radius: 28 + i * 9, life: 0.6 + i * 0.16, duration: 0.6 + i * 0.16, color });
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
    if (this.rings.length > 12) this.rings.splice(0, this.rings.length - 12);
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = Math.exp(-dt * 2);
      p.vx *= drag; p.vy *= drag; p.life -= dt;
    }
    for (const ring of this.rings) { ring.radius += dt * 135; ring.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    this.rings = this.rings.filter(r => r.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const ring of this.rings) {
      const alpha = ring.life / ring.duration;
      ctx.globalAlpha = alpha * 0.75; ctx.strokeStyle = ring.color; ctx.lineWidth = alpha * 3;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of this.particles) {
      const alpha = p.life / p.duration;
      ctx.globalAlpha = alpha; ctx.strokeStyle = p.color; ctx.lineWidth = alpha * 2.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
    }
    ctx.restore();
  }
}
