/**
 * Balance simulation: a bot plays whole runs with the real engine and content, and this prints
 * what happened. Runs are seeded 1, 2, 3… (or from `--seed`), so the same command on the same
 * code gives the same numbers: rerun it after a change to see its effect.
 *
 *   npm run simulate -- --runs 300 [--seed 1] [--out sim] [--log 3]
 *
 * Every simulation is saved in simulation/ (git-ignored) as <name>-runs.csv (one row per run) and
 * <name>-fights.csv (one row per fight). The name is the date and time, or `--out sim`.
 *
 * `--log 3` prints the fight log of run 3's fights, to check how the bot plays.
 *
 * The bot (`playTurn`) plays one card at a time: it tries each playable card on each target and
 * keeps the one that leaves the fight in the best shape (`evaluate`), until nothing helps. On the
 * map it takes a random path (never heading home early), picks a random card reward and event
 * choice, and buys Grit in shops when it's under half. It's a decent player, not a great one.
 */
import { gameData as data } from '../src/content';
import {
  addCardToDeck,
  applyAction,
  applyEventChoice,
  availableDestinations,
  buyShopItem,
  createRun,
  enterNextLevel,
  eventChoiceBlocked,
  fightFamilies,
  finishCombat,
  isAlive,
  isCardPlayable,
  isLastLevel,
  isMapComplete,
  previewIntent,
  rollCardRewards,
  sellCreature,
  setText,
  shopItemBlocked,
  startingBuilds,
  travelTo,
  visitEvent,
  visitShop,
  visitTreasure,
  type CombatAction,
  type CombatState,
  type RunState,
  type StatusId,
} from '../src/engine';
import { en } from '../src/locales/en';
import { mkdirSync, writeFileSync } from 'node:fs';

setText(en.engine, en.terms, 'en');

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const RUNS = Number(arg('runs', '100'));
const FIRST_SEED = Number(arg('seed', '1'));
const OUT = arg('out', new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'));
const LOG_SEED = Number(arg('log', '0'));
/** A fight still going after this many turns is stopped and counted as a stall. */
const MAX_TURNS = 60;

type FightResult = 'won' | 'fled' | 'lost' | 'stalled';
interface FightRecord {
  seed: number;
  /** 1 = the run's first fight. */
  index: number;
  level: string;
  kind: 'fight' | 'miniBoss' | 'boss' | 'eventFight';
  enemies: string[];
  result: FightResult;
  turns: number;
  gritBefore: number;
  gritLost: number;
  caughtByHealth: number;
  caughtByWill: number;
  escaped: number;
  /** The creatures' total Health and average move damage this fight (after scaling). */
  hpPool: number;
}
interface RunRecord {
  seed: number;
  outcome: 'won' | 'died' | 'bossEscaped' | 'stalled';
  level: string;
  fights: number;
  grit: number;
  deck: number;
  turns: number;
  caught: number;
  caughtByWill: number;
  caughtByHealth: number;
  escaped: number;
  bucket: number;
}

// --- The bot -------------------------------------------------------------------------------

/** A small seeded RNG for the bot's own choices (path, rewards, events), apart from the game's. */
function botRng(seed: number) {
  let a = seed * 2654435761;
  return (n: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

const DEBUFFS: StatusId[] = ['vulnerable', 'weak', 'slow', 'venom', 'snared', 'cowed', 'intimidated', 'lured', 'distracted', 'dazzled'];

/** How good the fight looks for the player, right now, with the creatures' next moves coming. */
function evaluate(s: CombatState): number {
  if (s.phase === 'lost') return -1e9;
  if (s.phase === 'fled') return -1e8;
  if (s.phase === 'won') return 1e8 + s.player.hp * 100;
  let score = 0;
  let strike = 0;
  let pull = 0;
  const pulls: { escape: number; escapeAt: number; rise: number; pull: number }[] = [];
  for (const e of s.enemies) {
    if (!isAlive(e)) {
      score += 1000;
      continue;
    }
    const health = 1 - e.hp / e.maxHp;
    const will = 1 - e.escape / e.escapeAt;
    score += 100 * Math.max(health, will) + 30 * Math.min(health, will);
    for (const id of DEBUFFS) score += 2 * (e.statuses[id] ?? 0);
    const p = previewIntent(s, e, data);
    const hit = (p?.damage ?? 0) * (p?.hits ?? 1);
    strike += hit;
    pull += p?.pull ?? 0;
    pulls.push({ escape: e.escape, escapeAt: e.escapeAt, rise: e.escapeRate, pull: p?.pull ?? 0 });
  }
  // Hold soaks both: split it between what's coming, in proportion.
  const incoming = strike + pull;
  const unsoaked = incoming ? Math.max(0, incoming - s.player.block) / incoming : 0;
  const gritLost = strike * unsoaked;
  score -= gritLost * (gritLost >= s.player.hp ? 1e5 : 4 + (2 * s.player.maxHp) / Math.max(1, s.player.hp));
  for (const p of pulls) {
    const after = p.escape + p.pull * unsoaked + p.rise;
    score -= after >= p.escapeAt ? 1e5 : (100 * p.pull * unsoaked) / p.escapeAt;
  }
  score += 3 * (s.player.statuses.strength ?? 0) + 5 * (s.powers?.length ?? 0) + 2 * s.player.patience;
  return score;
}

/** The player's turn: the best card each time, while one helps, then end the turn. */
function playTurn(state: CombatState): CombatState {
  for (let plays = 0; plays < 30 && state.phase === 'playerTurn'; plays++) {
    let best: { next: CombatState; score: number } | null = null;
    for (const card of state.piles.hand) {
      if (!isCardPlayable(state, card.uid, data)) continue;
      const def = data.cards[card.defId];
      const targets = def.target === 'enemy' ? state.enemies.filter(isAlive).map((e) => e.id) : [undefined];
      for (const targetId of targets) {
        const next = applyAction(state, { type: 'playCard', cardUid: card.uid, targetId }, data);
        if (next === state) continue;
        // A small nudge to use the energy: a card that changes nothing visible (a buff) still gets played.
        const score = evaluate(next) + 1;
        if (!best || score > best.score) best = { next, score };
      }
    }
    if (!best || best.score < evaluate(state)) break;
    state = best.next;
  }
  return state.phase === 'playerTurn' ? applyAction(state, { type: 'endTurn' } as CombatAction, data) : state;
}

function fight(run: RunState, combat: CombatState, kind: FightRecord['kind'], index: number): { combat: CombatState; record: FightRecord } {
  const gritBefore = combat.player.hp;
  const hpPool = combat.enemies.reduce((sum, e) => sum + e.maxHp, 0);
  let turns = 0;
  while (combat.phase === 'playerTurn' && turns < MAX_TURNS) {
    combat = playTurn(combat);
    turns++;
  }
  const record: FightRecord = {
    seed: run.seed,
    index,
    level: data.levels[run.level].id,
    kind,
    enemies: combat.enemies.map((e) => e.defId),
    result: combat.phase === 'playerTurn' ? 'stalled' : (combat.phase as FightResult),
    turns,
    gritBefore,
    gritLost: gritBefore - Math.max(0, combat.player.hp),
    caughtByHealth: combat.enemies.filter((e) => e.hp <= 0).length,
    caughtByWill: combat.enemies.filter((e) => e.hp > 0 && e.escape <= 0).length,
    escaped: combat.enemies.filter((e) => isAlive(e) && e.escape >= e.escapeAt).length,
    hpPool,
  };
  return { combat, record };
}

function pickReward(run: RunState, families: string[], pick: (n: number) => number): RunState {
  const rewards = rollCardRewards(run, data, { families });
  return rewards.choices.length ? addCardToDeck(rewards.run, rewards.choices[pick(rewards.choices.length)], data) : rewards.run;
}

function playRun(seed: number, fights: FightRecord[]): RunRecord {
  const pick = botRng(seed);
  let run = createRun(seed, data, startingBuilds(data)[0].id);
  const end = (outcome: RunRecord['outcome']): RunRecord => {
    const mine = fights.filter((f) => f.seed === seed);
    const sum = (key: 'turns' | 'caughtByWill' | 'caughtByHealth' | 'escaped') => mine.reduce((a, f) => a + f[key], 0);
    return {
      seed,
      outcome,
      level: data.levels[run.level].id,
      fights: run.fights,
      grit: run.hp,
      deck: run.deck.length,
      turns: sum('turns'),
      caught: sum('caughtByHealth') + sum('caughtByWill'),
      caughtByWill: sum('caughtByWill'),
      caughtByHealth: sum('caughtByHealth'),
      escaped: sum('escaped'),
      bucket: run.bucket.length,
    };
  };

  for (let steps = 0; steps < 200; steps++) {
    const options = availableDestinations(run).filter((n) => n.kind !== 'leave');
    if (!options.length) break;
    const node = options[pick(options.length)];
    let combat: CombatState | undefined;
    let kind: FightRecord['kind'] = node.kind === 'miniBoss' || node.kind === 'boss' ? node.kind : 'fight';
    let eventId: string | undefined;

    if (node.kind === 'shop') {
      run = visitShop(run, node.id);
      const heal = data.shop.find((i) => i.effect.type === 'heal');
      let visit = { bought: {} as Record<string, number> };
      if (heal && run.hp * 2 < run.maxHp) {
        // Sell catches (not companions) until the Grit is affordable.
        while (run.coins < heal.price && run.bucket.length > run.companions.length) run = sellCreature(run, run.companions.length, data);
        while (!shopItemBlocked(heal, run, visit) && run.hp * 2 < run.maxHp) ({ run, visit } = buyShopItem(run, visit, heal.id, data));
      }
      continue;
    }
    if (node.kind === 'treasure') ({ run, eventId } = visitTreasure(run, node.id, data));
    else if (node.kind === 'event') {
      const visit = visitEvent(run, node.id, data);
      run = visit.run;
      if (visit.combat) (combat = visit.combat), (kind = 'eventFight');
      else eventId = visit.eventId;
    } else ({ run, combat } = travelTo(run, node.id, data));

    if (eventId) {
      const choices = data.events[eventId].choices.map((c, i) => ({ c, i })).filter(({ c }) => !eventChoiceBlocked(c, run));
      const result = applyEventChoice(run, eventId, choices[pick(choices.length)].i, data);
      run = result.cardReward ? pickReward(result.run, [], pick) : result.run;
      continue;
    }
    if (!combat) continue;

    const played = fight(run, combat, kind, run.fights);
    fights.push(played.record);
    if (seed === LOG_SEED) console.log(`\n--- Fight #${played.record.index} (${played.record.kind}): ${played.record.result}\n${played.combat.log.join('\n')}`);
    if (played.record.result === 'stalled') return end('stalled');
    run = finishCombat(run, played.combat, data);
    if (played.combat.phase === 'lost') return end('died');
    if (played.combat.phase === 'fled') {
      if (isMapComplete(run)) return end('bossEscaped');
      continue;
    }
    if (isMapComplete(run)) {
      if (isLastLevel(run, data)) return end('won');
      run = enterNextLevel(run, data);
    }
    run = pickReward(run, fightFamilies(played.combat, data), pick);
  }
  return end('stalled');
}

// --- The report ----------------------------------------------------------------------------

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '-');
const avg = (xs: number[]) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const started = Date.now();
const fights: FightRecord[] = [];
const runs: RunRecord[] = [];
for (let i = 0; i < RUNS; i++) runs.push(playRun(FIRST_SEED + i, fights));

console.log(`\n${RUNS} runs (seeds ${FIRST_SEED}–${FIRST_SEED + RUNS - 1}) in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

console.log('Run outcomes');
const outcomes = ['won', 'died', 'bossEscaped', 'stalled'] as const;
console.table(Object.fromEntries(outcomes.map((o) => [o, pct(runs.filter((r) => r.outcome === o).length, RUNS)])));
const levelNames = data.levels.map((l) => l.id);
console.log('Where runs ended (level reached)');
console.table(Object.fromEntries(levelNames.map((l) => [l, Object.fromEntries(outcomes.map((o) => [o, runs.filter((r) => r.level === l && r.outcome === o).length]))])));
console.log(`Fights per run: median ${median(runs.map((r) => r.fights))}, average ${avg(runs.map((r) => r.fights))}. Deck at the end: ${avg(runs.map((r) => r.deck))} cards.\n`);

console.log('Survival: share of runs still going at each fight, and the average Grit going into it');
const maxIndex = Math.max(...fights.map((f) => f.index));
const survival: Record<string, { alive: string; gritIn: number; died: number }> = {};
for (let i = 1; i <= maxIndex; i++) {
  const at = fights.filter((f) => f.index === i);
  survival[`#${i}`] = { alive: pct(at.length, RUNS), gritIn: avg(at.map((f) => f.gritBefore)), died: at.filter((f) => f.result === 'lost').length };
}
console.table(survival);

console.log('Fights by level and kind (escape = a creature got away, ending the fight)');
const groups: Record<string, object> = {};
for (const level of levelNames) {
  for (const kind of ['fight', 'eventFight', 'miniBoss', 'boss'] as const) {
    const fs = fights.filter((f) => f.level === level && f.kind === kind);
    if (!fs.length) continue;
    const creatures = fs.reduce((sum, f) => sum + f.enemies.length, 0);
    groups[`${level} ${kind}`] = {
      n: fs.length,
      win: pct(fs.filter((f) => f.result === 'won').length, fs.length),
      escape: pct(fs.filter((f) => f.result === 'fled').length, fs.length),
      death: pct(fs.filter((f) => f.result === 'lost').length, fs.length),
      turns: avg(fs.map((f) => f.turns)),
      gritLost: avg(fs.map((f) => f.gritLost)),
      hpPool: avg(fs.map((f) => f.hpPool)),
      'by Health': pct(fs.reduce((s, f) => s + f.caughtByHealth, 0), creatures),
      'by Will': pct(fs.reduce((s, f) => s + f.caughtByWill, 0), creatures),
    };
  }
}
console.table(groups);

const perCreature = new Map<string, FightRecord[]>();
for (const f of fights) for (const id of new Set(f.enemies)) perCreature.set(id, [...(perCreature.get(id) ?? []), f]);
const creatureRows = [...perCreature].filter(([, fs]) => fs.length >= 5).map(([id, fs]) => ({
  id,
  met: fs.length,
  escape: fs.filter((f) => f.result === 'fled').length / fs.length,
  death: fs.filter((f) => f.result === 'lost').length / fs.length,
  gritLost: avg(fs.map((f) => f.gritLost)),
  turns: avg(fs.map((f) => f.turns)),
}));
const show = (rows: typeof creatureRows) =>
  console.table(Object.fromEntries(rows.slice(0, 10).map((r) => [r.id, { met: r.met, escape: pct(r.escape, 1), death: pct(r.death, 1), gritLost: r.gritLost, turns: r.turns }])));
console.log('Creatures that get away most (met 5+ times)');
show([...creatureRows].sort((a, b) => b.escape - a.escape));
console.log('Creatures that cost the most Grit (met 5+ times)');
show([...creatureRows].sort((a, b) => b.gritLost - a.gritLost));

/** Rows of plain values as CSV, with a header from the first row's keys. Lists are joined with spaces. */
function toCsv(rows: object[]): string {
  const cell = (v: unknown) => {
    const text = Array.isArray(v) ? v.join(' ') : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const keys = Object.keys(rows[0] ?? {});
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell((r as Record<string, unknown>)[k])).join(','))].join('\n') + '\n';
}

const dir = new URL('../simulation/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const base = dir + OUT.replace(/\.csv$/, '');
writeFileSync(`${base}-runs.csv`, toCsv(runs));
writeFileSync(`${base}-fights.csv`, toCsv(fights));
console.log(`Every run written to ${base}-runs.csv, every fight to ${base}-fights.csv`);
