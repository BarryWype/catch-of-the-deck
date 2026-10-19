<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { describeEffect, powerCount, powerTotal, type CardDef, type CombatState, type Effect, type GameData, type PowerId, type RunState } from '../engine';
import { t } from './i18n';
import { storeEffectChips } from './storeEffects';

/** `run`: also show what was bought in stores and still works (boons, lure, spare hooks). */
const props = defineProps<{ state: CombatState; data: GameData; run?: RunState }>();

const bought = computed(() => (props.run ? storeEffectChips(props.run, props.data) : []));

/** Powers without a fitting icon show their card's art. */
const ICONS: Partial<Record<PowerId, string>> = { hardShell: 'golden-shell', stingsAndSpines: 'thorn', envenomedHooks: 'hook', pushTheLimits: 'trap2',
  baitBall: 'white-bait', deadWeight: 'golden-anchor' };

function cardWith(match: (e: Effect) => boolean): CardDef | undefined {
  return Object.values(props.data.cards).find((c) => c.effects.some(match));
}

/** One chip per Power played this fight, in the order first played; copies add up. */
const entries = computed(() =>
  [...new Set((props.state.powers ?? []).map((p) => p.power))].map((power) => {
    const card = cardWith((e) => e.type === 'power' && e.power === power);
    const count = powerCount(props.state, power);
    return {
      power,
      count,
      icon: ICONS[power] ?? card?.art ?? '✨',
      title: `${card?.name ?? power}${count > 1 ? ` ×${count}` : ''}`,
      body: describeEffect({ type: 'power', power, amount: powerTotal(props.state, power) }),
    };
  }),
);

/**
 * Chips for what wears off: this turn's buffs (`thisTurn`, `keepHold`), then effects waiting for the
 * next turns (`delayed`), with their number or the turns left.
 */
const temporary = computed(() => {
  const { thisTurn = {}, keepHold, delayed = [], enemies } = props.state;
  const buffs: Effect[] = [
    ...(thisTurn.coiled ? [{ type: 'coil' } as const] : []),
    ...(thisTurn.venomBonus ? [{ type: 'venomBonus', amount: thisTurn.venomBonus } as const] : []),
    ...(thisTurn.venomCoating ? [{ type: 'venomCoating', amount: thisTurn.venomCoating } as const] : []),
    ...(keepHold ? [{ type: 'keepHold' } as const] : []),
  ];
  const now = buffs.map((effect) => {
    const card = cardWith((e) => e.type === effect.type);
    return { icon: card?.art ?? '✨', badge: 'amount' in effect ? effect.amount : undefined, title: card?.name ?? effect.type, body: describeEffect(effect) };
  });
  const later = delayed.map((d) => {
    const card = cardWith((e) => e.type === 'delayed' && JSON.stringify(e.effects) === JSON.stringify(d.effects));
    const target = enemies.find((e) => e.id === d.targetId);
    return {
      icon: card?.art ?? '⏱️',
      badge: d.turnsLeft,
      title: target ? t('combat.upcomingOn', { name: target.name }) : t('combat.upcoming'),
      body: describeEffect({ type: 'delayed', turns: d.turnsLeft, effects: d.effects }),
    };
  });
  return [...now, ...later];
});
</script>

<template>
  <div v-if="entries.length || temporary.length || bought.length" class="powers">
    <span v-for="p in entries" :key="p.power" class="power" v-tip="{ title: p.title, body: p.body }" tabindex="0">
      <GameIcon :icon="p.icon" /><b v-if="p.count > 1">{{ p.count }}</b>
    </span>
    <span v-for="(b, i) in temporary" :key="i" class="power temporary" v-tip="{ title: b.title, body: b.body }" tabindex="0">
      <GameIcon :icon="b.icon" /><b v-if="b.badge">{{ b.badge }}</b>
    </span>
    <span v-for="b in bought" :key="b.key" class="power bought" v-tip="{ title: b.title, body: b.body }" tabindex="0">
      <GameIcon :icon="b.icon" /><b v-if="b.badge">{{ b.badge }}</b>
    </span>
  </div>
</template>

<style scoped>
.powers { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.power {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.8rem;
  background: #4a3a17;
  box-shadow: inset 0 0 0 1px #c9a43a;
  cursor: help;
}
.temporary { background: #173a4a; box-shadow: inset 0 0 0 1px #3aa4c9; }
.bought { background: #1f3a24; box-shadow: inset 0 0 0 1px #5aa45f; }
</style>
