import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { bossMoveSets } from '../src/content/behaviors';
import { applyAction, buildGameData, createCombat, NO_FEATURES, previewIntent, turnAverage, type CombatState, type EnemyState, type GameData } from '../src/engine';
import { repeat } from './fixtures';

const data: GameData = buildGameData({ ...contentSource, features: { ...NO_FEATURES, bossGimmicks: true } });

/** A boss fight against one creature, with `deck` (drawn in that order) and the creature changed by `enemy`. */
function fight(id: string, opts: { d?: GameData; enemy?: Partial<EnemyState>; bosses?: boolean } = {}): CombatState {
  const s = createCombat({ seed: 1, deck: repeat('tug', 10), enemies: [id], playerHp: 60, playerMaxHp: 60, bosses: opts.bosses ?? true }, opts.d ?? data);
  return { ...s, enemies: [{ ...s.enemies[0], ...opts.enemy }] };
}
const play = (s: CombatState, defId: string) => applyAction(s, { type: 'playCard', cardUid: s.piles.hand.find((c) => c.defId === defId)!.uid, targetId: 'e0' }, data);
/** End the turn with no energy left (no Patience), the creature playing `intent`, the player keeping `block` Hold. */
const endTurn = (s: CombatState, intent?: string, block = 0) =>
  applyAction({ ...s, player: { ...s.player, energy: 0, block }, enemies: [{ ...s.enemies[0], ...(intent ? { intent } : {}) }] }, { type: 'endTurn' }, data);

describe('boss gimmicks', () => {
  it('only bosses with their own set play it, and only with the flag on', () => {
    expect(fight('giantPacificOctopus').enemies[0].gimmick).toBe(true);
    expect(fight('giantPacificOctopus').enemies[0].intent).toBe('tentacles');
    expect(fight('giantPacificOctopus', { bosses: false }).enemies[0].gimmick).toBeUndefined();
    expect(fight('giantPacificOctopus', { d: gameData }).enemies[0].gimmick).toBeUndefined();
    expect(fight('commonOctopus').enemies[0].gimmick).toBeUndefined();
  });

  it('a phased pattern averages both its phases', () => {
    const squid = bossMoveSets.atlanticGiantSquid;
    if (squid.pattern.type !== 'phased') throw new Error('phased');
    const both = (turnAverage(squid.moves, squid.pattern.first) + turnAverage(squid.moves, squid.pattern.then)) / 2;
    expect(turnAverage(squid.moves, squid.pattern)).toBeCloseTo(both);
  });

  it('Giant octopus, Eight Arms: takes a card from the next hand, given back once it loses 10 Health that turn', () => {
    const s = endTurn(fight('giantPacificOctopus', { enemy: { hp: 100, maxHp: 100 } }), 'eightArms');
    expect(s.piles.hand).toHaveLength(4);
    expect(s.enemies[0].held?.cards).toHaveLength(1);
    const grabbing = fight('giantPacificOctopus', { enemy: { intent: 'eightArms' } });
    expect(previewIntent(grabbing, grabbing.enemies[0], data)?.special?.key).toBe('grab');
    const once = play(s, 'tug');
    expect(once.enemies[0].held).toBeDefined();
    const twice = play(once, 'tug');
    expect(twice.enemies[0].held).toBeUndefined();
    expect(twice.piles.hand).toHaveLength(3);
  });

  it('Common lobster, Molting: sheds its debuffs, keeps its buffs', () => {
    const s = endTurn(fight('commonLobster', { enemy: { statuses: { vulnerable: 2, weak: 1, slow: 2, strength: 1 } } }), 'molt');
    expect(s.enemies[0].statuses).toEqual({ strength: 1 });
  });

  it('Catfish, Into the Mud: burrows while it winds up, then ambushes', () => {
    const before = endTurn(endTurn(fight('catfish')));
    expect(before.enemies[0].intent).toBe('digIn');
    const s = endTurn(before);
    expect(s.enemies[0].statuses).toMatchObject({ windUp: 1, burrowed: 1 });
    expect(s.enemies[0].intent).toBe('ambush');
  });

  it('Giant moray, Retreat into the Hole: attacks do nothing until its next turn, Drain still works', () => {
    const s = endTurn(fight('giantMorayEel'), 'retreat');
    expect(s.enemies[0].statuses.hiding).toBe(1);
    expect(play(s, 'tug').enemies[0].hp).toBe(s.enemies[0].hp);
    expect(endTurn(s, 'lunge').enemies[0].statuses.hiding).toBeUndefined();
  });

  it('Giant clam, Snap Shut: 20 Block and Burrow', () => {
    const s = endTurn(fight('giantClam'), 'snapShut');
    expect(s.enemies[0].block).toBe(20);
    expect(s.enemies[0].statuses.burrowed).toBe(1);
  });

  it('Bluefin tuna, Sprint: its Will rises double while it sprints, for 2 turns', () => {
    const s = fight('bluefinTuna', { enemy: { escape: 20 } });
    const rate = s.enemies[0].escapeRate;
    expect(endTurn(s, 'ram').enemies[0].escape).toBe(20 + rate);
    const sprinting = endTurn({ ...s, enemies: [{ ...s.enemies[0], statuses: { sprinting: 1 } }] }, 'ram');
    expect(sprinting.enemies[0].escape).toBe(20 + 2 * rate);
    expect(sprinting.enemies[0].statuses.sprinting).toBeUndefined();
    expect(endTurn(s, 'sprint', 1000).enemies[0].statuses.sprinting).toBe(1);
  });

  it('Giant squid: its first phase until its Health drops below half, then its second from the start', () => {
    let s = fight('atlanticGiantSquid');
    expect(s.enemies[0].intent).toBe('inkCloud');
    s = endTurn(s);
    expect(s.enemies[0].intent).toBe('squeeze');
    s = endTurn({ ...s, enemies: [{ ...s.enemies[0], hp: Math.floor(s.enemies[0].maxHp * 0.4) }] });
    expect(s.enemies[0].intent).toBe('tentacles');
    expect(endTurn(s).enemies[0].intent).toBe('armFrenzy');
  });

  it('Mako, Breach: double if the player has less than 10 Hold when it lands, shown in its intent', () => {
    const s = fight('shortfinMakoShark', { enemy: { intent: 'breach' } });
    const shown = (block: number) => previewIntent({ ...s, player: { ...s.player, block } }, s.enemies[0], data)!.damage!;
    expect(shown(0)).toBe(2 * shown(10));
    expect(endTurn(s, 'breach', 0).player.hp).toBe(60 - shown(0));
    expect(endTurn(s, 'breach', 10).player.hp).toBe(60 - (shown(10) - 10));
  });

  it('Oarfish, Omen: Tangled and Numb Fingers at once', () => {
    expect(endTurn(fight('oarfish'), 'omen').player.statuses).toMatchObject({ tangled: 1, numbFingers: 1 });
  });
});
