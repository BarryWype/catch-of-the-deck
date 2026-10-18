<script setup lang="ts">
import BarDelta from './BarDelta.vue';
import BarPreview from './BarPreview.vue';
import GameIcon from './GameIcon.vue';
import { computed, ref, watch } from 'vue';
import { t } from './i18n';

/**
 * `grit`: the player's bar, named and coloured as Grit (`terms.grit` in the language files).
 * `after` / `end`: its health after the card being played and after the creatures' moves
 * (BarPreview); `blockAfter`: its Block after the card.
 */
const props = defineProps<{ hp: number; maxHp: number; block: number; grit?: boolean; after?: number; end?: number; blockAfter?: number }>();
const percent = computed(() => (props.maxHp > 0 ? (100 * props.hp) / props.maxHp : 0));
/** Counts the changes that animate the icon (used as its `key`): the creature's heart on any
 * damage or heal, the Grit bar's muscle (it shakes and sheds a drop of sweat) on damage only. */
const bumps = ref(0);
watch(
  () => props.hp,
  (now, before) => {
    if (!props.grit || now < before) bumps.value++;
  },
);
</script>

<template>
  <div v-tip="t(grit ? 'bars.gritTip' : 'bars.healthTip')" class="healthbar" :class="{ blocking: block > 0, grit }">
    <div class="row">
      <!-- The player's Hold shows beside the fisherman instead (CombatView); his bar keeps its tint. -->
      <span v-if="(block > 0 || (blockAfter ?? 0) > 0) && !grit" v-tip="t('bars.block', { n: block })" class="block">
        <GameIcon icon="🛡️" />{{ blockAfter === undefined || blockAfter === block ? block : `${block} → ${blockAfter}` }}
      </span>
      <div class="bar">
        <div class="fill" :style="{ transform: `scaleX(${percent / 100})` }" />
        <BarPreview :value="hp" :max="maxHp" :after="after" :end="end" />
        <span v-if="grit" class="value"><span><span :key="bumps" class="cup" :class="{ spill: bumps > 0 }"><GameIcon icon="muscle" /><i class="drop" /></span> {{ hp }}/{{ maxHp }}<BarDelta :value="hp" :after="after" :end="end" /></span></span>
        <span v-else class="value"><span><span :key="bumps" :class="{ 'icon-bump': bumps > 0 }">♥</span> {{ hp }}/{{ maxHp }}<BarDelta :value="hp" :after="after" :end="end" /></span></span>
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
.healthbar:not(.grit) .bar { background: #3a1512; }
.healthbar:not(.grit) .fill { background: #d8443c; }
.healthbar:not(.grit).blocking .fill { background: color-mix(in srgb, #d8443c 55%, var(--block)); }
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
.grit .bar { background: #3a2716; }
/* Hold: a light water-blue wash over the whole Grit bar, on top of its outline. */
.grit.blocking .bar { background: color-mix(in srgb, #3a2716 70%, var(--block)); }
.grit .fill { background: var(--grit); }
.grit.blocking .fill { background: color-mix(in srgb, var(--grit) 55%, var(--block)); }
/* The drop waits hidden at the cup's rim, then falls and fades while the cup shakes. */
.cup { position: relative; display: inline-block; }
.cup .game-icon{ height: 1.8rem; width: 1.8rem; margin-right: 0.325rem; }
.drop {
  position: absolute;
  top: 10%;
  right: 8%;
  width: 3px;
  height: 4px;
  border-radius: 50% 50% 50% 50% / 35% 35% 65% 65%;
  background: #9fd4f5;
  opacity: 0;
}
.cup.spill :deep(.game-icon) { animation: cup-shake 0.8s ease-in-out; }
.cup.spill .drop { animation: cup-drop 0.6s ease-in 0.2s; }
@keyframes cup-shake {
  0%, 100% { rotate: 0deg; }
  20% { rotate: -12deg; }
  40% { rotate: 10deg; }
  60% { rotate: -8deg; }
  80% { rotate: 5deg; }
}
@keyframes cup-drop {
  0% { opacity: 1; translate: 0 0; }
  70% { opacity: 1; }
  100% { opacity: 0; translate: 3px 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .cup.spill :deep(.game-icon), .cup.spill .drop { animation: none; }
}
.block {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--block);
  color: #0d1a26;
  font-weight: 800;
  font-size: 0.8rem;
}
</style>
