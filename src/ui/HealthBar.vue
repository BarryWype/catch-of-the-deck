<script setup lang="ts">
import { computed } from 'vue';
import { t, term } from './i18n';

/** `grit`: the player's bar, named and coloured as Grit (`terms.grit` in the language files). */
const props = defineProps<{ hp: number; maxHp: number; block: number; grit?: boolean }>();
const percent = computed(() => (props.maxHp > 0 ? (100 * props.hp) / props.maxHp : 0));
</script>

<template>
  <div v-tip="t(grit ? 'bars.gritTip' : 'bars.healthTip')" class="healthbar" :class="{ blocking: block > 0, grit }">
    <!-- The label sits above the bar: the bright fill behind in-bar text wouldn't pass contrast. -->
    <span class="label">
      <template v-if="grit">{{ term('grit') }}&nbsp;</template>{{ grit ? `${hp} / ${maxHp}` : t('bars.health', { hp, maxHp }) }}
    </span>
    <div class="row">
      <span v-if="block > 0" v-tip="grit ? `${block} ${term('hold')}` : t('bars.block', { n: block })" class="block">🛡️{{ block }}</span>
      <div class="bar">
        <div class="fill" :style="{ transform: `scaleX(${percent / 100})` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* As wide as the block it sits in (a creature's, or the player's corner panel). */
.healthbar { display: flex; flex-direction: column; gap: 2px; width: 100%; }
.label { font-size: 0.72rem; font-weight: 700; color: var(--text); white-space: nowrap; }
.row { display: flex; align-items: center; gap: 6px; }
/* The creature's health is green, so red stays the colour of Strikes. */
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
.fill { height: 100%; background: #5cb85c; transform-origin: left; transition: transform 0.25s ease; }
.blocking .fill { background: color-mix(in srgb, #5cb85c 55%, var(--block)); }
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
