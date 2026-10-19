<script setup lang="ts">
import BarDelta from './BarDelta.vue';
import BarPreview from './BarPreview.vue';
import GameIcon from './GameIcon.vue';
import { computed, ref, watch } from 'vue';
import { t } from './i18n';

/**
 * `after` / `end`: its health after the card being played and after the creatures' moves
 * (BarPreview); `blockAfter`: its Block after the card.
 */
const props = defineProps<{ hp: number; maxHp: number; block: number; after?: number; end?: number; blockAfter?: number }>();
const percent = computed(() => (props.maxHp > 0 ? (100 * props.hp) / props.maxHp : 0));
/** Counts the changes that animate the heart (used as its `key`): any damage or heal. */
const bumps = ref(0);
watch(
  () => props.hp,
  () => bumps.value++,
);
</script>

<template>
  <div v-tip="t('bars.healthTip')" class="healthbar" :class="{ blocking: block > 0 }">
    <div class="row">
      <span v-if="block > 0 || (blockAfter ?? 0) > 0" v-tip="t('bars.block', { n: block })" class="block">
        <GameIcon icon="🛡️" />{{ blockAfter === undefined || blockAfter === block ? block : `${block} → ${blockAfter}` }}
      </span>
      <div class="bar">
        <div class="fill" :style="{ transform: `scaleX(${percent / 100})` }" />
        <BarPreview :value="hp" :max="maxHp" :after="after" :end="end" />
        <span class="value"><span><span :key="bumps" :class="{ 'icon-bump': bumps > 0 }">♥</span> {{ hp }}/{{ maxHp }}<BarDelta :value="hp" :after="after" :end="end" /></span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* As wide as the block it sits in (a creature's, or the player's corner panel). */
.healthbar { display: flex; flex-direction: column; gap: 2px; width: 100%; }
.row { display: flex; align-items: center; gap: 6px; }
.bar {
  position: relative;
  flex: 1;
  height: 32px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #0006;
}
.blocking .bar { outline: 2px solid var(--block); }
.fill { height: 100%; transform-origin: left; transition: transform 0.25s ease; }
/* Values sit inside the bar (like the Will bar). The creature's health is red, so red stays the
   colour of health, not of Strikes. */
.bar { background: #3a1512; }
.fill { background: #d8443c; }
.blocking .fill { background: color-mix(in srgb, #d8443c 55%, var(--block)); }
.value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000, 0 0 4px rgb(0 0 0 / 0.8);
}
.value > span { display: flex; align-items: center; gap: 0.325rem; }
.block {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--block);
  color: #0d1a26;
  font-weight: 800;
  font-size: 0.8rem;
}
</style>
