import { describe, expect, it } from 'vitest';
import {
  bringCatchHome,
  buildGameData,
  buyShopItem,
  createRun,
  creatureBlocked,
  finishCombat,
  rerollReward,
  rollCardRewards,
  shopItemBlocked,
  STORE_KINDS,
  storeItems,
  travelTo,
  visitShop,
  type BlessingDef,
  type GameData,
  type RunState,
  type ShopItemDef,
  type ShopVisit,
} from '../src/engine';
import { contentSource, gameData } from '../src/content';
import { caught, homeCreature, ids, setup, testData, withNodeKind } from './fixtures';

const shop: ShopItemDef[] = [
  { id: 'cocoa', store: 'cafe', name: 'Cocoa', price: 15, effect: { type: 'heal', amount: 15 } },
  { id: 'espresso', store: 'cafe', name: 'Espresso', price: 20, effect: { type: 'maxHpForFights', amount: 20, fights: 5 }, limit: 1 },
  { id: 'jacket', store: 'tackle', name: 'Jacket', price: 20, effect: { type: 'lifeJacket' }, limit: 1 },
  { id: 'parcel', store: 'tackle', name: 'Parcel', price: 15, effect: { type: 'sendHome' }, limit: 1 },
  { id: 'lure', store: 'tackle', name: 'Lure', price: 40, effect: { type: 'rareReward' }, limit: 1 },
  { id: 'hook', store: 'tackle', name: 'Hook', price: 10, effect: { type: 'extraRewardCard' } },
  { id: 'cut', store: 'tackle', name: 'Cut', price: 20, effect: { type: 'removeCard' }, limit: 1 },
  { id: 'bucket', store: 'bait', name: 'Bucket', price: 20, effect: { type: 'bucketSpace', amount: 3 }, limit: 1 },
  { id: 'release', store: 'bait', name: 'Release', price: 0, effect: { type: 'release' }, limit: 1 },
  { id: 'tank', store: 'bait', name: 'Tank', price: 0, effect: { type: 'aquariumSale', percent: 200 }, limit: 1 },
];
const blessings: BlessingDef[] = [
  { id: 'damage', effect: { type: 'bonus', bonus: { type: 'bonusDamage', amount: 1 }, fights: 2 } },
  { id: 'bond', effect: { type: 'bond', amount: 30 } },
  { id: 'grit', effect: { type: 'heal', amount: 20 } },
];
const data: GameData = { ...testData, shop, blessings };
const item = (id: string) => shop.find((i) => i.id === id)!;
const cafe: ShopVisit = { store: 'cafe', bought: {} };
const tackle: ShopVisit = { store: 'tackle', bought: {} };
const bait = (blessing = 'damage', family = 'shells'): ShopVisit => ({ store: 'bait', bought: {}, blessing, family });

/** A fresh run with `coins`, and these catches after its companions (none). */
function runWith(coins: number, ...bucket: string[]): RunState {
  return { ...createRun(5, data, 'basic'), coins, bucket: caught(...bucket) };
}

/** The run after a won fight against the dummy (it's caught, unless the bucket is full). */
function afterFight(run: RunState): RunState {
  const combat = setup(['strike'], { enemies: ['dummy'], hp: run.hp, data });
  combat.phase = 'won';
  combat.player.hp = run.hp;
  return finishCombat(run, combat, data);
}

describe('stores on the map', () => {
  it('makes every shop node one of the three stores, each of them showing up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const run = createRun(seed, gameData, 'rod');
      const shops = run.map.columns.flat().filter((n) => n.kind === 'shop');
      for (const node of shops) {
        expect(STORE_KINDS).toContain(node.store);
        seen.add(node.store!);
      }
    }
    expect([...seen].sort()).toEqual(['bait', 'cafe', 'tackle']);
  });

  it('every store sells something in the real content', () => {
    for (const store of STORE_KINDS) expect(storeItems({ store, bought: {} }, gameData).length).toBeGreaterThan(0);
  });

  it('opens the node’s store; the Bait shop draws its blessing and family on arrival, the same for the same run', () => {
    const base = withNodeKind(createRun(5, data, 'basic'), '1a', 'shop');
    const at = (store: 'cafe' | 'bait') => ({ ...base, map: { columns: base.map.columns.map((c) => c.map((n) => (n.id === '1a' ? { ...n, store } : n))) } });
    expect(visitShop(at('cafe'), '1a', data).visit).toEqual({ store: 'cafe', bought: {} });
    const first = visitShop(at('bait'), '1a', data);
    expect(first.run.position).toBe('1a');
    expect(blessings.map((b) => b.id)).toContain(first.visit.blessing);
    expect(first.visit.family).toBe('shells');
    expect(visitShop(at('bait'), '1a', data).visit).toEqual(first.visit);
    expect(() => visitShop(base, '1b', data)).toThrow();
  });

  it('only sells what the visited store has', () => {
    expect(() => buyShopItem(runWith(50), cafe, 'hook', data)).toThrow();
  });

  it('content checks want something in every store, and blessings for a release', () => {
    const noBait = { ...contentSource, shop: contentSource.shop.filter((i) => i.store !== 'bait') };
    expect(() => buildGameData(noBait)).toThrow(/every store/);
    expect(() => buildGameData({ ...contentSource, blessings: [] })).toThrow(/needs blessings/);
  });
});

describe('cafe', () => {
  it('a cocoa cup heals up to max Grit, as often as you can pay', () => {
    let { run, visit } = buyShopItem({ ...runWith(40), hp: 50 }, cafe, 'cocoa', data);
    expect(run).toMatchObject({ hp: 65, coins: 25 });
    ({ run, visit } = buyShopItem(run, visit, 'cocoa', data));
    expect(run).toMatchObject({ hp: 80, coins: 10 });
    expect(shopItemBlocked(item('cocoa'), run, visit, data)).toBe('Already at full Grit.');
    expect(shopItemBlocked(item('cocoa'), { ...run, hp: 10 }, visit, data)).toBe('Not enough coins.');
  });

  it('an espresso raises max Grit and Grit for five fights, then the cap drops back', () => {
    let { run, visit } = buyShopItem({ ...runWith(40), hp: 70 }, cafe, 'espresso', data);
    expect(run).toMatchObject({ hp: 90, maxHp: 100, coins: 20 });
    expect(shopItemBlocked(item('espresso'), run, visit, data)).toBe('Sold out.');
    for (let fight = 1; fight <= 4; fight++) run = afterFight({ ...run, bucket: [] });
    expect(run).toMatchObject({ hp: 90, maxHp: 100 });
    run = afterFight({ ...run, bucket: [] });
    expect(run).toMatchObject({ hp: 80, maxHp: 80, boons: [] });
  });
});

describe('tackle shop', () => {
  it('a life jacket keeps one creature through a lost run; the rest of the bucket is lost', () => {
    const run = runWith(30, 'shellA', 'shellB');
    expect(creatureBlocked(item('jacket'), run, tackle, 0, data)).toBeNull();
    const { run: after } = buyShopItem(run, tackle, 'jacket', data, 1);
    expect(after.bucket[1].lifeJacket).toBe(true);
    expect(creatureBlocked(item('jacket'), after, tackle, 1, data)).toBe('Already wearing a life jacket.');
    expect(ids(bringCatchHome([], after, data, false))).toEqual(['shellB']);
    expect(ids(bringCatchHome([], after, data, true))).toEqual(['shellA', 'shellB']);
  });

  it('a parcel posts a creature home now: its spot frees up, and it arrives however the run ends', () => {
    const run = { ...runWith(30, 'shellA'), bucket: caught('shellB', 'shellA'), companions: [homeCreature('shellB', 12)] };
    const { run: after } = buyShopItem(run, tackle, 'parcel', data, 0);
    expect(ids(after.bucket)).toEqual(['shellA']);
    expect(after.companions).toEqual([]);
    expect(after.sentHome).toEqual([homeCreature('shellB', 12)]);
    expect(bringCatchHome([], after, data, false)).toEqual([homeCreature('shellB', 12)]);
    expect(() => buyShopItem(runWith(30), tackle, 'parcel', data, 0)).toThrow();
    expect(shopItemBlocked(item('parcel'), runWith(30), tackle, data)).toBe('No creature in your bucket for this.');
  });

  it('a lucky lure puts a rare in the next reward, even before rares unlock; then it’s used up', () => {
    const { run } = buyShopItem(runWith(40), tackle, 'lure', data);
    const rewards = rollCardRewards(run, data, { families: ['shells'] });
    expect(rewards.choices).toContain('flex');
    expect(rewards.run.luckyLure).toBe(false);
    const plain = rollCardRewards(createRun(5, data, 'basic'), data, { families: ['shells'] });
    expect(plain.choices).not.toContain('flex');
  });

  it('spare hooks stack, each one more card in the next reward, its rerolls included', () => {
    let { run, visit } = buyShopItem(runWith(40), tackle, 'hook', data);
    ({ run, visit } = buyShopItem(run, visit, 'hook', data));
    expect(run.spareHooks).toBe(2);
    const rewards = rollCardRewards(run, data, { families: ['shells'] });
    expect(rewards.choices).toHaveLength(5);
    expect(rewards.run.spareHooks).toBe(0);
    expect(rerollReward(rewards.run, data, rewards.choices).choices).toHaveLength(5);
    expect(rollCardRewards(rewards.run, data).choices).toHaveLength(3);
  });

  it('removing a card takes the chosen one, once per visit', () => {
    const { run, visit } = buyShopItem(runWith(50), tackle, 'cut', data, 0);
    expect(run).toMatchObject({ deck: ['defend'], coins: 30 });
    expect(shopItemBlocked(item('cut'), { ...run, deck: ['a', 'b'] }, visit, data)).toBe('Sold out.');
    expect(() => buyShopItem(runWith(50), tackle, 'cut', data)).toThrow();
  });
});

describe('bait shop', () => {
  it('a bucket extension holds three more creatures for the rest of the run', () => {
    const { run } = buyShopItem(runWith(20, ...Array(7).fill('shellA')), bait(), 'bucket', data);
    expect(run.bucketSize).toBe(10);
    const after = afterFight(run);
    expect(after.bucket).toHaveLength(8);
    expect(after.waiting).toEqual([]);
    expect(afterFight({ ...run, bucketSize: 7 }).waiting).toHaveLength(1);
  });

  it('a release lets the creature go for no coins, for the visit’s blessing; a fight bonus lasts its fights', () => {
    const { run, visit } = buyShopItem(runWith(0, 'shellA', 'shellB'), bait('damage'), 'release', data, 0);
    expect(ids(run.bucket)).toEqual(['shellB']);
    expect(run.coins).toBe(0);
    expect(run.boons).toEqual([{ fightsLeft: 2, bonus: { type: 'bonusDamage', amount: 1 }, item: 'release', blessing: 'damage' }]);
    expect(shopItemBlocked(item('release'), run, visit, data)).toBe('Sold out.');
    const moved = { ...run, position: '1a', visited: [...run.visited, '1a'] };
    const atStart = { ...run, bucket: [] };
    expect(travelTo(atStart, '1a', data).combat.bonuses).toContainEqual({ type: 'bonusDamage', amount: 1 });
    expect(afterFight(afterFight(moved)).boons).toEqual([]);
  });

  it('a bond blessing bonds companions now, and caught creatures when they reach home', () => {
    const run = { ...runWith(0), bucket: caught('shellA', 'shellB', 'shellC'), companions: [homeCreature('shellA', 10)] };
    const { run: after } = buyShopItem(run, bait('bond'), 'release', data, 2);
    expect(after.companions).toEqual([homeCreature('shellA', 40)]);
    expect(bringCatchHome([], after, data)).toEqual([homeCreature('shellA', 40), homeCreature('shellB', 30)]);
  });

  it('a Grit blessing heals at once, not above max', () => {
    const { run } = buyShopItem({ ...runWith(0, 'shellA'), hp: 70 }, bait('grit'), 'release', data, 0);
    expect(run.hp).toBe(80);
  });

  it('the keeper’s aquarium buys one creature of the visit’s family, for twice its price', () => {
    const run = runWith(0, 'dummy', 'shellB');
    expect(creatureBlocked(item('tank'), run, bait(), 0, data)).toBe('Not a kind the keeper is after.');
    const { run: after, visit } = buyShopItem(run, bait(), 'tank', data, 1);
    expect(ids(after.bucket)).toEqual(['dummy']);
    expect(after.coins).toBe(20);
    expect(visit.sold).toEqual({ id: 'shellB', size: 'normal' });
    expect(shopItemBlocked(item('tank'), runWith(0, 'dummy'), bait(), data)).toBe('Nothing in your bucket the keeper is after.');
    expect(() => buyShopItem(run, bait(), 'tank', data, 0)).toThrow();
  });
});
