import './style.css';
import './neon.css';
import { Effects } from './effects.ts';
import { drawOrbit, drawShields } from './orbit-renderer.ts';
import { entrances, targets } from './orbit.ts';
import { Physics, BLACK_HOLE, WIDTH, HEIGHT, STEP, rails, combatRails, combatBumpers, bumpers, shooterGate } from './physics.ts';
import type { Ball } from './physics.ts';
import { Scoring, ORBIT_CHARGE_HITS, ORBIT_LAP_BASE, ORBIT_LAP_MAX_STEPS, ORBIT_CHARGE_POINTS, RAIL_BONUS, TARGET_POINTS } from './scoring.ts';
import { CombatStage, skillText } from './combat.ts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar"><a class="brand" href="./" aria-label="ORBIT ホーム"><span class="brand-mark">◉</span> ORBIT<span class="brand-sub">ARCADE CLUB</span></a><div class="header-actions"><span class="edition">NEON SUPERNOVA <span class="edition-dot"></span> VOL. 001</span><button id="effects" aria-pressed="true">✦ 演出 MAX</button></div></header>
  <main class="layout">
    <section class="intro">
      <div class="eyebrow"><span></span> LIGHT UP THE UNIVERSE</div>
      <h1>ONE MORE<br><span>ORBIT.</span></h1>
      <p class="lead">FIRST CONTACT</p>
      <p class="description">敵を撃破してウェーブを突破。<br>コアHPを守り、Guardian Coreを倒そう。</p>
      <section id="combat-hud" class="combat-hud" aria-label="ステージ状況" hidden>
        <div class="combat-hud-heading"><span id="combat-wave">WAVE 1 / 4</span><strong id="combat-combo">COMBO ×0</strong></div>
        <div class="hp-caption"><span>PLAYER CORE</span><span id="combat-hp-text">100 / 100</span></div>
        <div class="hp-track"><div id="combat-hp"></div></div>
        <div id="combat-skills" class="combat-skills">取得スキルなし</div>
      </section>
      <div class="scoreboard"><div id="chain" class="chain-display" role="status" hidden></div><div class="score-label">YOUR SCORE <span id="multiplier">×1</span></div><div id="score" class="score">000000</div><div id="score-gain" class="score-gain" hidden></div><div class="best-row"><span>♔ PERSONAL BEST</span><strong id="best">000000</strong></div></div>
      <div class="round-row"><div><span class="small-label">BALLS LEFT</span><div id="balls" class="balls" aria-label="残り3球"><i></i><i></i><i></i></div></div><div class="round-status"><span class="small-label">STATUS</span><strong id="status" role="status">READY TO ROLL</strong></div></div>
      <button id="stage-start" class="primary stage-start">FIRST CONTACT を開始 <span>↗</span></button>
      <button id="start" class="primary">ゲームをはじめる <span>↗</span></button>
      <div class="utility"><button id="pause" disabled aria-label="一時停止">Ⅱ 一時停止</button><button id="sound" aria-pressed="true">♫ サウンド ON</button></div>
      <p class="local-note">ハイスコアはこのブラウザに保存されます</p>
    </section>
    <section class="machine-area" aria-label="ピンボール台">
      <div class="cabinet"><div class="cabinet-top"><span>ORBIT / 01</span><span id="orbit-state" class="live-lamp">SHIELD 0/3</span></div>
        <div id="reward-progress" class="reward-progress" hidden><span id="multiplier-progress"></span><strong id="mission-progress"></strong></div>
        <div class="playfield"><canvas id="table" width="460" height="760" aria-label="ピンボール。左右矢印でフリッパー、スペース長押しで発射。"></canvas>
          <div id="ball-save" class="ball-save" hidden></div>
          <div id="overlay" class="overlay"><span id="overlay-kicker">WELCOME TO THE CLUB</span><h2 id="overlay-title">準備はいい？</h2><p id="overlay-text">3つのボールで、どこまでいける？</p><button id="overlay-start">PLAY NOW <span>↗</span></button></div>
          <div id="toast" class="toast" role="status"></div>
          <div id="reward" class="reward" role="status" hidden><strong id="reward-title"></strong><span id="reward-detail"></span></div>
          <section id="skill-choice" class="skill-choice" aria-labelledby="skill-choice-title" hidden>
            <span class="skill-kicker">WAVE CLEAR</span><h2 id="skill-choice-title">スキルを選択</h2>
            <p>次のウェーブに1つ持ち込める</p><div id="skill-options" class="skill-options"></div>
          </section>
        </div>
        <div class="cabinet-bottom"><span id="nova-state" role="status">LOCK 0/2 · 周回で穴を開放</span><div class="charge-track"><div id="charge"></div></div><span>✦</span></div>
      </div>
      <div class="touch-controls"><button id="left" aria-label="左フリッパー">◀ <span>LEFT</span></button><button id="launch" aria-label="長押しして離すと発射">発射 <span>HOLD</span></button><button id="right" aria-label="右フリッパー"><span>RIGHT</span> ▶</button></div>
    </section>
    <aside class="guide"><div class="guide-heading"><span>HOW TO PLAY</span><span>↙</span></div>
      <div class="instruction"><div class="key-pair"><kbd>←</kbd><kbd>→</kbd></div><h3>ボールを打ち返す</h3><p>左右のフリッパーを操作。<br>A / D キーでも遊べます。</p></div>
      <div class="instruction"><kbd class="wide-key">SPACE <span>⎵</span></kbd><h3>長押しして、発射</h3><p>ためて、離す。<br>長押しするほど強く飛びます。</p><p class="save-tip">発射後5秒以内の落球を救済。<br>各球1回、自動で再発射します。</p><p class="combat-tip">落球時は0.8秒後に再射出。<br>コアHPが0になるとゲームオーバー。</p></div>
      <div class="mission"><span class="mission-orbit">✳</span><span class="small-label">IGNITE THE SUPERNOVA</span><h3>2球ためて、超新星！</h3><p>的を3枚倒す → 15秒間ランプ開放。<br>周回すると中央の穴が開く。<br>穴に入れて保管、もう一度周回！</p><p class="orbit-reward">左は得点育成 500→2,000点<br>右は固定1,000点+倍率+5チャージ<br>2球保管 → 3球同時、周回5,000→25,000点！<br>3 / 5 / 8 / 12 HITでコンボボーナス。</p><p>保管時は残り球を消費せず補充。<br>バンパー10ヒットで倍率アップ。<br>ラスト1球はバンパー2倍、ギリギリ救済はDANGER +50!</p></div>
      <div class="pause-hint"><kbd>P</kbd><span>ひと息つく / 再開</span></div>
    </aside>
  </main>
  <footer><span>NO COINS. JUST GOOD TIMES.</span><span>ひと休みを、ハイスコアに。 <span class="footer-star">✳</span></span></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('table');
const COMBAT_VIEW_WIDTH = 720, COMBAT_VIEW_HEIGHT = 640;
const cabinet = document.querySelector<HTMLElement>('.cabinet')!;
const scoreboard = document.querySelector<HTMLElement>('.scoreboard')!;
const ctx = canvas.getContext('2d')!;
// Static background (backdrop, nebula, stars, engraving) is baked once per
// canvas resize instead of being re-rendered every frame.
const staticLayer = document.createElement('canvas');
const staticCtx = staticLayer.getContext('2d')!;
let staticDirty = true;
const physics = new Physics();
const combat = new CombatStage();
const effects = new Effects();
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
let effectsMax = !reducedMotion;
type State = 'ready' | 'playing' | 'paused' | 'over';
let state: State = 'ready';
let combatMode = false;
let relaunchTimer = 0;
let finishShown = false;
let score = 0, best = 0, bestAtStart = 0, balls = 3;
const scoring = new Scoring();
let left = false, right = false, charging = false, power = 0, sound = true;
let audio: AudioContext | undefined;
let accumulator = 0, previous = 0, clock = 0, toastTime = 0, shake = 0;
let railSoundTime = 0;
let impact = 0, launchGlow = 0, celebration = 0;
let celebrationText = '';
let rewardTime = 0, rewardPriority = 0, scorePulse = 0, scoreGainTime = 0, scoreGain = 0, scoreGainPriority = 0;
let novaIntro = 0, lockDim = 0;
let pendingJackpot: { title: string; detail: string; kind: string; priority: number; duration: number } | null = null;
const trails = new Map<Ball, { x: number; y: number }[]>();
const flashes = [0, 0, 0];
const flipperFlashes = [0, 0];
const popups: { x: number; y: number; text: string; life: number }[] = [];
const stars = Array.from({ length: 55 }, (_, i) => ({ x: 36 + (i * 137.51) % 354, y: 62 + (i * 97.13) % 580, phase: i * 2.3 }));
try { best = Math.max(0, Number(localStorage.getItem('orbit-best')) || 0); } catch { /* Storage is optional. */ }
function applyScoring(result: { tierIncreased: boolean; multiplier: number }) {
  if (result.tierIncreased) {
    toast(`倍率 UP! ×${result.multiplier}`);
    celebration = 1.7; celebrationText = `MULTIPLIER ×${result.multiplier}`;
    showReward(`×${result.multiplier}${result.multiplier === 5 ? ' MAX!!' : ' MULTIPLIER'}`, 'バンパー得点アップ', 'multiplier', 1);
    rewardSound('multiplier');
    if (effectsMax && !reducedMotion) { effects.burst(88, 420, '#ffce70', 1.7); effects.burst(367, 420, '#db85ff', 1.7); }
  }
}

function tone(frequency = 440, duration = 0.12, volume = 0.055, delay = 0, endFrequency = frequency * 0.5) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const at = audio.currentTime + delay;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    gain.gain.setValueAtTime(0, audio.currentTime); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Audio availability must never stop a game. */ }
}

function rewardSound(kind: 'combo' | 'multiplier' | 'lock' | 'nova' | 'jackpot', level = 1) {
  if (kind === 'combo') [660, 830, 990].slice(0, Math.min(3, level + 1)).forEach((f, i) => tone(f, 0.2, 0.035, i * 0.065, f * 1.2));
  if (kind === 'multiplier') { tone(160, 0.3, 0.045); tone(1040, 0.25, 0.04, 0.06, 1300); }
  if (kind === 'lock') { tone(220, 0.5, 0.06, 0, 40); tone(110, 0.4, 0.025, 0.1, 35); }
  if (kind === 'nova') { tone(120, 0.35, 0.045, 0, 1200); tone(70, 0.5, 0.065, 0.3); [523, 659, 784].forEach(f => tone(f, 0.55, 0.025, 0.4, f)); }
  if (kind === 'jackpot') [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.45, 0.025, i * 0.035, f));
}

function showReward(title: string, detail: string, kind: string, priority: number, duration = 1.15) {
  if (rewardTime > 0 && priority < rewardPriority) {
    // A quick first lap can finish during the nova intro. Show its jackpot next.
    if (kind === 'jackpot') pendingJackpot = { title, detail, kind, priority, duration };
    return;
  }
  rewardTime = duration; rewardPriority = priority;
  $('reward-title').textContent = title; $('reward-detail').textContent = detail;
  $('reward').dataset.kind = kind; $('reward').hidden = false;
}
function clearReward() {
  rewardTime = 0; rewardPriority = 0; novaIntro = 0; lockDim = 0;
  pendingJackpot = null;
  $('reward').hidden = true;
}
function addScore(points: number, jackpot = false) {
  score += points;
  const priority = jackpot ? 3 : points >= 1000 ? 2 : 1;
  // Group rapid additions; small hits must not erase a jackpot's stronger feedback.
  scoreGain = scoreGainTime > 0 ? scoreGain + points : points;
  scoreGainPriority = scoreGainTime > 0 ? Math.max(scoreGainPriority, priority) : priority;
  scoreGainTime = 0.8;
  scorePulse = Math.max(scorePulse, jackpot ? 1 : points >= 1000 ? 0.7 : 0.3);
  $('score-gain').textContent = `${scoreGainPriority === 3 ? 'JACKPOT ' : ''}+${scoreGain.toLocaleString()}`;
  $('score-gain').dataset.level = String(scoreGainPriority);
}

function sync() {
  $('score').textContent = String(score).padStart(6, '0');
  $('best').textContent = String(best).padStart(6, '0');
  $('multiplier').textContent = balls === 1 && state !== 'ready' && state !== 'over' ? `×${scoring.multiplier} · LAST×2` : `×${scoring.multiplier}`;
  $('balls').innerHTML = [0, 1, 2].map(i => `<i class="${i < balls ? '' : 'spent'}"></i>`).join('');
  $('balls').setAttribute('aria-label', `残り${balls}球`);
  $('status').textContent = state === 'ready' ? 'READY TO ROLL' : state === 'paused' ? 'TAKE A BREATHER' : state === 'over' ? 'GAME OVER' : combatMode ? `WAVE ${combat.wave} · CORE ${combat.hp}%` : physics.multiball ? `SUPERNOVA · ${physics.liveBallCount} BALLS` : physics.busy ? 'BALL LOCKED' : physics.relaunchIn > 0 ? 'BALL SAVED' : physics.orbit.active ? 'ORBIT RUN' : physics.launched ? 'IN ORBIT' : balls === 1 ? 'LAST BALL' : 'HOLD SPACE';
  $('pause').textContent = state === 'paused' ? '▷ 再開' : 'Ⅱ 一時停止';
  $<HTMLButtonElement>('pause').disabled = state === 'ready' || state === 'over';
  $('start').innerHTML = `${state === 'ready' ? 'ゲームをはじめる' : 'もう一度はじめる'} <span>↗</span>`;
  $('stage-start').innerHTML = `${state === 'ready' ? 'FIRST CONTACT を開始' : 'STAGE 1 を再挑戦'} <span>↗</span>`;
  $('stage-start').classList.toggle('hidden', combatMode && state !== 'ready' && state !== 'over');
  syncCombat();
}
function syncCombat() {
  const hud = $('combat-hud'); hud.hidden = !combatMode;
  $('combat-wave').textContent = `WAVE ${Math.min(combat.wave, 4)} / 4${combat.wave === 4 ? ' · BOSS' : ''}`;
  $('combat-combo').textContent = `COMBO ×${combat.combo}`;
  $('combat-hp-text').textContent = `${combat.hp} / 100`;
  $('combat-hp').style.width = `${combat.hp}%`;
  $('combat-hp').classList.toggle('critical', combat.hp <= 30);
  $('combat-skills').textContent = combat.skillSummary.length ? combat.skillSummary.join('　·　') : '取得スキルなし';
  $('combat-hud').classList.toggle('damaged', combat.lastDamage > 0);
}
function toast(message: string) { $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = 2.4; }
function clearInput() { left = false; right = false; charging = false; power = 0; }
function start() {
  combatMode = false; physics.combatSafety = false; staticDirty = true; finishShown = false; relaunchTimer = 0; document.body.classList.remove('combat-mode');
  $('skill-choice').hidden = true;
  bestAtStart = best; clearReward(); scorePulse = 0; scoreGainTime = 0; scoreGain = 0;
  state = 'playing'; score = 0; scoring.reset(); balls = 3; clearInput(); trails.clear(); effects.clear();
  impact = 0; launchGlow = 0; celebration = 0;
  popups.length = 0; shake = 0; flipperFlashes.fill(0);
  flashes.fill(0); physics.resetGame(); $('overlay').classList.add('hidden'); sync();
  toast('SPACE 長押し → 離して発射'); tone(660, 0.22);
}
function startStage() {
  combatMode = true; physics.combatSafety = true; staticDirty = true; finishShown = false; relaunchTimer = 0; document.body.classList.add('combat-mode');
  bestAtStart = best; clearReward(); scorePulse = 0; scoreGainTime = 0; scoreGain = 0;
  state = 'playing'; score = 0; scoring.reset(); balls = 3; clearInput(); trails.clear(); effects.clear(); popups.length = 0;
  impact = 0; shake = 0; flipperFlashes.fill(0); flashes.fill(0);
  combat.start(); physics.resetGame(); physics.launch(0.72);
  $('overlay').classList.add('hidden'); $('skill-choice').hidden = true; sync();
  toast('ボールを敵に当て、コアHPを守ろう'); tone(660, 0.22);
}
function presentSkillChoice() {
  const root = $('skill-options'); root.replaceChildren();
  for (const skill of combat.choices) {
    const button = document.createElement('button'); button.className = 'skill-card'; button.dataset.skill = skill;
    const title = document.createElement('strong'); title.textContent = `${skill}${combat.skills[skill] ? ` · Lv${combat.skills[skill] + 1}` : ' · Lv1'}`;
    const detail = document.createElement('span'); detail.textContent = skillText[skill];
    button.append(title, detail);
    button.addEventListener('click', () => {
      if (!combat.choose(skill)) return;
      $('skill-choice').hidden = true; $('stage-start').classList.add('hidden');
      if (skill === 'MULTIBALL') physics.addCombatBall();
      celebration = 1.5; celebrationText = `${skill} LV${combat.skills[skill]} ACQUIRED`;
      if (effectsMax && !reducedMotion) { effects.supernova(228, 390); shake = 5; }
      toast(`${skill} を獲得 · ${skillText[skill]}`); tone(900, 0.35); sync();
    });
    root.append(button);
  }
  $('skill-choice').hidden = false; clearInput();
  if (combat.wave === 4) { celebration = 2.2; celebrationText = 'GUARDIAN CORE INBOUND'; effects.supernova(228, 190); shake = 7; }
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
  if (state !== 'playing' || physics.launched || physics.relaunchIn > 0 || physics.busy || physics.multiball || charging) return;
  charging = true; power = 0; tone(130, 0.08);
}
function releaseCharge() {
  if (!charging) return;
  charging = false;
  if (state === 'playing') physics.launch(power);
  power = 0;
}

physics.onHit = i => {
  const lastBall = balls === 1;
  const result = scoring.bumper(lastBall);
  addScore(result.points);
  applyScoring(result);
  const { streak, bonus } = scoring.registerHit(clock);
  if (bonus) {
    addScore(bonus.points);
    showReward(bonus.label, `${streak} HIT · +${bonus.points.toLocaleString()}`, 'combo', 2);
    rewardSound('combo', streak >= 8 ? 2 : 1);
  }
  flashes[i] = 1; shake = effectsMax ? 3 : 0; impact = 1;
  const bumper = bumpers[i];
  popups.push({ x: bumper.x, y: bumper.y - bumper.radius - 12, text: `${lastBall ? 'LAST×2 ' : ''}${streak > 1 ? `${streak} HITS · ` : ''}+${result.points}`, life: 0.85 });
  if (effectsMax && !reducedMotion) effects.burst(bumper.x, bumper.y, i === 2 ? '#ff5cbf' : '#4cfff0', 1 + Math.min(streak, 5) * 0.13);
  if (streak >= 2) { celebration = 1.1; celebrationText = `${streak} HIT CHAIN`; }
  saveBest(); sync(); tone(600 + i * 180 + Math.min(streak - 1, 6) * 55, 0.16);
};
physics.onCombatBumper = (i, x, y) => {
  flashes[i] = 1;
  if (effectsMax && !reducedMotion) effects.burst(x, y, ['#77f4ff', '#c49aff', '#ffd57a'][i], 0.72);
  impact = Math.max(impact, 0.16);
};
physics.onFlipper = (isLeft, speed, x = 0, y = 0) => {
  flipperFlashes[isLeft ? 0 : 1] = Math.min(1, speed / 650);
  tone(180 + Math.min(500, speed * 0.35), 0.08, 0.025);
  // DANGER SAVE: a deep catch with a moving flipper earns a flat bonus (doubled on the last ball).
  if (y > 620 && speed > 150) {
    const bonus = scoring.tryDanger(clock, balls === 1);
    if (bonus !== null) {
      addScore(bonus);
      popups.push({ x, y: y - 22, text: `DANGER +${bonus}`, life: 0.9 });
      if (effectsMax && !reducedMotion) effects.burst(x, y, '#ffd27c', 0.5);
      saveBest(); sync(); tone(980, 0.12);
    }
  }
};
physics.onLaunch = () => {
  launchGlow = 1;
  if (effectsMax && !reducedMotion) effects.burst(423, 683, '#af9aff', 0.55);
  tone(220 + Math.max(0, -physics.ball.vy - 980) / 340 * 300, 0.25);
  if (physics.saveRemaining > 0) toast('5秒間の BALL SAVE · 各球1回');
  sync();
};
physics.onSave = () => {
  if (combatMode) { combat.combo = 0; combat.onCombo(0); toast('BALL RECOVERED · コンボリセット'); sync(); return; }
  clearInput(); trails.clear(); popups.length = 0; scoring.resetChain();
  clearReward();
  celebration = 1.3; celebrationText = 'BALL SAVED';
  if (effectsMax && !reducedMotion) effects.burst(228, 707, '#72ffd9', 1.2);
  toast('BALL SAVED! 球数そのまま、自動で再発射'); tone(880, 0.3); sync();
};
physics.onRail = () => {
  if (clock - railSoundTime < 0.1) return;
  railSoundTime = clock; addScore(RAIL_BONUS); saveBest(); sync(); tone(230, 0.06, 0.025);
};
physics.orbit.onTarget = index => {
  addScore(TARGET_POINTS); impact = 1;
  const target = targets[index];
  popups.push({ x: target.x, y: target.y - 14, text: '+100', life: 0.85 });
  if (effectsMax && !reducedMotion) effects.burst(target.x, target.y, '#ffa6d5', 0.6);
  tone(450 + index * 180, 0.15); saveBest(); sync();
};
physics.orbit.onOpen = () => {
  celebration = 1.6; celebrationText = 'GATES OPEN';
  toast('15秒間チャンス！ 左右の ↑ 入口を狙え');
  if (effectsMax && !reducedMotion) for (const mouth of Object.values(entrances)) effects.burst(mouth.x, mouth.y, '#86ffb8', 1.2);
  tone(1100, 0.35);
};
physics.orbit.onClose = () => { toast('ゲート閉鎖。もう一度、3枚の的を狙おう'); };
physics.orbit.onEnter = side => {
  celebration = 1.3; celebrationText = 'ORBIT RUN';
  toast(`${side === 'left' ? '右' : '左'}フリッパーへ戻る！ 打ち返す準備を`);
  tone(780, 0.3); sync();
};
physics.orbit.onComplete = (award, ball) => {
  addScore(award.points, award.jackpot); impact = 1; celebration = 1.5;
  if (award.jackpot) {
    showReward('JACKPOT', `+${award.points.toLocaleString()}`, 'jackpot', 4, 1.5);
    rewardSound('jackpot');
    if (effectsMax && !reducedMotion) shake = 6;
  }
  if (award.charge) {
    applyScoring(scoring.addHits(ORBIT_CHARGE_HITS));
    celebrationText = `CHARGE +${award.points.toLocaleString()} · 倍率+${ORBIT_CHARGE_HITS}`;
  } else {
    celebrationText = `${award.jackpot ? 'JACKPOT' : 'ORBIT'} +${award.points.toLocaleString()}`;
  }
  if (effectsMax && !reducedMotion) effects.burst(ball.x, ball.y, award.jackpot ? '#ffd27c' : award.side === 'left' ? '#60ffe4' : '#d9a0ff', award.jackpot ? 1.5 : 0.6);
  if (!award.jackpot) tone(1200, 0.25); saveBest(); sync();
};
physics.onBlackHoleReady = () => { toast('BLACK HOLE OPEN! 中央の穴へ入れて球を保管'); tone(330, 0.45); };
physics.onLock = count => {
  clearInput(); trails.clear(); celebration = 1.3; celebrationText = `BALL LOCKED ${count}/2`;
  showReward(`BALL LOCKED ${count}/2`, count === 1 ? 'ONE MORE BALL' : 'SUPERNOVA READY', 'lock', 3, 1.4);
  lockDim = count === 1 ? 0.45 : 0;
  toast(count === 1 ? '1球保管！ 球数そのまま補充。もう一度周回しよう' : '2球保管！ 超新星、解放！');
  if (effectsMax && !reducedMotion) effects.burst(BLACK_HOLE.x, BLACK_HOLE.y, '#d995ff', 1.2);
  rewardSound('lock'); sync();
};
physics.onMultiballStart = () => {
  trails.clear(); impact = 1; celebration = 2.3; celebrationText = 'SUPERNOVA';
  showReward('SUPERNOVA', '3 BALLS · JACKPOT 5,000 → 25,000', 'nova', 5, 2.1);
  novaIntro = 1; lockDim = 0;
  toast('3球同時！ ゲート常時開放 · 周回ごとにJACKPOT育成');
  if (effectsMax && !reducedMotion) { effects.supernova(228, 390); shake = 9; }
  rewardSound('nova'); sync();
};
physics.onMultiballEnd = () => { toast('超新星終了。残った1球で続行！'); sync(); };
physics.onBallLost = remaining => {
  if (combatMode) { combat.combo = 0; combat.onCombo(0); toast(`BALL LOST · COMBO RESET · 残り${remaining}球`); sync(); return; }
  if (remaining > 1) toast(`超新星継続！ あと${remaining}球 · 次は${physics.orbit.nextJackpot.toLocaleString()}点`); sync();
};
combat.onHit = (enemy, damage, killed) => {
  const text = killed ? `BREAK · ${enemy.kind.toUpperCase()}` : `-${damage}`;
  popups.push({ x: enemy.x, y: enemy.y - 25, text, life: 1.05 });
  impact = 1; shake = effectsMax ? (killed ? 5 : 2.2) : 0;
  if (effectsMax && !reducedMotion) effects.burst(enemy.x, enemy.y, killed ? '#ffd27c' : '#5ffff0', killed ? 1.5 : 0.72);
  addScore(killed ? 500 : damage * 10); tone(killed ? 1050 : 720, killed ? 0.25 : 0.1);
  if (killed && enemy.kind === 'Guardian Core') { celebration = 2.6; celebrationText = 'GUARDIAN CORE DESTROYED'; if (effectsMax && !reducedMotion) effects.supernova(enemy.x, enemy.y); }
  saveBest(); sync();
};
combat.onAttack = enemy => {
  if (effectsMax && !reducedMotion) effects.burst(enemy.x, enemy.y + 15, '#ff456f', 0.42);
  tone(180, 0.12, 0.025);
};
combat.onPlayerHit = damage => {
  shake = effectsMax ? 6 : 0; impact = 1; celebration = 0.7; celebrationText = `CORE HIT · -${damage}`;
  if (effectsMax && !reducedMotion) effects.burst(228, 650, '#ff456f', 1.1);
  tone(110, 0.32, 0.07, 0, 45); sync();
};
combat.onWave = wave => {
  if (wave === 4) { celebration = 2.2; celebrationText = 'GUARDIAN CORE INBOUND'; }
  sync();
};
combat.onCombo = combo => {
  if ([10, 20, 50].includes(combo)) {
    celebration = 1.4; celebrationText = `${combo} HIT COMBO`;
    if (effectsMax && !reducedMotion) { effects.supernova(228, 400); shake = Math.min(7, 2 + combo / 10); }
    rewardSound('combo', combo >= 20 ? 2 : 1);
  }
  sync();
};
function saveBest() {
  if (score > best) { best = score; try { localStorage.setItem('orbit-best', String(best)); } catch { /* Continue without persistence. */ } }
}
physics.onDrain = () => {
  if (combatMode && combat.status === 'playing') {
    clearInput(); trails.clear(); combat.combo = 0; combat.onCombo(0); physics.resetBall(); relaunchTimer = 0.8;
    celebration = 1.1; celebrationText = 'BALL RECOVERED';
    if (effectsMax && !reducedMotion) effects.burst(228, 714, '#72ffd9', 0.8);
    toast('BALL RECOVERED · コンボリセット'); sync(); return;
  }
  balls--; clearInput(); trails.clear(); scoring.resetChain(); tone(150, 0.4);
  clearReward();
  if (balls === 0) {
    state = 'over'; $('overlay').classList.remove('hidden');
    $('overlay-kicker').textContent = score > bestAtStart ? 'PERSONAL BEST!' : 'NICE ORBIT';
    $('overlay-title').textContent = score.toLocaleString();
    $('overlay-text').textContent = score > bestAtStart ? '自己ベスト更新！ 次はどこまでいける？' : `BESTまであと${Math.max(0, bestAtStart - score).toLocaleString()}点 · もう一度挑戦！`;
    $('overlay-start').textContent = 'もう一度プレイ ↗';
  } else { physics.resetBall(); toast(balls === 1 ? 'ラスト1球! バンパー2倍で逆転を狙え。SPACE 長押しで発射' : `あと${balls}球。SPACE 長押しで発射`); }
  sync();
};

$('start').addEventListener('click', start);
$('stage-start').addEventListener('click', startStage);
$('overlay-start').addEventListener('click', () => state === 'paused' ? pause() : combatMode ? startStage() : start());
$('pause').addEventListener('click', pause);
$('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = `♫ サウンド ${sound ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(sound)); if (sound) tone(); });
function syncEffects() {
  document.body.classList.toggle('light-effects', !effectsMax || reducedMotion);
  $('effects').textContent = `✦ 演出 ${effectsMax ? 'MAX' : 'LIGHT'}`;
  $('effects').setAttribute('aria-pressed', String(effectsMax));
  effects.clear(); trails.clear(); shake = 0;
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
function drawCombat() {
  for (const shot of combat.projectiles) {
    ctx.save(); ctx.shadowColor = '#ff456f'; ctx.shadowBlur = 16;
    line([[shot.x, shot.y + 12], [shot.x - shot.vx * 0.045, shot.y - 5]], '#ff456f', 4, 9);
    circle(shot.x, shot.y, 5, '#ffe7ed', '#ff456f', 2); ctx.restore();
  }
  for (const enemy of combat.enemies) {
    const boss = enemy.kind === 'Guardian Core';
    const size = boss ? 56 : enemy.kind === 'Tank' ? 36 : enemy.kind === 'Shooter' ? 31 : 27;
    const baseColor = boss ? '#ff5fbd' : enemy.kind === 'Tank' ? '#ffad63' : enemy.kind === 'Shooter' ? '#ff7185' : '#68f8ff';
    const color = enemy.hitFlash > 0 ? '#ffffff' : baseColor;
    ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.shadowColor = color; ctx.shadowBlur = effectsMax ? boss ? 28 : 19 : 4;
    ctx.globalAlpha = 0.34; ctx.beginPath(); ctx.ellipse(0, size * 0.72, size * 1.15, size * 0.42, 0, 0, Math.PI * 2); ctx.fillStyle = '#020814'; ctx.fill(); ctx.globalAlpha = 1;
    circle(0, 0, size + 8, '#10233c88', color, 2);
    if (boss) {
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 1.16, -size * .35); ctx.lineTo(size, size * .48); ctx.lineTo(0, size * .83); ctx.lineTo(-size, size * .48); ctx.lineTo(-size * 1.16, -size * .35); ctx.closePath();
      ctx.fillStyle = '#301a42'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      circle(0, 0, 23, enemy.hitFlash > 0 ? '#fff' : '#bf318d', '#ffd9f2', 3); circle(0, 0, 11, '#fff1fb');
      for (let i = -1; i <= 1; i++) line([[i * 25, -size * .25], [i * 25, size * .44]], '#ff9de0', 3, 7);
    } else {
      if (enemy.kind === 'Drone') {
        for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, -size * .5); ctx.lineTo(-size * .48, -size * 1.05); ctx.lineTo(size * .48, -size * 1.05); ctx.closePath(); ctx.fillStyle = '#153a4c'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
        circle(0, 0, size * .58, '#164253', color, 3); circle(0, 0, size * .24, '#e7ffff');
      } else if (enemy.kind === 'Shooter') {
        ctx.beginPath(); ctx.moveTo(-size * .72, -size * .65); ctx.lineTo(size * .45, -size * .65); ctx.lineTo(size * .78, -size * .3); ctx.lineTo(size * .78, size * .52); ctx.lineTo(-size * .45, size * .52); ctx.lineTo(-size * .78, size * .2); ctx.closePath();
        ctx.fillStyle = '#4a1e37'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#ff879f'; ctx.fillRect(-6, -size * 1.1, 12, size * .53); circle(0, 2, 9, '#ffd5dc', color, 2);
      } else {
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; const x = Math.cos(a) * size, y = Math.sin(a) * size; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
        ctx.fillStyle = '#493324'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
        circle(0, 0, size * .52, '#a45c27', '#ffd4a3', 2); ctx.fillStyle = '#ffd39a'; ctx.fillRect(-size * .62, -5, size * 1.24, 10);
      }
    }
    ctx.shadowBlur = 0;
    const title = boss ? 'GUARDIAN CORE' : enemy.kind.toUpperCase();
    const textY = size + 18, width = boss ? 150 : enemy.kind === 'Drone' ? 91 : 105;
    ctx.fillStyle = '#07121ceF'; ctx.fillRect(-width / 2, textY - 11, width, 31);
    label(title, 0, textY, boss ? 12 : 11, '#f4f7ff', '800');
    ctx.fillStyle = '#050a16'; ctx.fillRect(-width / 2, textY + 9, width, 7);
    ctx.fillStyle = color; ctx.fillRect(-width / 2, textY + 9, width * enemy.hp / enemy.maxHp, 7);
    label(`${enemy.hp} / ${enemy.maxHp}`, 0, textY + 28, 8, '#dbe6f4', '700');
    ctx.restore();
  }
}
function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewWidth = combatMode ? COMBAT_VIEW_WIDTH : WIDTH, viewHeight = combatMode ? COMBAT_VIEW_HEIGHT : HEIGHT;
  if (canvas.width !== viewWidth * dpr || canvas.height !== viewHeight * dpr) {
    canvas.width = viewWidth * dpr; canvas.height = viewHeight * dpr;
    staticLayer.width = viewWidth * dpr; staticLayer.height = viewHeight * dpr; staticDirty = true;
  }
  if (staticDirty) {
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const backdrop = staticCtx.createLinearGradient(0, 0, viewWidth, viewHeight);
    backdrop.addColorStop(0, '#0c1230'); backdrop.addColorStop(0.55, '#14102b'); backdrop.addColorStop(1, '#180b29');
    staticCtx.fillStyle = backdrop; staticCtx.fillRect(0, 0, viewWidth, viewHeight);
    const nebula = staticCtx.createRadialGradient(228, 280, 25, 228, 280, 255);
    nebula.addColorStop(0, '#672b893a'); nebula.addColorStop(0.55, '#30328322'); nebula.addColorStop(1, '#17113500');
    staticCtx.fillStyle = nebula; staticCtx.fillRect(25, 40, 375, 535);
    for (const star of stars) {
      staticCtx.globalAlpha = 0.25 + (Math.sin(star.phase) + 1) * 0.16;
      staticCtx.beginPath(); staticCtx.arc(star.x, star.y, 0.7 + star.phase % 1, 0, Math.PI * 2);
      staticCtx.fillStyle = '#c2b4ff'; staticCtx.fill();
    }
    staticCtx.globalAlpha = 1;
    staticCtx.save(); staticCtx.translate(228, 289); staticCtx.rotate(-0.5);
    staticCtx.strokeStyle = '#805de34c'; staticCtx.lineWidth = 1;
    for (const r of [129, 156, 179]) { staticCtx.beginPath(); staticCtx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2); staticCtx.stroke(); }
    staticCtx.restore();
    staticDirty = false;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(staticLayer, 0, 0, viewWidth, viewHeight);
  ctx.save();
  if (combatMode) {
    // Keep the combat field level and broad; classic mode retains its portrait table.
    ctx.transform(1.3, 0, 0, 0.8, 0, 8);
    const board = ctx.createLinearGradient(50, 80, 400, 700);
    board.addColorStop(0, '#132d47'); board.addColorStop(0.52, '#10192e'); board.addColorStop(1, '#211331');
    ctx.fillStyle = board; ctx.fillRect(20, 30, 420, 710);
    ctx.strokeStyle = '#51e8f5'; ctx.lineWidth = 3; ctx.shadowColor = '#42c9f5'; ctx.shadowBlur = effectsMax ? 22 : 2;
    ctx.strokeRect(20, 30, 420, 710); ctx.shadowBlur = 0;
    // A visible catch apron marks the point where an escaped ball is returned.
    line([[78, 680], [145, 714], [228, 728], [311, 714], [382, 680]], '#48f5df', 8, effectsMax ? 18 : 2);
    line([[78, 680], [145, 714], [228, 728], [311, 714], [382, 680]], '#eaffff', 2);
  }
  if (effectsMax && !reducedMotion && shake > 0.2) ctx.translate(Math.sin(clock * 95) * shake, Math.cos(clock * 85) * shake);
  if (effectsMax && !reducedMotion) for (const star of stars) {
    ctx.globalAlpha = 0.25 + (Math.sin(clock * 0.8 + star.phase) + 1) * 0.16;
    circle(star.x, star.y, 0.7 + star.phase % 1, '#c2b4ff');
  }
  ctx.globalAlpha = 1;
  if (effectsMax && !reducedMotion && !combatMode) {
    ctx.save(); ctx.translate(228, 287); ctx.rotate(-0.5);
    for (let i = 0; i < 3; i++) {
      const angle = (reducedMotion ? 0 : clock * 0.22) + i * Math.PI * 2 / 3;
      circle(Math.cos(angle) * 173, Math.sin(angle) * 125, 2, ['#5ffff0', '#ff79cf', '#b695ff'][i]);
    }
    ctx.restore();
  }
  if (!combatMode) line([[17, 600], [17, 148], [42, 75], [107, 27], [353, 27], [418, 66], [453, 138], [453, 739]], '#3a5963', 2);
  line([[39, 463], [39, 155], [61, 99], [116, 58], [349, 58], [393, 88]], '#61fff1', 2.5, effectsMax ? 14 : 3);
  line([[40, 485], [40, 586], [109, 670], [143, 684]], '#ff65b7', 3, effectsMax ? 17 : 3);
  line([[390, 467], [390, 585], [342, 660], [316, 677]], '#bc89ff', 3, effectsMax ? 17 : 3);
  if (!combatMode) label('O  R  B  I  T', 221, 196, 15, '#8ba4aa', '600');
  for (let i = 0; i < 3 && !combatMode; i++) {
    circle(94 + i * 82, 123 - (i === 1 ? 14 : 0), 7, '#263f49', '#6ce8d2', 1.4);
    circle(94 + i * 82, 123 - (i === 1 ? 14 : 0), 2.5, '#6ce8d2');
  }
  if (!combatMode) drawOrbit(ctx, physics.orbit, clock, effectsMax && !reducedMotion);
  const visibleRails = combatMode ? combatRails : rails;
  for (const wall of visibleRails) {
    line([[wall.a.x, wall.a.y + 3], [wall.b.x, wall.b.y + 3]], '#080f17', 11);
  }
  for (const wall of visibleRails) {
    line([[wall.a.x, wall.a.y], [wall.b.x, wall.b.y]], wall.color ?? '#4c6772', wall.color ? 5 : 6, wall.color ? 6 : 0);
  }
  for (const wall of visibleRails) {
    line([[wall.a.x, wall.a.y - 1], [wall.b.x, wall.b.y - 1]], wall.color ? '#e0eee1' : '#8ca1a4', 1);
  }
  if (!physics.inLane) line([[shooterGate.a.x, shooterGate.a.y], [shooterGate.b.x, shooterGate.b.y]], '#e8b571', 3, 4);
  if (!combatMode) bumpers.forEach((b, i) => {
    const color = i === 2 ? '#ff63ba' : '#60ffed';
    circle(b.x, b.y + 7, b.radius + 7, '#08121b');
    ctx.shadowBlur = effectsMax ? 22 + flashes[i] * 30 : 5; ctx.shadowColor = color;
    circle(b.x, b.y, b.radius + 4, '#162e38', color, 2); ctx.shadowBlur = 0;
    circle(b.x, b.y, b.radius - 3, effectsMax && flashes[i] > 0.5 ? '#c8ffe8' : '#22324a', color, 3);
    circle(b.x, b.y, b.radius - 10, i === 2 ? '#7a285c' : '#235a66');
    label('✦', b.x, b.y + 9, 27, i === 2 ? '#ffb4ec' : '#a6ffe8');
    if (effectsMax && !reducedMotion) {
      const angle = (reducedMotion ? 0 : clock * (i === 2 ? -0.45 : 0.35)) + i;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.65;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 11, angle + j * 2.1, angle + j * 2.1 + 0.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
  if (combatMode) combatBumpers.forEach((b, i) => {
    const color = ['#77f4ff', '#c49aff', '#ffd57a'][i];
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = effectsMax ? 20 + flashes[i] * 24 : 3;
    circle(b.x, b.y + 5, b.radius + 5, '#08121c');
    circle(b.x, b.y, b.radius, '#192c46', color, 3);
    circle(b.x, b.y, b.radius * 0.61, '#26334b', '#f5f5ff', 1.5);
    circle(b.x, b.y, b.radius * 0.25, color);
    ctx.restore();
  });
  if (combatMode) drawCombat();
  if (!combatMode) drawShields(ctx, physics.orbit);
  const gateOpen = physics.orbit.isOpen;
  const celebrating = celebration > 0;
  const holeActive = physics.blackHoleReady || physics.busy || physics.multiball;
  const holeColor = physics.multiball ? '#ffd27c' : holeActive ? '#df9cff' : '#665a89';
  if (!combatMode) {
  ctx.save(); ctx.translate(BLACK_HOLE.x, BLACK_HOLE.y);
  if (effectsMax && !reducedMotion) { ctx.shadowColor = holeColor; ctx.shadowBlur = holeActive ? 24 : 4; }
  circle(0, 0, 23, '#060511', holeColor, 2);
  ctx.shadowBlur = 0;
  ctx.rotate(effectsMax && !reducedMotion ? clock * (holeActive ? 1.8 : 0.2) : 0);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, i * Math.PI / 3, 0, Math.PI * 1.5);
    ctx.strokeStyle = holeColor; ctx.globalAlpha = holeActive ? 0.7 : 0.25; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 2; i++) circle(217 + i * 22, 465, 4, i < physics.lockedBalls ? '#ffe5a5' : '#27203c', '#a07ac5');
  label(physics.multiball ? `${physics.liveBallCount} BALLS · 周回で JACKPOT` : physics.blackHoleReady ? '↓ BLACK HOLE OPEN · ここを狙え ↓' : `LOCK ${physics.lockedBalls}/2 · 周回で穴を開放`, 228, 439, 9, holeColor, '700');
  }
  ctx.shadowColor = '#e277ff'; ctx.shadowBlur = effectsMax ? 16 : 0;
  if (!combatMode) label(celebrating ? celebrationText : physics.multiball ? 'SUPERNOVA' : gateOpen ? `${physics.orbit.openRemaining.toFixed(1)}s OPEN` : `SHIELD ${physics.orbit.down.filter(Boolean).length}/3`, 228, 518, 23, celebrating ? '#fff3ca' : '#eadcff', '800');
  ctx.shadowBlur = 0;
  if (!combatMode) label(physics.multiball ? `JACKPOT +${physics.orbit.nextJackpot.toLocaleString()} · GATES ALWAYS OPEN` : gateOpen ? `L +${ORBIT_LAP_BASE * Math.min(ORBIT_LAP_MAX_STEPS, physics.orbit.laps + 1)} · R ${ORBIT_CHARGE_POINTS}+CHARGE` : '3 TARGETS → 15s ORBIT', 228, 537, 9, '#acb3d1');
  for (const side of [true, false]) {
    const f = physics.flipper(side);
    const flash = flipperFlashes[side ? 0 : 1];
    line([[f.a.x, f.a.y + 5], [f.b.x, f.b.y + 5]], '#080f17', 22);
    line([[f.a.x, f.a.y], [f.b.x, f.b.y]], '#ff795f', 19, 9);
    line([[f.a.x, f.a.y - 3], [f.b.x, f.b.y - 3]], flash > 0.25 ? '#fff7db' : '#ffc0a3', 5, flash * 18);
    circle(f.a.x, f.a.y, 5, '#773b36', '#ffb59b');
  }
  label(combatMode ? 'A U T O   R E T U R N' : physics.saveRemaining > 0 ? '✦ BALL SAVE ✦' : 'D R A I N', 228, 740, 10, combatMode || physics.saveRemaining > 0 ? '#6ce8d2' : '#526d77');
  ctx.save(); ctx.translate(423, 422); ctx.rotate(-Math.PI / 2); label('L A U N C H   ↑', 0, 0, 10, '#8aa4a8'); ctx.restore();
  const pull = power * 25;
  for (let i = 0; i < 7; i++) line([[414, 706 + i * 4 + pull * 0.15], [432, 708 + i * 4 + pull * 0.15]], '#799090', 1.5);
  line([[411, 699 + pull], [435, 699 + pull]], '#e8b571', 5);
  if (effectsMax && !reducedMotion) {
    effects.draw(ctx);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const trail of trails.values()) for (let i = 1; i < trail.length; i++) {
      const intensity = i / trail.length;
      ctx.globalAlpha = intensity * 0.55;
      line([[trail[i - 1].x, trail[i - 1].y], [trail[i].x, trail[i].y]], i < trail.length / 2 ? '#a475ff' : '#59e8ff', intensity * 11, 8);
    }
    ctx.globalAlpha = launchGlow * 0.5;
    line([[423, 185], [423, 678]], '#be9cff', 3, 16);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (state !== 'over') for (const ball of physics.balls) {
    const { x, y } = ball;
    const radius = ball.radius * (physics.captureRemaining > 0 ? Math.max(0.1, physics.captureRemaining / 0.65) : 1);
    const by = ball === physics.ball && !physics.launched ? y + pull : y;
    circle(x + 3, by + 5, radius + 1, '#07121c');
    if (effectsMax && !reducedMotion) {
      ctx.shadowColor = physics.multiball ? '#ffd27c' : '#8dffff'; ctx.shadowBlur = 18;
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
    if (!combatMode || combat.status === 'playing') {
      while (accumulator >= STEP) { physics.step(STEP, left, right); accumulator -= STEP; if (state !== 'playing') { accumulator = 0; break; } }
    } else accumulator = 0;
    if (combatMode && state === 'playing' && combat.status === 'playing') {
      if (relaunchTimer > 0) { relaunchTimer = Math.max(0, relaunchTimer - dt); if (relaunchTimer === 0) physics.launch(0.72); }
      combat.step(dt, relaunchTimer > 0 ? [] : physics.balls); syncCombat();
      const finalStatus: string = combat.status;
      if (finalStatus === 'choice' && $('skill-choice').hidden) presentSkillChoice();
      if (!finishShown && (finalStatus === 'gameover' || finalStatus === 'clear')) {
        finishShown = true; state = 'over'; $('skill-choice').hidden = true; $('overlay').classList.remove('hidden');
        $('overlay-kicker').textContent = finalStatus === 'clear' ? 'STAGE 1 COMPLETE' : 'CORE DESTROYED';
        $('overlay-title').textContent = finalStatus === 'clear' ? 'STAGE CLEAR' : 'GAME OVER';
        $('overlay-text').textContent = finalStatus === 'clear' ? `Guardian Core撃破 · 残りHP ${combat.hp}` : 'プレイヤーコアのHPが0になった';
        $('overlay-start').textContent = 'もう一度挑戦 ↗'; $('stage-start').classList.remove('hidden');
        if (finalStatus === 'clear' && effectsMax && !reducedMotion) { effects.supernova(228, 390); shake = 9; }
      }
    }
    const currentBalls = physics.balls;
    for (const ball of trails.keys()) if (!currentBalls.includes(ball)) trails.delete(ball);
    if (physics.launched && effectsMax && !reducedMotion) for (const ball of currentBalls) {
      const trail = trails.get(ball) ?? [];
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 18) trail.shift(); trails.set(ball, trail);
    }
    effects.update(dt);
    impact = Math.max(0, impact - dt * 3);
    launchGlow = Math.max(0, launchGlow - dt * 1.7);
    celebration = Math.max(0, celebration - dt);
    rewardTime = Math.max(0, rewardTime - dt);
    if (rewardTime === 0 && pendingJackpot) {
      const next = pendingJackpot; pendingJackpot = null;
      showReward(next.title, next.detail, next.kind, next.priority, next.duration);
    }
    scorePulse = Math.max(0, scorePulse - dt * 2.5);
    scoreGainTime = Math.max(0, scoreGainTime - dt);
    novaIntro = Math.max(0, novaIntro - dt);
    lockDim = Math.max(0, lockDim - dt);
    for (let i = 0; i < 3; i++) flashes[i] = Math.max(0, flashes[i] - dt * 3);
    for (let i = 0; i < 2; i++) flipperFlashes[i] = Math.max(0, flipperFlashes[i] - dt * 7);
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].life -= dt; if (popups[i].life <= 0) popups.splice(i, 1); }
    shake *= Math.exp(-dt * 12);
    toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible');
  } else accumulator = 0;
  const saveDisplay = $('ball-save');
  saveDisplay.hidden = state === 'ready' || state === 'over' || physics.busy || physics.multiball || (physics.saveRemaining <= 0 && physics.relaunchIn <= 0);
  saveDisplay.textContent = physics.relaunchIn > 0 ? combatMode ? '✦ AUTO RETURN · 再射出' : '✦ BALL SAVED · 自動で再発射' : `✦ BALL SAVE · ${(Math.ceil(physics.saveRemaining * 10) / 10).toFixed(1)}s`;
  $('charge').style.width = `${power * 100}%`;
  $('nova-state').textContent = combatMode ? `AUTO CATCH · BALL RETURN · COMBO RESET` : physics.multiball ? `✦ SUPERNOVA · ${physics.liveBallCount} BALLS` : physics.blackHoleReady ? `LOCK ${physics.lockedBalls}/2 · 中央の穴を狙え！` : physics.busy ? `LOCK ${physics.lockedBalls}/2 · ${physics.lockedBalls === 2 ? '超新星、解放！' : '補充中…'}` : `LOCK ${physics.lockedBalls}/2 · 周回で穴を開放`;
  document.querySelector<HTMLElement>('.charge-track')!.hidden = combatMode;
  canvas.dataset.ballCount = String(physics.balls.length);
  document.body.classList.toggle('supernova', physics.multiball);
  $('orbit-state').textContent = combatMode ? `WAVE ${combat.wave} · ENEMIES ${combat.enemies.length}` : physics.multiball ? `✦ JACKPOT +${physics.orbit.nextJackpot.toLocaleString()}` : physics.orbit.openRemaining > 0 ? `● ${physics.orbit.active ? 'ORBIT · ' : ''}OPEN ${physics.orbit.openRemaining.toFixed(1)}s` : physics.orbit.active ? '● ORBIT RUN' : `SHIELD ${physics.orbit.down.filter(Boolean).length}/3`;
  $('orbit-state').dataset.mode = physics.orbit.active ? 'running' : physics.orbit.openRemaining > 0 ? 'open' : 'locked';
  $('orbit-state').classList.toggle('urgent', !combatMode && !physics.multiball && physics.orbit.openRemaining > 0 && physics.orbit.openRemaining <= 5);
  $('reward-progress').hidden = combatMode || state === 'ready' || state === 'over';
  $('multiplier-progress').textContent = scoring.hitsToNextMultiplier === 0 ? '×5 MAX!!' : `×${scoring.multiplier + 1}まであと${scoring.hitsToNextMultiplier} HIT`;
  const targetsLeft = physics.orbit.down.filter(down => !down).length;
  $('mission-progress').textContent = physics.multiball ? `NEXT JACKPOT +${physics.orbit.nextJackpot.toLocaleString()}`
    : physics.lockedBalls === 2 ? 'SUPERNOVA READY'
    : physics.blackHoleReady ? `${physics.lockedBalls === 1 ? 'ONE MORE LOCK · ' : ''}中央の穴へ！`
    : physics.lockedBalls === 1 ? 'ONE MORE LOCK · 周回で穴を開放'
    : physics.orbit.isOpen ? 'GATES OPEN · ランプを狙え！'
    : targetsLeft === 1 ? 'ONE MORE TARGET' : `GATESまであと${targetsLeft} TARGETS`;
  const active = state === 'playing';
  $('reward').hidden = rewardTime <= 0 || !active;
  $('score-gain').hidden = scoreGainTime <= 0 || state === 'ready' || state === 'over';
  scoreboard.style.setProperty('--score-pulse', String(effectsMax && !reducedMotion ? scorePulse : 0));
  cabinet.style.setProperty('--lock-dim', String(active && effectsMax && !reducedMotion ? lockDim : 0));
  cabinet.style.setProperty('--nova-opacity', String(active && effectsMax && !reducedMotion ? novaIntro * 0.32 : 0));
  cabinet.style.setProperty('--nova-color', novaIntro > 0.8 ? '#ffffff' : novaIntro > 0.4 ? '#ff75d0' : '#ffd27c');
  cabinet.style.setProperty('--impact', String(effectsMax ? impact : 0));
  scoreboard.classList.toggle('hit', effectsMax && impact > 0.3);
  $('chain').hidden = state === 'ready' || state === 'over' || !scoring.isChainActive(clock);
  $('chain').textContent = `✦ ${scoring.hitStreak} HIT CHAIN`;
  $('left').classList.toggle('pressed', left); $('right').classList.toggle('pressed', right);
  draw(); requestAnimationFrame(frame);
}  sync(); syncEffects(); requestAnimationFrame(frame);

// Installable PWA: register the service worker in production builds only, so dev
// servers and browser tests never get a caching layer in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* Playable without offline support. */ });
  });
}
