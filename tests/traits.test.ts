import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { applyAction, buildGameData, createCombat, NO_FEATURES, previewIntent, previewIntents, type CombatState, type EnemyState, type GameData } from '../src/engine';
import { repeat } from './fixtures';

const data: GameData = buildGameData({ ...contentSource, features: { ...NO_FEATURES, traits: true } });

/** A fight against one creature, with `deck` (drawn in that order) and the creature changed by `enemy`. */
function fight(id: string, opts: { deck?: string[]; d?: GameData; enemy?: Partial<EnemyState>; hp?: number } = {}): CombatState {
  const s = createCombat({ seed: 1, deck: opts.deck ?? repeat('tug', 10), enemies: [id], playerHp: opts.hp ?? 60, playerMaxHp: 60 }, opts.d ?? data);
  return { ...s, enemies: [{ ...s.enemies[0], ...opts.enemy }] };
}
const play = (s: CombatState, defId: string, d: GameData = data) =>
  applyAction(s, { type: 'playCard', cardUid: s.piles.hand.find((c) => c.defId === defId)!.uid, targetId: 'e0' }, d);
/** End the turn with no energy left (no Patience), the creature playing `intent`. */
const endTurn = (s: CombatState, intent?: string, d: GameData = data) =>
  applyAction({ ...s, player: { ...s.player, energy: 0 }, enemies: [{ ...s.enemies[0], ...(intent ? { intent } : {}) }] }, { type: 'endTurn' }, d);

describe('temperament traits', () => {
  it('every temperament has one, with a name and a description', () => {
    const temperaments = new Set(Object.values(data.enemies).map((e) => e.temperament));
    for (const t of temperaments) {
      const trait = Object.values(data.enemies).find((e) => e.temperament === t)!.trait;
      expect(trait?.name, t).toBeTruthy();
      expect(trait?.description, t).toBeTruthy();
    }
  });

  it('puffer, Inflate: the third hit in one turn gives the player 2 Spines', () => {
    let s = fight('spottedPufferfish', { enemy: { hp: 200, maxHp: 200 } });
    s = play(play(s, 'tug'), 'tug');
    expect(s.player.statuses.spines).toBeUndefined();
    expect(play(s, 'tug').player.statuses.spines).toBe(2);
  });

  it('armored, Hard Shell: half its Block stays into its next turn', () => {
    const s = fight('hardClam', { enemy: { block: 10 } });
    expect(endTurn(s, 'spit').enemies[0].block).toBe(5);
    expect(endTurn(fight('hardClam', { d: gameData, enemy: { block: 10 } }), 'spit', gameData).enemies[0].block).toBe(0);
  });

  it('giant, Deep Runs: its Will rises only every other turn, by double', () => {
    const s = fight('oceanSunfish', { enemy: { escape: 20 } });
    const rate = s.enemies[0].escapeRate;
    const once = endTurn(s, 'ram');
    expect(once.enemies[0].escape).toBe(20);
    expect(endTurn(once, 'ram').enemies[0].escape).toBe(20 + 2 * rate);
  });

  it('eel, Slippery: the first Drain each turn drains half (rounded up), the next one fully', () => {
    const s = fight('ribbonEel', { deck: repeat('reelIn', 10), enemy: { intent: 'coil', escape: 40 } });
    const first = play(s, 'reelIn');
    expect(first.enemies[0].escape).toBe(40 - 4);
    expect(play(first, 'reelIn').enemies[0].escape).toBe(40 - 4 - 7);
  });

  it('schooling, Scatter: the first time its Health drops below 50%, its Will jumps by 10', () => {
    const s = fight('guppy', { enemy: { hp: 13, maxHp: 24, escape: 20 } });
    const hit = play(s, 'tug');
    expect(hit.enemies[0].escape).toBe(30);
    expect(play({ ...hit, enemies: [{ ...hit.enemies[0], hp: 11 }] }, 'tug').enemies[0].escape).toBe(30);
  });

  it('cephalopod, Ink Sense: its Ink hides its next two moves', () => {
    let s = endTurn(fight('flapjackOctopus'), 'inkCloud');
    expect(s.enemies[0].intentHidden).toBe(true);
    s = endTurn(s);
    expect(s.enemies[0].intentHidden).toBe(true);
    expect(endTurn(s).enemies[0].intentHidden).toBe(false);
  });

  it('predator, Bloodlust: 1 Strength the first time its hit drops the player below 50% Grit', () => {
    const s = endTurn(fight('perch', { hp: 31 }), 'lunge');
    expect(s.player.hp).toBeLessThan(30);
    expect(s.enemies[0].statuses.strength).toBe(1);
    expect(endTurn(s, 'lunge').enemies[0].statuses.strength).toBe(1);
  });

  it('fighter, Second Run: once, low on Will, its rest becomes a normal Pull', () => {
    const resting: GameData = { ...data, enemies: { ...data.enemies, tench: { ...data.enemies.tench, pattern: { type: 'sequence', moves: ['catchBreath'] } } } };
    const s = endTurn(fight('tench', { d: resting, enemy: { escape: 10 } }), undefined, resting);
    expect(s.enemies[0].intent).toBe('leap');
    expect(endTurn(s, undefined, resting).enemies[0].intent).toBe('catchBreath');
  });

  it('venomous, Toxic: its Venom loses no charge the first time it hits the player', () => {
    expect(endTurn(fight('greaterWeever'), 'sting').player.statuses.venom).toBe(2);
    expect(endTurn(fight('greaterWeever', { d: gameData }), 'sting', gameData).player.statuses.venom).toBe(1);
  });

  it('reefFish, Dazzle: every third move it may bluff, shown with a "?" and left out of the bar preview', () => {
    const calm = (c: CombatState) => ({ ...c, enemies: [{ ...c.enemies[0], escape: 10 }] });
    let s = calm(endTurn(calm(endTurn(calm(fight('clownfish'))))));
    expect(s.enemies[0].bluff).toBeDefined();
    expect(previewIntent(s, s.enemies[0], data)?.mayBluff).toBe(true);
    expect(previewIntents(s, data).player).toEqual(s.player);
    const real = s.enemies[0].intent;
    s = endTurn(s);
    expect(s.enemies[0].moveHistory.at(-1)).toBe(real);
    expect(s.enemies[0].bluff).toBeUndefined();
  });

  it('jellyfish, Drifting: the player’s attacks deal 25% less while its next move is its rest', () => {
    const resting = play(fight('commonJellyfish', { enemy: { intent: 'pulse' } }), 'tug');
    const wrapping = play(fight('commonJellyfish', { enemy: { intent: 'wrap' } }), 'tug');
    expect(wrapping.enemies[0].maxHp - wrapping.enemies[0].hp).toBe(5);
    expect(resting.enemies[0].maxHp - resting.enemies[0].hp).toBe(3);
  });

  it('bottomDweller, Regrowth: heals 3% of its Health at the start of each of its turns', () => {
    const s = fight('commonStarfish', { enemy: { hp: 10, maxHp: 100 } });
    expect(endTurn(s, 'prickle').enemies[0].hp).toBe(13);
  });

  it('clawed, Counter-pinch: a hit its Block soaks completely pinches back for 2', () => {
    const s = fight('commonHermitCrab', { enemy: { block: 20 } });
    expect(60 - play(s, 'tug').player.hp).toBe(2);
    expect(60 - play(fight('commonHermitCrab', { enemy: { block: 2 } }), 'tug').player.hp).toBe(0);
  });

  it('ambusher, Camouflage: starts each of its turns with 3 Block', () => {
    expect(endTurn(fight('hairyFrogfish'), 'snap').enemies[0].block).toBe(3);
  });

  it('do nothing with the feature off', () => {
    let s = fight('spottedPufferfish', { d: gameData, enemy: { hp: 200, maxHp: 200 } });
    s = play(play(play(s, 'tug', gameData), 'tug', gameData), 'tug', gameData);
    expect(s.player.statuses.spines).toBeUndefined();
  });
});
