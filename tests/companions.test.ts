import { describe, expect, it } from 'vitest';
import {
  activeBonuses,
  availableDestinations,
  companionEffects,
  createRun,
  describeCompanionEffect,
  finishCombat,
  sellCreature,
  travelTo,
  type CompanionEffect,
} from '../src/engine';
import { gameData } from '../src/content';
import { endTurn, play, repeat, setup, testData } from './fixtures';

/** Brought creatures with no bond yet. */
const pets = (...ids: string[]) => ids.map((id) => ({ id, bond: 0 }));

const trigger = (on: Extract<CompanionEffect, { type: 'trigger' }>['on'], effect: Extract<CompanionEffect, { type: 'trigger' }>['effect']) =>
  ({ type: 'trigger', on, effect }) as const;

describe('companion bonus scaling', () => {
  it('counts different species only: 1 species ×1, 2 species ×2, 3 species ×2 plus the full-school extra', () => {
    expect(companionEffects(pets('shellA'), testData)).toContainEqual({ type: 'bonusBlock', amount: 1 });
    expect(companionEffects(pets('shellA', 'shellA'), testData)).toContainEqual({ type: 'bonusBlock', amount: 1 });
    expect(companionEffects(pets('shellA', 'shellB'), testData)).toContainEqual({ type: 'bonusBlock', amount: 2 });
    const school = companionEffects(pets('shellA', 'shellB', 'shellC'), testData);
    expect(school).toContainEqual({ type: 'bonusBlock', amount: 2 });
    expect(school).toContainEqual({ type: 'keepBlock', amount: 2 });
    expect(activeBonuses(pets('shellA', 'shellB', 'shellC'), testData)[0].species).toBe(3);
  });

  it('creatures without a temperament bonus give nothing', () => {
    expect(companionEffects(pets('dummy', 'cycler'), testData)).toEqual([]);
  });

  it('every real temperament has a bonus, and every bonus can be described', () => {
    for (const enemy of Object.values(gameData.enemies)) expect(gameData.companionBonuses[enemy.temperament!]).toBeDefined();
    for (const bonus of Object.values(gameData.companionBonuses)) {
      for (const effect of [...bonus.effects, ...bonus.fullSchool]) expect(describeCompanionEffect(effect)).toMatch(/\.$/);
    }
  });
});

describe('companions in a run', () => {
  it('only brought creatures are companions; captures are angry and give nothing', () => {
    const run = createRun(5, testData, 'basic', pets('shellA'));
    expect(run.companions).toEqual(pets('shellA'));
    expect(run.maxHp).toBe(85);
    expect(run.hp).toBe(85);
    const fight = travelTo(run, availableDestinations(run)[0].id, testData);
    const after = finishCombat(fight.run, { ...fight.combat, phase: 'won' }, testData);
    expect(after.bucket.length).toBeGreaterThan(1);
    expect(after.companions.map((c) => c.id)).toEqual(['shellA']);
  });

  it('fights get the scaled bonuses', () => {
    const run = createRun(5, testData, 'basic', pets('shellA', 'shellB'));
    const { combat } = travelTo(run, availableDestinations(run)[0].id, testData);
    expect(combat.bonuses).toContainEqual({ type: 'bonusBlock', amount: 2 });
  });

  it('selling a companion ends its bonus; sales get the sell bonus, rounded up', () => {
    const run = { ...createRun(5, testData, 'basic', pets('shellA')), bucket: ['shellA', 'dummy'] };
    const soldCapture = sellCreature(run, 1, testData);
    expect(soldCapture.coins).toBe(6); // 5 + 10%, rounded up
    expect(soldCapture.companions).toEqual(pets('shellA'));
    const soldCompanion = sellCreature(run, 0, testData);
    expect(soldCompanion.companions).toEqual([]);
    expect(soldCompanion.bucket).toEqual(['dummy']);
  });

  it('heals after a fight that is not lost, never above max HP', () => {
    const s = setup(repeat('strike', 5), { hp: 50, bonuses: [{ type: 'healAfterFight', amount: 4 }] });
    const run = { ...createRun(5, testData, 'basic'), hp: 50 };
    expect(finishCombat(run, { ...s, phase: 'fled' }, testData).hp).toBe(54);
    expect(finishCombat(run, { ...s, phase: 'lost' }, testData).hp).toBe(50);
    expect(finishCombat({ ...run, hp: 79 }, { ...s, player: { ...s.player, hp: 79 }, phase: 'won' }, testData).hp).toBe(80);
  });
});

describe('companion bonuses in combat', () => {
  it('bonusBlock adds to every Block gained by the player', () => {
    const s = play(setup(repeat('defend', 5), { bonuses: [{ type: 'bonusBlock', amount: 2 }] }), 'defend');
    expect(s.player.block).toBe(7);
  });

  it('keepBlock carries some Block into the next turn', () => {
    let s = setup(repeat('defend', 10), { enemies: ['gambler'], bonuses: [{ type: 'keepBlock', amount: 2 }] });
    s = play(play(s, 'defend'), 'defend');
    s = endTurn(s);
    expect(s.player.block).toBeLessThanOrEqual(2);
    expect(s.player.block).toBeGreaterThan(0);
  });

  it('bonusDamage adds to every hit; firstAttackDamage only boosts the first attack of the fight', () => {
    let s = setup(repeat('strike', 5), { bonuses: [{ type: 'bonusDamage', amount: 1 }, { type: 'firstAttackDamage', amount: 100 }] });
    s = play(s, 'strike');
    expect(s.enemies[0].hp).toBe(100 - 14);
    s = play(s, 'strike');
    expect(s.enemies[0].hp).toBe(100 - 14 - 7);
  });

  it('dodgeAttacks negates the first enemy attacks of the fight', () => {
    let s = setup(repeat('strike', 10), { bonuses: [{ type: 'dodgeAttacks', amount: 1 }] });
    s = endTurn(s);
    expect(s.player.hp).toBe(80);
    s = endTurn(s);
    expect(s.player.hp).toBe(70);
  });

  it('bonusEscapeReduction makes calming cards stronger', () => {
    const s = play(setup(['calm', ...repeat('strike', 4)], { bonuses: [{ type: 'bonusEscapeReduction', amount: 2 }] }), 'calm');
    expect(s.enemies[0].escape).toBe(0); // 4 - 10 - 2, never below 0
  });

  it('slowEscape lowers escape rates at the start of the fight', () => {
    const s = setup(repeat('strike', 5), { enemies: ['shellA'], bonuses: [{ type: 'slowEscape', amount: 10 }] });
    expect(s.enemies[0].escapeRate).toBe(0); // rate 1: at least 1 is taken off
  });

  it('fullBlock and hitByEnemy hit the attacker back, ignoring Strength', () => {
    let s = setup(repeat('defend', 10), {
      bonuses: [trigger('fullBlock', { type: 'dealDamage', amount: 2 }), trigger('hitByEnemy', { type: 'dealDamage', amount: 1 })],
    });
    s = play(play(s, 'defend'), 'defend');
    s = endTurn(s);
    expect(s.player.hp).toBe(80);
    expect(s.enemies[0].hp).toBe(100 - 3);
  });

  it('firstBelowHalfHp fires once, and its Block lasts into the next turn', () => {
    let s = setup(repeat('strike', 20), { hp: 45, bonuses: [trigger('firstBelowHalfHp', { type: 'gainBlock', amount: 8 })] });
    s = endTurn(s); // 45 → 35, below 40
    expect(s.player.block).toBe(8);
    s = endTurn(s); // 8 blocked, 33 left
    expect(s.player.hp).toBe(33);
    expect(s.player.block).toBe(0);
  });

  it('combatStart effects land once the first turn has begun', () => {
    const s = setup(repeat('strike', 10), {
      bonuses: [
        trigger('combatStart', { type: 'gainBlock', amount: 5 }),
        trigger('combatStart', { type: 'drawCards', amount: 1 }),
        trigger('combatStart', { type: 'applyStatus', status: 'weak', amount: 1, target: 'allEnemies' }),
      ],
    });
    expect(s.player.block).toBe(5);
    expect(s.piles.hand).toHaveLength(6);
    expect(s.enemies[0].statuses.weak).toBe(1);
  });

  it('firstAttackEachTurn poisons the target; Poison deals damage at the end of its turn', () => {
    let s = setup(repeat('strike', 10), { bonuses: [trigger('firstAttackEachTurn', { type: 'applyStatus', status: 'poison', amount: 2 })] });
    s = play(play(s, 'strike'), 'strike');
    expect(s.enemies[0].statuses.poison).toBe(2);
    s = endTurn(s);
    expect(s.enemies[0].hp).toBe(100 - 12 - 2);
    expect(s.enemies[0].statuses.poison).toBe(1);
  });

  it('Poison can capture a creature', () => {
    let s = setup(repeat('strike', 10), { enemies: ['shellA'], bonuses: [trigger('combatStart', { type: 'applyStatus', status: 'poison', amount: 20, target: 'allEnemies' })] });
    s = endTurn(s);
    expect(s.phase).toBe('won');
  });
});
