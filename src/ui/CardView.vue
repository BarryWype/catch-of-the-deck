<script setup lang="ts">
import { computed } from 'vue';
import { describeCard, type CardDef } from '../engine';
import { t } from './i18n';

const props = withDefaults(
  defineProps<{
    card: CardDef;
    description?: string;
    playable?: boolean;
    selected?: boolean;
    /** Its type bonus applies to the current target: highlight it. */
    effective?: boolean;
  }>(),
  { description: undefined, playable: true, selected: false, effective: false },
);

const TYPE_ICON: Record<CardDef['type'], string> = { attack: '⚔️', defense: '🛡️', drain: '🧲', support: '🌀', power: '✨' };
const text = computed(() => props.description ?? describeCard(props.card));
/** Rules text longer than this gets a smaller font so it stays inside the card. */
const LONG_TEXT = 85;
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
    :aria-disabled="!playable"
  >
    <span class="cost">{{ card.cost }}</span>
    <span v-if="card.patienceCost" v-tip="t('card.patienceCost', { n: card.patienceCost })" class="patience-cost">⏳{{ card.patienceCost }}</span>
    <span class="name">{{ card.name }}</span>
    <span class="art">{{ card.art ?? TYPE_ICON[card.type] }}</span>
    <span class="type">{{ t(`card.type.${card.type}`) }}</span>
    <span class="desc" :class="{ long: text.length > LONG_TEXT }">
      <span>
        <template v-for="(part, i) in parts" :key="i">
          <template v-if="'real' in part">{{ part.base }} <b class="real" :class="part.up ? 'up' : 'down'">({{ part.real }})</b></template>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>
    </span>
    <span v-if="effective" class="effective-badge">{{ t('card.effective') }}</span>
  </button>
</template>

<style scoped>
.card {
  --frame: var(--attack);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 140px;
  height: 196px;
  padding: 8px;
  border: 3px solid var(--frame);
  border-radius: 12px;
  background: linear-gradient(180deg, #2c303b, #1f222a);
  color: var(--text);
  font: inherit;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgb(0 0 0 / 0.4);
  /* Grows from its bottom edge, so a hovered card rises out of the hand. The same easing both
     ways: moving from card to card, one settles back while the next lifts. */
  transform-origin: 50% 100%;
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease;
}
/* The deeper hover shadow fades in on its own layer, so only opacity animates. */
.card::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  box-shadow: 0 10px 18px rgb(0 0 0 / 0.5);
  opacity: 0;
  transition: opacity 0.22s ease;
  pointer-events: none;
}
.card:hover:not(.unplayable)::after { opacity: 1; }
.card.defense { --frame: var(--skill); }
.card.drain { --frame: var(--drain); }
.card.support { --frame: var(--support); }
.card.power { --frame: var(--power); }
.card:hover:not(.unplayable) { z-index: 2; transform: translateY(-16px) scale(1.08); }
.card.selected { z-index: 2; transform: translateY(-20px) scale(1.08); box-shadow: 0 0 0 3px var(--highlight), 0 12px 20px rgb(0 0 0 / 0.5); }
.card.unplayable { opacity: 0.5; cursor: not-allowed; }

.cost {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #fff6;
  background: var(--energy);
  color: #1b1d24;
  font-weight: 800;
  line-height: 26px;
}
.patience-cost {
  position: absolute;
  top: 22px;
  left: -10px;
  padding: 0 5px;
  border-radius: 10px;
  border: 2px solid #fff6;
  background: #2a3f5a;
  color: #bfe3ff;
  font-size: 0.7rem;
  font-weight: 800;
}
.name { font-weight: 700; font-size: 0.95rem; margin: 2px 0 6px 12px; }
.rarity-rare .name { color: #ffd76a; }
.art {
  display: grid;
  place-items: center;
  height: 56px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--frame) 25%, #14161c);
  font-size: 1.8rem;
}
.type {
  align-self: center;
  margin: -8px 0 6px;
  padding: 0 8px;
  border-radius: 8px;
  background: #14161c;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.desc { flex: 1; display: grid; place-items: center; font-size: 0.78rem; line-height: 1.25; }
.desc.long { font-size: 0.66rem; line-height: 1.2; }

.card.effective { box-shadow: 0 0 0 2px #7be38f, 0 0 16px rgb(123 227 143 / 0.55), 0 4px 10px rgb(0 0 0 / 0.4); }
.effective-badge {
  position: absolute;
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

@media (prefers-reduced-motion: reduce) {
  .card, .card::after { transition: none; }
}
</style>
