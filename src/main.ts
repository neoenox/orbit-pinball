import './style.css';
import './neon.css';
import { Effects } from './effects.ts';
import { Physics, WIDTH, HEIGHT, STEP, rails, bumpers, shooterGate } from './physics.ts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar"><a class="brand" href="./" aria-label="ORBIT ホーム"><span class="brand-mark">◉</span> ORBIT<span class="brand-sub">ARCADE CLUB</span></a><div class="header-actions"><span class="edition">NEON SUPERNOVA <span class="edition-dot"></span> VOL. 001</span><button id="effects" aria-pressed="true">✦ 演出 MAX</button></div></header>
  <main class="layout">
    <section class="intro">
      <div class="eyebrow"><span></span> LIGHT UP THE UNIVERSE</div>
      <h1>ONE MORE<br><span>ORBIT.</span></h1>
      <p class="lead">あと1球、が止まらない。</p>
      <p class="description">狙って、弾いて、もう一度。<br>小さな宇宙で、ハイスコアを目指そう。</p>
      <div class="scoreboard"><div id="chain" class="chain-display" role="status" hidden></div><div class="score-label">YOUR SCORE <span id="multiplier">×1</span></div><div id="score" class="score">000000</div><div class="best-row"><span>♔ PERSONAL BEST</span><strong id="best">000000</strong></div></div>
      <div class="round-row"><div><span class="small-label">BALLS LEFT</span><div id="balls" class="balls" aria-label="残り3球"><i></i><i></i><i></i></div></div><div class="round-status"><span class="small-label">STATUS</span><strong id="status" role="status">READY TO ROLL</strong></div></div>
      <button id="start" class="primary">ゲームをはじめる <span>↗</span></button>
      <div class="utility"><button id="pause" disabled aria-label="一時停止">Ⅱ 一時停止</button><button id="sound" aria-pressed="true">♫ サウンド ON</button></div>
      <p class="local-note">ハイスコアはこのブラウザに保存されます</p>
    </section>
    <section class="machine-area" aria-label="ピンボール台">
      <div class="cabinet"><div class="cabinet-top"><span>ORBIT / 01</span><span class="live-lamp">● FREE PLAY</span></div>
        <div class="playfield"><canvas id="table" width="460" height="760" aria-label="ピンボール。左右矢印でフリッパー、スペース長押しで発射。"></canvas>
          <div id="ball-save" class="ball-save" hidden></div>
          <div id="overlay" class="overlay"><span id="overlay-kicker">WELCOME TO THE CLUB</span><h2 id="overlay-title">準備はいい？</h2><p id="overlay-text">3つのボールで、どこまでいける？</p><button id="overlay-start">PLAY NOW <span>↗</span></button></div>
          <div id="toast" class="toast" role="status"></div>
        </div>
        <div class="cabinet-bottom"><span>KEEP THE BALL IN ORBIT</span><div class="charge-track"><div id="charge"></div></div><span>✦</span></div>
      </div>
      <div class="touch-controls"><button id="left" aria-label="左フリッパー">◀ <span>LEFT</span></button><button id="launch" aria-label="長押しして離すと発射">発射 <span>HOLD</span></button><button id="right" aria-label="右フリッパー"><span>RIGHT</span> ▶</button></div>
    </section>
    <aside class="guide"><div class="guide-heading"><span>HOW TO PLAY</span><span>↙</span></div>
      <div class="instruction"><div class="key-pair"><kbd>←</kbd><kbd>→</kbd></div><h3>ボールを打ち返す</h3><p>左右のフリッパーを操作。<br>A / D キーでも遊べます。</p></div>
      <div class="instruction"><kbd class="wide-key">SPACE <span>⎵</span></kbd><h3>長押しして、発射</h3><p>ためて、離す。<br>長押しするほど強く飛びます。</p><p class="save-tip">発射後5秒以内の落球を救済。<br>各球1回、自動で再発射します。</p></div>
      <div class="mission"><span class="mission-orbit">✳</span><span class="small-label">AIM A LITTLE HIGHER</span><h3>バンパーを狙おう。</h3><p>光るバンパーは100点。<br>10ヒットごとに倍率アップ。<br>最大 ×5 でスコアを伸ばそう。</p></div>
      <div class="pause-hint"><kbd>P</kbd><span>ひと息つく / 再開</span></div>
    </aside>
  </main>
  <footer><span>NO COINS. JUST GOOD TIMES.</span><span>ひと休みを、ハイスコアに。 <span class="footer-star">✳</span></span></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('table');
const ctx = canvas.getContext('2d')!;
const physics = new Physics();
const effects = new Effects();
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
let effectsMax = !reducedMotion;
type State = 'ready' | 'playing' | 'paused' | 'over';
let state: State = 'ready';
let score = 0, best = 0, balls = 3, hits = 0;
let left = false, right = false, charging = false, power = 0, sound = true;
let audio: AudioContext | undefined;
let accumulator = 0, previous = 0, clock = 0, toastTime = 0, shake = 0;
let railSoundTime = 0;
let hitStreak = 0, lastHitTime = -Infinity;
let impact = 0, launchGlow = 0, celebration = 0;
let celebrationText = '';
const trail: { x: number; y: number }[] = [];
const flashes = [0, 0, 0];
const flipperFlashes = [0, 0];
const popups: { x: number; y: number; text: string; life: number }[] = [];
const stars = Array.from({ length: 55 }, (_, i) => ({ x: 36 + (i * 137.51) % 354, y: 62 + (i * 97.13) % 580, phase: i * 2.3 }));
try { best = Math.max(0, Number(localStorage.getItem('orbit-best')) || 0); } catch { /* Storage is optional. */ }

function tone(frequency = 440, duration = 0.12, volume = 0.055) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
  } catch { /* Audio availability must never stop a game. */ }
}

function sync() {
  $('score').textContent = String(score).padStart(6, '0');
  $('best').textContent = String(best).padStart(6, '0');
  $('multiplier').textContent = `×${Math.min(5, 1 + Math.floor(hits / 10))}`;
  $('balls').innerHTML = [0, 1, 2].map(i => `<i class="${i < balls ? '' : 'spent'}"></i>`).join('');
  $('balls').setAttribute('aria-label', `残り${balls}球`);
  $('status').textContent = state === 'ready' ? 'READY TO ROLL' : state === 'paused' ? 'TAKE A BREATHER' : state === 'over' ? 'GAME OVER' : physics.relaunchIn > 0 ? 'BALL SAVED' : physics.launched ? 'IN ORBIT' : 'HOLD SPACE';
  $('pause').textContent = state === 'paused' ? '▷ 再開' : 'Ⅱ 一時停止';
  $<HTMLButtonElement>('pause').disabled = state === 'ready' || state === 'over';
  $('start').innerHTML = `${state === 'ready' ? 'ゲームをはじめる' : 'もう一度はじめる'} <span>↗</span>`;
}
function toast(message: string) { $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = 2.4; }
function clearInput() { left = false; right = false; charging = false; power = 0; }
function start() {
  state = 'playing'; score = 0; hits = 0; balls = 3; clearInput(); trail.length = 0; effects.clear();
  impact = 0; launchGlow = 0; celebration = 0;
  hitStreak = 0; lastHitTime = -Infinity; popups.length = 0; shake = 0; flipperFlashes.fill(0);
  flashes.fill(0); physics.resetBall(); $('overlay').classList.add('hidden'); sync();
  toast('SPACE 長押し → 離して発射'); tone(660, 0.22);
}
function pause() {
  if (state !== 'playing' && state !== 'paused') return;
  state = state === 'playing' ? 'paused' : 'playing'; clearInput();
  $('overlay').classList.toggle('hidden', state === 'playing');
  if (state === 'paused') {
    $('overlay-kicker').textContent = 'TAKE YOUR TIME'; $('overlay-title').textContent = 'ちょっと、ひと休み。';
    $('overlay-text').textContent = 'P キー、または下のボタンで再開'; $('overlay-start').textContent = 'ゲームを再開 ↗';
  }
  sync();
}
function beginCharge() {
  if (state !== 'playing' || physics.launched || physics.relaunchIn > 0 || charging) return;
  charging = true; power = 0; tone(130, 0.08);
}
function releaseCharge() {
  if (!charging) return;
  charging = false;
  if (state === 'playing') physics.launch(power);
  power = 0;
}

physics.onHit = i => {
  const points = 100 * Math.min(5, 1 + Math.floor(hits / 10));
  score += points; hits++;
  hitStreak = clock - lastHitTime <= 2.2 ? hitStreak + 1 : 1; lastHitTime = clock;
  flashes[i] = 1; shake = effectsMax ? 3 : 0; impact = 1;
  const bumper = bumpers[i];
  popups.push({ x: bumper.x, y: bumper.y - bumper.radius - 12, text: `${hitStreak > 1 ? `${hitStreak} HITS · ` : ''}+${points}`, life: 0.85 });
  if (effectsMax) effects.burst(bumper.x, bumper.y, i === 2 ? '#ff5cbf' : '#4cfff0', 1 + Math.min(hitStreak, 5) * 0.13);
  if (hitStreak >= 2) { celebration = 1.1; celebrationText = `${hitStreak} HIT CHAIN`; }
  if (hits % 10 === 0 && hits <= 40) {
    toast(`倍率 UP! ×${Math.min(5, 1 + hits / 10)}`);
    celebration = 1.7; celebrationText = `MULTIPLIER ×${1 + hits / 10}`;
    if (effectsMax) { effects.burst(88, 420, '#ffce70', 1.7); effects.burst(367, 420, '#db85ff', 1.7); }
  }
  saveBest(); sync(); tone(600 + i * 180 + Math.min(hitStreak - 1, 6) * 55, 0.16);
};
physics.onFlipper = (isLeft, speed) => {
  flipperFlashes[isLeft ? 0 : 1] = Math.min(1, speed / 650);
  tone(180 + Math.min(500, speed * 0.35), 0.08, 0.025);
};
physics.onLaunch = () => {
  launchGlow = 1;
  if (effectsMax) effects.burst(423, 683, '#af9aff', 0.55);
  tone(220 + Math.max(0, -physics.ball.vy - 980) / 340 * 300, 0.25);
  if (physics.saveRemaining > 0) toast('5秒間の BALL SAVE · 各球1回');
  sync();
};
physics.onSave = () => {
  clearInput(); trail.length = 0; popups.length = 0; hitStreak = 0; lastHitTime = -Infinity;
  celebration = 1.3; celebrationText = 'BALL SAVED';
  if (effectsMax) effects.burst(228, 707, '#72ffd9', 1.2);
  toast('BALL SAVED! 球数そのまま、自動で再発射'); tone(880, 0.3); sync();
};
physics.onRail = () => {
  if (clock - railSoundTime < 0.1) return;
  railSoundTime = clock; score += 10; saveBest(); sync(); tone(230, 0.06, 0.025);
};
function saveBest() {
  if (score > best) { best = score; try { localStorage.setItem('orbit-best', String(best)); } catch { /* Continue without persistence. */ } }
}
physics.onDrain = () => {
  balls--; clearInput(); trail.length = 0; hitStreak = 0; lastHitTime = -Infinity; tone(150, 0.4);
  if (balls === 0) {
    state = 'over'; $('overlay').classList.remove('hidden');
    $('overlay-kicker').textContent = score > 0 && score >= best ? 'PERSONAL BEST!' : 'NICE ORBIT';
    $('overlay-title').textContent = score.toLocaleString(); $('overlay-text').textContent = 'もう1回、記録を超えてみよう。';
    $('overlay-start').textContent = 'もう一度プレイ ↗';
  } else { physics.resetBall(); toast(`あと${balls}球。SPACE 長押しで発射`); }
  sync();
};

$('start').addEventListener('click', start);
$('overlay-start').addEventListener('click', () => state === 'paused' ? pause() : start());
$('pause').addEventListener('click', pause);
$('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = `♫ サウンド ${sound ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(sound)); if (sound) tone(); });
function syncEffects() {
  document.body.classList.toggle('light-effects', !effectsMax);
  $('effects').textContent = `✦ 演出 ${effectsMax ? 'MAX' : 'LIGHT'}`;
  $('effects').setAttribute('aria-pressed', String(effectsMax));
  effects.clear(); trail.length = 0; shake = 0;
}
$('effects').addEventListener('click', () => { effectsMax = !effectsMax; syncEffects(); });
motionPreference.addEventListener('change', event => {
  reducedMotion = event.matches; effectsMax = !reducedMotion; syncEffects();
});
const keys = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyP', 'Escape']);
window.addEventListener('keydown', e => {
  if (!keys.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space' && e.target instanceof HTMLElement && e.target.closest('button, a') && state !== 'playing') return;
  e.preventDefault(); if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { pause(); return; }
  if (e.code === 'Space' && (state === 'ready' || state === 'over')) start();
  if (state !== 'playing') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { left = true; tone(95, 0.04, 0.02); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { right = true; tone(105, 0.04, 0.02); }
  if (e.code === 'Space') beginCharge();
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') right = false;
  if (e.code === 'Space') releaseCharge();
});
for (const id of ['left', 'right', 'launch']) {
  const button = $(id);
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); button.setPointerCapture(e.pointerId);
    if (state !== 'playing') return;
    if (id === 'left') left = true; else if (id === 'right') right = true; else beginCharge();
    button.classList.add('pressed');
  });
  const release = () => { button.classList.remove('pressed'); if (id === 'left') left = false; else if (id === 'right') right = false; else releaseCharge(); };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', () => { if (id === 'launch') { charging = false; power = 0; } release(); });
  button.addEventListener('lostpointercapture', release);
}
window.addEventListener('blur', () => { clearInput(); if (state === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });

function line(points: number[][], color: string, width = 2, glow = 0) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.stroke(); ctx.shadowBlur = 0;
}
function circle(x: number, y: number, r: number, fill: string, stroke?: string, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function label(text: string, x: number, y: number, size: number, color: string, weight = '500') {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
}
function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== WIDTH * dpr) { canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const backdrop = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, '#0c1230'); backdrop.addColorStop(0.55, '#14102b'); backdrop.addColorStop(1, '#180b29');
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  if (effectsMax && !reducedMotion && shake > 0.2) ctx.translate(Math.sin(clock * 95) * shake, Math.cos(clock * 85) * shake);
  const nebula = ctx.createRadialGradient(228, 280, 25, 228, 280, 255);
  nebula.addColorStop(0, '#672b893a'); nebula.addColorStop(0.55, '#30328322'); nebula.addColorStop(1, '#17113500');
  ctx.fillStyle = nebula; ctx.fillRect(25, 40, 375, 535);
  for (const star of stars) {
    ctx.globalAlpha = effectsMax && !reducedMotion ? 0.25 + (Math.sin(clock * 0.8 + star.phase) + 1) * 0.16 : 0.35;
    circle(star.x, star.y, 0.7 + star.phase % 1, '#c2b4ff');
  }
  ctx.globalAlpha = 1;
  // Orbital engraving: a quiet part of the table, below the physical components.
  ctx.save(); ctx.translate(228, 289); ctx.rotate(-0.5);
  ctx.strokeStyle = '#805de34c'; ctx.lineWidth = 1;
  for (const r of [129, 156, 179]) { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  if (effectsMax) {
    ctx.save(); ctx.translate(228, 287); ctx.rotate(-0.5);
    for (let i = 0; i < 3; i++) {
      const angle = (reducedMotion ? 0 : clock * 0.22) + i * Math.PI * 2 / 3;
      circle(Math.cos(angle) * 173, Math.sin(angle) * 125, 2, ['#5ffff0', '#ff79cf', '#b695ff'][i]);
    }
    ctx.restore();
  }
  line([[17, 600], [17, 148], [42, 75], [107, 27], [353, 27], [418, 66], [453, 138], [453, 739]], '#3a5963', 2);
  line([[39, 463], [39, 155], [61, 99], [116, 58], [349, 58], [393, 88]], '#61fff1', 2.5, effectsMax ? 14 : 3);
  line([[40, 485], [40, 586], [109, 670], [143, 684]], '#ff65b7', 3, effectsMax ? 17 : 3);
  line([[390, 467], [390, 585], [342, 660], [316, 677]], '#bc89ff', 3, effectsMax ? 17 : 3);
  label('O  R  B  I  T', 221, 196, 15, '#8ba4aa', '600');
  for (let i = 0; i < 3; i++) {
    circle(94 + i * 82, 123 - (i === 1 ? 14 : 0), 7, '#263f49', '#6ce8d2', 1.4);
    circle(94 + i * 82, 123 - (i === 1 ? 14 : 0), 2.5, '#6ce8d2');
  }
  for (const wall of rails) {
    line([[wall.a.x, wall.a.y + 3], [wall.b.x, wall.b.y + 3]], '#080f17', 11);
  }
  for (const wall of rails) {
    line([[wall.a.x, wall.a.y], [wall.b.x, wall.b.y]], wall.color ?? '#4c6772', wall.color ? 5 : 6, wall.color ? 6 : 0);
  }
  for (const wall of rails) {
    line([[wall.a.x, wall.a.y - 1], [wall.b.x, wall.b.y - 1]], wall.color ? '#e0eee1' : '#8ca1a4', 1);
  }
  if (!physics.inLane) line([[shooterGate.a.x, shooterGate.a.y], [shooterGate.b.x, shooterGate.b.y]], '#e8b571', 3, 4);
  bumpers.forEach((b, i) => {
    const color = i === 2 ? '#ff63ba' : '#60ffed';
    circle(b.x, b.y + 7, b.radius + 7, '#08121b');
    ctx.shadowBlur = effectsMax ? 22 + flashes[i] * 30 : 5; ctx.shadowColor = color;
    circle(b.x, b.y, b.radius + 4, '#162e38', color, 2); ctx.shadowBlur = 0;
    circle(b.x, b.y, b.radius - 3, effectsMax && flashes[i] > 0.5 ? '#c8ffe8' : '#22324a', color, 3);
    circle(b.x, b.y, b.radius - 10, i === 2 ? '#7a285c' : '#235a66');
    label('✦', b.x, b.y + 9, 27, i === 2 ? '#ffb4ec' : '#a6ffe8');
    if (effectsMax) {
      const angle = (reducedMotion ? 0 : clock * (i === 2 ? -0.45 : 0.35)) + i;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.65;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 11, angle + j * 2.1, angle + j * 2.1 + 0.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
  label('✦', 228, 423, 27, '#e8b571');
  const celebrating = celebration > 0;
  label(celebrating ? '✦ LIGHT IT UP ✦' : 'STAY IN', 228, 463, 11, celebrating ? '#ffd889' : '#a39fcb', '600');
  ctx.shadowColor = '#e277ff'; ctx.shadowBlur = effectsMax ? 16 : 0;
  label(celebrating ? celebrationText : 'ORBIT', 228, 498, celebrating ? 24 : 36, celebrating ? '#fff3ca' : '#eadcff', '800');
  ctx.shadowBlur = 0;
  line([[183, 511], [271, 511]], '#6ce8d2', 1);
  label('100 PTS / BUMPER', 228, 534, 9, '#718f9a');
  for (const side of [true, false]) {
    const f = physics.flipper(side);
    const flash = flipperFlashes[side ? 0 : 1];
    line([[f.a.x, f.a.y + 5], [f.b.x, f.b.y + 5]], '#080f17', 22);
    line([[f.a.x, f.a.y], [f.b.x, f.b.y]], '#ff795f', 19, 9);
    line([[f.a.x, f.a.y - 3], [f.b.x, f.b.y - 3]], flash > 0.25 ? '#fff7db' : '#ffc0a3', 5, flash * 18);
    circle(f.a.x, f.a.y, 5, '#773b36', '#ffb59b');
  }
  label(physics.saveRemaining > 0 ? '✦ BALL SAVE ✦' : 'D R A I N', 228, 740, 10, physics.saveRemaining > 0 ? '#6ce8d2' : '#526d77');
  ctx.save(); ctx.translate(423, 422); ctx.rotate(-Math.PI / 2); label('L A U N C H   ↑', 0, 0, 10, '#8aa4a8'); ctx.restore();
  const pull = power * 25;
  for (let i = 0; i < 7; i++) line([[414, 706 + i * 4 + pull * 0.15], [432, 708 + i * 4 + pull * 0.15]], '#799090', 1.5);
  line([[411, 699 + pull], [435, 699 + pull]], '#e8b571', 5);
  if (effectsMax) {
    effects.draw(ctx);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < trail.length; i++) {
      const intensity = i / trail.length;
      ctx.globalAlpha = intensity * 0.55;
      line([[trail[i - 1].x, trail[i - 1].y], [trail[i].x, trail[i].y]], i < trail.length / 2 ? '#a475ff' : '#59e8ff', intensity * 11, 8);
    }
    ctx.globalAlpha = launchGlow * 0.5;
    line([[423, 185], [423, 678]], '#be9cff', 3, 16);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (state !== 'over') {
    const { x, y, radius } = physics.ball;
    const by = !physics.launched ? y + pull : y;
    circle(x + 3, by + 5, radius + 1, '#07121c');
    if (effectsMax) {
      ctx.shadowColor = '#8dffff'; ctx.shadowBlur = 18;
      circle(x, by, radius + 1, '#4eb8dd77'); ctx.shadowBlur = 0;
      if (charging) circle(x, by, radius + 5 + power * 5, 'transparent', '#e29bff', 2);
    }
    const gradient = ctx.createRadialGradient(x - 3, by - 4, 0, x, by, radius);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.35, '#e3f6f5'); gradient.addColorStop(0.7, '#92acb7'); gradient.addColorStop(1, '#3c6477');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, by, radius, 0, Math.PI * 2); ctx.fill();
  }
  for (const popup of popups) {
    ctx.globalAlpha = Math.min(1, popup.life * 3);
    label(popup.text, popup.x, popup.y - (reducedMotion || !effectsMax ? 0 : (0.85 - popup.life) * 30), effectsMax ? 16 : 13, '#fff6d9', '700');
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function frame(time: number) {
  const dt = Math.min((time - (previous || time)) / 1000, 0.04); previous = time;
  if (state === 'playing') {
    clock += dt;
    if (charging) power = Math.min(1, power + dt * 0.85);
    accumulator += dt;
    while (accumulator >= STEP) { physics.step(STEP, left, right); accumulator -= STEP; if (state !== 'playing') { accumulator = 0; break; } }
    if (physics.launched && effectsMax) { trail.push({ x: physics.ball.x, y: physics.ball.y }); if (trail.length > 18) trail.shift(); }
    effects.update(dt);
    impact = Math.max(0, impact - dt * 3);
    launchGlow = Math.max(0, launchGlow - dt * 1.7);
    celebration = Math.max(0, celebration - dt);
    for (let i = 0; i < 3; i++) flashes[i] = Math.max(0, flashes[i] - dt * 3);
    for (let i = 0; i < 2; i++) flipperFlashes[i] = Math.max(0, flipperFlashes[i] - dt * 7);
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].life -= dt; if (popups[i].life <= 0) popups.splice(i, 1); }
    shake *= Math.exp(-dt * 12);
    toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible');
  } else accumulator = 0;
  const saveDisplay = $('ball-save');
  saveDisplay.hidden = state === 'ready' || state === 'over' || (physics.saveRemaining <= 0 && physics.relaunchIn <= 0);
  saveDisplay.textContent = physics.relaunchIn > 0 ? '✦ BALL SAVED · 自動で再発射' : `✦ BALL SAVE · ${(Math.ceil(physics.saveRemaining * 10) / 10).toFixed(1)}s`;
  $('charge').style.width = `${power * 100}%`;
  document.querySelector<HTMLElement>('.cabinet')!.style.setProperty('--impact', String(effectsMax ? impact : 0));
  document.querySelector('.scoreboard')!.classList.toggle('hit', effectsMax && impact > 0.3);
  $('chain').hidden = state === 'ready' || state === 'over' || hitStreak < 2 || clock - lastHitTime > 2.2;
  $('chain').textContent = `✦ ${hitStreak} HIT CHAIN`;
  $('left').classList.toggle('pressed', left); $('right').classList.toggle('pressed', right);
  draw(); requestAnimationFrame(frame);
}
sync(); syncEffects(); requestAnimationFrame(frame);
