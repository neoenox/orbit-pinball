import { entrances, orbitPaths, targets, type OrbitCourse } from './orbit.ts';

export function drawOrbit(ctx: CanvasRenderingContext2D, course: OrbitCourse, clock: number, animate: boolean) {
  ctx.save();
  const open = course.isOpen;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of ['left', 'right'] as const) {
    const points = orbitPaths[side];
    const active = course.hasFlightOn(side);
    const color = side === 'left' ? '#61ffe4' : '#d9a0ff';
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = open || active ? color : '#666887'; ctx.globalAlpha = open || active ? 0.55 : 0.28;
    ctx.lineWidth = 23; ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#0c1325'; ctx.lineWidth = 18; ctx.stroke();
    ctx.globalAlpha = active ? 0.9 : open ? 0.6 : 0.22;
    ctx.strokeStyle = color; ctx.lineWidth = active ? 3 : 1.5;
    ctx.setLineDash(open || active ? [10, 15] : [2, 14]);
    ctx.lineDashOffset = animate && (open || active) ? -clock * 45 : 0;
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const side of ['left', 'right'] as const) {
    const mouth = entrances[side];
    ctx.fillStyle = '#0b1028'; ctx.fillRect(mouth.x - 26, mouth.y - 7, 52, 14);
    ctx.strokeStyle = open ? '#99ffb0' : '#ff749f'; ctx.lineWidth = 3;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = animate ? 10 : 0;
    if (open) {
      for (const sign of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(mouth.x + sign * 26, mouth.y + 4);
        ctx.lineTo(mouth.x + sign * 26, mouth.y - 19); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(mouth.x - 24, mouth.y); ctx.lineTo(mouth.x + 24, mouth.y); ctx.stroke();
      for (let i = -16; i <= 16; i += 8) {
        ctx.beginPath(); ctx.moveTo(mouth.x + i - 3, mouth.y + 4); ctx.lineTo(mouth.x + i + 3, mouth.y - 4); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.font = '700 9px "Segoe UI", sans-serif';
    ctx.fillStyle = open ? '#c9ffcf' : '#e5a5c3';
    ctx.fillText(course.supernova ? 'JACKPOT ↑' : open ? 'SHOOT ↑' : 'LOCKED', mouth.x, mouth.y - 17);
    ctx.fillStyle = '#b9b1df'; ctx.font = '8px "Segoe UI", sans-serif';
    ctx.fillText(side === 'left' ? 'L ORBIT' : 'R ORBIT', mouth.x, mouth.y + 21);
    if (open) {
      ctx.strokeStyle = '#8bffc8'; ctx.globalAlpha = 0.75;
      for (const y of [mouth.y + 42, mouth.y + 55]) {
        ctx.beginPath(); ctx.moveTo(mouth.x - 7, y); ctx.lineTo(mouth.x, y - 7); ctx.lineTo(mouth.x + 7, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

export function drawShields(ctx: CanvasRenderingContext2D, course: OrbitCourse) {
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = '600 9px "Segoe UI", sans-serif'; ctx.fillStyle = '#d3b9f4';
  ctx.fillText('S H I E L D', 228, 390);
  targets.forEach((target, i) => {
    const down = course.down[i];
    ctx.fillStyle = down ? '#15362c' : '#ad4773';
    ctx.strokeStyle = down ? '#68cfa0' : '#ffb3dc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(target.x - target.width / 2, target.y - (down ? 3 : 7), target.width, down ? 6 : 14, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = down ? '#9bfbd0' : '#fff0f9';
    ctx.font = '700 10px "Segoe UI", sans-serif';
    ctx.fillText(down ? '✓' : String(i + 1), target.x, down ? target.y + 18 : target.y + 4);
  });
  ctx.restore();
}
