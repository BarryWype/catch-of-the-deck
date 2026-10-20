import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

// useGame's module tree reads these at import; the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

const writes = { profile: vi.fn() };
vi.mock('../src/ui/saveStore', () => ({
  SAVE_VERSION: 1,
  PROFILE_VERSION: 1,
  loadSavedGame: async () => null,
  loadProfile: async () => ({ version: 1, homeAquarium: [], creatureBook: {}, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 4, logbook: ['tackleBox'], recovering: [] }),
  writeProfile: writes.profile,
  writeSavedGame: () => {},
  clearSavedGame: () => {},
  clearProfile: () => {},
  applyTransfer: () => {},
}));

const { useGame } = await import('../src/ui/useGame');
const engine = await import('../src/engine');
type CompanionEffect = import('../src/engine').CompanionEffect;
const { gameData } = await import('../src/content');
const { contentSource } = await import('../src/content');
const { caught, homeCreature, testData } = await import('./fixtures');
const {
  activeBonuses,
  buyNode,
  createRun,
  debugCatch,
  debugSetPlayer,
  discountedPrice,
  finishCombat,
  GOLDEN_SHELLS,
  nodeBlocked,
  progressionLayout,
  restAtHome,
  rewardOptions,
  rollCardRewards,
  runSellBonus,
  sellCreature,
  shellsEarned,
  startScenario,
  storeItems,
  bondLevel,
  travelTo,
  validateContent,
  validateScenario,
  CARD_REWARD_COUNT,
  BUCKET_SIZE,
  REWARD_REROLLS_AT_START,
} = engine;

const everything = gameData.progression.map((n) => n.id);
/** The real Logbook's nodes, on the test content (its numbers stay fixed). */
const testLogbook = { ...testData, progression: gameData.progression };
const nodesOfType = (type: string) => gameData.progression.filter((n) => n.effect.type === type).map((n) => n.id);

/** A real run standing on its first level's `kind`, the fight there started. */
function at(kind: 'miniBoss' | 'boss', progression: string[] = []) {
  const run = createRun(1, gameData, 'rod', [], undefined, [], progression);
  const nodes = run.map.columns.flat();
  const target = nodes.find((n) => n.kind === kind)!;
  const before = nodes.find((n) => n.next.includes(target.id))!;
  return travelTo({ ...run, position: before.id }, target.id, gameData);
}

describe('golden shells', () => {
  it('a won mini-boss gives 1, a boss 2, anything else or a fight not won none', () => {
    expect(GOLDEN_SHELLS).toEqual({ miniBoss: 1, boss: 2 });
    const mini = at('miniBoss');
    const boss = at('boss');
    expect(shellsEarned(mini.run, { ...mini.combat, phase: 'won' })).toBe(1);
    expect(shellsEarned(boss.run, { ...boss.combat, phase: 'won' })).toBe(2);
    expect(shellsEarned(boss.run, { ...boss.combat, phase: 'fled' })).toBe(0);
    expect(shellsEarned(boss.run, { ...boss.combat, phase: 'lost' })).toBe(0);
    const fight = travelTo(createRun(1, gameData, 'rod'), createRun(1, gameData, 'rod').map.columns[1][0].id, gameData);
    expect(shellsEarned(fight.run, { ...fight.combat, phase: 'won' })).toBe(0);
  });

  it('are saved to the profile as soon as the mini-boss is beaten, and shown on its reward', async () => {
    const game = useGame(1);
    await nextTick();
    expect(game.logbook.value).toEqual({ shells: 4, unlocked: ['tackleBox'] });
    const { run, combat } = at('miniBoss', ['tackleBox']);
    game.run.value = run;
    game.combat.value = { ...combat, phase: 'won' };
    game.screen.value = 'combat';
    game.claimVictory();
    expect(game.logbook.value.shells).toBe(5);
    expect(game.shellsWon.value).toBe(1);
    expect(writes.profile).toHaveBeenLastCalledWith(expect.objectContaining({ goldenShells: 5, logbook: ['tackleBox'] }));
    expect(game.screen.value).toBe('reward');
  });

  it('are kept when the run is lost afterwards (in the sandbox, a boss gives 2)', async () => {
    const game = useGame(1);
    await nextTick();
    game.playScenario({ seed: 3, build: 'rod', level: 0, start: { type: 'boss' }, profile: { unlocked: [], fishermenMet: [], home: [], shells: 0 } });
    let fight = game.combat.value!;
    for (const e of fight.enemies) if (fight.phase !== 'won') fight = debugCatch(fight, e.id, 'will');
    game.setDebugCombat(fight);
    game.claimVictory();
    expect(game.logbook.value.shells).toBe(2);
    // On to the next level's first fight, and lose it.
    game.chooseReward(game.rewardChoices.value[0]);
    game.travel(game.run.value!.map.columns[1][0].id);
    if (game.combat.value) game.setDebugCombat(debugSetPlayer(game.combat.value, { hp: 0 }));
    expect(game.combat.value?.phase).toBe('lost');
    expect(game.logbook.value.shells).toBe(2);
    // The real profile comes back as it was.
    game.toMenu();
    expect(game.logbook.value).toEqual({ shells: 4, unlocked: ['tackleBox'] });
  });
});

describe('buying Logbook nodes', () => {
  it('needs the node before it and its cost in shells, once', () => {
    expect(nodeBlocked('savingsJar', { shells: 99, unlocked: [] }, gameData)).toBe('Buy the one before it first.');
    expect(nodeBlocked('tackleBox', { shells: 9, unlocked: [] }, gameData)).toBe('Not enough golden shells.');
    const bought = buyNode({ shells: 12, unlocked: [] }, 'tackleBox', gameData);
    expect(bought).toEqual({ shells: 2, unlocked: ['tackleBox'] });
    expect(nodeBlocked('tackleBox', { ...bought, shells: 99 }, gameData)).toBe('Already bought.');
    expect(() => buyNode({ ...bought, shells: 99 }, 'tackleBox', gameData)).toThrow('Already bought.');
    expect(() => buyNode({ shells: 24, unlocked: ['tackleBox'] }, 'savingsJar', gameData)).toThrow();
    expect(buyNode({ shells: 25, unlocked: ['tackleBox'] }, 'savingsJar', gameData).shells).toBe(0);
    expect(() => buyNode({ shells: 99, unlocked: [] }, 'ghost', gameData)).toThrow();
  });

  it('are laid out by track and requires, each track a column of 10, 25, 45 and 70', () => {
    const { tracks, nodes } = progressionLayout(gameData);
    expect(tracks).toEqual(['gear', 'haggling', 'creatures']);
    for (const [column] of tracks.entries()) {
      const track = nodes.filter((n) => n.column === column).sort((a, b) => a.row - b.row);
      expect(track.map((n) => n.row)).toEqual([0, 1, 2, 3]);
      expect(track.map((n) => n.node.cost)).toEqual([10, 25, 45, 70]);
    }
  });

  it('content checks catch unknown requires, unknown store items, loops and bad costs', () => {
    expect(validateContent(contentSource)).toEqual([]);
    const [first, second, ...rest] = contentSource.progression;
    const errorsWith = (...nodes: typeof contentSource.progression) => validateContent({ ...contentSource, progression: [...nodes, ...rest] });
    expect(errorsWith({ ...first, requires: ['ghost'] }, second)).toEqual([expect.stringContaining('requires unknown node "ghost"')]);
    expect(errorsWith({ ...first, effect: { type: 'shopItem', item: 'ghost' } }, second)).toEqual([expect.stringContaining('unknown shop item "ghost"')]);
    expect(errorsWith({ ...first, requires: [second.id] }, second)).toEqual([expect.stringContaining('requires itself'), expect.stringContaining('requires itself')]);
    expect(errorsWith({ ...first, cost: 0 }, second)).toEqual([expect.stringContaining('cost must be')]);
  });
});

describe('Logbook effects, where each number is used', () => {
  it('a run starts with more rerolls, coins and bucket space', () => {
    const plain = createRun(1, gameData, 'rod');
    const run = createRun(1, gameData, 'rod', [], undefined, [], everything);
    expect(plain).toMatchObject({ rewardRerolls: REWARD_REROLLS_AT_START, coins: 0, bucketSize: BUCKET_SIZE, progression: [] });
    expect(run).toMatchObject({ rewardRerolls: REWARD_REROLLS_AT_START + 1, coins: 10, bucketSize: BUCKET_SIZE + 2, progression: everything });
    expect(rewardOptions(run, gameData).rerolls).toBe(REWARD_REROLLS_AT_START + 1);
  });

  it('the life jacket, parcel and lucky lure are only sold once unlocked', () => {
    const tackle = (progression: string[]) => storeItems(createRun(1, gameData, 'rod', [], undefined, [], progression), { store: 'tackle' }, gameData).map((i) => i.id);
    expect(tackle([])).toEqual(['spareHook', 'removeCard']);
    expect(tackle(['lifeJackets'])).toEqual(['lifeJacket', 'spareHook', 'removeCard']);
    expect(tackle(everything)).toEqual(['lifeJacket', 'parcel', 'luckyLure', 'spareHook', 'removeCard']);
    const run = createRun(1, gameData, 'rod');
    expect(() => engine.buyShopItem({ ...run, coins: 99, bucket: caught('clownfish') }, { store: 'tackle', bought: {} }, 'lifeJacket', gameData, 0)).toThrow();
  });

  it('store prices are 20% lower, rounded down, and that is what buying costs', () => {
    expect(discountedPrice(13, nodesOfType('shopDiscount'), gameData)).toBe(10);
    expect(discountedPrice(13, [], gameData)).toBe(13);
    const run = { ...createRun(1, gameData, 'rod', [], undefined, [], ['lifeJackets', 'parcels', 'haggler']), coins: 50 };
    const prices = Object.fromEntries(storeItems(run, { store: 'cafe' }, gameData).map((i) => [i.id, i.price]));
    expect(prices).toEqual({ cocoa: 12, espresso: 16 });
    const bought = engine.buyShopItem({ ...run, hp: 1 }, { store: 'cafe', bought: {} }, 'cocoa', gameData);
    expect(bought.run.coins).toBe(38);
  });

  it('the sell bonus adds to the companions’ (not multiplied), then rounds up once as every sale does', () => {
    // shellA sells for 10; its temperament gives +10%, the Logbook +20%: 10 × 130% = 13 (not 10 × 110% × 120% = 13.2 → 14).
    const fishmonger = nodesOfType('sellBonus');
    const run = { ...createRun(5, testLogbook, 'basic', [homeCreature('shellA')], undefined, [], fishmonger), bucket: caught('shellA', 'dummy') };
    expect(runSellBonus(run, testLogbook)).toBe(30);
    expect(sellCreature(run, 0, testLogbook).coins).toBe(13);
    // dummy sells for 5: 5 × 130% = 6.5 → 7.
    expect(sellCreature(run, 1, testLogbook).coins).toBe(7);
    // On capture, the spear's +20% and the Logbook's add up too: 5 × 140% = 7.
    const plain = { ...createRun(5, testLogbook, 'basic', [], undefined, [], fishmonger), equipment: ['spear'] };
    const fight = travelTo(plain, '1a', testLogbook);
    expect(finishCombat(fight.run, { ...fight.combat, phase: 'won' }, testLogbook).coins).toBe(7);
  });

  it('card rewards offer one more card', () => {
    const run = createRun(1, gameData, 'rod', [], undefined, [], nodesOfType('rewardChoices'));
    expect(rollCardRewards(run, gameData).choices).toHaveLength(CARD_REWARD_COUNT + 1);
    expect(rollCardRewards(createRun(1, gameData, 'rod'), gameData).choices).toHaveLength(CARD_REWARD_COUNT);
  });

  it('every companion counts one more star, in the fight’s bonuses too', () => {
    const stars = nodesOfType('companionStars');
    const brought = [homeCreature('shellA'), homeCreature('shellB')];
    expect(activeBonuses(brought, testLogbook)[0].stars).toBe(2);
    expect(activeBonuses(brought, testLogbook, 1)[0].stars).toBe(4);
    // One shellA: bonusBlock byStars [1, 2], so 1★ gives 1 and 2★ gives 2.
    const run = createRun(5, testLogbook, 'basic', [homeCreature('shellA')], undefined, [], stars);
    const block = (effects: readonly CompanionEffect[]) => effects.find((e) => e.type === 'bonusBlock') as { amount: number };
    expect(block(travelTo(run, '1a', testLogbook).combat.bonuses).amount).toBe(2);
    expect(block(travelTo({ ...run, progression: [] }, '1a', testLogbook).combat.bonuses).amount).toBe(1);
    expect(engine.runCompanionEffects(run, testLogbook)).toEqual(engine.companionEffects([homeCreature('shellA')], testLogbook, 1));
  });

  it('creatures resting at home bond up to level 2', () => {
    // shellA: full bond 100, level 1 at 20, level 2 at 50; resting gives 2 points.
    const home = [homeCreature('shellA', 19), homeCreature('shellA', 49), homeCreature('shellA', 50)];
    expect(restAtHome(home, testData).map((c) => c.bond)).toEqual([20, 49, 50]);
    const rested = restAtHome(home, testData, engine.restingBondLevel(nodesOfType('restingBondLevel'), testLogbook));
    expect(rested.map((c) => c.bond)).toEqual([21, 50, 50]);
    expect(bondLevel(rested[1], testData)).toBe(2);
    expect(engine.restingBondLevel([], gameData)).toBe(1);
  });
});

describe('the debug sandbox and the Logbook', () => {
  it('a scenario profile sets the shells and nodes, any of them, and checks their ids', () => {
    const scenario = { build: 'rod', level: 0, start: { type: 'shop' as const, store: 'tackle' as const }, profile: { unlocked: [], fishermenMet: [], home: [], shells: 7, progression: ['luckyLures'] } };
    expect(validateScenario(scenario, gameData)).toBeNull();
    const { run } = startScenario(scenario, gameData);
    expect(storeItems(run, { store: 'tackle' }, gameData).map((i) => i.id)).toContain('luckyLure');
    expect(validateScenario({ ...scenario, profile: { ...scenario.profile, progression: ['ghost'] } }, gameData)).toEqual({ code: 'node', detail: 'ghost' });
    expect(validateScenario({ ...scenario, profile: { ...scenario.profile, shells: -1 } }, gameData)).toEqual({ code: 'number', detail: 'profile.shells' });
  });
});
