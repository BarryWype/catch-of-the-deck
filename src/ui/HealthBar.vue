<script setup lang="ts">
import BarPreview from './BarPreview.vue';
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { t, term } from './i18n';

/**
 * `grit`: the player's bar, named and coloured as Grit (`terms.grit` in the language files).
 * `after` / `end`: its health after the card being played and after the creatures' moves
 * (BarPreview); `blockAfter`: its Block after the card.
 */
const props = defineProps<{ hp: number; maxHp: number; block: number; grit?: boolean; after?: number; end?: number; blockAfter?: number }>();
const percent = computed(() => (props.maxHp > 0 ? (100 * props.hp) / props.maxHp : 0));
</script>

<template>
  <div v-tip="t(grit ? 'bars.gritTip' : 'bars.healthTip')" class="healthbar" :class="{ blocking: block > 0, grit }">
    <!-- The Grit bar keeps its label above; the creature's values sit inside its bar instead. -->
    <span v-if="grit" class="label">{{ term('grit') }}&nbsp;{{ hp }} / {{ maxHp }}</span>
    <div class="row">
      <!-- The player's Hold shows beside the fisherman instead (CombatView); his bar keeps its tint. -->
      <span v-if="(block > 0 || (blockAfter ?? 0) > 0) && !grit" v-tip="t('bars.block', { n: block })" class="block">
        <GameIcon icon="🛡️" />{{ blockAfter === undefined || blockAfter === block ? block : `${block} → ${blockAfter}` }}
      </span>
      <div class="bar">
        <div class="fill" :style="{ transform: `scaleX(${percent / 100})` }" />
        <BarPreview :value="hp" :max="maxHp" :after="after" :end="end" />
        <span v-if="!grit" class="value">♥ {{ hp }}/{{ maxHp }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* As wide as the block it sits in (a creature's, or the player's corner panel). */
.healthbar { display: flex; flex-direction: column; gap: 2px; width: 100%; }
.label { font-size: 0.72rem; font-weight: 700; color: var(--text); white-space: nowrap; }
.row { display: flex; align-items: center; gap: 6px; }
.bar {
  position: relative;
  flex: 1;
  height: 16px;
  border-radius: 8px;
  background: #1d2f22;
  overflow: hidden;
  border: 1px solid #0006;
}
.blocking .bar { outline: 2px solid var(--block); }
.fill { height: 100%; transform-origin: left; transition: transform 0.25s ease; }
/* The creature's health: a tall red bar with its values inside (like the Will bar), so red stays
   the colour of health, not of Strikes. */
.healthbar:not(.grit) .bar { height: 32px; border-radius: 12px; background: #3a1512; }
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
.grit .bar { background: #3a2716; }
/* Hold: a light water-blue wash over the whole Grit bar, on top of its outline. */
.grit.blocking .bar { background: color-mix(in srgb, #3a2716 70%, var(--block)); }
.grit .fill { background: var(--grit); }
.grit.blocking .fill { background: color-mix(in srgb, var(--grit) 55%, var(--block)); }
.block {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--block);
  color: #0d1a26;
  font-weight: 800;
  font-size: 0.8rem;
}
</style>
