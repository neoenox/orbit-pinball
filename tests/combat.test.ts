import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatStage } from '../src/combat.ts';

test('starts the four-wave first contact stage with the requested enemy stats', () => {
  const stage = new CombatStage(); stage.start();
  assert.equal(stage.hp, 100); assert.equal(stage.wave, 1);
  assert.deepEqual(stage.enemies.map(e => [e.kind, e.hp, e.attackEvery, e.attackDamage]), [
    ['Drone', 20, 3, 5], ['Drone', 20, 3, 5],
  ]);
});

test('awards a three-choice skill pick between waves and applies its effect', () => {
  const stage = new CombatStage(); stage.start();
  stage.enemies.splice(0); stage.status = 'choice'; stage.choices = ['POWER', 'CHAIN', 'SHIELD'];
  assert.equal(stage.choose('POWER'), true);
  assert.equal(stage.damage, 15); assert.equal(stage.wave, 2); assert.equal(stage.enemies.length, 3);
  assert.equal(stage.choose('MULTIBALL'), false);
});

test('spawns the requested second, third, and boss wave rosters', () => {
  const stage = new CombatStage(); stage.start();
  const advance = () => { stage.status = 'choice'; stage.choices = ['POWER', 'CHAIN', 'SHIELD']; stage.choose('POWER'); };
  advance(); assert.deepEqual(stage.enemies.map(e => [e.kind, e.hp, e.attackEvery, e.attackDamage]), [
    ['Drone', 20, 3, 5], ['Drone', 20, 3, 5], ['Shooter', 35, 5, 10],
  ]);
  advance(); assert.deepEqual(stage.enemies.map(e => [e.kind, e.hp, e.attackEvery, e.attackDamage]), [
    ['Shooter', 35, 5, 10], ['Shooter', 35, 5, 10], ['Tank', 80, 8, 20],
  ]);
  advance(); assert.deepEqual(stage.enemies.map(e => [e.kind, e.hp, e.attackEvery, e.attackDamage]), [
    ['Guardian Core', 300, 5, 10],
  ]);
});

test('enemy shots reduce core HP, shield scales damage, and zero HP ends the run', () => {
  const stage = new CombatStage(); stage.start(); stage.skills.SHIELD = 1;
  stage.projectiles.push({ x: 228, y: 649, vx: 0, vy: 175, damage: 10 });
  stage.step(1 / 60, []);
  assert.equal(stage.hp, 93);
  stage.projectiles.push({ x: 228, y: 649, vx: 0, vy: 175, damage: 5 });
  stage.step(1 / 60, []); assert.equal(stage.hp, 89.5);
  stage.hp = 1; stage.projectiles.push({ x: 228, y: 649, vx: 0, vy: 175, damage: 5 });
  stage.step(1 / 60, []); assert.equal(stage.hp, 0); assert.equal(stage.status, 'gameover');
});

test('ball contact damages enemies once per impact and unlocks the next wave', () => {
  const stage = new CombatStage(); stage.start();
  const ball = { x: stage.enemies[0].x, y: stage.enemies[0].y, vx: 0, vy: 400, radius: 8 };
  stage.step(1 / 60, [ball]); assert.equal(stage.enemies[0].hp, 10);
  stage.step(1 / 60, [ball]); assert.equal(stage.enemies[0].hp, 10);
  stage.step(0.3, [ball]); assert.equal(stage.enemies.length, 1);
  ball.x = stage.enemies[0].x; ball.y = stage.enemies[0].y;
  stage.step(0.3, [ball]); assert.equal(stage.enemies[0].hp, 10);
  stage.step(0.3, [ball]); assert.equal(stage.status, 'choice');
  assert.equal(stage.choose(stage.choices[0]), true); assert.equal(stage.wave, 2);
});

test('boss fires faster below half health and defeat clears the stage', () => {
  const stage = new CombatStage(); stage.start();
  stage.wave = 4; stage.enemies = [{ id: 0, kind: 'Guardian Core', x: 228, y: 190, hp: 150, maxHp: 300, attackEvery: 5, attackDamage: 10, attackIn: 0.01, hitFlash: 0 }];
  stage.step(0.02, []); assert.ok(stage.enemies[0].attackIn < 3);
  stage.enemies[0].hp = 10;
  const ball = { x: 228, y: 190, vx: 0, vy: 400, radius: 8 };
  stage.step(0.02, [ball]); assert.equal(stage.status, 'clear');
});
