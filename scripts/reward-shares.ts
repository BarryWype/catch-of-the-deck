/**
 * Card reward shares: for tier-1 creatures, by fishing spot, the expected share of reward cards
 * of each type. A fight at a spot meets one of its encounters at random (`encountersFor`), and
 * its reward draws from the families of those creatures (`rollCardRewards`): each slot is rare
 * with `RARE_CHANCE`, otherwise normal, uniformly within the pool.
 *
 *   npm run reward-shares [-- --out before]
 *
 * Prints the table and saves it in simulation/<name>-reward-shares.csv.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData as data } from '../src/content';
import { creatureFamilies, encountersFor, RARE_CHANCE, setText, startingBuilds, type CardType, type MapNode } from '../src/engine';
import { en } from '../src/locales/en';

setText(en.engine, en.terms, 'en');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUT = outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
const TYPES: CardType[] = ['attack', 'defense', 'support', 'drain', 'power'];
const build = startingBuilds(data)[0].id;
const offerable = Object.values(data.cards).filter((c) => c.family !== undefined && (c.build === undefined || c.build === build));

/** The share of each card type in a reward slot, drawing from these families. */
function slotShares(families: Set<string>): Record<CardType, number> {
  const pool = offerable.filter((c) => families.has(c.family!));
  const shares = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<CardType, number>;
  const normal = pool.filter((c) => c.rarity === 'normal');
  const rare = pool.filter((c) => c.rarity === 'rare');
  const rareChance = rare.length ? RARE_CHANCE / 100 : 0;
  for (const c of normal) shares[c.type] += (1 - rareChance) / normal.length;
  for (const c of rare) shares[c.type] += rareChance / rare.length;
  return shares;
}

const rows: Record<string, Record<string, string | number>> = {};
for (const spot of Object.values(data.spots)) {
  const node: MapNode = { id: 'x', column: 1, x: 0, y: 0, kind: 'fight', tier: 1, spot: spot.id, enemies: null, label: null, releaseReason: null, next: [] };
  const encounters = encountersFor(node, data).filter((e) => e.enemies.every((id) => data.enemies[id]));
  const total = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<CardType, number>;
  for (const encounter of encounters) {
    const families = new Set(encounter.enemies.flatMap((id) => creatureFamilies(id, data).map((f) => f.id)));
    const shares = slotShares(families);
    for (const t of TYPES) total[t] += shares[t] / encounters.length;
  }
  rows[`${spot.id} ${spot.name}`] = {
    creatures: encounters.length,
    ...Object.fromEntries(TYPES.map((t) => [t, `${Math.round(total[t] * 100)}%`])),
  };
}
console.log(`Reward card shares by type, tier-1 fights, by spot (rare chance ${RARE_CHANCE}%)`);
console.table(rows);

const dir = new URL('../simulation/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const csv = [['spot', 'creatures', ...TYPES].join(','), ...Object.entries(rows).map(([spot, r]) => [`"${spot}"`, r.creatures, ...TYPES.map((t) => r[t])].join(','))].join('\n') + '\n';
writeFileSync(`${dir}${OUT}-reward-shares.csv`, csv);
console.log(`Saved to simulation/${OUT}-reward-shares.csv`);
