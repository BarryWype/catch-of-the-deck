import { RELIC_CHOICES, RELIC_ODDS } from './constants';
import { nextFloat, nextInt } from './rng';
import type { RunState } from './run';
import type { GameData, RelicRarity } from './types';
import { clone } from './util';

/**
 * Relics (`gearRelics`): equipment with a `rarity`, earned during a run. A relic choice offers
 * `RELIC_CHOICES` of those the run doesn't have, each slot's rarity drawn at the level's
 * `RELIC_ODDS` (another rarity when that one has none left), never the same relic twice. It waits
 * in `RunState.relicChoices` until one is taken (`takeRelic`) or passed on (`skipRelics`); while it
 * waits, no other offer is added.
 */
export function rollRelicChoices(run: RunState, data: GameData, count = RELIC_CHOICES): RunState {
  // One offer at a time: a trophy event's own relic doesn't add a second choice.
  if (run.relicChoices?.length) return run;
  const next = clone(run);
  const odds = RELIC_ODDS[Math.min(run.level, RELIC_ODDS.length - 1)];
  const owned = new Set(run.equipment);
  const left = Object.values(data.equipment).filter((e) => e.rarity && !owned.has(e.id));
  const choices: string[] = [];
  for (let slot = 0; slot < count; slot++) {
    const pool = left.filter((e) => !choices.includes(e.id));
    if (!pool.length) break;
    let roll = nextFloat(next) * (odds.common + odds.uncommon + odds.rare);
    const rarity = (Object.keys(odds) as RelicRarity[]).find((r) => (roll -= odds[r]) < 0) ?? 'rare';
    const ofRarity = pool.filter((e) => e.rarity === rarity);
    const from = ofRarity.length ? ofRarity : pool;
    choices.push(from[nextInt(next, 0, from.length - 1)].id);
  }
  next.relicChoices = choices;
  return next;
}

/** Take one of the relics on offer: it joins the run's equipment, and the others are gone. */
export function takeRelic(run: RunState, id: string): RunState {
  if (!run.relicChoices?.includes(id)) throw new Error(`"${id}" isn't on offer.`);
  const next = { ...clone(run), equipment: [...run.equipment, id] };
  delete next.relicChoices;
  return next;
}

/** Leave the relics on offer. */
export function skipRelics(run: RunState): RunState {
  const next = clone(run);
  delete next.relicChoices;
  return next;
}
