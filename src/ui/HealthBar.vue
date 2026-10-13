<script setup lang="ts">
import { computed } from 'vue';
import { PLAYER_BLOCK_NAME, PLAYER_HP_NAME } from '../engine';

/** `grit`: the player's bar, named and coloured as Grit (`PLAYER_HP_NAME`). */
const props = defineProps<{ hp: number; maxHp: number; block: number; grit?: boolean }>();
const percent = computed(() => (props.maxHp > 0 ? (100 * props.hp) / props.maxHp : 0));
</script>

<template>
  <div class="healthbar" :class="{ blocking: block > 0, grit }">
    <span v-if="block > 0" class="block" :title="`${block} ${grit ? PLAYER_BLOCK_NAME : 'Block'}`">{{ grit ? '✊' : '🛡️' }}{{ block }}</span>
    <div class="bar">
      <div class="fill" :style="{ transform: `scaleX(${percent / 100})` }" />
      <span class="label"><template v-if="grit">{{ PLAYER_HP_NAME }}&nbsp;</template>{{ hp }} / {{ maxHp }}</span>
    </div>
  </div>
</template>

<style scoped>
.healthbar { display: flex; align-items: center; gap: 6px; width: 170px; }
.bar {
  position: relative;
  flex: 1;
  height: 16px;
  border-radius: 8px;
  background: #3a1d22;
  overflow: hidden;
  border: 1px solid #0006;
}
.blocking .bar { outline: 2px solid var(--block); }
.fill { height: 100%; background: var(--hp); transform-origin: left; transition: transform 0.25s ease; }
.blocking .fill { background: color-mix(in srgb, var(--hp) 55%, var(--block)); }
.grit .bar { background: #3a2716; }
.grit .fill { background: var(--grit); }
.grit.blocking .fill { background: color-mix(in srgb, var(--grit) 55%, var(--block)); }
.label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  text-shadow: 0 1px 2px #000;
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
