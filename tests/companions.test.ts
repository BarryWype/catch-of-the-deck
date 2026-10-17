import { describe, expect, it } from 'vitest';
import {
  activeBonuses,
  availableDestinations,
  companionEffects,
  companionStars,
  nextStars,
  createRun,
  describeCompanionEffect,
  enterNextLevel,
  finishCombat,
  rerollReward,
  rewardOptions,
  skipReward,
  sellCreature,
  travelTo,
  type CompanionEffect,
} from '../src/engine';
import { gameData } from '../src/content';
import { endTurn, play, repeat, setup, testData, homeCreature, caught, ids } from './fixtures';

/** Brought creatures with no bond yet. */
const pets = (...ids: string[]) => ids.map((id) => homeCreature(id));

const trigger = (on: Extract<CompanionEffect, { type: 'trigger' }>['on'], effect: Extract<CompanionEffect, { type: 'trigger' }>['effect']) =>
  ({ type: 'trigger', on, effect }) as const;

describe('companion stars', () => {
  // The shells are tier 1 (no tier given), full bond at 100: levels at 20, 50 and 100 points.
  const shellA = testData.enemies.shellA;
  const withTier = (tier: number) => ({ ...testData, enemies: { ...testData.enemies, shellA: { ...shellA, tier } } });
  const block = (effects: CompanionEffect[]) => effects.find((e) => e.type === 'bonusBlock');

  it('a companion has its tier in stars, +1 at bond level 2 and +1 more at level 3', () => {
    expect([0, 49, 50, 99, 100].map((bond) => companionStars(homeCreature('shellA', bond), testData))).toEqual([1, 1, 2, 2, 3]);
    expect(companionStars(homeCreature('shellA', 0), withTier(3))).toBe(3);
    expect(companionStars(homeCreature('shellA', 100), withTier(3))).toBe(5);
  });

  it('a temperament adds up its companions’ stars, each species once (the one with more stars)', () => {
    const [bonus] = activeBonuses([homeCreature('shellA', 0), homeCreature('shellA', 100), homeCreature('shellB', 50)], testData);
    expect(bonus).toMatchObject({ species: 2, stars: 3 + 2 });
    expect(activeBonuses(pets('shellA', 'shellA'), testData)[0]).toMatchObject({ species: 1, stars: 1 });
  });

  it('amounts come from byStars at the temperament’s stars, the last entry covering more; others stay fixed', () => {
    expect(block(companionEffects(pets('shellA'), testData))).toEqual({ type: 'bonusBlock', amount: 1, byStars: [1, 2] });
    expect(block(companionEffects(pets('shellA', 'shellB'), testData))?.amount).toBe(2);
    expect(block(companionEffects([homeCreature('shellA', 100)], withTier(3)))?.amount).toBe(2); // 5★
    expect(companionEffects([homeCreature('shellA', 100)], withTier(3))).toContainEqual({ type: 'bonusMaxHp', amount: 5 });
    const pinch: CompanionEffect = { type: 'trigger', on: 'fullBlock', effect: { type: 'dealDamage', amount: 2 }, byStars: [2, 3, 4] };
    const data = { ...testData, companionBonuses: { shelled: { ...testData.companionBonuses.shelled, effects: [pinch] } } };
    expect(activeBonuses(pets('shellA', 'shellB'), data)[0].effects[0]).toMatchObject({ effect: { type: 'dealDamage', amount: 3 } });
  });

  it('3 species add the full-school effects, as written', () => {
    const school = companionEffects(pets('shellA', 'shellB', 'shellC'), testData);
    expect(block(school)?.amount).toBe(2);
    expect(school).toContainEqual({ type: 'keepBlock', amount: 2 });
    expect(activeBonuses(pets('shellA', 'shellB', 'shellC'), testData)[0]).toMatchObject({ species: 3, stars: 3 });
  });

  it('the next stars that would change an amount, and what they change', () => {
    const data = { ...testData, companionBonuses: { shelled: { ...testData.companionBonuses.shelled, effects: [{ type: 'bonusBlock' as const, amount: 1, byStars: [1, 1, 2] }] } } };
    expect(nextStars(activeBonuses(pets('shellA'), data)[0])).toEqual({ more: 2, effects: [{ type: 'bonusBlock', amount: 2, byStars: [1, 1, 2] }] });
    expect(nextStars(activeBonuses(pets('shellA', 'shellB', 'shellC'), data)[0])).toBeNull();
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
    expect(combat.bonuses).toContainEqual({ type: 'bonusBlock', amount: 2, byStars: [1, 2] });
  });

  it('selling a companion ends its bonus; sales get the sell bonus, rounded up', () => {
    const run = { ...createRun(5, testData, 'basic', pets('shellA')), bucket: caught('shellA', 'dummy') };
    const soldCapture = sellCreature(run, 1, testData);
    expect(soldCapture.coins).toBe(6); // 5 + 10%, rounded up
    expect(soldCapture.companions).toEqual(pets('shellA'));
    const soldCompanion = sellCreature(run, 0, testData);
    expect(soldCompanion.companions).toEqual([]);
    expect(ids(soldCompanion.bucket)).toEqual(['dummy']);
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

  it('secondTurnStart fires once, after the second turn’s draw', () => {
    let s = setup(repeat('strike', 20), { bonuses: [trigger('secondTurnStart', { type: 'drawCards', amount: 2 })] });
    expect(s.piles.hand).toHaveLength(5);
    s = endTurn(s);
    expect(s.piles.hand).toHaveLength(7);
    s = endTurn(s);
    expect(s.piles.hand).toHaveLength(5);
  });

  it('firstAttackEachTurn applies Venom; it hits at the start of the creature\'s turn, then loses a charge', () => {
    let s = setup(repeat('strike', 10), { bonuses: [trigger('firstAttackEachTurn', { type: 'applyStatus', status: 'venom', amount: 2 })] });
    s = play(play(s, 'strike'), 'strike');
    expect(s.enemies[0].statuses.venom).toBe(2);
    s = endTurn(s);
    expect(s.enemies[0].hp).toBe(100 - 12 - 2);
    expect(s.enemies[0].statuses.venom).toBe(1);
  });

  it('Venom can capture a creature before it acts', () => {
    let s = setup(repeat('strike', 10), { enemies: ['shellA'], bonuses: [trigger('combatStart', { type: 'applyStatus', status: 'venom', amount: 20, target: 'allEnemies' })] });
    s = endTurn(s);
    expect(s.phase).toBe('won');
  });
});

describe('Eel companions: skipping and rerolling card rewards', () => {
  const eels = ['ribbonEel', 'europeanConger', 'harlequinSnakeEel'];
  // Ribbon eel is tier 1, the others tier 2: 1★, 3★ and 5★.
  const runWith = (species: number) => createRun(5, gameData, 'rod', pets(...eels.slice(0, species)));

  // Every run also has a reroll of its own (REWARD_REROLLS_AT_START), counted with theirs.
  it('without them, a card reward must be taken', () => {
    expect(rewardOptions(runWith(0), gameData)).toEqual({ skips: 0, rerolls: 1 });
    expect(() => skipReward(runWith(0), gameData)).toThrow();
  });

  it('give 1 skip per level at 1★, 2 at 3★, and 3 skips plus 3 rerolls with 3 species (5★)', () => {
    expect(rewardOptions(runWith(1), gameData)).toEqual({ skips: 1, rerolls: 1 });
    expect(rewardOptions(runWith(2), gameData)).toEqual({ skips: 2, rerolls: 1 });
    expect(rewardOptions(runWith(3), gameData)).toEqual({ skips: 3, rerolls: 4 });
  });

  it('are used up on a level and come back on the next one', () => {
    let run = skipReward(skipReward(runWith(2), gameData), gameData);
    expect(rewardOptions(run, gameData).skips).toBe(0);
    expect(() => skipReward(run, gameData)).toThrow();
    run = enterNextLevel(run, gameData);
    expect(rewardOptions(run, gameData).skips).toBe(2); // bond gained on the way stays under level 2
  });

  it('a reroll offers other cards and uses one of theirs up first, as those end with the level', () => {
    const offered = ['doubleCast', 'playTheLine', 'tireItOut'];
    const { run, choices } = rerollReward(runWith(3), gameData, offered);
    expect(choices).toHaveLength(3);
    expect(choices.filter((id) => offered.includes(id))).toEqual([]);
    expect(rewardOptions(run, gameData).rerolls).toBe(3);
    expect(run.rewardRerolls).toBe(1);
  });
});
