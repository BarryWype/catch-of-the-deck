<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { creatureFamilies, describeCard, type CardDef } from '../engine';
import { gameData } from '../content';
import { t } from './i18n';
import { iconUrl, TYPE_ICONS } from './icons';
import KeywordText from './KeywordText.vue';
import SpriteView from './SpriteView.vue';
import { COMPACT_QUERY, useMedia } from './useScreen';

const props = withDefaults(
  defineProps<{
    card: CardDef;
    description?: string;
    playable?: boolean;
    selected?: boolean;
    /** Its type bonus applies to the current target: highlight it. */
    effective?: boolean;
    /** Its energy cost right now, when a tax changes it (`cardCost`). */
    cost?: number;
  }>(),
  { description: undefined, playable: true, selected: false, effective: false, cost: undefined },
);

const shownCost = computed(() => props.cost ?? props.card.cost);
const text = computed(() => props.description ?? describeCard(props.card));

/**
 * A card of a family shows one of the family's creatures on its art, over the family's colour;
 * family-less cards (starter, junk) show their `art` icon over a neutral colour. Each family's cards are paired with its
 * creatures in content order, so no creature appears twice while there are enough of them.
 */
const FAMILY_COLOURS: Record<string, string> = {
  venom: '#5d2f7a',
  shell: '#2c5a86',
  swift: '#1f7a74',
  hunter: '#8a3030',
  endurance: '#7a5a2f',
  patient: '#2f6f52',
  trickster: '#8a4f6f',
  flashy: '#9a7020',
  camo: '#4f6f3a',
  slimy: '#2f6f5f',
};
/** Which creature's face each family card carries, by card id. */
const FAMILY_CARD_CREATURE: Record<string, string> = {};
{
  const cards = Object.values(gameData.cards);
  const facesOf: Record<string, string[]> = {};
  for (const family of new Set(cards.flatMap((c) => (c.family ? [c.family] : [])))) {
    facesOf[family] = Object.values(gameData.enemies)
      .filter((e) => creatureFamilies(e.id, gameData).some((f) => f.id === family))
      .map((e) => e.id);
  }
  for (const family of Object.keys(facesOf)) {
    const faces = facesOf[family];
    cards.filter((c) => c.family === family).forEach((card, i) => (FAMILY_CARD_CREATURE[card.id] = faces[i % faces.length]));
  }
}
const compact = useMedia(COMPACT_QUERY);
const familyCreature = computed(() => (props.card.id ? gameData.enemies[FAMILY_CARD_CREATURE[props.card.id]] ?? null : null));
/** Whole-number scales of the 32 px sprite cells. */
const artSize = computed(() => (compact.value ? 64 : 96));
const artIcon = computed(() => (props.card.art ? iconUrl(props.card.art) : undefined));
const familyColour = computed(() => FAMILY_COLOURS[props.card.family ?? ''] ?? (props.card.type === 'junk' ? '#4a4640' : '#39445e'));
const family = computed(() => (props.card.family ? gameData.families[props.card.family] : undefined));
const emblem = computed(() => (family.value ? gameData.enemies[family.value.emblem] : undefined));
const familyTip = computed(
  () =>
    family.value &&
    t('card.family', {
      family: family.value.name,
      temperaments: family.value.temperaments.map((id) => gameData.companionBonuses[id]?.temperamentName ?? id).join(', '),
    }),
);
/** Rules text steps down these font scales until it fits its box. */
const TEXT_SCALES = [1, 0.9, 0.8, 0.72, 0.65, 0.58];
const desc = ref<HTMLElement>();
const textScale = ref(1);
async function fitText() {
  for (const scale of TEXT_SCALES) {
    textScale.value = scale;
    await nextTick();
    const el = desc.value;
    if (!el || (el.firstElementChild as HTMLElement).offsetHeight <= el.clientHeight) return;
  }
}
/** The box changes size with the screen, and from nothing when a hidden card is shown. */
let resizes: ResizeObserver | undefined;
onMounted(() => {
  resizes = new ResizeObserver(() => fitText());
  resizes.observe(desc.value!);
  document.fonts.ready.then(fitText);
});
onBeforeUnmount(() => resizes?.disconnect());
watch(text, fitText);
/** Splits out "5 (9)" pairs (printed amount, real amount) so the real one can be coloured. */
const parts = computed(() =>
  text.value.split(/(\d+ \(\d+\))/).map((part) => {
    const match = /^(\d+) \((\d+)\)$/.exec(part);
    return match ? { base: match[1], real: match[2], up: Number(match[2]) > Number(match[1]) } : { text: part };
  }),
);
</script>

<template>
  <button
    type="button"
    class="card"
    :class="[card.type, `rarity-${card.rarity}`, { unplayable: !playable, selected, effective }]"
    :style="{ '--family': familyColour }"
    :aria-disabled="!playable"
  >
    <span class="waves" />
    <span class="art">
      <SpriteView v-if="familyCreature?.sprite" :sprite="familyCreature.sprite" :size="artSize" :aria-label="familyCreature.name" />
      <img v-else-if="artIcon" :src="artIcon" alt="" class="art-icon" />
      <template v-else>{{ card.art }}</template>
    </span>
    <span class="cost" :class="{ taxed: shownCost > card.cost }">{{ card.unplayable ? '–' : shownCost }}</span>
    <span v-if="card.patienceCost" v-tip="t('card.patienceCost', { n: card.patienceCost })" class="patience-cost">⏳{{ card.patienceCost }}</span>
    <span class="name">{{ card.name }}</span>
    <span v-tip="t(`card.type.${card.type}`)" class="type" role="img" :aria-label="t(`card.type.${card.type}`)">
      <img :src="iconUrl(TYPE_ICONS[card.type])" alt="" />
    </span>
    <span class="box">
      <span v-if="emblem?.sprite" v-tip="familyTip" class="crest" role="img" :aria-label="familyTip">
        <SpriteView :sprite="emblem.sprite" :size="16" />
      </span>
      <span ref="desc" class="desc">
        <span :style="{ fontSize: `${textScale}em` }">
          <template v-for="(part, i) in parts" :key="i">
            <template v-if="'real' in part">{{ part.base }} <b class="real" :class="part.up ? 'up' : 'down'">({{ part.real }})</b></template>
            <KeywordText v-else :text="part.text" />
          </template>
        </span>
      </span>
    </span>
    <span v-if="effective" class="effective-badge">{{ t('card.effective') }}</span>
  </button>
</template>

<style scoped>
/* Full art: the creature over a wash of its family's colour, swimming out over the top of the rules
   box. The type colour (--frame) only rims the box and the type chip. Positions are from the inside
   of the 2 px border. */
.card {
  --frame: var(--attack);
  --rim: #0a0e16;
  position: relative;
  display: block;
  width: 140px;
  height: 196px;
  padding: 0;
  border: 2px solid #2a3348;
  border-radius: 0;
  background: color-mix(in srgb, var(--family) 60%, #0b1220);
  color: var(--text);
  font: inherit;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 0 0 2px var(--rim), 0 5px 0 2px rgb(0 0 0 / 0.35);
  /* Grows from its bottom edge, so a hovered card rises out of the hand. The same easing both
     ways: moving from card to card, one settles back while the next lifts. */
  transform-origin: 50% 100%;
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease;
}
/* The deeper hover shadow fades in on its own layer, so only opacity animates. */
.card::after {
  content: '';
  position: absolute;
  inset: -2px;
  box-shadow: 0 10px 18px rgb(0 0 0 / 0.5);
  opacity: 0;
  transition: opacity 0.22s ease;
  pointer-events: none;
}
@media (hover: hover) {
  .card:hover::after { opacity: 1; }
  /* The hand lifts its cards higher than this (they hang below the screen edge) by setting
     --card-hover-lift; everywhere else the default keeps the lift small. */
  .card:hover { z-index: 2; transform: translateY(var(--card-hover-lift, -16px)) scale(1.08); }
  /* A card that can't be played lifts and un-dims like the rest, so its text can be read; the
     forbidden cursor keeps the signal that it won't play. */
  .card:hover.unplayable { opacity: 1; }
}
.card.defense { --frame: var(--skill); }
.card.drain { --frame: var(--drain); }
.card.support { --frame: var(--support); }
.card.power { --frame: var(--power); }
.card.junk { --frame: var(--junk); }
.card.rarity-rare { border-color: #d1a13a; }
.card.selected { z-index: 2; transform: translateY(-20px) scale(1.08); box-shadow: 0 0 0 3px var(--highlight), 0 12px 20px rgb(0 0 0 / 0.5); }
.card.unplayable { opacity: 0.5; cursor: not-allowed; }

/* Water lines, and three bubbles at fixed spots. */
.waves { position: absolute; inset: 0; background-image: repeating-linear-gradient(180deg, rgb(255 255 255 / 0.06) 0 2px, transparent 2px 14px); }
.waves::before,
.waves::after { content: ''; position: absolute; background: rgb(255 255 255 / 0.22); }
.waves::before { left: 12%; top: 30%; width: 4px; height: 4px; }
.waves::after { left: 84%; top: 18%; width: 2px; height: 2px; box-shadow: -8px 44px 0 rgb(255 255 255 / 0.22); }

/* Its bottom overlaps the box's top edge by 12 px. */
.art { position: absolute; z-index: 2; left: 20px; top: 21px; width: 96px; height: 96px; display: grid; place-items: center; font-size: 3rem; line-height: 1; pointer-events: none; }
.art-icon { width: 64px; height: 64px; image-rendering: pixelated; }

.cost {
  position: absolute;
  z-index: 3;
  left: 4px;
  top: 4px;
  width: 20px;
  height: 20px;
  background: var(--energy);
  color: #1b1d24;
  font-weight: 800;
  line-height: 20px;
  box-shadow: 0 0 0 2px var(--rim), inset -2px -2px 0 #c98a22, inset 2px 2px 0 #ffe08a;
}
.cost.taxed { color: #c42c2c; }
.patience-cost {
  position: absolute;
  z-index: 3;
  left: 4px;
  top: 30px;
  padding: 1px 3px;
  background: #22344d;
  color: #bfe3ff;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--rim);
}
.name {
  position: absolute;
  z-index: 3;
  left: 26px;
  right: 26px;
  top: 8px;
  font-size: 0.82rem;
  line-height: 1;
  text-shadow: 1px 0 0 var(--rim), -1px 0 0 var(--rim), 0 1px 0 var(--rim), 0 -1px 0 var(--rim), 1px 1px 0 var(--rim);
}
.rarity-rare .name { color: #ffd76a; }
.type {
  position: absolute;
  z-index: 3;
  right: 4px;
  top: 4px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  background: #141a26;
  box-shadow: 0 0 0 2px var(--rim), inset 0 0 0 2px var(--frame);
}
.type img { width: 16px; height: 16px; image-rendering: pixelated; }

.box {
  position: absolute;
  z-index: 1;
  left: 5px;
  right: 5px;
  bottom: 5px;
  height: 82px;
  display: flex;
  flex-direction: column;
  padding: 12px 5px 3px;
  background: #141a26;
  border: 2px solid var(--frame);
  box-shadow: 0 0 0 2px var(--rim);
}
/* Sits on the box's top-right corner, half above its edge. The emblem is the 32 px cell at half size. */
.crest {
  position: absolute;
  z-index: 3;
  right: 3px;
  top: -12px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  background: #141a26;
  box-shadow: 0 0 0 2px var(--frame);
}
.desc { flex: 1; min-height: 0; display: grid; place-items: center; color: #d8dde6; font-size: 0.78rem; line-height: 1.15; }

.card.effective { box-shadow: 0 0 0 2px #7be38f, 0 0 16px rgb(123 227 143 / 0.55), 0 4px 10px rgb(0 0 0 / 0.4); }
.effective-badge {
  position: absolute;
  z-index: 4;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 8px;
  border-radius: 8px;
  background: #2f8a45;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}
.real { font-weight: 800; }
.real.up { color: #7ee08a; }
.real.down { color: #ff8a80; }

/* Small screens: a smaller card, the creature at 2×, its text a little smaller. */
@media (max-width: 700px), (max-height: 500px) {
  .card { width: 118px; height: 166px; }
  .art { left: 25px; top: 30px; width: 64px; height: 64px; font-size: 2.2rem; }
  .art-icon { width: 48px; height: 48px; }
  .cost { left: 3px; top: 3px; width: 18px; height: 18px; line-height: 18px; }
  .patience-cost { left: 3px; top: 26px; font-size: 0.62rem; }
  .name { left: 22px; right: 22px; top: 6px; font-size: 0.72rem; }
  .type { right: 3px; top: 3px; }
  .box { left: 4px; right: 4px; bottom: 4px; height: 70px; padding: 10px 4px 3px; }
  .desc { font-size: 0.7rem; }
  .card.selected { transform: translateY(-14px) scale(1.05); }
}

@media (prefers-reduced-motion: reduce) {
  .card, .card::after { transition: none; }
}
</style>
