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
 * Companions: `--companions clownfish,blueTang --bond 2` starts every run with those creatures
 * brought from home, at that bond level (0–3). `--lineups` plays the same seeds with no
 * companions, then with standard lineups of each temperament, and ranks them (<name>-lineups.csv).
 *
 * `--build foraging` plays that build instead of the first one (Rod), locked or not.
 *
 * `--campaign 20` plays 20 runs in a row (seeds from `--seed`) sharing one home aquarium, starting
 * empty: the bot brings its best companions (`chooseCompanions`), heads home at a leave node when
 * under half Grit, and hatches eggs at once. Fishermen of locked builds stand on its maps, and it
 * unlocks builds as a player would (it keeps playing its build). It reports how fast bond grows,
 * and the run each build was unlocked on (<name>-campaign.csv).
 *
 * The bot (`playTurn`) plays one card at a time: it tries each playable card on each target and
 * keeps the one that leaves the fight in the best shape (`evaluate`), until nothing helps. On the
 * map it takes a random path (never heading home early), picks a random card reward and event
 * choice, and buys Grit in shops when it's under half. It's a decent player, not a great one.
 */
import { BOND_BY_TIER } from '../src/content/creatures';
import { gameData as data } from '../src/content';
import {
  addCardToDeck,
  applyAction,
  applyEventChoice,
  availableDestinations,
  activeBonuses,
  BOND_LEVELS,
  bondLevel,
  bondPerFight,
  bondThreshold,
  bringCatchHome,
  CATCH_SIZES,
  catchesOf,
  companionStars,
  FULL_SCHOOL,
  hatchling,
  keepCatch,
  layEggs,
  MAX_BOND_LEVEL,
  restAtHome,
  saleValue,
  sellCatch,
  SESSION_SLOTS,
  takeFromHome,
  visitLeave,
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
  fishermenToMeet,
  newUnlocks,
  questProgress,
  startingBuilds,
  visitFisherman,
  travelTo,
  visitEvent,
  visitShop,
  visitTreasure,
  type CombatAction,
  type CatchSize,
  type CombatState,
  type HomeCreature,
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
const COMPANIONS = arg('companions', '').split(',').filter(Boolean);
const BOND = Number(arg('bond', '0'));
const LINEUPS = args.includes('--lineups');
const CAMPAIGN = Number(arg('campaign', '0'));
const BUILD = arg('build', startingBuilds(data)[0].id);
if (!data.builds[BUILD]) throw new Error(`Unknown build "${BUILD}"`);
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
  /** The creatures' total Health this fight (after scaling). */
  hpPool: number;
  /** The player's Patience when the fight ended. */
  patience: number;
  /** Moves the creatures played, by role (a heavy turn is the move right after a Wind-up). */
  creatureTurns: number;
  normalTurns: number;
  paceTurns: number;
  specialTurns: number;
  windUpTurns: number;
  heavyTurns: number;
  /** Sizes of the creatures caught. */
  sizes: CatchSize[];
}
interface RunRecord {
  seed: number;
  /** `left`: headed home at a leave node (campaign only). */
  outcome: 'won' | 'left' | 'died' | 'bossEscaped' | 'stalled';
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
  companions: string[];
  /** Each companion's stars at the start of the run, in the same order. */
  companionStars: number[];
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
  // Junk in hand: Grit lost at the end of the turn, or less Hold.
  for (const card of s.piles.hand) {
    const inHand = data.cards[card.defId]?.inHand;
    score -= 8 * (inHand?.gritAtEndOfTurn ?? 0) + 3 * (inHand?.holdLess ?? 0);
  }
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
    patience: combat.player.patience,
    ...creatureTurns(combat),
    sizes: [],
  };
  return { combat, record };
}

const ROLES = ['normal', 'pace', 'special', 'windUp', 'heavy'] as const;

function creatureTurns(combat: CombatState) {
  const roles = combat.enemies.flatMap((e) => {
    const moves = e.moveHistory.map((id) => data.enemies[e.defId].moves.find((m) => m.id === id));
    return moves.map((m, i) => (moves[i - 1]?.role === 'windUp' ? 'heavy' : (m?.role ?? 'normal')));
  });
  const count = (role: (typeof ROLES)[number]) => roles.filter((r) => r === role).length;
  return {
    creatureTurns: roles.length,
    normalTurns: count('normal'),
    paceTurns: count('pace'),
    specialTurns: count('special'),
    windUpTurns: count('windUp'),
    heavyTurns: count('heavy'),
  };
}

/** Each role's share of the creatures' turns in these fights. */
function roleShares(fs: FightRecord[]): Record<string, string> {
  const total = fs.reduce((s, f) => s + f.creatureTurns, 0);
  return Object.fromEntries(ROLES.map((role) => [role, pct(fs.reduce((s, f) => s + f[`${role}Turns`], 0), total)]));
}

function pickReward(run: RunState, families: string[], pick: (n: number) => number): RunState {
  const rewards = rollCardRewards(run, data, { families });
  return rewards.choices.length ? addCardToDeck(rewards.run, rewards.choices[pick(rewards.choices.length)], data) : rewards.run;
}

/** Bucket full: sell the lowest-value creature that isn't a companion, the waiting catch included. */
function makeRoom(run: RunState): RunState {
  while (run.waiting.length) {
    const value = (slot: number) => saleValue(slot < 0 ? run.waiting[0].id : run.bucket[slot].id, 0, data);
    let cheapest = -1;
    for (let slot = run.companions.length; slot < run.bucket.length; slot++) if (value(slot) < value(cheapest)) cheapest = slot;
    run = cheapest < 0 ? sellCatch(run, data) : keepCatch(run, cheapest, data);
  }
  return run;
}

/**
 * One run, with `brought` companions. With `headHome` (the campaign), the bot takes a leave node
 * when it's under half Grit. `fishermen` stand on the maps; the ones it meets go in `met`.
 */
function playRun(
  seed: number,
  fights: FightRecord[],
  brought: readonly HomeCreature[] = [],
  headHome = false,
  fishermen: readonly string[] = [],
  met: string[] = [],
): { record: RunRecord; run: RunState } {
  const pick = botRng(seed);
  let run = createRun(seed, data, BUILD, brought, undefined, fishermen);
  const end = (outcome: RunRecord['outcome']) => {
    const mine = fights.filter((f) => f.seed === seed);
    const sum = (key: 'turns' | 'caughtByWill' | 'caughtByHealth' | 'escaped') => mine.reduce((a, f) => a + f[key], 0);
    const record: RunRecord = {
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
      companions: brought.map((c) => c.id),
      companionStars: brought.map((c) => companionStars(c, data)),
    };
    return { record, run };
  };

  for (let steps = 0; steps < 200; steps++) {
    const leave = availableDestinations(run).find((n) => n.kind === 'leave');
    if (headHome && leave && run.hp * 2 < run.maxHp) {
      run = visitLeave(run, leave.id);
      return end('left');
    }
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
    if (node.kind === 'fisherman') {
      run = visitFisherman(run, node.id, data);
      if (node.fisherman && !met.includes(node.fisherman)) met.push(node.fisherman);
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
    played.record.sizes = catchesOf(run, played.combat).map((c) => c.size);
    fights.push(played.record);
    if (seed === LOG_SEED) console.log(`\n--- Fight #${played.record.index} (${played.record.kind}): ${played.record.result}\n${played.combat.log.join('\n')}`);
    if (played.record.result === 'stalled') return end('stalled');
    run = makeRoom(finishCombat(run, played.combat, data));
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

/** Every seed played once with these creatures brought from home. */
function simulate(brought: readonly HomeCreature[] = []): { runs: RunRecord[]; fights: FightRecord[] } {
  const fights: FightRecord[] = [];
  const runs: RunRecord[] = [];
  for (let i = 0; i < RUNS; i++) runs.push(playRun(FIRST_SEED + i, fights, brought).record);
  return { runs, fights };
}

function report(runs: RunRecord[], fights: FightRecord[], started: number) {
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
        patience: avg(fs.map((f) => f.patience)),
        'by Health': pct(fs.reduce((s, f) => s + f.caughtByHealth, 0), creatures),
        'by Will': pct(fs.reduce((s, f) => s + f.caughtByWill, 0), creatures),
      };
    }
  }
  console.table(groups);

  console.log('All ages together (the balance targets: fights 4–6 turns, 8–10 Grit lost in normal fights, 10–20% escapes; Patience 2–3)');
  const byKind: Record<string, object> = {};
  for (const [name, kinds] of [['normal fights', ['fight', 'eventFight']], ['mini-boss', ['miniBoss']], ['boss', ['boss']]] as const) {
    const fs = fights.filter((f) => (kinds as readonly string[]).includes(f.kind));
    byKind[name] = {
      n: fs.length,
      turns: avg(fs.map((f) => f.turns)),
      gritLost: avg(fs.map((f) => f.gritLost)),
      escape: pct(fs.filter((f) => f.result === 'fled').length, fs.length),
      patience: avg(fs.map((f) => f.patience)),
      ...roleShares(fs),
    };
  }
  console.table(byKind);

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
}

/** Rows of plain values as CSV, with a header from the first row's keys. Lists are joined with spaces. */
function toCsv(rows: object[]): string {
  const cell = (v: unknown) => {
    const text = Array.isArray(v) ? v.join(' ') : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const keys = Object.keys(rows[0] ?? {});
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell((r as Record<string, unknown>)[k])).join(','))].join('\n') + '\n';
}

// --- Companions ----------------------------------------------------------------------------

/** A creature brought from home at bond `level`. */
function atBond(id: string, level: number): HomeCreature {
  if (!data.enemies[id]) throw new Error(`Unknown creature "${id}"`);
  return { id, bond: level ? bondThreshold(id, level, data) : 0, size: 'normal' };
}

/**
 * The standard lineups of each temperament, from its species in creatures.ts order: one tier 1
 * at bond 1, two different tier 1s at bond 1, a full school of the lowest tiers at bond 1, and
 * one of the highest tier at bond 3. A lineup the temperament lacks the species for is skipped.
 */
function lineups(): { name: string; brought: HomeCreature[] }[] {
  return Object.keys(data.companionBonuses).flatMap((temperament) => {
    const species = Object.values(data.enemies)
      .filter((e) => e.temperament === temperament)
      .sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1));
    const tier1 = species.filter((e) => e.tier === 1);
    const top = species.find((e) => e.tier === species[species.length - 1].tier)!;
    return [
      tier1.length >= 1 && { name: `${temperament} 1 tier 1`, brought: [atBond(tier1[0].id, 1)] },
      tier1.length >= 2 && { name: `${temperament} 2 tier 1`, brought: tier1.slice(0, 2).map((e) => atBond(e.id, 1)) },
      species.length >= 3 && { name: `${temperament} full school`, brought: species.slice(0, 3).map((e) => atBond(e.id, 1)) },
      { name: `${temperament} tier ${top.tier} bond 3`, brought: [atBond(top.id, 3)] },
    ].filter((l) => !!l);
  });
}

/** One row of the lineup ranking: how runs went with these companions. */
function lineupRow(name: string, brought: HomeCreature[], { runs, fights }: { runs: RunRecord[]; fights: FightRecord[] }) {
  const share = (outcome: RunRecord['outcome']) => Math.round((1000 * runs.filter((r) => r.outcome === outcome).length) / runs.length) / 10;
  return {
    lineup: name,
    companions: brought.map((c) => c.id).join(' '),
    won: share('won'),
    died: share('died'),
    bossEscaped: share('bossEscaped'),
    medianFights: median(runs.map((r) => r.fights)),
    gritPerFight: avg(fights.map((f) => f.gritLost)),
  };
}

// --- Campaign ----------------------------------------------------------------------------

/** A home creature followed through the campaign: `trips` = successful runs it was brought on. */
type Tracked = HomeCreature & { uid: number; trips: number };

/**
 * The campaign bot's companions: for each temperament, its best creature of each species (by
 * stars), then its others; the temperament whose first 3 make a full school, then give the most
 * stars, wins. Returns slots in `home`.
 */
function chooseCompanions(home: readonly HomeCreature[]): number[] {
  const slotsOf = new Map<string, number[]>();
  home.forEach((c, slot) => {
    const temperament = data.enemies[c.id]?.temperament;
    if (temperament && data.companionBonuses[temperament]) slotsOf.set(temperament, [...(slotsOf.get(temperament) ?? []), slot]);
  });
  let best: { slots: number[]; score: number } | null = null;
  for (const slots of slotsOf.values()) {
    const sorted = [...slots].sort((a, b) => companionStars(home[b], data) - companionStars(home[a], data));
    const firsts = sorted.filter((slot, i) => sorted.findIndex((other) => home[other].id === home[slot].id) === i);
    const picked = [...firsts, ...sorted.filter((slot) => !firsts.includes(slot))].slice(0, SESSION_SLOTS);
    const bonus = activeBonuses(picked.map((slot) => home[slot]), data)[0];
    const score = (bonus.species >= FULL_SCHOOL ? 1000 : 0) + bonus.stars;
    if (!best || score > best.score) best = { slots: picked, score };
  }
  return best?.slots ?? [];
}

function campaign(runsInARow: number) {
  let home: Tracked[] = [];
  let nextUid = 0;
  const track = (c: HomeCreature): Tracked => ({ uid: nextUid++, trips: 0, ...c });
  const fights: FightRecord[] = [];
  const rows: ({ run: number; outcome: RunRecord['outcome'] } & Record<string, unknown>)[] = [];
  /** The run in which a creature first reached each bond level, and, per level, the trips each creature took to reach it, with its tier. */
  const firstRun: (number | null)[] = Array(MAX_BOND_LEVEL).fill(null);
  const reached = new Map<number, Set<number>>();
  const tripsTo: { level: number; tier: number; trips: number }[] = [];
  let companionsLost = 0;
  const bucketsHome: number[] = [];
  /** Builds unlocked, the run each was unlocked on, and the fishermen met (and the run of the first meeting). */
  const unlocked: string[] = [];
  const unlockedOn: Record<string, number> = {};
  const met: string[] = [];
  const metOn: Record<string, number> = {};

  for (let i = 0; i < runsInARow; i++) {
    const { home: left, brought } = takeFromHome(home, chooseCompanions(home));
    const { record, run } = playRun(FIRST_SEED + i, fights, brought, true, fishermenToMeet(data, unlocked), met);
    for (const id of met) metOn[id] ??= i + 1;
    const success = record.outcome === 'won' || record.outcome === 'left';
    home = restAtHome(left, data) as Tracked[];
    if (success) {
      // bringCatchHome copies the companions with their extra fields: one more trip each.
      const back = bringCatchHome([], run, data);
      home.push(...back.slice(0, run.companions.length).map((c) => ({ ...(c as Tracked), trips: (c as Tracked).trips + 1 })));
      home.push(...back.slice(run.companions.length).map(track));
      bucketsHome.push(run.bucket.length);
      for (const id of newUnlocks(data, unlocked, met, home, run.questsShown)) {
        unlocked.push(id);
        unlockedOn[id] = i + 1;
      }
    }
    companionsLost += brought.length - (success ? run.companions.length : 0);
    home.push(...layEggs(home, run, data).map((id) => track(hatchling(id, data))));
    for (const c of home) {
      const levels = reached.get(c.uid) ?? new Set();
      for (let level = 1; level <= bondLevel(c, data); level++) {
        if (levels.has(level)) continue;
        levels.add(level);
        firstRun[level - 1] ??= i + 1;
        tripsTo.push({ level, tier: data.enemies[c.id]?.tier ?? 1, trips: c.trips });
      }
      reached.set(c.uid, levels);
    }
    rows.push({
      run: i + 1,
      outcome: record.outcome,
      fights: record.fights,
      companions: brought.map((c) => `${c.id}:${companionStars(c, data)}`),
      bucketHome: success ? run.bucket.length : 0,
      home: home.length,
      bestBond: Math.max(0, ...home.map((c) => bondLevel(c, data))),
      met: met.join(' '),
      unlocked: unlocked.join(' '),
      // Each quest's progress after the run: at home, e.g. "foraging 3/6", or shown in the bucket ("net shown").
      quests: Object.values(data.builds)
        .filter((b) => b.unlock)
        .map((b) => {
          if (b.unlock!.quest.type === 'inBucket') return `${b.id} ${run.questsShown.includes(b.id) ? 'shown' : '-'}`;
          const { have, need } = questProgress(b.unlock!.quest, home, data);
          return `${b.id} ${have}/${need}`;
        })
        .join(' '),
    });
  }

  const successes = rows.filter((r) => r.outcome === 'won' || r.outcome === 'left').length;
  console.log(`\nCampaign: ${runsInARow} runs in a row (seeds ${FIRST_SEED}–${FIRST_SEED + runsInARow - 1}), one home aquarium`);
  console.table(Object.fromEntries(rows.map(({ run, ...r }) => [run, r])));
  console.log(`Successful runs ${successes}, lost ${runsInARow - successes}. Companions lost: ${companionsLost}. Bucket brought home: ${avg(bucketsHome)} on average.`);
  console.log('Builds to unlock: the run their fisherman was first met on, and the run they were unlocked on');
  console.table(
    Object.fromEntries(
      Object.values(data.builds)
        .filter((b) => b.unlock)
        .map((b) => [b.id, { met: metOn[b.unlock!.fisherman] ?? 'never', unlocked: unlockedOn[b.id] ?? 'never' }]),
    ),
  );
  console.log('Run in which the first creature reached each bond level');
  console.table(Object.fromEntries(firstRun.map((run, i) => [`level ${i + 1}`, run ?? 'never'])));
  console.log('Successful runs a creature was brought on before reaching each level (target: level 2 in 2–3, level 3 in about 5)');
  const tripRows: Record<string, object> = {};
  for (let level = 1; level <= MAX_BOND_LEVEL; level++) {
    for (const tier of [1, 2, 3]) {
      const trips = tripsTo.filter((t) => t.level === level && t.tier === tier && t.trips > 0).map((t) => t.trips);
      if (trips.length) tripRows[`level ${level}, tier ${tier}`] = { creatures: trips.length, median: median(trips), fewest: Math.min(...trips), most: Math.max(...trips) };
    }
  }
  console.table(tripRows);
  // The bond a companion brought along would gain in each run (`bondPerFight` over its fights), whoever was brought.
  const tierOf = (level: string) => data.levels.find((l) => l.id === level)?.tier ?? 1;
  const bondOf = (seed: number) => fights.filter((f) => f.seed === seed).reduce((sum, f) => sum + bondPerFight(tierOf(f.level), f.kind === 'miniBoss' || f.kind === 'boss'), 0);
  const bondRows: Record<string, object> = {};
  for (const [name, which] of [['successful runs', ['won', 'left']], ['all runs', ['won', 'left', 'died', 'bossEscaped', 'stalled']]] as const) {
    const bond = rows.filter((r) => (which as readonly string[]).includes(r.outcome)).map((r) => bondOf(FIRST_SEED + r.run - 1));
    if (!bond.length) continue;
    const runsTo = (tier: 1 | 2 | 3, level: number) => Math.ceil(Math.ceil(BOND_BY_TIER[tier] * BOND_LEVELS[level - 1]) / Math.max(1, median(bond)));
    bondRows[name] = {
      runs: bond.length,
      'median bond': median(bond),
      'tier 1 → level 2/3': `${runsTo(1, 2)} / ${runsTo(1, 3)}`,
      'tier 2 → level 2/3': `${runsTo(2, 2)} / ${runsTo(2, 3)}`,
      'tier 3 → level 2/3': `${runsTo(3, 2)} / ${runsTo(3, 3)}`,
    };
  }
  console.log('Bond a companion gains per run, and the runs like these it would take to reach bond levels 2 and 3');
  console.table(bondRows);
  const sizes = fights.flatMap((f) => f.sizes);
  console.log(`Sizes of the ${sizes.length} catches`);
  console.table(Object.fromEntries(CATCH_SIZES.map((size) => [size, pct(sizes.filter((s) => s === size).length, sizes.length)])));
  return rows;
}

// --- Main ----------------------------------------------------------------------------------

const dir = new URL('../simulation/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const base = dir + OUT.replace(/\.csv$/, '');
const started = Date.now();

if (CAMPAIGN) {
  writeFileSync(`${base}-campaign.csv`, toCsv(campaign(CAMPAIGN)));
  console.log(`Written to ${base}-campaign.csv`);
} else if (LINEUPS) {
  const none = lineupRow('no companions', [], simulate());
  const rows = [none, ...lineups().map((l) => lineupRow(l.name, l.brought, simulate(l.brought)))].map((r) => ({
    ...r,
    'Δwon': Math.round(10 * (r.won - none.won)) / 10,
    'Δdied': Math.round(10 * (r.died - none.died)) / 10,
    'ΔmedianFights': r.medianFights - none.medianFights,
    'ΔgritPerFight': Math.round(10 * (r.gritPerFight - none.gritPerFight)) / 10,
  }));
  // A power ranking by survival: the bot never heads home, so the further runs go, the stronger the lineup.
  rows.sort((a, b) => b.medianFights - a.medianFights || b.won - a.won || a.gritPerFight - b.gritPerFight);
  console.log(`\nLineups, ${RUNS} runs each (seeds ${FIRST_SEED}–${FIRST_SEED + RUNS - 1}) in ${((Date.now() - started) / 1000).toFixed(1)}s. Outcomes in %.`);
  console.table(Object.fromEntries(rows.map(({ lineup, companions: _, ...r }) => [lineup, r])));
  writeFileSync(`${base}-lineups.csv`, toCsv(rows));
  console.log(`Written to ${base}-lineups.csv`);
} else {
  const { runs, fights } = simulate(COMPANIONS.map((id) => atBond(id, BOND)));
  report(runs, fights, started);
  writeFileSync(`${base}-runs.csv`, toCsv(runs));
  writeFileSync(`${base}-fights.csv`, toCsv(fights));
  console.log(`Every run written to ${base}-runs.csv, every fight to ${base}-fights.csv`);
}
