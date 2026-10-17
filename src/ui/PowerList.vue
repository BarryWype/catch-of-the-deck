<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { describeEffect, powerCount, powerTotal, type CombatState, type GameData, type PowerId } from '../engine';

const props = defineProps<{ state: CombatState; data: GameData }>();

/** Powers without a fitting icon show their card's art. */
const ICONS: Partial<Record<PowerId, string>> = { hardShell: 'golden-shell', stingsAndSpines: 'thorn', envenomedHooks: 'hook', pushTheLimits: 'trap2',
  baitBall: 'white-bait', deadWeight: 'golden-anchor' };

/** One chip per Power played this fight, in the order first played; copies add up. */
const entries = computed(() =>
  [...new Set((props.state.powers ?? []).map((p) => p.power))].map((power) => {
    const card = Object.values(props.data.cards).find((c) => c.type === 'power' && c.effects.some((e) => e.type === 'power' && e.power === power));
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
</script>

<template>
  <div v-if="entries.length" class="powers">
    <span v-for="p in entries" :key="p.power" class="power" v-tip="{ title: p.title, body: p.body }" tabindex="0">
      <GameIcon :icon="p.icon" /><b v-if="p.count > 1">{{ p.count }}</b>
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
</style>
