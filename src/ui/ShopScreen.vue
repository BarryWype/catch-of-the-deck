<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import cafeUrl from './assets/stores/cafe.png';
import cafeKeeperUrl from './assets/stores/cafe-keeper.png';
import tackleUrl from './assets/stores/tackle-shop.png';
import tackleKeeperUrl from './assets/stores/tackle-keeper.png';
import baitUrl from './assets/stores/bait-shop.png';
import baitKeeperUrl from './assets/stores/bait-keeper.png';
import { computed, ref } from 'vue';
import {
  aquariumPrice,
  creatureBlocked,
  creatureTypeNames,
  describeCard,
  needsCreature,
  shopItemBlocked,
  storeItems,
  type GameData,
  type RunState,
  type ShopItemDef,
  type ShopVisit,
  type StoreKind,
} from '../engine';
import CardView from './CardView.vue';
import { t, type TextKey } from './i18n';
import { HOLD_ICON } from './icons';
import SpriteView from './SpriteView.vue';
import { blessingText } from './storeEffects';

const props = defineProps<{ run: RunState; data: GameData; visit: ShopVisit }>();
const emit = defineEmits<{ buy: [itemId: string, choice?: number]; leave: [] }>();

const tagNames = computed(() => creatureTypeNames(props.data));

/**
 * The store scenes (src/ui/assets/stores, made by scripts/generate-store-art.mjs), 240x160 art
 * pixels: positions below are in those pixels, the same as the script's. Items stand on the shelf
 * boards, the upper row first, inner spots first and alternating left and right, so a few items spread out
 * without reaching the scene's edges; the Bait shop
 * has no lower right board, its tank stands there.
 */
const ART = { w: 240, h: 160 };
const SLOTS = [
  { x: 68, y: 56 },
  { x: 172, y: 56 },
  { x: 28, y: 56 },
  { x: 212, y: 56 },
  { x: 68, y: 96 },
  { x: 172, y: 96 },
  { x: 28, y: 96 },
  { x: 212, y: 96 },
];
/**
 * A store with no more items than this sells from its counter, either side of the keeper (`COUNTER_SLOTS`
 * in the script). Not the Bait shop: its tank takes the counter, and labels there would cover the keeper.
 */
const COUNTER = [
  { x: 88, y: 118 },
  { x: 152, y: 118 },
];
const KEEPER = { x: 105, y: 72, w: 30, h: 46 };
const TANK = { x: 172, y: 86, w: 64, h: 33 };
const SIGN = { x: 178, y: 126, w: 52, h: 24 };
const SCENES: Record<StoreKind, { art: string; keeper: string }> = {
  cafe: { art: cafeUrl, keeper: cafeKeeperUrl },
  tackle: { art: tackleUrl, keeper: tackleKeeperUrl },
  bait: { art: baitUrl, keeper: baitKeeperUrl },
};

const pct = (r: { x: number; y: number; w?: number; h?: number }) => ({
  left: `${(r.x / ART.w) * 100}%`,
  top: `${(r.y / ART.h) * 100}%`,
  ...(r.w ? { width: `${(r.w / ART.w) * 100}%` } : {}),
  ...(r.h ? { height: `${(r.h / ART.h) * 100}%` } : {}),
});

const items = computed(() => storeItems(props.visit, props.data));
const forSale = computed(() => items.value.filter((i) => i.effect.type !== 'aquariumSale'));
const places = computed(() => (props.visit.store !== 'bait' && forSale.value.length <= COUNTER.length ? COUNTER : SLOTS));
const shelved = computed(() => forSale.value.slice(0, places.value.length));
/** Where each shelved item stands: an item alone on its board is centred on it (the shelves span `SHELF_X` in the script). */
const SHELF_CENTRE = { left: 48, right: 192 };
const spots = computed(() => {
  if (places.value === COUNTER) return COUNTER;
  const used = SLOTS.slice(0, shelved.value.length);
  const side = (s: { x: number }) => (s.x < ART.w / 2 ? 'left' : 'right');
  return used.map((s) => (used.filter((o) => o.y === s.y && side(o) === side(s)).length === 1 ? { ...s, x: SHELF_CENTRE[side(s)] } : s));
});
const aquarium = computed(() => items.value.find((i) => i.effect.type === 'aquariumSale'));
const family = computed(() => (props.visit.family ? props.data.families[props.visit.family] : undefined));
const soldSprite = computed(() => props.visit.sold && props.data.enemies[props.visit.sold.id]?.sprite);

/** The item waiting for the player to pick a card (`removeCard`) or a bucket creature. */
const picking = ref<ShopItemDef | null>(null);

const blocked = (item: ShopItemDef) => shopItemBlocked(item, props.run, props.visit, props.data);

function effectText(item: ShopItemDef) {
  const e = item.effect;
  switch (e.type) {
    case 'heal':
    case 'bucketSpace':
      return t(`shop.effect.${e.type}`, { n: e.amount });
    case 'maxHpForFights':
      return t('shop.effect.maxHpForFights', { n: e.amount, fights: e.fights });
    case 'release':
      return t('shop.effect.release', { blessing: blessingText(props.data.blessings.find((b) => b.id === props.visit.blessing)) });
    case 'aquariumSale':
      return t('shop.effect.aquariumSale', { family: family.value?.name ?? '' });
    default:
      return t(`shop.effect.${e.type}`);
  }
}

function tip(item: ShopItemDef) {
  return {
    title: item.name,
    detail: `${effectText(item)}`,
    body: blocked(item) ?? '',
  };
}

function onBuy(item: ShopItemDef) {
  if (item.effect.type === 'removeCard' || needsCreature(item)) picking.value = item;
  else emit('buy', item.id);
}

function onPick(choice: number) {
  if (!picking.value) return;
  emit('buy', picking.value.id, choice);
  picking.value = null;
}

/** The bucket as the picker shows it: each creature, why it can't be picked, and what the aquarium pays for it. */
const choices = computed(() =>
  props.run.bucket.map((c, slot) => ({
    slot,
    def: props.data.enemies[c.id],
    size: c.size,
    lifeJacket: !!c.lifeJacket,
    blocked: picking.value ? creatureBlocked(picking.value, props.run, props.visit, slot, props.data) : null,
    price: picking.value?.effect.type === 'aquariumSale' ? aquariumPrice(picking.value, props.run, slot, props.data) : null,
  })),
);

/**
 * What the keeper says, one line per tap, in turn. The Cafe keeper's every other line hints at the
 * next build to unlock: the first fisherman on this run's maps (`RunState.fishermen`, in build order).
 */
const lines = computed(() => {
  const chat = [1, 2, 3].map((n) => t(`store.chat.${props.visit.store}.${n}` as TextKey));
  if (props.visit.store !== 'cafe') return chat;
  const hint = t(`store.hint.${props.run.fishermen[0] ?? 'none'}` as TextKey);
  return chat.flatMap((line) => [line, hint]);
});
const said = ref(-1);
function talk() {
  said.value = (said.value + 1) % lines.value.length;
}
</script>

<template>
  <section class="shop">
    <h2>{{ t(`shop.title.${visit.store}`) }}</h2>
    <p class="wallet">{{ t('shop.wallet', { coins: run.coins, grit: run.hp, max: run.maxHp }) }}</p>

    <template v-if="picking?.effect.type === 'removeCard'">
      <p>{{ t('shop.chooseRemove', { coins: picking.price }) }}</p>
      <div class="deck">
        <CardView
          v-for="(id, i) in run.deck"
          :key="i"
          :card="data.cards[id]"
          :description="describeCard(data.cards[id], { tagNames })"
          @click="onPick(i)"
        />
      </div>
      <button class="ghost" @click="picking = null">{{ t('shop.cancel') }}</button>
    </template>

    <template v-else-if="picking">
      <p>{{ t(picking.effect.type === 'aquariumSale' ? 'shop.chooseOne' : 'shop.chooseCreature', { item: picking.name }) }}</p>
      <p class="effect">{{ effectText(picking) }}</p>
      <ul class="picker">
        <li v-for="c in choices" :key="c.slot">
          <button type="button" class="pick" :disabled="!!c.blocked" v-tip="c.blocked ?? ''" @click="onPick(c.slot)">
            <SpriteView v-if="c.def?.sprite" :sprite="c.def.sprite" :size="48" />
            <span class="name">{{ c.def?.name ?? '?' }} <small>{{ t(`size.${c.size}`) }}</small></span>
            <span v-if="c.lifeJacket" class="jacket" v-tip="t('shop.lifeJacket')"><GameIcon :icon="HOLD_ICON" /></span>
            <span v-if="c.price !== null && !c.blocked" class="price"><GameIcon icon="🪙" /> {{ c.price }}</span>
          </button>
        </li>
      </ul>
      <button class="ghost" @click="picking = null">{{ t('shop.cancel') }}</button>
    </template>

    <template v-else>
      <div class="scene">
        <img class="art" :src="SCENES[visit.store].art" alt="" />

        <button type="button" class="keeper" :style="pct(KEEPER)" :aria-label="t('shop.talk')" @click="talk">
          <img :src="SCENES[visit.store].keeper" alt="" />
        </button>
        <p v-if="said >= 0" class="bubble" role="status" @click="talk">{{ lines[said] }}</p>

        <template v-if="aquarium">
          <button
            type="button"
            class="tank"
            :style="pct(TANK)"
            :disabled="!!blocked(aquarium)"
            :aria-label="aquarium.name"
            v-tip="tip(aquarium)"
            @click="onBuy(aquarium)"
          >
            <SpriteView v-if="soldSprite" class="sold" :sprite="soldSprite" :size="48" />
          </button>
          <!-- The sign is blank in the art: what the keeper is after is written here. -->
          <div class="sign" :style="pct(SIGN)">
            <template v-if="visit.sold"><b>{{ t('shop.aquariumSold') }}</b></template>
            <template v-else>
              <b>{{ t('shop.aquariumSign', { family: family?.name ?? '' }) }}</b>
              <small>{{ t('shop.aquariumTerms') }}</small>
            </template>
          </div>
        </template>

        <button
          v-for="(item, i) in shelved"
          :key="item.id"
          type="button"
          class="slot"
          :class="{ counter: places === COUNTER }"
          :style="pct(spots[i])"
          :disabled="!!blocked(item)"
          :aria-label="item.name"
          v-tip="tip(item)"
          @click="onBuy(item)"
        >
          <span class="item-icon"><GameIcon :icon="item.icon ?? '🎁'" /></span>
          <span class="name">{{ item.name }}</span>
          <span class="price">
            <template v-if="item.price"><span class="coin"><GameIcon icon="🪙" /></span> {{ item.price }}</template>
            <template v-else>{{ t('shop.free') }}</template>
          </span>
          <span class="shadow" aria-hidden="true" />
        </button>
      </div>
      <button class="ghost" @click="emit('leave')">{{ t('shop.leave') }}</button>
    </template>
  </section>
</template>

<style scoped>
.shop { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 4vh; text-align: center; }
.shop h2 { margin: 0; }
.wallet { margin: 0 0 4px; color: var(--muted); }
.effect { margin: 0; max-width: 520px; color: var(--muted); font-size: 0.85rem; }

/* The store scene, with its keeper over the counter and the items standing on the shelves. */
.scene { position: relative; width: min(92vw, 640px); aspect-ratio: 3 / 2; }
.art { display: block; width: 100%; image-rendering: pixelated; }
.keeper {
  position: absolute;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.keeper img { display: block; width: 100%; image-rendering: pixelated; }
@media (hover: hover) {
  .keeper:hover { transform: translateY(-2px); filter: brightness(1.08); }
}
.bubble {
  position: absolute;
  left: 50%;
  bottom: 56%;
  transform: translateX(-50%);
  width: min(70%, 360px);
  margin: 0;
  padding: 8px 12px;
  border: 2px solid #2e1c2c;
  border-radius: 10px;
  background: #f2e2b6;
  color: #2e1c2c;
  font-size: 0.85rem;
  line-height: 1.3;
  box-shadow: 0 4px 10px rgb(0 0 0 / 0.35);
  cursor: pointer;
  z-index: 2;
}
.bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-top-color: #2e1c2c;
  border-bottom: 0;
}

.tank {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
@media (hover: hover) {
  .tank:not(:disabled):hover { border-color: rgb(245 215 110 / 0.7); }
}
.tank:disabled { cursor: not-allowed; }
.sign {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 4%;
  color: #2e1c2c;
  line-height: 1.05;
  text-align: center;
  pointer-events: none;
}
.sign b { font-size: 0.85rem; }
.sign small { font-size: 0.68rem; font-weight: 700; color: #8d2c44; }

.slot {
  position: absolute;
  /* Its bottom on the shelf or counter top, sunk 5px so the item looks set on it. */
  transform: translate(-50%, calc(-100% + 5px));
  width: 16%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #fff;
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease;
}
@media (hover: hover) {
  .slot:not(:disabled):hover { transform: translate(-50%, calc(-100% + 2px)); }
}
.slot.counter { width: 24%; }
/* On a shelf a name stays on one line: a second would reach the item on the shelf above. */
.slot:not(.counter) { width: max-content; min-width: 16%; }
.slot:not(.counter) .name { white-space: nowrap; }
.slot:disabled { opacity: 1; cursor: not-allowed; }
/* Name and price above the icon, outlined so they read on any wall. */
.slot .name,
.slot .price {
  max-width: 100%;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  /* A 2px dark outline all round, then a soft shadow, so the words stand out from the wall behind. */
  text-shadow:
    2px 0 0 #2e1c2c, -2px 0 0 #2e1c2c, 0 2px 0 #2e1c2c, 0 -2px 0 #2e1c2c,
    2px 2px 0 #2e1c2c, -2px 2px 0 #2e1c2c, 2px -2px 0 #2e1c2c, -2px -2px 0 #2e1c2c,
    0 3px 6px rgb(0 0 0 / 0.8);
}
.slot .price { display: inline-flex; align-items: center; gap: 3px; font-size: 1.1rem; font-weight: 800; color: var(--highlight); }
.slot .coin { font-size: 1.3em; line-height: 1; filter: drop-shadow(0 0 1px #2e1c2c) drop-shadow(0 2px 2px rgb(0 0 0 / 0.7)); }
/* The item itself stands on its shelf or the counter over a shadow, bobbing slowly. */
.slot .item-icon { order: 2; font-size: 2.2rem; line-height: 1; margin-top: 6px; animation: bob 2s ease-in-out infinite; filter: drop-shadow(0 2px 0 rgb(46 28 44 / 0.6)); }
.slot .shadow { order: 3; width: 2.2rem; height: 5px; margin-top: -2px; border-radius: 50%; background: rgb(0 0 0 / 0.35); }
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@media (prefers-reduced-motion: reduce) {
  .slot .item-icon { animation: none; }
}

.deck { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 900px; }
.picker { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 760px; margin: 0; padding: 0; list-style: none; }
.pick {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: linear-gradient(180deg, #26304a, #1b2233);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.pick:disabled { opacity: 0.5; cursor: not-allowed; }
.pick .name { display: flex; flex-direction: column; align-items: flex-start; font-weight: 700; line-height: 1.2; }
.pick small { color: var(--muted); font-size: 0.72rem; font-weight: 500; }
.pick .price { display: inline-flex; align-items: center; gap: 3px; font-weight: 800; color: var(--highlight); }

/* Small screens: tags too tight for a name (its tooltip keeps it), and a smaller sign. */
@media (max-width: 700px), (max-height: 500px) {
  /* Shelves are too close for a name (the tooltip keeps it); the counter has room. */
  .slot .name { display: none; }
  .slot.counter .name { display: block; font-size: 0.78rem; }
  .slot .price { font-size: 0.85rem; }
  .slot .item-icon { font-size: 1.5rem; }
  .slot .shadow { width: 1.5rem; height: 4px; }
  .bubble { font-size: 0.72rem; padding: 6px 8px; width: 80%; }
  .sign b { font-size: 0.52rem; }
  .sign small { font-size: 0.46rem; }
}
</style>
